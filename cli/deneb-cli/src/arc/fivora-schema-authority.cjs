'use strict';

/**
 * FivoraSchemaAuthority (P5 & P5.1)
 * 
 * Centralized authority for all Fivora editorSchema generation and validation.
 * Enforces:
 * 1. Strict platform type whitelist (never emit 'currency', 'custom', 'object' as leaf, etc.)
 * 2. Automatic semantic type coercion to supported platform primitives
 * 3. Global canonical path uniqueness across all sections (prevents duplicate path violations)
 * 4. Safe section and list schema structures
 */

const PLATFORM_ALLOWED_TYPES = new Set([
  'text',
  'textarea',
  'email',
  'tel',
  'url',
  'image',
  'number',
  'boolean',
  'select',
  'color',
]);

const TYPE_COERCION_MAP = {
  currency: 'text',
  price: 'number',
  richtext: 'textarea',
  phone: 'tel',
  link: 'url',
  href: 'url',
  percentage: 'number',
  int: 'number',
  float: 'number',
  bool: 'boolean',
  img: 'image',
  icon: 'image',
};

/**
 * Coerces an arbitrary or semantic type into an allowed Fivora primitive type.
 * @param {string} rawType
 * @param {string} [fieldKey]
 * @returns {string} Allowed Fivora type
 */
function normalizeFieldType(rawType, fieldKey = '') {
  if (!rawType || typeof rawType !== 'string') return 'text';
  const lower = rawType.toLowerCase().trim();

  if (PLATFORM_ALLOWED_TYPES.has(lower)) {
    return lower;
  }

  if (TYPE_COERCION_MAP[lower]) {
    return TYPE_COERCION_MAP[lower];
  }

  // Heuristic from fieldKey
  const keyLower = fieldKey.toLowerCase();
  if (keyLower.endsWith('url') || keyLower.endsWith('link') || keyLower.endsWith('href')) {
    return 'url';
  }
  if (keyLower.endsWith('image') || keyLower.endsWith('img') || keyLower.endsWith('logo') || keyLower.endsWith('avatar')) {
    return 'image';
  }
  if (keyLower.endsWith('email')) {
    return 'email';
  }
  if (keyLower.endsWith('phone') || keyLower.endsWith('tel')) {
    return 'tel';
  }
  if (keyLower.endsWith('description') || keyLower.endsWith('summary') || keyLower.endsWith('bio') || keyLower.endsWith('body')) {
    return 'textarea';
  }
  if (keyLower.startsWith('is') || keyLower.startsWith('has') || keyLower.startsWith('enable') || keyLower.endsWith('enabled')) {
    return 'boolean';
  }

  return 'text';
}

class CanonicalPathRegistry {
  constructor() {
    this.paths = new Map(); // canonicalPath -> { sectionId, fieldType, key, label }
  }

  register(canonicalPath, sectionId, fieldType, metadata = {}) {
    const normalized = canonicalPath.replace(/\[\d+\]/g, '[*]').trim();
    if (!this.paths.has(normalized)) {
      this.paths.set(normalized, {
        canonicalPath: normalized,
        ownerSection: sectionId,
        fieldType: normalizeFieldType(fieldType, metadata.key),
        key: metadata.key,
        label: metadata.label,
      });
      return { registered: true, isDuplicate: false, owner: sectionId };
    }
    const existing = this.paths.get(normalized);
    return {
      registered: false,
      isDuplicate: true,
      owner: existing.ownerSection,
    };
  }

  has(canonicalPath) {
    const normalized = canonicalPath.replace(/\[\d+\]/g, '[*]').trim();
    return this.paths.has(normalized);
  }

  get(canonicalPath) {
    const normalized = canonicalPath.replace(/\[\d+\]/g, '[*]').trim();
    return this.paths.get(normalized);
  }
}

/**
 * Sanitizes and deduplicates an editorSchema sections array before writing manifest.
 * Guarantees zero duplicate leaf paths across sections and zero invalid types.
 * 
 * @param {Array} sections Array of editorSchema section objects
 * @returns {Array} Sanitized sections
 */
function sanitizeEditorSections(sections) {
  if (!Array.isArray(sections)) return [];
  const registry = new CanonicalPathRegistry();
  const sanitizedSections = [];

  function sanitizeField(field, basePath, sectionId) {
    if (!field || typeof field !== 'object') return null;
    const currentPath = basePath ? `${basePath}.${field.key}` : field.key;

    if (field.type === 'object') {
      const cleanSubFields = [];
      for (const sub of field.fields || []) {
        const clean = sanitizeField(sub, currentPath, sectionId);
        if (clean) cleanSubFields.push(clean);
      }
      return {
        ...field,
        fields: cleanSubFields,
      };
    }

    if (field.type === 'list') {
      const itemPath = `${currentPath}[*]`;
      const reg = registry.register(currentPath, sectionId, 'list', { key: field.key, label: field.label });
      if (reg.isDuplicate) {
        return null; // Duplicate list path
      }
      const cleanSubFields = [];
      for (const sub of field.fields || []) {
        const clean = sanitizeField(sub, itemPath, sectionId);
        if (clean) cleanSubFields.push(clean);
      }
      return {
        ...field,
        fields: cleanSubFields,
      };
    }

    // Leaf field
    const safeType = normalizeFieldType(field.type, field.key);
    const reg = registry.register(currentPath, sectionId, safeType, { key: field.key, label: field.label });
    if (reg.isDuplicate) {
      return null; // Deduplicate: already declared in another section or earlier in this section
    }

    return {
      ...field,
      type: safeType,
    };
  }

  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const sectionPath = section.path || section.id;
    const cleanFields = [];

    for (const field of section.fields || []) {
      const clean = sanitizeField(field, sectionPath, section.id);
      if (clean) cleanFields.push(clean);
    }

    sanitizedSections.push({
      ...section,
      fields: cleanFields,
    });
  }

  return sanitizedSections;
}

module.exports = {
  PLATFORM_ALLOWED_TYPES,
  TYPE_COERCION_MAP,
  normalizeFieldType,
  CanonicalPathRegistry,
  sanitizeEditorSections,
};

'use strict';

const PLATFORM_CONTRACT = require('../platform/platform-contract.json');


/**
 * Faithful port of the Fivora strict visual-editing contract rules that the
 * platform ingest pipeline applies (backend/src/common/template-visual-edit-contract.ts).
 *
 * ARC self-validates against these rules so a converted project is rejected
 * locally rather than at upload time.
 */

const recast = require('recast');
const { parseSource, getJsxName, hasJsxAttribute, collectJsxText } = require('./ast.cjs');

const MARKER_ATTRIBUTE_TO_KIND = {
  'data-preview-field-path': 'field',
  'data-preview-list-path': 'list',
  'data-preview-item-path': 'item',
  'data-preview-page-key': 'page',
};

const MARKER_ATTRIBUTE_PATTERN =
  /\b(data-preview-(?:field-path|list-path|item-path|page-key))\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([\s\S]*?)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;

const MARKER_ATTRIBUTE_OCCURRENCE_PATTERN =
  /\b(data-preview-(?:field-path|list-path|item-path|page-key))\s*=/g;

const PATH_SEGMENT_PATTERN = String.raw`[^.[\]\s]+`;
const CANONICAL_PATH_PATTERN = new RegExp(
  String.raw`^${PATH_SEGMENT_PATTERN}(?:\[(?:\d+|\*)\])*(?:\.${PATH_SEGMENT_PATTERN}(?:\[(?:\d+|\*)\])*)*$`
);

// Mirrors BROAD_CONTENT_CONTAINERS in the platform contract.
const BROAD_CONTENT_CONTAINERS = new Set([
  'html', 'body', 'main', 'header', 'footer', 'nav', 'section', 'article',
  'aside', 'form', 'div', 'ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'tr',
]);

const PRIMITIVE_TYPES = new Set([
  'text', 'textarea', 'email', 'tel', 'url', 'image', 'number', 'boolean', 'select',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendPath(basePath, key) {
  return basePath ? `${basePath}.${key}` : key;
}

function wildcardPath(path) {
  return String(path).replace(/\[\d+\]/g, '[*]');
}

function canonicalizeMarkerPath(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\[\s*\$\{[^}]+\}\s*\]/g, '[*]')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']');
  return CANONICAL_PATH_PATTERN.test(normalized) ? normalized : null;
}

function pathsOverlap(left, right) {
  return wildcardPath(left) === wildcardPath(right);
}

function isPlatformControlled(path) {
  return (PLATFORM_CONTRACT.platformControlledPaths || []).some((platformPath) =>
    platformPath.includes('[*]') ? wildcardPath(path) === platformPath : path === platformPath
  );
}

function isControlOnly(path, controlOnlyPaths) {
  if (isPlatformControlled(path)) return true;
  return (controlOnlyPaths || []).some((controlPath) =>
    controlPath.includes('[*]') ? wildcardPath(path) === controlPath : path === controlPath
  );
}

/** Port of walkContentValue: derives every editable path implied by site-data content. */
function enumerateContentPaths(content) {
  const inventory = {
    fieldPatterns: new Set(),
    concreteFields: new Set(),
    listPatterns: new Set(),
    concreteLists: new Set(),
    itemPatterns: new Set(),
    concreteItems: new Set(),
  };

  function walk(value, path) {
    if (Array.isArray(value)) {
      const listPattern = wildcardPath(path);
      inventory.listPatterns.add(listPattern);
      inventory.concreteLists.add(path);
      inventory.itemPatterns.add(`${listPattern}[*]`);
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        inventory.concreteItems.add(itemPath);
        if (Array.isArray(item) || isPlainObject(item)) {
          walk(item, itemPath);
        } else {
          inventory.fieldPatterns.add(wildcardPath(itemPath));
          inventory.concreteFields.add(itemPath);
        }
      });
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(child, appendPath(path, key));
      }
      return;
    }
    inventory.fieldPatterns.add(wildcardPath(path));
    inventory.concreteFields.add(path);
  }

  if (isPlainObject(content)) {
    for (const [key, value] of Object.entries(content)) {
      walk(value, key);
    }
  }

  return inventory;
}

/** Port of walkSchemaNode: derives editable paths implied by editorSchema. */
function enumerateSchemaPaths(editorSchema) {
  const fieldPatterns = new Set();
  const listPatterns = new Set();
  const itemPatterns = new Set();

  function walk(path, node) {
    if (!node) return;
    if (node.type === 'object') {
      for (const field of node.fields || []) {
        walk(appendPath(path, field.key), field);
      }
      return;
    }
    if (node.type === 'list') {
      const listPattern = wildcardPath(path);
      const itemPattern = `${listPattern}[*]`;
      listPatterns.add(listPattern);
      itemPatterns.add(itemPattern);
      if (node.itemField) fieldPatterns.add(itemPattern);
      for (const field of node.fields || []) {
        walk(appendPath(itemPattern, field.key), field);
      }
      return;
    }
    fieldPatterns.add(wildcardPath(path));
  }

  for (const section of editorSchema?.sections || []) {
    walk(section.path, section);
  }

  return { fieldPatterns, listPatterns, itemPatterns };
}

/** Port of extractTemplateVisualEditMarkers for a single artifact. */
function extractMarkers(code, filePath = '') {
  const markers = [];
  const unparseable = [];
  const parsedOffsets = new Set();

  MARKER_ATTRIBUTE_PATTERN.lastIndex = 0;
  for (const match of String(code).matchAll(MARKER_ATTRIBUTE_PATTERN)) {
    const attributeName = match[1];
    const rawValue = match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? '';
    const offset = match.index ?? 0;
    parsedOffsets.add(offset);
    markers.push({
      kind: MARKER_ATTRIBUTE_TO_KIND[attributeName],
      value: String(rawValue).trim(),
      filePath,
      offset,
      line: lineNumberAt(code, offset),
    });
  }

  MARKER_ATTRIBUTE_OCCURRENCE_PATTERN.lastIndex = 0;
  for (const match of String(code).matchAll(MARKER_ATTRIBUTE_OCCURRENCE_PATTERN)) {
    const offset = match.index ?? 0;
    if (!parsedOffsets.has(offset)) {
      unparseable.push(
        `${filePath}:${lineNumberAt(code, offset)} ${match[1]} must use a literal string or a JSX template literal.`
      );
    }
  }

  return { markers, unparseable };
}

function lineNumberAt(content, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

/**
 * Scans JSX source for marker placement violations that the platform detects in
 * exported HTML. Source scanning cannot see the final DOM, but a violation in
 * source deterministically produces the same violation in the export.
 */
function auditMarkerPlacement(code, filePath) {
  const errors = [];
  const tagPattern = /<\s*([a-zA-Z][a-zA-Z0-9.:-]*)((?:[^<>{}]|\{[^{}]*\})*?)(\/?)>/g;

  for (const match of String(code).matchAll(tagPattern)) {
    const tag = match[1];
    const attrs = match[2] || '';
    const offset = match.index ?? 0;
    const line = lineNumberAt(code, offset);
    const lowerTag = tag.toLowerCase();

    const hasField = /\bdata-preview-field-path\s*=/.test(attrs);
    const hasList = /\bdata-preview-list-path\s*=/.test(attrs);
    const hasItem = /\bdata-preview-item-path\s*=/.test(attrs);
    const staticMatch = attrs.match(/\bdata-preview-static\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    const hasStatic = /\bdata-preview-static\b/.test(attrs);

    const isHidden =
      /\bhidden(?:[\s=]|\/?>)/i.test(attrs) ||
      /\baria-hidden\s*=\s*(?:"true"|'true'|\{\s*true\s*\})/i.test(attrs) ||
      /\bstyle\s*=\s*\{\s*\{[\s\S]*?\b(?:display\s*:\s*['"]none['"]|visibility\s*:\s*['"]hidden['"])[\s\S]*?\}\s*\}/i.test(attrs) ||
      /\bclassName\s*=\s*(?:"[^"]*\bhidden\b[^"]*"|'[^']*\bhidden\b[^']*'|\{\s*`[^`]*\bhidden\b[^`]*`\s*\})/i.test(attrs);

    if ((hasField || hasList || hasItem) && isHidden) {
      errors.push(
        `${filePath}:${line} data-preview field/list/item marker is hidden. Strict visual-edit targets must remain visible and clickable in the exported page.`
      );
    }
    if (hasStatic && !(staticMatch?.[1] ?? staticMatch?.[2] ?? '').trim()) {
      errors.push(`${filePath}:${line} data-preview-static requires a reason.`);
    }
    if ((hasField || hasList || hasItem) && hasStatic) {
      errors.push(
        `${filePath}:${line} data-preview field/list/item markers cannot share an element with data-preview-static.`
      );
    }
    if (hasField && BROAD_CONTENT_CONTAINERS.has(lowerTag)) {
      errors.push(
        `${filePath}:${line} data-preview-field-path cannot be placed on broad <${lowerTag}> content containers.`
      );
    }
    if (hasStatic && BROAD_CONTENT_CONTAINERS.has(lowerTag)) {
      errors.push(
        `${filePath}:${line} data-preview-static cannot cover a broad <${lowerTag}> content container.`
      );
    }
  }

  errors.push(...auditCoupledListMarkers(code, filePath));
  return errors;
}

/**
 * Detects coupling parallel arrays by index: rendering a field from list B inside an item belonging to list A.
 */
function auditCoupledListMarkers(code, filePath) {
  const errors = [];
  const itemBlockPattern = /<\s*([a-zA-Z][a-zA-Z0-9.:-]*)((?:[^<>{}]|\{[^{}]*\})*?)\bdata-preview-item-path\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})([\s\S]*?)<\/\1>/g;
  for (const match of String(code).matchAll(itemBlockPattern)) {
    const itemPath = match[3] ?? match[4] ?? match[5] ?? '';
    const inner = match[6] || '';
    if (!itemPath) continue;
    const baseList = itemPath.replace(/\[[^\]]*\]$/, '');

    for (const fieldMatch of inner.matchAll(/\bdata-preview-field-path\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g)) {
      const fieldPath = fieldMatch[1] ?? fieldMatch[2] ?? fieldMatch[3] ?? '';
      if (!fieldPath || !/\[\d+\]/.test(fieldPath)) continue;
      const fieldList = fieldPath.replace(/\[\d+\][\s\S]*$/, '');
      if (fieldList && baseList && fieldList !== baseList) {
        errors.push(
          `${filePath}:${lineNumberAt(code, match.index ?? 0)} repeated field "${fieldPath}" is rendered inside item "${itemPath}" but belongs to a different list. Model one visual card as one object-list item instead of coupling parallel arrays by index.`
        );
      }
    }
  }
  return errors;
}

/**
 * Detects the action/label collision the platform rejects: one element owning
 * both an href/src action contract and different visible text.
 */
function auditActionLabelCollision(code, filePath) {
  const errors = [];
  const anchorPattern = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;

  for (const match of String(code).matchAll(anchorPattern)) {
    const attrs = match[1] || '';
    const inner = match[2] || '';
    if (!/\bdata-preview-field-path\s*=/.test(attrs)) continue;
    if (/\bdata-preview-field-path\s*=/.test(inner)) continue;

    const visibleText = inner
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{[^{}]*\}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (visibleText.length > 2 && /\p{L}/u.test(visibleText)) {
      errors.push(
        `${filePath}:${lineNumberAt(code, match.index ?? 0)} data-preview-field-path covers both the <a> action and visible text "${visibleText.slice(0, 48)}". Move the label marker to a nested element.`
      );
    }
  }

  return errors;
}

/**
 * Validates that every editable path implied by site-data/editorSchema is
 * actually rendered somewhere in source (or declared control-only).
 * This is the check that most commonly rejects auto-converted templates.
 */
function auditPathCoverage({ content, editorSchema, markers, controlOnlyPaths }) {
  const errors = [];
  const contentInventory = enumerateContentPaths(content);
  const schemaInventory = enumerateSchemaPaths(editorSchema);

  const fieldMarkers = new Set();
  const listMarkers = new Set();
  const itemMarkers = new Set();
  const pageMarkers = new Set();

  for (const marker of markers) {
    const canonical = canonicalizeMarkerPath(marker.value);
    if (marker.kind === 'page') {
      pageMarkers.add(String(marker.value).trim());
      continue;
    }
    if (!canonical) {
      errors.push(
        `${marker.filePath}:${marker.line} has invalid data-preview-${marker.kind}-path "${marker.value}".`
      );
      continue;
    }
    if (marker.kind === 'field') fieldMarkers.add(canonical);
    if (marker.kind === 'list') listMarkers.add(canonical);
    if (marker.kind === 'item') itemMarkers.add(canonical);
  }

  const covers = (markerSet, path) =>
    markerSet.has(path) || [...markerSet].some((marker) => pathsOverlap(marker, path));

  for (const path of contentInventory.concreteFields) {
    if (isControlOnly(path, controlOnlyPaths)) continue;
    if (covers(fieldMarkers, path)) continue;
    errors.push(
      `site-data content field "${path}" has no data-preview-field-path in source. Bind it, remove it, or declare it in visualEditing.controlOnlyPaths.`
    );
  }

  for (const path of contentInventory.concreteLists) {
    if (isControlOnly(path, controlOnlyPaths)) continue;
    if (covers(listMarkers, path)) continue;
    errors.push(
      `site-data content list "${path}" has no data-preview-list-path in source.`
    );
  }

  for (const path of contentInventory.concreteItems) {
    if (isControlOnly(path, controlOnlyPaths)) continue;
    if (covers(itemMarkers, path)) continue;
    errors.push(
      `site-data content list item "${path}" has no data-preview-item-path in source.`
    );
  }

  const knownFieldPaths = [
    ...contentInventory.fieldPatterns,
    ...contentInventory.concreteFields,
    ...schemaInventory.fieldPatterns,
  ];
  for (const marker of fieldMarkers) {
    if (!knownFieldPaths.some((known) => pathsOverlap(marker, known))) {
      errors.push(`data-preview-field-path references unknown path "${marker}".`);
    }
  }

  const knownListPaths = [
    ...contentInventory.listPatterns,
    ...contentInventory.concreteLists,
    ...schemaInventory.listPatterns,
  ];
  for (const marker of listMarkers) {
    if (!knownListPaths.some((known) => pathsOverlap(marker, known))) {
      errors.push(`data-preview-list-path references unknown path "${marker}".`);
    }
  }

  return { errors, contentInventory, schemaInventory, fieldMarkers, listMarkers, itemMarkers, pageMarkers };
}

/** Ports validateSchemaPathUniqueness / section uniqueness. */
function auditSchemaUniqueness(editorSchema) {
  const errors = [];
  const seenIds = new Set();
  const seenSectionPaths = new Set();
  const seenLeafPaths = new Map();

  for (const section of editorSchema?.sections || []) {
    if (seenIds.has(section.id)) {
      errors.push(`editorSchema.sections contains duplicate id "${section.id}".`);
    }
    if (seenSectionPaths.has(section.path)) {
      errors.push(`editorSchema.sections contains duplicate path "${section.path}".`);
    }
    seenIds.add(section.id);
    seenSectionPaths.add(section.path);

    walkLeaves(section.path, section, section.id);
  }

  function walkLeaves(path, node, sectionId) {
    if (!node) return;
    if (node.type === 'object') {
      for (const field of node.fields || []) walkLeaves(appendPath(path, field.key), field, sectionId);
      return;
    }
    if (node.type === 'list') {
      const itemPath = `${wildcardPath(path)}[*]`;
      registerLeaf(wildcardPath(path), sectionId, 'list');
      for (const field of node.fields || []) walkLeaves(appendPath(itemPath, field.key), field, sectionId);
      return;
    }
    if (!PRIMITIVE_TYPES.has(node.type)) {
      errors.push(`editorSchema path "${path}" declares unsupported type "${node.type}".`);
      return;
    }
    registerLeaf(wildcardPath(path), sectionId, 'field');
  }

  function registerLeaf(path, sectionId, kind) {
    const previous = seenLeafPaths.get(path);
    if (previous) {
      errors.push(
        `editorSchema declares duplicate editable ${kind} path "${path}" in sections "${previous.sectionId}" and "${sectionId}".`
      );
      return;
    }
    seenLeafPaths.set(path, { sectionId, kind });
  }

  return errors;
}

/** Ports validatePageCoverage against on-disk routes instead of exported HTML. */
function auditPageCoverage({ pages, routeFiles, pageMarkersByFile }) {
  const errors = [];
  const seenIds = new Set();
  const seenRoutes = new Map();

  if (!pages || pages.length === 0) {
    errors.push('Strict visual editing requires at least one manifest pages[] entry.');
    return errors;
  }

  for (const page of pages) {
    if (seenIds.has(page.id)) {
      errors.push(`Manifest pages[] contains duplicate id "${page.id}".`);
    }
    seenIds.add(page.id);

    const route = normalizePageRoute(page.route);
    if (!route) {
      errors.push(`Manifest page "${page.id}" must declare a canonical route.`);
      continue;
    }
    const duplicate = seenRoutes.get(route);
    if (duplicate) {
      errors.push(`Manifest pages "${duplicate}" and "${page.id}" use duplicate route "${route}".`);
    } else {
      seenRoutes.set(route, page.id);
    }

    const sourceFile = routeFiles[page.id];
    if (!sourceFile) {
      errors.push(
        `Manifest page "${page.id}" route "${route}" has no page file on disk, so the export cannot contain it.`
      );
      continue;
    }
    const keys = pageMarkersByFile[sourceFile] || [];
    if (!keys.includes(page.id)) {
      errors.push(`Route "${route}" (${sourceFile}) is missing data-preview-page-key="${page.id}".`);
    }
  }

  return errors;
}

function normalizePageRoute(route) {
  if (!route) return null;
  const trimmed = String(route).trim();
  if (!trimmed.startsWith('/') || trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('..')) {
    return null;
  }
  return trimmed === '/' ? trimmed : trimmed.replace(/\/+$/, '');
}

/** Ports validatePreviewRuntimeCapability's package-provider fast path. */
function auditPreviewRuntime(sources) {
  const joined = sources.join('\n');
  const usesPackageProvider =
    /(?:import|export)\s+[\s\S]*?\b(?:SiteDataProvider|BaseSiteDataProvider|useSiteData|DenebProvider|DenebSiteDataProvider|DenebUiProvider)\b[\s\S]*?\bfrom\s+['"][^'"]*['"]/m.test(joined) ||
    /(?:import|export)\s+[\s\S]*?\bfrom\s+['"](?:@fivora\/|deneb-ui|@deneb-ui\/)/m.test(joined) ||
    /<(?:SiteDataProvider|BaseSiteDataProvider|DenebProvider|DenebSiteDataProvider|DenebUiProvider)\b/m.test(joined);

  return usesPackageProvider
    ? []
    : [
        'Preview runtime is not certifiable: no @deneb-ui/ui SiteDataProvider/useSiteData usage was found. Mount SiteDataProvider in the root layout.',
      ];
}

/**
 * Finds meaningful visible JSX text that is neither bound to a field nor marked
 * static. Strict mode treats these as errors in the exported HTML.
 * Prefers an AST walk so TypeScript generics and nested tags are not misread.
 */
function findUncoveredVisibleText(code, filePath) {
  let ast;
  try {
    ast = parseSource(code, filePath);
  } catch {
    return findUncoveredVisibleTextRegex(code, filePath);
  }

  const findings = [];
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const tag = getJsxName(node);
      const lower = String(tag || '').toLowerCase();
      if (!tag || lower === 'option' || lower === 'script' || lower === 'style') {
        this.traverse(pathNode);
        return;
      }
      if (
        hasJsxAttribute(node, 'data-preview-field-path') ||
        hasJsxAttribute(node, 'data-preview-static')
      ) {
        this.traverse(pathNode);
        return;
      }
      if (ancestorHasStaticMarker(pathNode)) {
        this.traverse(pathNode);
        return;
      }
      const text = collectJsxText(node);
      if (isMeaningfulUncoveredText(text)) {
        findings.push({
          tag,
          text,
          filePath,
          line: node.loc?.start?.line || 1,
        });
      }
      this.traverse(pathNode);
    },
  });
  return findings;
}

function ancestorHasStaticMarker(pathNode) {
  let current = pathNode.parent;
  while (current) {
    const node = current.node || current.value;
    if (node && node.type === 'JSXElement' && hasJsxAttribute(node, 'data-preview-static')) return true;
    current = current.parentPath || current.parent;
  }
  return false;
}

function isMeaningfulUncoveredText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length <= 2 || !/\p{L}/u.test(value)) return false;
  if (!/^[\p{L}\p{N}"'(¡¿#$€£]/u.test(value)) return false;
  if (/^(?:true|false|null|undefined)$/i.test(value)) return false;
  return true;
}

function findUncoveredVisibleTextRegex(code, filePath) {
  const findings = [];
  const source = String(code);
  const elementPattern = /<\s*([a-zA-Z][a-zA-Z0-9.:-]*)((?:[^<>{}]|\{[^{}]*\})*?)>([^<>{}]*)</g;

  for (const match of source.matchAll(elementPattern)) {
    const tag = match[1];
    const attrs = match[2] || '';
    const text = (match[3] || '').replace(/\s+/g, ' ').trim();
    const offset = match.index ?? 0;

    if (/[\w$)\]]/.test(source[offset - 1] || '')) continue;
    if (tag.toLowerCase() === 'option') continue;
    if (!isMeaningfulUncoveredText(text)) continue;
    if (/\bdata-preview-(?:field-path|static)\b/.test(attrs)) continue;

    findings.push({ tag, text, filePath, line: lineNumberAt(source, offset) });
  }

  return findings;
}

function auditEmptyStateSource(code, filePath) {
  const errors = [];
  const source = String(code);
  const andPattern =
    /\{([^{}]{0,120}?)\s*&&\s*\(?\s*<\s*([a-zA-Z][\w.:-]*)([^>]*data-preview-(?:field-path|list-path|item-path)[^>]*)>/g;
  for (const match of source.matchAll(andPattern)) {
    errors.push(
      `${filePath}:${lineNumberAt(source, match.index ?? 0)} editable marker is gated behind "${String(match[1]).trim()} &&". Keep the target mounted when its value is empty, false, or zero.`
    );
  }
  const ternaryPattern =
    /\{([^{}]{0,80}?)\s*\?\s*<\s*([a-zA-Z][\w.:-]*)([^>]*data-preview-(?:field-path|list-path|item-path)[^>]*)>[\s\S]{0,200}?\?\s*(?:null|false|undefined)/g;
  for (const match of source.matchAll(ternaryPattern)) {
    errors.push(
      `${filePath}:${lineNumberAt(source, match.index ?? 0)} editable marker unmounts on a falsy ternary. Keep the target mounted when its value is empty.`
    );
  }
  return errors;
}

function auditSelectOptions(editorSchema, pages = []) {
  const errors = [];
  const declaredPageIds = new Set((pages || []).map((page) => page?.id).filter(Boolean));

  function checkSelect(path, options) {
    if (!Array.isArray(options) || !options.some((option) => typeof option === 'string' && option.trim())) {
      errors.push(
        `editorSchema select field "${path}" must declare at least one non-empty option for strict visual editing.`
      );
      return;
    }
    if (!declaredPageIds.size) return;
    if (!/(?:destination|action|targetpage|buttonaction|pagekey)/i.test(path)) return;
    for (const option of options) {
      const opt = typeof option === 'string' ? option.trim() : '';
      if (opt && opt !== 'none' && opt !== 'external' && !declaredPageIds.has(opt)) {
        errors.push(
          `editorSchema select field "${path}" declares destination option "${opt}" which is not in fivora-template.json pages[].`
        );
      }
    }
  }

  function walk(path, node) {
    if (!node) return;
    if (node.type === 'select') {
      checkSelect(path, node.options);
      return;
    }
    if (node.type === 'object') {
      for (const field of node.fields || []) walk(appendPath(path, field.key), field);
      return;
    }
    if (node.type !== 'list') return;
    const itemPath = `${wildcardPath(path)}[*]`;
    if (node.itemField?.type === 'select') checkSelect(itemPath, node.itemField.options);
    for (const field of node.fields || []) walk(appendPath(itemPath, field.key), field);
  }

  for (const section of editorSchema?.sections || []) walk(section.path, section);
  return errors;
}

function auditListBounds(editorSchema, content) {
  const errors = [];

  function validBound(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  function readValue(path) {
    let value = content || {};
    for (const part of String(path).split('.')) {
      if (!part || !isPlainObject(value)) return undefined;
      value = value[part];
    }
    return value;
  }

  function walkSchema(path, node) {
    if (!node) return;
    if (node.type === 'object') {
      for (const field of node.fields || []) walkSchema(appendPath(path, field.key), field);
      return;
    }
    if (node.type !== 'list') return;
    const minItems = validBound(node.minItems);
    const maxItems = validBound(node.maxItems);
    if (node.minItems !== undefined && minItems === null) {
      errors.push(`editorSchema list "${path}" minItems must be a non-negative safe integer.`);
    }
    if (node.maxItems !== undefined && maxItems === null) {
      errors.push(`editorSchema list "${path}" maxItems must be a non-negative safe integer.`);
    }
    const effectiveMinimum = minItems ?? (node.required ? 1 : 0);
    if (maxItems !== null && effectiveMinimum > maxItems) {
      errors.push(
        `editorSchema list "${path}" requires at least ${effectiveMinimum} item(s) but maxItems is ${maxItems}.`
      );
    }
    const items = Array.isArray(readValue(path)) ? readValue(path) : [];
    if (maxItems !== null && items.length > maxItems) {
      errors.push(
        `site-data.json content list "${path}" contains ${items.length} items, exceeding editorSchema maxItems ${maxItems}.`
      );
    }
    const itemPath = `${wildcardPath(path)}[*]`;
    for (const field of node.fields || []) walkSchema(appendPath(itemPath, field.key), field);
  }

  for (const section of editorSchema?.sections || []) walkSchema(section.path, section);
  return errors;
}

function auditStaticMarkerAuthorship(code, filePath) {
  if (!/\.[cm]?[jt]s$/i.test(filePath) || /\.(tsx|jsx)$/i.test(filePath)) return [];
  const mutation =
    /\b(?:setAttribute|setAttributeNS|toggleAttribute)\s*\(\s*['"`]data-preview-static['"`]/.exec(code) ||
    /\b(?:writeFile|writeFileSync)\s*\([\s\S]{0,200}data-preview-static/.exec(code);
  if (!mutation) return [];
  return [
    `${filePath}:${lineNumberAt(code, mutation.index || 0)} programmatically injects data-preview-static. Author each intentional static annotation directly on the smallest source element.`,
  ];
}

function auditRouteOwnedMarkerCoverage({ editorSchema, pages, markers, controlOnlyPaths }) {
  const errors = [];
  const pagesById = new Map((pages || []).map((page) => [page.id, page]));
  const sections = (editorSchema?.sections || [])
    .map((section) => ({ section, canonicalPath: canonicalizeMarkerPath(section.path) }))
    .filter((entry) => entry.canonicalPath);

  for (const marker of markers || []) {
    if (marker.kind === 'page' || marker.kind === 'item') continue;
    const canonical = canonicalizeMarkerPath(marker.value);
    if (!canonical) continue;
    if (marker.kind === 'field' && isControlOnly(canonical, controlOnlyPaths)) continue;
    const owner = sections
      .filter((entry) => {
        const sectionPath = wildcardPath(entry.canonicalPath);
        const markerPath = wildcardPath(canonical);
        return markerPath === sectionPath || markerPath.startsWith(`${sectionPath}.`) || markerPath.startsWith(`${sectionPath}[`);
      })
      .sort((left, right) => right.canonicalPath.length - left.canonicalPath.length)[0];
    if (!owner?.section.pageKey) continue;
    const page = pagesById.get(owner.section.pageKey);
    if (!page) {
      errors.push(
        `editorSchema section "${owner.section.path}" assigns ${marker.kind} "${canonical}" to unknown manifest page "${owner.section.pageKey}".`
      );
    }
  }
  return errors;
}

module.exports = {
  BROAD_CONTENT_CONTAINERS,
  PRIMITIVE_TYPES,
  enumerateContentPaths,
  enumerateSchemaPaths,
  extractMarkers,
  auditMarkerPlacement,
  auditCoupledListMarkers,
  auditActionLabelCollision,
  auditPathCoverage,
  auditSchemaUniqueness,
  auditPageCoverage,
  auditPreviewRuntime,
  auditEmptyStateSource,
  auditSelectOptions,
  auditListBounds,
  auditStaticMarkerAuthorship,
  auditRouteOwnedMarkerCoverage,
  findUncoveredVisibleText,
  canonicalizeMarkerPath,
  wildcardPath,
  isControlOnly,
  normalizePageRoute,
};

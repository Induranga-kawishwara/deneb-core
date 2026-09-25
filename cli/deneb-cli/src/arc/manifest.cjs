'use strict';

const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJson, deepMerge, isPlainObject } = require('./fs-utils.cjs');
const { ARC_VERSION, SCHEMA_VERSION } = require('./version.cjs');
const { collectFontIdsFromSiteData, applyFontTheme } = require('./font-plan.cjs');
const { humanLabel, classifyFieldType } = require('./field-paths.cjs');
const PLATFORM_CONTRACT = require('../platform/platform-contract.json');

const {
  enumerateContentPaths,
  canonicalizeMarkerPath,
  wildcardPath,
} = require('./fivora-contract.cjs');
const { sanitizeEditorSections } = require('./fivora-schema-authority.cjs');

function pruneUnboundLeaves(content, isBound) {
  function walk(node, path) {
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        if (item && typeof item === 'object') walk(item, `${path}[${index}]`);
      });
      return;
    }
    if (!isPlainObject(node)) return;
    for (const key of Object.keys(node)) {
      const next = path ? `${path}.${key}` : key;
      const value = node[key];
      if (Array.isArray(value)) {
        const listBound =
          isBound(next) || isBound(`${next}[0]`) || isBound(`${next}[*]`);
        if (!listBound && !isAllowedControlOnly(next)) {
          delete node[key];
          continue;
        }
        walk(value, next);
        continue;
      }
      if (isPlainObject(value)) {
        walk(value, next);
        if (Object.keys(value).length === 0 && !isBound(next) && !isAllowedControlOnly(next)) {
          delete node[key];
        }
        continue;
      }
      if (!isBound(next) && !isAllowedControlOnly(next)) {
        delete node[key];
      }
    }
  }
  walk(content, '');
}

function setDeep(target, pathStr, value) {
  const parts = String(pathStr).split('.').filter(Boolean);
  let curr = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlainObject(curr[key])) curr[key] = {};
    curr = curr[key];
  }
  const last = parts[parts.length - 1];
  if (curr[last] === undefined) curr[last] = value;
}

function defaultDualModeTheme(existingTheme = {}) {
  const base = {
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    backgroundColor: '#ffffff',
    cardBackgroundColor: '#f8fafc',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    headingFont: 'Outfit, sans-serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '12px',
    dark: {
      primaryColor: '#38bdf8',
      secondaryColor: '#f8fafc',
      accentColor: '#0284c7',
      backgroundColor: '#0b0f19',
      cardBackgroundColor: '#111827',
      textColor: '#f9fafb',
      borderColor: '#1f2937',
    },
  };
  if (isPlainObject(existingTheme)) {
    Object.assign(base, existingTheme);
    if (isPlainObject(existingTheme.dark)) {
      base.dark = { ...base.dark, ...existingTheme.dark };
    }
  }
  return base;
}

function getDeep(target, pathStr) {
  const parts = String(pathStr).split('.').filter(Boolean);
  let curr = target;
  for (const part of parts) {
    if (!curr || typeof curr !== 'object') return undefined;
    curr = curr[part];
  }
  return curr;
}

function upsertSchemaField(sections, fieldPath, fieldType, label, required = false) {
  const parts = String(fieldPath).split('.');
  const sectionId = parts[0];
  const rest = parts.slice(1);
  let section = sections.find((s) => s.id === sectionId || s.path === sectionId);
  if (!section) {
    section = {
      id: sectionId,
      path: sectionId,
      type: 'object',
      label: sectionId === 'common' ? 'Shared Website Content' : `${humanLabel(sectionId)} Content`,
      fields: [],
    };
    sections.push(section);
  }
  if (!section.path) section.path = section.id;

  let fields = section.fields;
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    const isLeaf = i === rest.length - 1;
    let existing = fields.find((f) => f.key === key);
    if (isLeaf) {
      if (!existing) {
        fields.push({
          key,
          type: fieldType === 'url' ? 'url' : fieldType === 'textarea' ? 'textarea' : fieldType === 'phone' ? 'tel' : fieldType,
          label: label || humanLabel(key),
          ...(required ? { required: true } : {}),
        });
      }
      return;
    }
    if (!existing) {
      existing = { key, type: 'object', label: humanLabel(key), fields: [] };
      fields.push(existing);
    }
    existing.fields = existing.fields || [];
    fields = existing.fields;
  }
}

/**
 * Registers a repeated collection as a Fivora `list` node. Only the properties
 * the component actually renders become editable item fields; anything else
 * (ids, internal keys) stays in content but is declared control-only.
 */
function upsertSchemaList(sections, listPath, itemFields, items) {
  const parts = String(listPath).split('.');
  const sectionId = parts[0];
  let section = sections.find((s) => s.id === sectionId || s.path === sectionId);
  if (!section) {
    section = {
      id: sectionId,
      path: sectionId,
      type: 'object',
      label: sectionId === 'common' ? 'Shared Website Content' : `${humanLabel(sectionId)} Content`,
      fields: [],
    };
    sections.push(section);
  }

  let fields = section.fields;
  const rest = parts.slice(1);
  for (let i = 0; i < rest.length - 1; i++) {
    let existing = fields.find((f) => f.key === rest[i]);
    if (!existing) {
      existing = { key: rest[i], type: 'object', label: humanLabel(rest[i]), fields: [] };
      fields.push(existing);
    }
    existing.fields = existing.fields || [];
    fields = existing.fields;
  }

  const key = rest[rest.length - 1];
  if (fields.some((f) => f.key === key)) return;

  const isPrimitiveList = (itemFields || []).length === 0;
  fields.push({
    key,
    type: 'list',
    label: humanLabel(key),
    itemLabel: humanLabel(key).replace(/s$/, '') || 'Item',
    itemType: isPrimitiveList ? 'string' : 'object',
    minItems: 0,
    maxItems: Math.max((items || []).length, 12),
    fields: (itemFields || []).map((field) => ({
      key: field.key,
      type:
        field.type === 'url'
          ? 'url'
          : field.type === 'image'
            ? 'image'
            : field.type === 'textarea'
              ? 'textarea'
              : field.type === 'tel' || field.type === 'phone'
                ? 'tel'
                : field.type === 'email'
                  ? 'email'
                  : field.type || 'text',
      label: humanLabel(field.key),
    })),
  });
}

const LIST_ACTION_CTA_ITEM_FIELDS = [
  { key: 'buttonLabel', type: 'text' },
  { key: 'buttonUrl', type: 'url' },
];

function isListActionCtaKey(key) {
  return /Cta$/i.test(String(key || ''));
}

/**
 * Walks merged site-data content and registers schemas ARC learns from merchant patterns:
 * list CTAs (`*Cta` with buttonLabel/buttonUrl) and paired *Label/*Url siblings.
 */
function enrichSchemasFromContent(content, sections) {
  if (!content || typeof content !== 'object') return;

  function walk(node, prefix) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      const listKey = prefix.split('.').pop() || '';
      if (isListActionCtaKey(listKey)) {
        const sample = node[0];
        if (sample && typeof sample === 'object' && ('buttonLabel' in sample || 'buttonUrl' in sample)) {
          upsertSchemaList(sections, prefix, LIST_ACTION_CTA_ITEM_FIELDS, node);
        }
      }
      node.forEach((item, idx) => {
        if (item && typeof item === 'object') walk(item, `${prefix}[${idx}]`);
      });
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value) && isListActionCtaKey(key)) {
        const sample = value[0];
        if (sample && typeof sample === 'object' && ('buttonLabel' in sample || 'buttonUrl' in sample)) {
          upsertSchemaList(sections, nextPath, LIST_ACTION_CTA_ITEM_FIELDS, value);
        }
      } else if (typeof value === 'string' && /Url$/i.test(key)) {
        upsertSchemaField(sections, nextPath, 'url', humanLabel(key));
        const labelKey = key.replace(/Url$/i, 'Label');
        if (Object.prototype.hasOwnProperty.call(node, labelKey)) {
          upsertSchemaField(sections, `${prefix}.${labelKey}`, 'text', humanLabel(labelKey));
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        walk(value, nextPath);
      }
    }
  }

  walk(content, '');
}

function collectFieldsFromPlan(plan) {
  const fields = [];
  for (const file of plan.files || []) {
    for (const t of file.transformations || []) {
      if (t.field) {
        fields.push({
          path: t.field,
          type: t.fieldType || 'text',
          value: t.fallback,
        });
      }
      if (t.urlField) {
        fields.push({ path: t.urlField, type: 'url', value: t.fallback });
      }
      if (t.labelField) {
        fields.push({ path: t.labelField, type: 'text', value: t.labelFallback });
      }
      if (t.highlightField) {
        fields.push({ path: t.highlightField, type: 'text', value: t.highlightFallback });
      }
      if (t.operation === 'bind-highlighted-heading' && t.field) {
        const highlightFrag = (t.fragments || []).find((f) => f.type === 'span' || f.type === 'format' || f.type === 'inline-format' || f.tag === 'span');
        const highlightVal = highlightFrag ? (highlightFrag.text || 'Highlight') : (t.highlightFallback || 'Highlight');
        fields.push({ path: `${t.field}Highlight`, type: 'text', value: highlightVal });
      }
      if (t.propTransforms) {
        for (const [propName, propInfo] of Object.entries(t.propTransforms)) {
          fields.push({
            path: propInfo.field,
            type: propInfo.type || 'text',
            value: propInfo.fallback,
          });
        }
      }
      if (t.listField) {
        fields.push({
          path: t.listField,
          type: 'list',
          value: t.items || [],
          itemFields: t.itemFields || [],
        });
      }
    }
  }
  return fields;
}

function collectStylesFromPlan(plan, existingStyles) {
  const styles = isPlainObject(existingStyles) ? { ...existingStyles } : {};
  for (const file of plan.files || []) {
    for (const t of file.transformations || []) {
      if (t.operation !== 'style-bind' || !t.stylePath) continue;
      if (t.stylePath.includes('[*]')) continue;
      if (!styles[t.stylePath]) styles[t.stylePath] = {};
    }
  }
  return styles;
}

function baseContent(projectName, routes, projectDir) {
  const navLabels = {};
  for (const page of routes) navLabels[page.id] = page.label || page.id;
  let logoUrl = '';
  if (projectDir) {
    const candidates = ['logo.svg', 'logo.png', 'logo-dark.svg', 'icon.svg', 'icon.png', 'fivora-logo.png'];
    for (const cand of candidates) {
      if (fs.existsSync(path.join(projectDir, 'public', cand))) {
        logoUrl = `/${cand}`;
        break;
      }
    }
  }
  return {
    common: {
      websiteTitle: projectName,
      shortDescription: `A high-converting storefront built for the Fivora platform.`,
      logoUrl,
      headerCtaLabel: 'Contact Us',
      copyright: `© ${new Date().getFullYear()} ${projectName}. All rights reserved.`,
      navLabels,
      business: {
        phone: '',
        whatsapp: '',
        email: '',
      },
    },
  };
}

/**
 * Fivora strict mode requires every concrete site-data field to either render a
 * data-preview-field-path marker or be declared control-only. Control-only is
 * reserved for ids, internal flags, and the unrendered merchant baseline — not
 * as a dump for fields ARC planned but failed to bind.
 *
 * PLATFORM_CONTROLLED_PATHS: paths the Fivora AI/platform writes that templates
 * must never render as inline editable HTML. Loaded from platform-contract.json
 * so all templates benefit automatically without any template-side declaration.
 */
const BASELINE_CONTROL_ONLY = /^(common\.(websiteTitle|shortDescription|logoUrl|headerCtaLabel|copyright|navLabels(\.[^.]+)?|business(\.[^.]+)*))$/;
const SYSTEM_FIELD = /(^|\.)(id|key|slug|internalId|sku|_id)$/i;
const PLATFORM_CONTROLLED_PATHS = new Set(
  (PLATFORM_CONTRACT.platformControlledPaths || []).map(wildcardPath)
);

function slimListItems(items, itemFields) {
  const keys = (itemFields || []).map((field) => field.key).filter(Boolean);
  if (!keys.length || !Array.isArray(items)) return items || [];
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const out = {};
    for (const key of keys) {
      if (!(key in item)) continue;
      if (Array.isArray(item[key])) continue;
      out[key] = item[key];
    }
    return Object.keys(out).length ? out : item;
  });
}

function isModalOrFormPath(path) {
  return (
    /(?:^|\.)(?:form|modal|dialog|drawer|popup|sheet|booking|checkout|cartDrawer)(?:\.|$)/i.test(path) ||
    /(?:Modal|Form|Drawer|Dialog|Booking)(?:\.|$)/.test(path)
  );
}

function isAllowedControlOnly(path) {
  return (
    BASELINE_CONTROL_ONLY.test(path) ||
    SYSTEM_FIELD.test(path) ||
    PLATFORM_CONTROLLED_PATHS.has(wildcardPath(path)) ||
    isModalOrFormPath(path)
  );
}

/**
 * Ensures platform-managed editorSchema sections exist. These sections are required
 * by the strict contract validator when their sub-paths appear in controlOnlyPaths.
 * Template developers must never need to add these manually.
 */
function ensurePlatformSections(sections, content, boundListPaths = []) {
  // additionalPages: rendered visually by PlatformAdditionalPages component.
  // label is editable; id and route are platform-controlled.
  // Only inject additionalPages if it is actually bound or present in content with items.
  // Templates without additionalPages rendered would fail Fivora strict validation
  // if an unrendered editable list is declared in editorSchema.sections.
  const hasAdditionalPages =
    (Array.isArray(boundListPaths) && boundListPaths.some((p) => p === 'additionalPages' || p.startsWith('additionalPages['))) ||
    (content && Array.isArray(content.additionalPages) && content.additionalPages.length > 0 && Array.isArray(boundListPaths) && boundListPaths.includes('additionalPages'));

  if (hasAdditionalPages && !sections.find((s) => s.id === 'additionalPages')) {
    sections.push({
      id: 'additionalPages',
      path: 'additionalPages',
      type: 'list',
      label: 'Additional Pages',
      minItems: 0,
      maxItems: 20,
      fields: [
        { key: 'label', type: 'text', label: 'Page label', required: true },
        { key: 'id', type: 'text', label: 'Page ID' },
        { key: 'route', type: 'text', label: 'Page route' },
      ],
    });
  }

  // __fivoraIntake: AI intake data written by the platform. Never rendered in
  // template HTML — always control-only. Section required so sub-paths can be
  // declared in controlOnlyPaths without "unknown path" errors.
  if (!sections.find((s) => s.id === '__fivoraIntake')) {
    sections.push({
      id: '__fivoraIntake',
      path: '__fivoraIntake',
      type: 'object',
      label: 'AI Intake (Platform Managed)',
      fields: [
        { key: 'tone', type: 'text', label: 'Brand tone' },
        { key: 'outputLanguage', type: 'text', label: 'Output language' },
        { key: 'businessSummary', type: 'textarea', label: 'Business summary' },
        { key: 'additionalBusinessDetails', type: 'textarea', label: 'Additional business details' },
        { key: 'referenceWebsiteUrl', type: 'url', label: 'Reference website URL' },
        { key: 'guidanceNotes', type: 'object', label: 'AI Guidance Notes', fields: [] },
      ],
    });
  }
}

function computeControlOnlyPaths(content, boundPaths, declared = []) {
  const inventory = enumerateContentPaths(content);
  const bound = new Set([...(boundPaths || [])].map(wildcardPath));
  const controlOnly = new Set();

  // Auto-inject all platform-contract paths that exist in site data content —
  // templates never need to declare these manually.
  for (const platformPath of PLATFORM_CONTRACT.platformControlledPaths || []) {
    const canonical = canonicalizeMarkerPath(platformPath);
    if (!canonical) continue;
    const known = [...inventory.fieldPatterns, ...inventory.concreteFields].some(
      (path) => wildcardPath(path) === wildcardPath(canonical)
    );
    if (known) controlOnly.add(canonical);
  }

  for (const declaredPath of declared) {
    const canonical = canonicalizeMarkerPath(declaredPath);
    if (!canonical || !isAllowedControlOnly(canonical)) continue;
    const known = [...inventory.fieldPatterns, ...inventory.concreteFields].some(
      (path) => wildcardPath(path) === wildcardPath(canonical)
    );
    if (known) controlOnly.add(canonical);
  }

  for (const path of inventory.concreteFields) {
    const isModalForm = isModalOrFormPath(path);
    if (bound.has(wildcardPath(path)) && !isModalForm) continue;
    if (isAllowedControlOnly(path)) controlOnly.add(path);
  }

  return [...controlOnly].sort();
}

/**
 * A section may only claim a pageKey when every marker it owns actually renders
 * on that route, otherwise Fivora's route-owned coverage check fails.
 */
function assignSectionPageKeys(sections, routes, markerRoutes) {
  const routeIds = new Set(routes.map((route) => route.id));

  for (const section of sections) {
    delete section.pageKey;
    if (!routeIds.has(section.id)) continue;

    const ownedPaths = Object.keys(markerRoutes || {}).filter(
      (path) => path === section.path || path.startsWith(`${section.path}.`) || path.startsWith(`${section.path}[`)
    );
    if (!ownedPaths.length) continue;

    const rendersOnlyOnOwnRoute = ownedPaths.every((path) =>
      (markerRoutes[path] || []).includes(section.id)
    );
    if (rendersOnlyOnOwnRoute) section.pageKey = section.id;
  }
}

function buildSiteDataAndManifest({
  projectDir,
  projectName,
  profile,
  plan,
  recipe,
  existingSiteData,
  existingManifest,
  boundFieldPaths = [],
  boundListPaths = [],
  extraFields = [],
  markerRoutes = {},
}) {
  const routes = (profile.routes && profile.routes.length ? profile.routes : [{ id: 'home', label: 'Home', route: '/', required: true }])
    .map((r) => ({
      id: r.id,
      label: r.label,
      route: r.route,
      ...(r.required ? { required: true } : {}),
    }));

  const content = baseContent(projectName, routes, projectDir);

  // Recipes may hint schema shape, but must not dump another storefront's content
  // into an unrelated project. Extracted values always win.

  const plannedFields = [...collectFieldsFromPlan(plan), ...(extraFields || [])];
  const boundSet = new Set(
    [...(boundFieldPaths || []), ...(boundListPaths || [])].map((path) => wildcardPath(path))
  );
  function isBound(path) {
    if (!path) return false;
    const wild = wildcardPath(path);
    return boundSet.has(wild) || [...boundSet].some((marker) => wildcardPath(marker) === wild);
  }

  // A second `init` run re-reads already-transformed sources, where the former
  // literals are now site-data expressions and therefore no longer detectable.
  // Seeding from the existing manifest is what makes the run converge instead
  // of silently erasing the schema it produced the first time.
  const editorSections = (existingManifest?.editorSchema?.sections || []).map((section) =>
    JSON.parse(JSON.stringify(section))
  );

  let commonSection = editorSections.find((section) => section.id === 'common' || section.path === 'common');
  if (!commonSection) {
    commonSection = {
      id: 'common',
      path: 'common',
      type: 'object',
      label: 'Shared Website Content',
      fields: [],
    };
    editorSections.unshift(commonSection);
  }
  commonSection.fields = commonSection.fields || [];

  const commonBaseline = [
    { key: 'websiteTitle', type: 'text', label: 'Website Title', required: true },
    { key: 'shortDescription', type: 'textarea', label: 'Short Description' },
    { key: 'logoUrl', type: 'image', label: 'Website Logo' },
    { key: 'headerCtaLabel', type: 'text', label: 'Header Button Label' },
    {
      key: 'navLabels',
      type: 'object',
      label: 'Navigation Labels',
      fields: routes.map((p) => ({ key: p.id, type: 'text', label: `${p.label || p.id} Link` })),
    },
    { key: 'copyright', type: 'text', label: 'Copyright' },
  ];
  for (const field of commonBaseline) {
    if (!commonSection.fields.some((existing) => existing.key === field.key)) {
      commonSection.fields.push(field);
    }
  }

  for (const field of plannedFields) {
    if (field.type === 'list') {
      if (!isBound(field.path) && !isBound(`${field.path}[0]`) && !isBound(`${field.path}[*]`)) continue;
      const value = slimListItems(field.value ?? [], field.itemFields);
      setDeep(content, field.path, value);
      upsertSchemaList(editorSections, field.path, field.itemFields, value);
      continue;
    }
    if (!isBound(field.path) && !isAllowedControlOnly(field.path)) continue;
    if (!isBound(field.path) && isAllowedControlOnly(field.path)) {
      setDeep(content, field.path, field.value ?? '');
      continue;
    }
    setDeep(content, field.path, field.value ?? '');
    const type = field.type === 'url' ? 'text' : field.type || classifyFieldType('text', field.value);
    upsertSchemaField(editorSections, field.path, type, humanLabel(field.path));
  }

  if (existingSiteData && existingSiteData.content) {
    Object.assign(content, deepMerge(content, existingSiteData.content));
    // Planned extracted values should win over empty recipe defaults when existing is absent,
    // but never erase merchant-configured existing values.
    for (const field of plannedFields) {
      if (!isBound(field.path) && field.type !== 'list' && !isAllowedControlOnly(field.path)) continue;
      const existingVal = getDeep(existingSiteData.content, field.path);
      if (existingVal !== undefined) setDeep(content, field.path, existingVal);
      else if (field.value !== undefined) setDeep(content, field.path, field.value);
    }
  }

  pruneUnboundLeaves(content, isBound);

  const siteData = {
    denebVersion: existingSiteData?.denebVersion || undefined,
    arcVersion: ARC_VERSION,
    schemaVersion: SCHEMA_VERSION,
    project: existingSiteData?.project || {
      id: `${projectName}-project`,
      title: projectName,
      status: 'APPROVED',
    },
    merchant: existingSiteData?.merchant || {
      businessName: projectName,
      description: 'A modern commerce storefront built for the Fivora platform.',
    },
    template: existingSiteData?.template || {
      id: `${projectName}-template`,
      name: projectName,
      engine: 'NEXT_STATIC_EXPORT',
      structure: {
        pages: routes.map((p) => p.id),
        theme: defaultDualModeTheme(existingSiteData?.template?.structure?.theme || existingSiteData?.theme),
      },
    },
    requirements: existingSiteData?.requirements || {
      requiredPages: routes.filter((p) => p.required).map((p) => p.id),
      requiredFeatures: [],
    },
    content,
    styles: collectStylesFromPlan(plan, existingSiteData?.styles),
    theme: defaultDualModeTheme(existingSiteData?.theme || existingSiteData?.template?.structure?.theme),
  };

  applyFontTheme(siteData, collectFontIdsFromSiteData(siteData));

  if (!siteData.template.structure) siteData.template.structure = {};
  siteData.template.structure.pages = routes.map((p) => p.id);

  assignSectionPageKeys(editorSections, routes, markerRoutes);
  enrichSchemasFromContent(content, editorSections);

  // Auto-inject platform-managed editorSchema sections if not already present.
  // These sections are required so the validator accepts their controlOnlyPaths,
  // but template developers should never need to add these manually.
  ensurePlatformSections(editorSections, content, boundListPaths);

  // controlOnlyPaths: platform paths are auto-merged by platform-contract.json at
  // validate/build time. We only emit template-specific paths here (currently none
  // by default — templates add their own via controlOnlyPaths in fivora-template.json).
  const controlOnlyPaths = computeControlOnlyPaths(
    content,
    boundFieldPaths,
    existingManifest?.visualEditing?.controlOnlyPaths || []
  );

  const manifest = {
    framework: existingManifest?.framework || 'nextjs-static-export',
    version: existingManifest?.version || 2,
    denebVersion: existingManifest?.denebVersion,
    arcVersion: ARC_VERSION,
    schemaVersion: SCHEMA_VERSION,
    visualEditing: {
      contractVersion: 1,
      mode: existingManifest?.visualEditing?.mode || 'strict',
      controlOnlyPaths,
    },
    siteDataFile: existingManifest?.siteDataFile || (profile.hasSrc ? 'src/data/site-data.json' : 'data/site-data.json'),
    outputDirectory: existingManifest?.outputDirectory || 'out',
    installCommand: existingManifest?.installCommand || 'npm install',
    buildCommand: existingManifest?.buildCommand || 'npm run build',
    basePathEnvVar: existingManifest?.basePathEnvVar || 'NEXT_PUBLIC_SITE_BASE_PATH',
    pages: routes,
    editorSchema: {
      version: 1,
      sections: sanitizeEditorSections(editorSections),
    },
  };

  return { siteData, manifest, siteDataRel: manifest.siteDataFile };
}

function writeDataBank(projectDir, siteData, manifest) {
  const siteDataRel = manifest.siteDataFile || 'src/data/site-data.json';
  const siteDataPath = path.join(projectDir, siteDataRel);
  const manifestPath = path.join(projectDir, 'fivora-template.json');
  writeJson(siteDataPath, siteData);
  writeJson(manifestPath, manifest);
  return { siteDataPath, manifestPath };
}

function loadExistingData(projectDir, profile) {
  const manifest = readJsonSafe(path.join(projectDir, 'fivora-template.json'));
  const rel = manifest?.siteDataFile || (profile.hasSrc ? 'src/data/site-data.json' : 'data/site-data.json');
  const siteData = readJsonSafe(path.join(projectDir, rel));
  return { manifest, siteData, siteDataRel: rel };
}

function countSchemaFields(manifest) {
  function walk(fields) {
    if (!Array.isArray(fields)) return 0;
    let n = 0;
    for (const f of fields) {
      if (f.fields) n += walk(f.fields);
      else n += 1;
    }
    return n;
  }
  return (manifest.editorSchema?.sections || []).reduce((acc, s) => acc + walk(s.fields), 0);
}

module.exports = {
  buildSiteDataAndManifest,
  writeDataBank,
  loadExistingData,
  setDeep,
  getDeep,
  countSchemaFields,
  collectFieldsFromPlan,
  computeControlOnlyPaths,
  assignSectionPageKeys,
  upsertSchemaList,
  enrichSchemasFromContent,
  isListActionCtaKey,
  isAllowedControlOnly,
};

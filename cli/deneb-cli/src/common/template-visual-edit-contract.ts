import type {
  TemplateEditorField,
  TemplateEditorSchema,
  TemplateEditorSection,
} from './template-editor-schema';
import { findDuplicateTemplateEditorPaths } from './template-editor-schema';

export type TemplateVisualEditingConfig = {
  contractVersion: 1;
  mode: 'strict' | 'legacy';
  controlOnlyPaths?: string[];
};

export type TemplateVisualEditingPage = {
  id: string;
  label: string;
  route?: string;
};

export type TemplateVisualEditingArtifact = {
  filePath: string;
  kind: 'source' | 'html';
  content: string;
};

export type TemplateVisualEditMarkerKind = 'field' | 'list' | 'item' | 'page';

export type TemplateVisualEditMarker = {
  kind: TemplateVisualEditMarkerKind;
  value: string;
  filePath: string;
  artifactKind: TemplateVisualEditingArtifact['kind'];
  offset: number;
  line: number;
};

export type TemplateVisualEditPathInventory = {
  fieldPatterns: string[];
  concreteFields: string[];
  listPatterns: string[];
  concreteLists: string[];
  itemPatterns: string[];
  concreteItems: string[];
};

export type TemplateVisualEditingValidationInput = {
  manifestVersion: number;
  visualEditing?: TemplateVisualEditingConfig | null;
  pages?: TemplateVisualEditingPage[];
  contentDefaults: Record<string, unknown> | null;
  editorSchema: TemplateEditorSchema | null;
  artifacts: TemplateVisualEditingArtifact[];
};

export type TemplateVisualEditingValidationResult = {
  mode: 'strict' | 'legacy';
  errors: string[];
  warnings: string[];
  inventory: TemplateVisualEditPathInventory;
  markers: TemplateVisualEditMarker[];
};

export type TemplateVisualEditingEmptyStateValidationInput = {
  manifestVersion: number;
  visualEditing?: TemplateVisualEditingConfig | null;
  pages?: TemplateVisualEditingPage[];
  contentDefaults: Record<string, unknown> | null;
  editorSchema: TemplateEditorSchema | null;
  artifacts: TemplateVisualEditingArtifact[];
};

export type TemplateVisualEditingEmptyStateValidationResult = {
  errors: string[];
  warnings: string[];
  requiredFieldPaths: string[];
  requiredListPaths: string[];
  requiredItemPaths: string[];
};

type MutablePathInventory = {
  fieldPatterns: Set<string>;
  concreteFields: Set<string>;
  listPatterns: Set<string>;
  concreteLists: Set<string>;
  itemPatterns: Set<string>;
  concreteItems: Set<string>;
};

const MARKER_ATTRIBUTE_TO_KIND = {
  'data-preview-field-path': 'field',
  'data-preview-list-path': 'list',
  'data-preview-item-path': 'item',
  'data-preview-page-key': 'page',
} as const satisfies Record<string, TemplateVisualEditMarkerKind>;

const MARKER_ATTRIBUTE_PATTERN =
  /\b(data-preview-(?:field-path|list-path|item-path|page-key))\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([\s\S]*?)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;

const MARKER_ATTRIBUTE_OCCURRENCE_PATTERN =
  /\b(data-preview-(?:field-path|list-path|item-path|page-key))\s*=/g;

const PATH_SEGMENT_PATTERN = String.raw`[^.[\]\s]+`;
const CANONICAL_PATH_PATTERN = new RegExp(
  String.raw`^${PATH_SEGMENT_PATTERN}(?:\[(?:\d+|\*)\])*(?:\.${PATH_SEGMENT_PATTERN}(?:\[(?:\d+|\*)\])*)*$`,
);

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const IGNORED_HTML_CONTAINERS = new Set([
  'head',
  'script',
  'style',
  'noscript',
  'svg',
  'template',
]);

const BROAD_CONTENT_CONTAINERS = new Set([
  'html',
  'body',
  'main',
  'header',
  'footer',
  'nav',
  'section',
  'article',
  'aside',
  'form',
  'div',
  'ul',
  'ol',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
]);

export const PRIMARY_PREVIEW_DATA_MESSAGE = 'FIVORA_PREVIEW_SITE_DATA';
const PREVIOUS_PREVIEW_PREFIX = `${['MARKET', 'PLACE'].join('')}_PREVIEW_`;
export const LEGACY_PREVIEW_DATA_MESSAGE = `${PREVIOUS_PREVIEW_PREFIX}SITE_DATA`;
export const PREVIEW_DATA_MESSAGE = PRIMARY_PREVIEW_DATA_MESSAGE;

export const PRIMARY_PREVIEW_READY_MESSAGE = 'FIVORA_PREVIEW_READY';
export const LEGACY_PREVIEW_READY_MESSAGE = `${PREVIOUS_PREVIEW_PREFIX}READY`;
export const PREVIEW_READY_MESSAGE = PRIMARY_PREVIEW_READY_MESSAGE;

export function enumerateTemplateVisualEditPaths(
  contentDefaults: Record<string, unknown> | null,
  editorSchema: TemplateEditorSchema | null,
): TemplateVisualEditPathInventory {
  const inventory: MutablePathInventory = {
    fieldPatterns: new Set<string>(),
    concreteFields: new Set<string>(),
    listPatterns: new Set<string>(),
    concreteLists: new Set<string>(),
    itemPatterns: new Set<string>(),
    concreteItems: new Set<string>(),
  };

  if (contentDefaults) {
    for (const [key, value] of Object.entries(contentDefaults)) {
      walkContentValue(value, key, inventory);
    }
  }

  for (const section of editorSchema?.sections ?? []) {
    walkSchemaNode(section.path, section, inventory);
  }

  return {
    fieldPatterns: [...inventory.fieldPatterns].sort(),
    concreteFields: [...inventory.concreteFields].sort(),
    listPatterns: [...inventory.listPatterns].sort(),
    concreteLists: [...inventory.concreteLists].sort(),
    itemPatterns: [...inventory.itemPatterns].sort(),
    concreteItems: [...inventory.concreteItems].sort(),
  };
}

export function buildTemplateVisualEditingEmptyContent(
  contentDefaults: Record<string, unknown> | null,
  editorSchema: TemplateEditorSchema | null,
) {
  const emptyContent = emptyContentValue(contentDefaults ?? {}) as Record<
    string,
    unknown
  >;

  for (const section of editorSchema?.sections ?? []) {
    applyEmptySchemaNode(emptyContent, section.path, section);
  }

  return emptyContent;
}

export function buildTemplateVisualEditingProbeContent(
  contentDefaults: Record<string, unknown> | null,
  editorSchema: TemplateEditorSchema | null,
) {
  const probeContent = structuredClone(contentDefaults ?? {});

  for (const section of editorSchema?.sections ?? []) {
    applyProbeSchemaNode(probeContent, section.path, section);
  }

  return fillUnschematizedProbeValues(probeContent, '') as Record<
    string,
    unknown
  >;
}

export function extractTemplateVisualEditMarkers(
  artifacts: TemplateVisualEditingArtifact[],
): {
  markers: TemplateVisualEditMarker[];
  unparseableAttributes: string[];
} {
  const markers: TemplateVisualEditMarker[] = [];
  const unparseableAttributes: string[] = [];

  for (const artifact of artifacts) {
    const parsedOffsets = new Set<number>();
    MARKER_ATTRIBUTE_PATTERN.lastIndex = 0;

    for (const match of artifact.content.matchAll(MARKER_ATTRIBUTE_PATTERN)) {
      const attributeName = match[1] as keyof typeof MARKER_ATTRIBUTE_TO_KIND;
      const rawValue =
        match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? '';
      const offset = match.index ?? 0;
      parsedOffsets.add(offset);
      markers.push({
        kind: MARKER_ATTRIBUTE_TO_KIND[attributeName],
        value: decodeHtmlAttribute(rawValue).trim(),
        filePath: artifact.filePath,
        artifactKind: artifact.kind,
        offset,
        line: lineNumberAt(artifact.content, offset),
      });
    }

    MARKER_ATTRIBUTE_OCCURRENCE_PATTERN.lastIndex = 0;
    for (const match of artifact.content.matchAll(
      MARKER_ATTRIBUTE_OCCURRENCE_PATTERN,
    )) {
      const offset = match.index ?? 0;
      if (!parsedOffsets.has(offset)) {
        unparseableAttributes.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} ${match[1]} must use a literal string or a JSX template literal.`,
        );
      }
    }
  }

  return { markers, unparseableAttributes };
}

/**
 * Records which content paths the exported HTML actually renders on each page.
 * The fivora stores this build-derived metadata beside the manifest so a
 * selected Home page can still ask for a service list it genuinely displays,
 * without exposing every field from an unselected Services page.
 */
export function buildRenderedContentPathsByPage(
  pages: TemplateVisualEditingPage[],
  markers: TemplateVisualEditMarker[],
) {
  const htmlMarkers = markers.filter(
    (marker) => marker.artifactKind === 'html',
  );

  return Object.fromEntries(
    pages.map((page) => {
      const pageFiles = new Set(
        htmlMarkers
          .filter(
            (marker) =>
              marker.kind === 'page' && marker.value.trim() === page.id,
          )
          .map((marker) => marker.filePath),
      );
      const paths = uniqueSorted(
        htmlMarkers
          .filter(
            (marker) =>
              marker.kind === 'field' && pageFiles.has(marker.filePath),
          )
          .map((marker) => canonicalizeMarkerPath(marker.value))
          .filter((path): path is string => Boolean(path)),
      );
      return [page.id, paths] as const;
    }),
  ) as Record<string, string[]>;
}

export function validateTemplateVisualEditingContract(
  input: TemplateVisualEditingValidationInput,
): TemplateVisualEditingValidationResult {
  const mode =
    input.manifestVersion >= 2 || input.visualEditing?.mode === 'strict'
      ? 'strict'
      : 'legacy';
  const strictFindings: string[] = [];
  const warnings: string[] = [];
  const inventory = enumerateTemplateVisualEditPaths(
    input.contentDefaults,
    input.editorSchema,
  );
  const extraction = extractTemplateVisualEditMarkers(input.artifacts);
  const markers = extraction.markers;

  if (!input.contentDefaults) {
    strictFindings.push(
      'site-data.json must contain a JSON object at "content".',
    );
  }
  if (!input.editorSchema) {
    strictFindings.push(
      'An editor schema could not be derived from site-data.json content.',
    );
  }
  validateSchemaSectionUniqueness(input.editorSchema, strictFindings);
  validateSchemaPathUniqueness(input.editorSchema, strictFindings);
  validateStrictSelectOptions(input.editorSchema, strictFindings, input.pages);
  validateStrictListBounds(
    input.editorSchema,
    input.contentDefaults,
    strictFindings,
  );
  validateStaticMarkerSourceAuthorship(input.artifacts, strictFindings);
  validatePreviewRuntimeCapability(input.artifacts, strictFindings);
  validateLiveProductRouting(input.artifacts, strictFindings);

  warnings.push(
    ...extraction.unparseableAttributes.map(
      (finding) =>
        `${finding} Exported exact markers may still satisfy strict coverage.`,
    ),
  );

  const fieldMarkers = collectCanonicalPathMarkers(
    markers,
    'field',
    strictFindings,
  );
  const listMarkers = collectCanonicalPathMarkers(
    markers,
    'list',
    strictFindings,
  );
  const itemMarkers = collectCanonicalPathMarkers(
    markers,
    'item',
    strictFindings,
  );
  const htmlMarkers = markers.filter(
    (marker) => marker.artifactKind === 'html',
  );
  const htmlFieldMarkers = collectCanonicalPathMarkers(
    htmlMarkers,
    'field',
    strictFindings,
  );
  const htmlListMarkers = collectCanonicalPathMarkers(
    htmlMarkers,
    'list',
    strictFindings,
  );
  const htmlItemMarkers = collectCanonicalPathMarkers(
    htmlMarkers,
    'item',
    strictFindings,
  );
  const sourceMarkers = markers.filter(
    (marker) => marker.artifactKind === 'source',
  );
  const sourceFieldMarkers = collectCanonicalPathMarkers(
    sourceMarkers,
    'field',
    strictFindings,
  );
  const sourceListMarkers = collectCanonicalPathMarkers(
    sourceMarkers,
    'list',
    strictFindings,
  );
  const sourceItemMarkers = collectCanonicalPathMarkers(
    sourceMarkers,
    'item',
    strictFindings,
  );
  const controlOnlyPaths = normalizeControlOnlyPaths(
    input.visualEditing?.controlOnlyPaths ?? [],
    inventory,
    strictFindings,
  );

  validateExpectedPathCoverage({
    label: 'editable field',
    expectedPatterns: inventory.fieldPatterns,
    concretePaths: inventory.concreteFields,
    htmlMarkerPaths: htmlFieldMarkers,
    sourceMarkerPaths: sourceFieldMarkers,
    controlOnlyPaths,
    findings: strictFindings,
  });
  validateExpectedPathCoverage({
    label: 'editable list',
    expectedPatterns: inventory.listPatterns,
    concretePaths: inventory.concreteLists,
    htmlMarkerPaths: htmlListMarkers,
    sourceMarkerPaths: sourceListMarkers,
    controlOnlyPaths: [],
    findings: strictFindings,
  });
  validateExpectedPathCoverage({
    label: 'editable list item',
    expectedPatterns: inventory.itemPatterns,
    concretePaths: inventory.concreteItems,
    htmlMarkerPaths: htmlItemMarkers,
    sourceMarkerPaths: sourceItemMarkers,
    controlOnlyPaths: [],
    findings: strictFindings,
  });

  validateUnknownMarkers(
    'field',
    fieldMarkers,
    inventory.fieldPatterns,
    inventory.concreteFields,
    strictFindings,
  );
  validateUnknownMarkers(
    'list',
    listMarkers,
    inventory.listPatterns,
    inventory.concreteLists,
    strictFindings,
  );
  validateUnknownMarkers(
    'item',
    itemMarkers,
    inventory.itemPatterns,
    inventory.concreteItems,
    strictFindings,
  );
  validatePageCoverage(
    input.manifestVersion,
    input.pages ?? [],
    markers,
    input.artifacts,
    strictFindings,
  );
  validateRouteOwnedMarkerCoverage({
    manifestVersion: input.manifestVersion,
    pages: input.pages ?? [],
    schema: input.editorSchema,
    markers,
    fieldPaths: uniqueSorted([
      ...inventory.fieldPatterns.filter((path) => !path.includes('[*]')),
      ...inventory.concreteFields,
    ]),
    listPaths: uniqueSorted([
      ...inventory.listPatterns.filter((path) => !path.includes('[*]')),
      ...inventory.concreteLists,
    ]),
    itemPaths: inventory.concreteItems,
    controlOnlyPaths,
    findings: strictFindings,
  });

  const visibleHtmlFindings = auditUnmarkedVisibleHtml(
    input.artifacts,
    input.pages ?? [],
  );
  if (mode === 'strict') {
    strictFindings.push(...visibleHtmlFindings);
  } else {
    warnings.push(...visibleHtmlFindings);
  }

  const uniqueStrictFindings = uniqueSorted(strictFindings);
  const uniqueWarnings = uniqueSorted(warnings);

  if (mode === 'legacy') {
    return {
      mode,
      errors: [],
      warnings: uniqueSorted([
        ...uniqueStrictFindings.map((finding) => `[legacy] ${finding}`),
        ...uniqueWarnings,
      ]),
      inventory,
      markers,
    };
  }

  return {
    mode,
    errors: uniqueStrictFindings,
    warnings: uniqueWarnings,
    inventory,
    markers,
  };
}

export function validateTemplateVisualEditingEmptyState(
  input: TemplateVisualEditingEmptyStateValidationInput,
): TemplateVisualEditingEmptyStateValidationResult {
  const findings: string[] = [];
  const warnings: string[] = [];
  const inventory = enumerateTemplateVisualEditPaths(
    input.contentDefaults,
    input.editorSchema,
  );
  const emptyContent = buildTemplateVisualEditingEmptyContent(
    input.contentDefaults,
    input.editorSchema,
  );
  const emptyInventory = enumerateTemplateVisualEditPaths(
    emptyContent,
    input.editorSchema,
  );
  const requiredFieldPaths = uniqueSorted([
    ...inventory.fieldPatterns.filter((path) => !path.includes('[*]')),
    ...emptyInventory.concreteFields,
  ]);
  const requiredListPaths = uniqueSorted([
    ...inventory.listPatterns.filter((path) => !path.includes('[*]')),
    ...emptyInventory.concreteLists,
  ]);
  const requiredItemPaths = emptyInventory.concreteItems;
  const htmlArtifacts = input.artifacts.filter(
    (artifact) => artifact.kind === 'html',
  );
  const extraction = extractTemplateVisualEditMarkers(htmlArtifacts);
  const fieldMarkers = collectCanonicalPathMarkers(
    extraction.markers,
    'field',
    findings,
  );
  const listMarkers = collectCanonicalPathMarkers(
    extraction.markers,
    'list',
    findings,
  );
  const itemMarkers = collectCanonicalPathMarkers(
    extraction.markers,
    'item',
    findings,
  );
  const controlOnlyPaths = normalizeControlOnlyPaths(
    input.visualEditing?.controlOnlyPaths ?? [],
    inventory,
    findings,
  );

  reportUnexpectedEmptyStateMarkers({
    markerPaths: fieldMarkers,
    expectedPaths: emptyInventory.concreteFields,
    knownPatterns: inventory.fieldPatterns,
    attribute: 'field',
    findings,
  });
  reportUnexpectedEmptyStateMarkers({
    markerPaths: listMarkers,
    expectedPaths: emptyInventory.concreteLists,
    knownPatterns: inventory.listPatterns,
    attribute: 'list',
    findings,
  });
  reportUnexpectedEmptyStateMarkers({
    markerPaths: itemMarkers,
    expectedPaths: emptyInventory.concreteItems,
    knownPatterns: inventory.itemPatterns,
    attribute: 'item',
    findings,
  });

  for (const path of requiredFieldPaths) {
    if (isControlOnly(path, controlOnlyPaths) || fieldMarkers.includes(path)) {
      continue;
    }
    findings.push(
      `Empty-state export removed data-preview-field-path="${path}". Keep the editable target mounted when its value is empty, false, or zero.`,
    );
  }

  for (const path of requiredListPaths) {
    if (listMarkers.includes(path)) {
      continue;
    }
    findings.push(
      `Empty-state export removed data-preview-list-path="${path}". Keep the list container mounted when the list has no items.`,
    );
  }

  for (const path of requiredItemPaths) {
    if (itemMarkers.includes(path)) {
      continue;
    }
    findings.push(
      `Empty-state export removed data-preview-item-path="${path}" required by minItems/required list validation.`,
    );
  }

  validatePageCoverage(
    input.manifestVersion,
    input.pages ?? [],
    extraction.markers,
    htmlArtifacts,
    findings,
  );
  validateRouteOwnedMarkerCoverage({
    manifestVersion: input.manifestVersion,
    pages: input.pages ?? [],
    schema: input.editorSchema,
    markers: extraction.markers,
    fieldPaths: requiredFieldPaths,
    listPaths: requiredListPaths,
    itemPaths: requiredItemPaths,
    controlOnlyPaths,
    findings,
  });

  warnings.push(...extraction.unparseableAttributes);

  return {
    errors: uniqueSorted(findings),
    warnings: uniqueSorted(warnings),
    requiredFieldPaths,
    requiredListPaths,
    requiredItemPaths,
  };
}

function reportUnexpectedEmptyStateMarkers(params: {
  markerPaths: string[];
  expectedPaths: string[];
  knownPatterns: string[];
  attribute: 'field' | 'list' | 'item';
  findings: string[];
}) {
  const expected = new Set(params.expectedPaths);
  const known = new Set(params.knownPatterns);

  for (const path of params.markerPaths) {
    if (
      path.includes('[*]') ||
      expected.has(path) ||
      !known.has(wildcardPath(path))
    ) {
      continue;
    }
    params.findings.push(
      `Empty-state export rendered out-of-range data-preview-${params.attribute}-path="${path}" for a list item that does not exist. Render list items from the actual site-data array instead of fixed indexes or placeholder cards.`,
    );
  }
}

function applyProbeSchemaNode(
  root: Record<string, unknown>,
  path: string,
  node: TemplateEditorSection,
) {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.includes('['))) {
    return;
  }

  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!isPlainObject(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }

  const key = parts.at(-1)!;
  applyProbeNodeAtKey(cursor, key, node, path);
}

function applyProbeNodeAtKey(
  container: Record<string, unknown>,
  key: string,
  node: TemplateEditorSection | TemplateEditorField,
  path: string,
) {
  if (node.type === 'list') {
    const items = Array.isArray(container[key])
      ? [...(container[key] as unknown[])]
      : [];
    const maximumItems = validListBound(node.maxItems);
    const minimumItems = Math.min(
      maximumItems ?? Number.MAX_SAFE_INTEGER,
      maximumItems === 0
        ? 0
        : Math.max(1, validListBound(node.minItems) ?? (node.required ? 1 : 0)),
    );
    while (items.length < minimumItems) {
      items.push(undefined);
    }

    container[key] = items.map((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (node.itemField) {
        return probePrimitiveValue(
          item,
          node.itemField.type,
          itemPath,
          node.itemField.options,
        );
      }

      const objectItem = isPlainObject(item) ? item : {};
      for (const field of node.fields ?? []) {
        applyProbeNodeAtKey(
          objectItem,
          field.key,
          field,
          appendPath(itemPath, field.key),
        );
      }
      return objectItem;
    });
    return;
  }

  if (node.type === 'object') {
    const objectValue = isPlainObject(container[key]) ? container[key] : {};
    container[key] = objectValue;
    for (const field of node.fields ?? []) {
      applyProbeNodeAtKey(
        objectValue,
        field.key,
        field,
        appendPath(path, field.key),
      );
    }
    return;
  }

  container[key] = probePrimitiveValue(
    container[key],
    node.type,
    path,
    node.options,
  );
}

function probePrimitiveValue(
  value: unknown,
  type: TemplateEditorSection['type'],
  path: string,
  options?: string[],
) {
  if (type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) && value !== 0
      ? value
      : 1;
  }
  if (type === 'boolean') {
    return value === true ? value : true;
  }
  if (
    typeof value === 'string' &&
    value.trim() &&
    (type !== 'select' || !options?.length || options.includes(value))
  ) {
    return value;
  }

  if (type === 'select') {
    return options?.[0] ?? probeText(path);
  }
  if (type === 'url') {
    return `https://template-validation.example.invalid/${probeSlug(path)}`;
  }
  if (type === 'image') {
    return `/template-validation-${probeSlug(path)}.svg`;
  }
  if (type === 'email') {
    return 'validation@example.invalid';
  }
  if (type === 'tel') {
    return '+12025550142';
  }
  return probeText(path);
}

function fillUnschematizedProbeValues(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      fillUnschematizedProbeValues(item, `${path}[${index}]`),
    );
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const childPath = appendPath(path, key);
        return [key, fillUnschematizedProbeValues(child, childPath)];
      }),
    );
  }
  if (typeof value === 'string') {
    return value.trim() ? value : inferUnschematizedStringProbe(path);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0 ? value : 1;
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (value === null || value === undefined) {
    return probeText(path);
  }
  return value;
}

function inferUnschematizedStringProbe(path: string) {
  const normalized = path.toLowerCase();
  if (normalized.includes('email')) {
    return 'validation@example.invalid';
  }
  if (
    normalized.includes('phone') ||
    normalized.includes('mobile') ||
    normalized.includes('whatsapp') ||
    normalized.includes('contactnumber')
  ) {
    return '+12025550142';
  }
  if (
    normalized.includes('image') ||
    normalized.includes('logo') ||
    normalized.includes('banner') ||
    normalized.includes('thumbnail') ||
    normalized.includes('photo')
  ) {
    return `/template-validation-${probeSlug(path)}.svg`;
  }
  if (normalized.includes('url') || normalized.includes('link')) {
    return `https://template-validation.example.invalid/${probeSlug(path)}`;
  }
  return probeText(path);
}

function probeText(path: string) {
  return `Validation ${path || 'content'}`;
}

function probeSlug(path: string) {
  return (
    path
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'content'
  );
}

function emptyContentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [];
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        emptyContentValue(child),
      ]),
    );
  }
  if (typeof value === 'string') {
    return '';
  }
  if (typeof value === 'number') {
    return 0;
  }
  if (typeof value === 'boolean') {
    return false;
  }
  return value;
}

function applyEmptySchemaNode(
  root: Record<string, unknown>,
  path: string,
  node: TemplateEditorSection,
) {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.includes('['))) {
    return;
  }

  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!isPlainObject(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }

  const key = parts.at(-1)!;
  applyEmptyNodeAtKey(cursor, key, node);
}

function applyEmptyNodeAtKey(
  container: Record<string, unknown>,
  key: string,
  node: TemplateEditorSection | TemplateEditorField,
) {
  if (node.type === 'list') {
    const minimumItems = Math.min(
      validListBound(node.maxItems) ?? Number.MAX_SAFE_INTEGER,
      validListBound(node.minItems) ?? (node.required ? 1 : 0),
    );
    container[key] = Array.from({ length: minimumItems }, () =>
      createEmptyListItem(node),
    );
    return;
  }

  if (node.type === 'object') {
    const objectValue = isPlainObject(container[key]) ? container[key] : {};
    container[key] = objectValue;
    for (const field of node.fields ?? []) {
      applyEmptyNodeAtKey(objectValue, field.key, field);
    }
    return;
  }

  container[key] =
    node.type === 'number' ? 0 : node.type === 'boolean' ? false : '';
}

function createEmptyListItem(node: {
  itemField?: TemplateEditorSection['itemField'];
  fields?: TemplateEditorField[];
}) {
  if (node.itemField) {
    return node.itemField.type === 'number'
      ? 0
      : node.itemField.type === 'boolean'
        ? false
        : '';
  }

  const item: Record<string, unknown> = {};
  for (const field of node.fields ?? []) {
    applyEmptyNodeAtKey(item, field.key, field);
  }
  return item;
}

function walkContentValue(
  value: unknown,
  path: string,
  inventory: MutablePathInventory,
) {
  if (Array.isArray(value)) {
    const listPattern = wildcardPath(path);
    inventory.listPatterns.add(listPattern);
    inventory.concreteLists.add(path);
    inventory.itemPatterns.add(`${listPattern}[*]`);

    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      inventory.concreteItems.add(itemPath);
      if (Array.isArray(item) || isPlainObject(item)) {
        walkContentValue(item, itemPath, inventory);
      } else {
        inventory.fieldPatterns.add(wildcardPath(itemPath));
        inventory.concreteFields.add(itemPath);
      }
    });
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      walkContentValue(childValue, appendPath(path, key), inventory);
    }
    return;
  }

  inventory.fieldPatterns.add(wildcardPath(path));
  inventory.concreteFields.add(path);
}

function walkSchemaNode(
  path: string,
  node: TemplateEditorSection | TemplateEditorField,
  inventory: MutablePathInventory,
) {
  if (node.type === 'object') {
    for (const field of node.fields ?? []) {
      walkSchemaNode(appendPath(path, field.key), field, inventory);
    }
    return;
  }

  if (node.type === 'list') {
    const listPattern = wildcardPath(path);
    const itemPattern = `${listPattern}[*]`;
    inventory.listPatterns.add(listPattern);
    inventory.itemPatterns.add(itemPattern);

    if (node.itemField) {
      inventory.fieldPatterns.add(itemPattern);
    }

    for (const field of node.fields ?? []) {
      walkSchemaNode(appendPath(itemPattern, field.key), field, inventory);
    }
    return;
  }

  inventory.fieldPatterns.add(wildcardPath(path));
}

function collectCanonicalPathMarkers(
  markers: TemplateVisualEditMarker[],
  kind: Exclude<TemplateVisualEditMarkerKind, 'page'>,
  findings: string[],
) {
  const values: string[] = [];

  for (const marker of markers.filter((candidate) => candidate.kind === kind)) {
    const canonical = canonicalizeMarkerPath(marker.value);
    if (!canonical) {
      findings.push(
        `${marker.filePath}:${lineNumberForMarker(marker)} has invalid data-preview-${kind}-path "${marker.value}".`,
      );
      continue;
    }
    values.push(canonical);
  }

  return uniqueSorted(values);
}

function normalizeControlOnlyPaths(
  paths: string[],
  inventory: TemplateVisualEditPathInventory,
  findings: string[],
) {
  const normalized: string[] = [];

  for (const path of paths) {
    const canonical = canonicalizeMarkerPath(path);
    if (!canonical) {
      findings.push(`controlOnlyPaths contains invalid path "${path}".`);
      continue;
    }

    const known = [
      ...inventory.fieldPatterns,
      ...inventory.concreteFields,
    ].some((expected) => pathsOverlap(canonical, expected));
    if (!known) {
      findings.push(
        `controlOnlyPaths contains unknown editable field path "${canonical}".`,
      );
      continue;
    }
    normalized.push(canonical);
  }

  return uniqueSorted(normalized);
}

function validateExpectedPathCoverage(params: {
  label: string;
  expectedPatterns: string[];
  concretePaths: string[];
  htmlMarkerPaths: string[];
  sourceMarkerPaths: string[];
  controlOnlyPaths: string[];
  findings: string[];
}) {
  for (const expected of params.expectedPatterns) {
    if (isControlOnly(expected, params.controlOnlyPaths)) {
      continue;
    }

    const matchingConcretePaths = params.concretePaths.filter(
      (concrete) => wildcardPath(concrete) === expected,
    );

    if (!expected.includes('[*]')) {
      if (!params.htmlMarkerPaths.includes(expected)) {
        params.findings.push(
          `Exported HTML is missing exact data-preview-${markerAttributeFragment(params.label)}="${expected}" for ${params.label}.`,
        );
      }
      continue;
    }

    if (
      !params.sourceMarkerPaths.some((marker) =>
        markerCoversPattern(marker, expected),
      )
    ) {
      params.findings.push(
        `Source is missing dynamic data-preview-${markerAttributeFragment(params.label)} mapping for ${params.label} "${expected}". Use an exact JSX template path such as [\${index}] so newly added and reordered items remain editable.`,
      );
    }

    if (matchingConcretePaths.length > 0) {
      continue;
    }
  }

  for (const concrete of params.concretePaths) {
    if (params.expectedPatterns.includes(concrete)) {
      continue;
    }
    if (
      isControlOnly(concrete, params.controlOnlyPaths) ||
      params.htmlMarkerPaths.includes(concrete)
    ) {
      continue;
    }
    params.findings.push(
      `Exported HTML is missing exact data-preview-${markerAttributeFragment(params.label)}="${concrete}" for concrete ${params.label}.`,
    );
  }
}

function validateUnknownMarkers(
  kind: Exclude<TemplateVisualEditMarkerKind, 'page'>,
  markerPaths: string[],
  expectedPatterns: string[],
  concretePaths: string[],
  findings: string[],
) {
  for (const marker of markerPaths) {
    const known =
      expectedPatterns.some((expected) => pathsOverlap(marker, expected)) ||
      concretePaths.some((expected) => pathsOverlap(marker, expected));
    if (!known) {
      findings.push(
        `data-preview-${kind}-path references unknown path "${marker}".`,
      );
    }
  }
}

function validatePageCoverage(
  manifestVersion: number,
  pages: TemplateVisualEditingPage[],
  markers: TemplateVisualEditMarker[],
  artifacts: TemplateVisualEditingArtifact[],
  findings: string[],
) {
  const htmlArtifacts = artifacts.filter(
    (artifact) => artifact.kind === 'html',
  );
  const pageMarkers = markers.filter(
    (marker) => marker.kind === 'page' && marker.artifactKind === 'html',
  );
  const pageIds = new Set(pages.map((page) => page.id));
  const seenPageIds = new Set<string>();
  const seenPageRoutes = new Map<string, string>();

  if (pages.length === 0) {
    findings.push(
      'Strict visual editing requires at least one manifest pages[] entry.',
    );
  }

  for (const page of pages) {
    if (seenPageIds.has(page.id)) {
      findings.push(`Manifest pages[] contains duplicate id "${page.id}".`);
    }
    seenPageIds.add(page.id);

    const route =
      normalizePageRoute(page.route) ??
      (manifestVersion < 2 ? legacyPageRoute(page.id) : null);

    if (!route) {
      findings.push(
        `Manifest page "${page.id}" must declare a canonical route for strict visual editing.`,
      );
      continue;
    }

    const existingRoutePage = seenPageRoutes.get(route);
    if (existingRoutePage) {
      findings.push(
        `Manifest pages "${existingRoutePage}" and "${page.id}" use duplicate route "${route}".`,
      );
    } else {
      seenPageRoutes.set(route, page.id);
    }

    const routeArtifacts = htmlArtifacts.filter((artifact) =>
      artifactMatchesRoute(artifact.filePath, route),
    );
    if (routeArtifacts.length === 0) {
      findings.push(
        `Manifest page "${page.id}" route "${route}" has no exported HTML file.`,
      );
      continue;
    }

    const routeFiles = new Set(
      routeArtifacts.map((artifact) => artifact.filePath),
    );
    const hasPageRoot = pageMarkers.some(
      (marker) => marker.value === page.id && routeFiles.has(marker.filePath),
    );
    if (!hasPageRoot) {
      findings.push(
        `Exported route "${route}" is missing data-preview-page-key="${page.id}".`,
      );
    }
  }

  for (const marker of markers.filter(
    (candidate) => candidate.kind === 'page',
  )) {
    if (!pageIds.has(marker.value)) {
      findings.push(
        `${marker.filePath}:${lineNumberForMarker(marker)} data-preview-page-key references unknown manifest page "${marker.value}".`,
      );
    }
  }
}

function validateRouteOwnedMarkerCoverage(params: {
  manifestVersion: number;
  pages: TemplateVisualEditingPage[];
  schema: TemplateEditorSchema | null;
  markers: TemplateVisualEditMarker[];
  fieldPaths: string[];
  listPaths: string[];
  itemPaths: string[];
  controlOnlyPaths: string[];
  findings: string[];
}) {
  const sections = (params.schema?.sections ?? [])
    .map((section) => ({
      section,
      canonicalPath: canonicalizeMarkerPath(section.path),
    }))
    .filter(
      (
        entry,
      ): entry is {
        section: TemplateEditorSection;
        canonicalPath: string;
      } => Boolean(entry.canonicalPath),
    );
  const pagesById = new Map(params.pages.map((page) => [page.id, page]));

  const validatePaths = (
    kind: Exclude<TemplateVisualEditMarkerKind, 'page'>,
    paths: string[],
  ) => {
    for (const path of paths) {
      if (kind === 'field' && isControlOnly(path, params.controlOnlyPaths)) {
        continue;
      }

      const shopOwner = sections
        .filter((entry) => pathBelongsToSection(path, entry.canonicalPath))
        .sort(
          (left, right) =>
            right.canonicalPath.length - left.canonicalPath.length,
        )[0];
      if (!shopOwner?.section.pageKey) {
        continue;
      }

      const page = pagesById.get(shopOwner.section.pageKey);
      if (!page) {
        params.findings.push(
          `editorSchema section "${shopOwner.section.path}" assigns ${markerCoverageLabel(kind)} "${path}" to unknown manifest page "${shopOwner.section.pageKey}".`,
        );
        continue;
      }

      const route =
        normalizePageRoute(page.route) ??
        (params.manifestVersion < 2 ? legacyPageRoute(page.id) : null);
      if (!route) {
        continue;
      }

      const hasExportedMarker = params.markers.some(
        (marker) =>
          marker.kind === kind &&
          marker.artifactKind === 'html' &&
          canonicalizeMarkerPath(marker.value) === path,
      );
      if (!hasExportedMarker) {
        continue;
      }

      const renderedOnOwnedRoute = params.markers.some(
        (marker) =>
          marker.kind === kind &&
          marker.artifactKind === 'html' &&
          canonicalizeMarkerPath(marker.value) === path &&
          artifactMatchesRoute(marker.filePath, route),
      );
      if (renderedOnOwnedRoute) {
        continue;
      }

      params.findings.push(
        `Page-owned ${markerCoverageLabel(kind)} "${path}" from editorSchema section "${shopOwner.section.path}" must render data-preview-${markerPathAttribute(kind)}="${path}" on manifest page "${page.id}" route "${route}". Shared sections without pageKey may render globally.`,
      );
    }
  };

  validatePaths('field', uniqueSorted(params.fieldPaths));
  validatePaths('list', uniqueSorted(params.listPaths));
  validatePaths('item', uniqueSorted(params.itemPaths));
}

function pathBelongsToSection(path: string, sectionPath: string) {
  const wildcardedPath = wildcardPath(path);
  const wildcardedSection = wildcardPath(sectionPath);
  return (
    wildcardedPath === wildcardedSection ||
    wildcardedPath.startsWith(`${wildcardedSection}.`) ||
    wildcardedPath.startsWith(`${wildcardedSection}[`)
  );
}

function markerCoverageLabel(
  kind: Exclude<TemplateVisualEditMarkerKind, 'page'>,
) {
  if (kind === 'field') return 'editable field';
  if (kind === 'list') return 'editable list';
  return 'editable list item';
}

function markerPathAttribute(
  kind: Exclude<TemplateVisualEditMarkerKind, 'page'>,
) {
  if (kind === 'field') return 'field-path';
  if (kind === 'list') return 'list-path';
  return 'item-path';
}

function validateStrictSelectOptions(
  schema: TemplateEditorSchema | null,
  findings: string[],
  manifestPages: TemplateVisualEditingPage[] = [],
) {
  const declaredPageIds = new Set(
    manifestPages
      .map((p) => p.id?.trim())
      .filter((id): id is string => Boolean(id)),
  );

  const checkSelectNode = (path: string, options: string[] | undefined) => {
    if (
      !options?.some(
        (option) => typeof option === 'string' && option.trim().length > 0,
      )
    ) {
      findings.push(
        `editorSchema select field "${path}" must declare at least one non-empty option for strict visual editing. Add options: ["First option", ...] or change the field type.`,
      );
      return;
    }

    if (declaredPageIds.size > 0) {
      const isDestinationField =
        /(?:destination|action|targetpage|buttonaction|pagekey)/i.test(path);
      if (isDestinationField) {
        for (const option of options) {
          const opt = typeof option === 'string' ? option.trim() : '';
          if (
            opt &&
            opt !== 'none' &&
            opt !== 'external' &&
            !declaredPageIds.has(opt)
          ) {
            findings.push(
              `editorSchema select field "${path}" declares destination option "${opt}" which is not in fivora-template.json pages[]. Declared pages: ${[...declaredPageIds].join(', ')}.`,
            );
          }
        }
      }
    }
  };

  const walkNode = (
    path: string,
    node: TemplateEditorSection | TemplateEditorField,
  ) => {
    if (node.type === 'select') {
      checkSelectNode(path, node.options);
      return;
    }

    if (node.type === 'object') {
      for (const field of node.fields ?? []) {
        walkNode(appendPath(path, field.key), field);
      }
      return;
    }

    if (node.type !== 'list') {
      return;
    }

    const itemPath = `${wildcardPath(path)}[*]`;
    if (node.itemField?.type === 'select') {
      checkSelectNode(itemPath, node.itemField.options);
    }
    for (const field of node.fields ?? []) {
      walkNode(appendPath(itemPath, field.key), field);
    }
  };

  for (const section of schema?.sections ?? []) {
    walkNode(section.path, section);
  }
}

function validateStrictListBounds(
  schema: TemplateEditorSchema | null,
  contentDefaults: Record<string, unknown> | null,
  findings: string[],
) {
  const walkSchemaNode = (
    path: string,
    node: TemplateEditorSection | TemplateEditorField,
  ) => {
    if (node.type === 'object') {
      for (const field of node.fields ?? []) {
        walkSchemaNode(appendPath(path, field.key), field);
      }
      return;
    }

    if (node.type !== 'list') {
      return;
    }

    const minItems = validListBound(node.minItems);
    const maxItems = validListBound(node.maxItems);
    if (node.minItems !== undefined && minItems === null) {
      findings.push(
        `editorSchema list "${path}" minItems must be a non-negative safe integer.`,
      );
    }
    if (node.maxItems !== undefined && maxItems === null) {
      findings.push(
        `editorSchema list "${path}" maxItems must be a non-negative safe integer.`,
      );
    }

    const effectiveMinimum = minItems ?? (node.required ? 1 : 0);
    if (maxItems !== null && effectiveMinimum > maxItems) {
      findings.push(
        `editorSchema list "${path}" requires at least ${effectiveMinimum} item${effectiveMinimum === 1 ? '' : 's'} but maxItems is ${maxItems}. Increase maxItems or lower minItems/required.`,
      );
    }

    const itemPath = `${wildcardPath(path)}[*]`;
    for (const field of node.fields ?? []) {
      walkSchemaNode(appendPath(itemPath, field.key), field);
    }
  };

  const walkContentNode = (
    path: string,
    node: TemplateEditorSection | TemplateEditorField,
    value: unknown,
  ) => {
    if (node.type === 'object') {
      const objectValue = isPlainObject(value) ? value : {};
      for (const field of node.fields ?? []) {
        walkContentNode(
          appendPath(path, field.key),
          field,
          objectValue[field.key],
        );
      }
      return;
    }

    if (node.type !== 'list') {
      return;
    }

    const items = Array.isArray(value) ? value : [];
    const maxItems = validListBound(node.maxItems);
    if (maxItems !== null && items.length > maxItems) {
      findings.push(
        `site-data.json content list "${path}" contains ${items.length} items, exceeding editorSchema maxItems ${maxItems}.`,
      );
    }

    for (const [index, item] of items.entries()) {
      const objectItem = isPlainObject(item) ? item : {};
      for (const field of node.fields ?? []) {
        walkContentNode(
          appendPath(`${path}[${index}]`, field.key),
          field,
          objectItem[field.key],
        );
      }
    }
  };

  for (const section of schema?.sections ?? []) {
    walkSchemaNode(section.path, section);
    walkContentNode(
      section.path,
      section,
      readContentValueByPath(contentDefaults ?? {}, section.path),
    );
  }
}

function validListBound(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function readContentValueByPath(
  content: Record<string, unknown>,
  path: string,
) {
  let value: unknown = content;
  for (const part of path.split('.').map((candidate) => candidate.trim())) {
    if (!part || !isPlainObject(value)) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

function validateStaticMarkerSourceAuthorship(
  artifacts: TemplateVisualEditingArtifact[],
  findings: string[],
) {
  const mutationPatterns = [
    /\b(?:setAttribute|setAttributeNS|toggleAttribute)\s*\(\s*['"`]data-preview-static['"`]/m,
    /\.(?:attr|prop)\s*\(\s*['"`]data-preview-static['"`]/m,
    /\bdataset\s*(?:\.\s*previewStatic|\[\s*['"`]previewStatic['"`]\s*\])\s*=/m,
    /\b(?:innerHTML|outerHTML)\s*\+?=[^;]{0,500}data-preview-static/m,
    /\.(?:replace|replaceAll)\s*\([\s\S]{0,500}?data-preview-static/m,
  ];

  for (const artifact of artifacts.filter(
    (candidate) => candidate.kind === 'source',
  )) {
    const directMutation = mutationPatterns
      .map((pattern) => pattern.exec(artifact.content))
      .find((candidate): candidate is RegExpExecArray => Boolean(candidate));
    const staticMarkerOffset = artifact.content.search(/data-preview-static/);
    const writesFilesystemOutput =
      /\b(?:writeFile|writeFileSync|appendFile|appendFileSync)\s*\(/m.exec(
        artifact.content,
      );
    const isNonJsxScript = /\.[cm]?[jt]s$/i.test(artifact.filePath);
    const generatedFileMutation =
      staticMarkerOffset >= 0 && isNonJsxScript && writesFilesystemOutput;
    if (!directMutation && !generatedFileMutation) {
      continue;
    }
    const offset = directMutation?.index ?? staticMarkerOffset;
    findings.push(
      `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} programmatically injects data-preview-static. Author each intentional static annotation directly on the smallest source element; blanket or post-build annotation bypasses strict editable-content validation.`,
    );
  }
}

function validatePreviewRuntimeCapability(
  artifacts: TemplateVisualEditingArtifact[],
  findings: string[],
) {
  const sourceArtifacts = artifacts.filter(
    (artifact) => artifact.kind === 'source',
  );
  const source = sourceArtifacts.map((artifact) => artifact.content).join('\n');

  const usesPackageProvider =
    /(?:import|export)\s+[\s\S]*?\b(?:SiteDataProvider|BaseSiteDataProvider|useSiteData|DenebProvider|DenebSiteDataProvider|DenebUiProvider)\b[\s\S]*?\bfrom\s+['"][^'"]*['"]/m.test(
      source,
    ) ||
    /(?:import|export)\s+[\s\S]*?\bfrom\s+['"](?:@fivora\/|deneb-ui|@deneb-ui\/)/m.test(
      source,
    ) ||
    /<(?:SiteDataProvider|BaseSiteDataProvider|DenebProvider|DenebSiteDataProvider|DenebUiProvider|[A-Za-z_$][\w$]*\.(?:SiteDataProvider|DenebProvider))\b/m.test(
      source,
    );

  if (usesPackageProvider) {
    return;
  }

  const hasDataProtocol =
    source.includes(PRIMARY_PREVIEW_DATA_MESSAGE) ||
    source.includes(LEGACY_PREVIEW_DATA_MESSAGE);
  const hasReadyProtocol =
    source.includes(PRIMARY_PREVIEW_READY_MESSAGE) ||
    source.includes(LEGACY_PREVIEW_READY_MESSAGE);
  const hasMessageListener =
    /(?:window|globalThis|self)\s*\.\s*addEventListener\s*\(\s*['"]message['"]/m.test(
      source,
    ) || /(?:window|globalThis|self)\s*\.\s*onmessage\s*=/m.test(source);
  const hasReactiveUpdate =
    /\bset[A-Z_$][\w$]*\s*\(/m.test(source) ||
    /\bdispatch\s*\(/m.test(source) ||
    /\b(?:store|siteDataStore)\s*\.\s*(?:setState|set|update)\s*\(/m.test(
      source,
    );
  const hasReactiveDataHandler = sourceArtifacts.some((artifact) => {
    const artifactSource = artifact.content;
    const listensForMessages =
      /(?:window|globalThis|self)\s*\.\s*addEventListener\s*\(\s*['"]message['"]/m.test(
        artifactSource,
      ) ||
      /(?:window|globalThis|self)\s*\.\s*onmessage\s*=/m.test(artifactSource);
    const updatesReactiveData =
      /\bset[A-Z_$][\w$]*\s*\(/m.test(artifactSource) ||
      /\bdispatch\s*\(/m.test(artifactSource) ||
      /\b(?:store|siteDataStore)\s*\.\s*(?:setState|set|update)\s*\(/m.test(
        artifactSource,
      );
    return (
      (artifactSource.includes(PRIMARY_PREVIEW_DATA_MESSAGE) ||
        artifactSource.includes(LEGACY_PREVIEW_DATA_MESSAGE)) &&
      listensForMessages &&
      updatesReactiveData
    );
  });
  const hasContextProvider =
    /\bcreateContext\s*[<(]/m.test(source) &&
    /(?:\.Provider\b|<[A-Za-z_$][\w$]*Provider\b)/m.test(source) &&
    /\buseContext\s*[<(]/m.test(source);
  const hasReactiveProvider =
    hasContextProvider ||
    /\buseSyncExternalStore\s*[<(]/m.test(source) ||
    (/\bcreate(?:Store|Signal)\s*[<(]/m.test(source) &&
      /\buse[A-Z_$][\w$]*(?:Store|Data)\s*[<(]/m.test(source));
  const emitsReady = sourceArtifacts.some(
    (artifact) =>
      (artifact.content.includes(PRIMARY_PREVIEW_READY_MESSAGE) ||
        artifact.content.includes(LEGACY_PREVIEW_READY_MESSAGE)) &&
      /\bpostMessage\s*\(/m.test(artifact.content),
  );

  if (!hasDataProtocol) {
    findings.push(
      `Preview runtime source must implement the "${PRIMARY_PREVIEW_DATA_MESSAGE}" (or legacy "${LEGACY_PREVIEW_DATA_MESSAGE}") protocol so editor changes replace the rendered site data instead of remaining in a static JSON import.`,
    );
  }
  if (!hasReadyProtocol) {
    findings.push(
      `Preview runtime source must implement the "${PRIMARY_PREVIEW_READY_MESSAGE}" (or legacy "${LEGACY_PREVIEW_READY_MESSAGE}") protocol so the editor can wait for a live preview before sending data.`,
    );
  }
  if (!hasMessageListener || !hasReactiveUpdate || !hasReactiveDataHandler) {
    findings.push(
      `Preview runtime source must handle "${PRIMARY_PREVIEW_DATA_MESSAGE}" (or legacy "${LEGACY_PREVIEW_DATA_MESSAGE}") and apply its payload through a reactive state setter, reducer, or store update in the same live-data module.`,
    );
  }
  if (!hasReactiveProvider) {
    findings.push(
      'Preview runtime source must expose live site data through a recognizable reactive provider/hook (for example createContext + Provider + useContext, useSyncExternalStore, or a reactive store hook). Static site-data.json imports alone cannot be certified.',
    );
  }
  if (!emitsReady) {
    findings.push(
      `Preview runtime source must call postMessage with "${PREVIEW_READY_MESSAGE}" after its live-data listener is ready.`,
    );
  }
}

function validateLiveProductRouting(
  artifacts: TemplateVisualEditingArtifact[],
  findings: string[],
) {
  const sourceArtifacts = artifacts.filter(
    (artifact) => artifact.kind === 'source',
  );
  const legacyRoutePatterns = [
    /\/products\/\$\{/m,
    /['"`]\/products\/['"`]\s*\+\s*(?:encodeURIComponent\s*\()?/m,
  ];

  for (const artifact of sourceArtifacts) {
    const match = legacyRoutePatterns
      .map((pattern) => pattern.exec(artifact.content))
      .find((candidate): candidate is RegExpExecArray => Boolean(candidate));
    if (!match) continue;
    findings.push(
      `${artifact.filePath}:${lineNumberAt(artifact.content, match.index)} uses a build-time dynamic /products/:id URL. Live catalog items can be added after a static export, so product links must use the stable exported route /products/detail/?id=... and resolve the ID from the live catalog on the client.`,
    );
  }

  const usesStableProductRoute = sourceArtifacts.some((artifact) =>
    /\/products\/detail\/?(?:\?[^'"`\s]*)?/m.test(artifact.content),
  );
  if (!usesStableProductRoute) return;

  const exportsStableProductRoute = artifacts.some(
    (artifact) =>
      artifact.kind === 'html' &&
      /(?:^|\/)products\/detail\/(?:index\.)?html$/i.test(
        artifact.filePath.replace(/\\/g, '/'),
      ),
  );
  if (!exportsStableProductRoute) {
    findings.push(
      'Product links use /products/detail/?id=..., but the static export does not contain products/detail/index.html. Add a static detail page that reads the query ID and hydrates the matching item from the live catalog.',
    );
  }
}

function auditUnmarkedVisibleHtml(
  artifacts: TemplateVisualEditingArtifact[],
  pages: TemplateVisualEditingPage[],
) {
  const warnings: string[] = [];
  for (const artifact of artifacts.filter(
    (candidate) =>
      candidate.kind === 'html' &&
      !isUnmanifestedFrameworkErrorDocument(candidate.filePath, pages),
  )) {
    warnings.push(...auditHtmlArtifact(artifact));
  }
  return warnings;
}

function isUnmanifestedFrameworkErrorDocument(
  filePath: string,
  pages: TemplateVisualEditingPage[],
) {
  const normalizedFile = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const frameworkErrorDocument =
    /^(?:404|500|_error|_not-found)(?:\/index)?\.html$/i.test(normalizedFile);
  if (!frameworkErrorDocument) {
    return false;
  }

  return !pages.some((page) => {
    const route = normalizePageRoute(page.route);
    return route ? artifactMatchesRoute(normalizedFile, route) : false;
  });
}

function auditHtmlArtifact(artifact: TemplateVisualEditingArtifact) {
  const findings: string[] = [];
  const stack: Array<{
    tag: string;
    ignored: boolean;
    hidden: boolean;
    fieldCovered: boolean;
    staticCovered: boolean;
    ownsFieldMarker: boolean;
    hasNestedFieldMarker: boolean;
    fieldPath: string | null;
    itemPath: string | null;
    shopAttributeValues: string[];
    visibleTextParts: string[];
    offset: number;
  }> = [];
  const tokens = artifact.content.matchAll(
    /<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g,
  );

  for (const tokenMatch of tokens) {
    const token = tokenMatch[0];
    const offset = tokenMatch.index ?? 0;
    const parent = stack.at(-1);

    if (token.startsWith('<!--') || token.startsWith('<!')) {
      continue;
    }

    if (token.startsWith('</')) {
      const closingTag = token
        .slice(2, -1)
        .trim()
        .split(/\s+/)[0]
        ?.toLowerCase();
      const matchingIndex = stack
        .map((entry) => entry.tag)
        .lastIndexOf(closingTag);
      if (matchingIndex >= 0) {
        findings.push(...auditFieldMarkerScope(artifact, stack[matchingIndex]));
        stack.splice(matchingIndex);
      }
      continue;
    }

    if (token.startsWith('<')) {
      const tagMatch = token.match(/^<\s*([a-zA-Z0-9:-]+)/);
      if (!tagMatch) {
        continue;
      }
      const tag = tagMatch[1].toLowerCase();
      const hasFieldMarker = /\bdata-preview-field-path\s*=/.test(token);
      const hasListMarker = /\bdata-preview-list-path\s*=/.test(token);
      const hasItemMarker = /\bdata-preview-item-path\s*=/.test(token);
      const hasEditableMarker =
        hasFieldMarker || hasListMarker || hasItemMarker;
      if (hasFieldMarker) {
        for (const ancestor of stack) {
          if (ancestor.ownsFieldMarker) {
            ancestor.hasNestedFieldMarker = true;
          }
        }
      }
      const staticMatch = token.match(
        /\bdata-preview-static\s*=\s*(?:"([^"]*)"|'([^']*)')/,
      );
      const hasStaticMarker = Boolean(staticMatch);
      if (
        hasStaticMarker &&
        !(staticMatch?.[1] ?? staticMatch?.[2] ?? '').trim()
      ) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} data-preview-static requires a reason.`,
        );
      }
      if (hasEditableMarker && (hasStaticMarker || parent?.staticCovered)) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} data-preview field/list/item markers cannot be on or inside data-preview-static. The visual editor intentionally ignores targets beneath a static ancestor.`,
        );
      }
      if (hasFieldMarker && BROAD_CONTENT_CONTAINERS.has(tag)) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} data-preview-field-path cannot be placed on broad <${tag}> content containers. Put the marker on the exact visible text, media, link, or control that the field edits.`,
        );
      }
      if (hasStaticMarker && BROAD_CONTENT_CONTAINERS.has(tag)) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} data-preview-static cannot cover a broad <${tag}> content container. Mark only the smallest genuinely non-editable element.`,
        );
      }

      const hidden = Boolean(parent?.hidden) || isHiddenHtmlElement(token, tag);
      if (hasEditableMarker && hidden) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} data-preview field/list/item marker is hidden. Strict visual-edit targets must remain visible and clickable in the exported page.`,
        );
      }

      const fieldPath =
        token
          .match(/\bdata-preview-field-path\s*=\s*(?:"([^"]*)"|'([^']*)')/)
          ?.slice(1)
          .find(Boolean) ?? null;
      const ownItemPath =
        token
          .match(/\bdata-preview-item-path\s*=\s*(?:"([^"]*)"|'([^']*)')/)
          ?.slice(1)
          .find(Boolean) ?? null;
      if (
        ownItemPath &&
        parent?.itemPath &&
        !isFieldOwnedByRepeatedItem(ownItemPath, parent.itemPath)
      ) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} repeated item "${ownItemPath}" is nested inside unrelated item "${parent.itemPath}". One visual card must be one object-list item; do not couple parallel arrays by index.`,
        );
      }
      const itemPath = ownItemPath ?? parent?.itemPath ?? null;
      if (
        fieldPath &&
        itemPath &&
        /\[\d+\]/.test(fieldPath) &&
        !isFieldOwnedByRepeatedItem(fieldPath, itemPath)
      ) {
        findings.push(
          `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} repeated field "${fieldPath}" is rendered inside item "${itemPath}" but belongs to a different list. Model one visual card as one object-list item instead of coupling parallel arrays by index.`,
        );
      }

      const context = {
        tag,
        ignored: Boolean(parent?.ignored) || IGNORED_HTML_CONTAINERS.has(tag),
        hidden,
        fieldCovered: Boolean(parent?.fieldCovered) || hasFieldMarker,
        staticCovered: Boolean(parent?.staticCovered) || hasStaticMarker,
        ownsFieldMarker: hasFieldMarker,
        hasNestedFieldMarker: false,
        fieldPath,
        itemPath,
        shopAttributeValues: collectShopSensitiveAttributeValues(token, tag),
        visibleTextParts: [] as string[],
        offset,
      };

      if (!context.ignored && !context.fieldCovered && !context.staticCovered) {
        const sensitiveFindings = auditSensitiveAttributes(
          artifact,
          token,
          tag,
          offset,
        );
        findings.push(...sensitiveFindings);
        if (
          tag === 'img' &&
          !context.hidden &&
          sensitiveFindings.length === 0
        ) {
          findings.push(
            `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} rendered <img> is not covered by data-preview-field-path or data-preview-static. Bind business media to an exact image field, or mark an intentional fixed/decorative image static with a reason.`,
          );
        }
      }

      if (!VOID_HTML_TAGS.has(tag) && !/\/\s*>$/.test(token)) {
        stack.push(context);
      }
      continue;
    }

    const visibleText = normalizeVisibleText(token);
    if (isMeaningfulVisibleText(visibleText)) {
      for (const ancestor of stack) {
        if (ancestor.ownsFieldMarker) {
          ancestor.visibleTextParts.push(visibleText);
        }
      }
    }
    if (parent?.ignored || parent?.fieldCovered || parent?.staticCovered) {
      continue;
    }

    if (isMeaningfulVisibleText(visibleText)) {
      findings.push(
        `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} visible text "${truncate(visibleText, 72)}" is not covered by data-preview-field-path or data-preview-static.`,
      );
    }
  }

  return findings;
}

function isFieldOwnedByRepeatedItem(fieldPath: string, itemPath: string) {
  const normalizedField = decodeHtmlAttribute(fieldPath).trim();
  const normalizedItem = decodeHtmlAttribute(itemPath).trim();
  return (
    normalizedField === normalizedItem ||
    normalizedField.startsWith(`${normalizedItem}.`) ||
    normalizedField.startsWith(`${normalizedItem}[`)
  );
}

function auditFieldMarkerScope(
  artifact: TemplateVisualEditingArtifact,
  entry: {
    tag: string;
    ownsFieldMarker: boolean;
    hasNestedFieldMarker: boolean;
    fieldPath: string | null;
    shopAttributeValues: string[];
    visibleTextParts: string[];
    offset: number;
  },
) {
  if (
    !entry.ownsFieldMarker ||
    entry.hasNestedFieldMarker ||
    entry.shopAttributeValues.length === 0
  ) {
    return [];
  }

  const visibleText = normalizeVisibleText(entry.visibleTextParts.join(' '));
  if (
    !isMeaningfulVisibleText(visibleText) ||
    entry.shopAttributeValues.some((value) =>
      attributeValueMatchesVisibleText(value, visibleText),
    )
  ) {
    return [];
  }

  return [
    `${artifact.filePath}:${lineNumberAt(artifact.content, entry.offset)} data-preview-field-path="${entry.fieldPath ?? ''}" cannot cover both <${entry.tag}> action/media attributes and different visible text "${truncate(visibleText, 72)}". Put the action/media marker on the element and the label marker on an exact nested text element.`,
  ];
}

function collectShopSensitiveAttributeValues(token: string, tag: string) {
  return [
    ...token.matchAll(/\b(href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),
  ]
    .map((attribute) => ({
      name: attribute[1].toLowerCase(),
      value: decodeHtmlAttribute(attribute[2] ?? attribute[3] ?? '').trim(),
    }))
    .filter(({ name, value }) => isShopSensitiveAttribute(tag, name, value))
    .map(({ value }) => value);
}

function attributeValueMatchesVisibleText(value: string, visibleText: string) {
  const normalizeComparable = (candidate: string) =>
    decodeHtmlAttribute(candidate)
      .replace(/^(?:mailto:|tel:|sms:|https?:\/\/)/i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();

  return normalizeComparable(value) === normalizeComparable(visibleText);
}

function auditSensitiveAttributes(
  artifact: TemplateVisualEditingArtifact,
  token: string,
  tag: string,
  offset: number,
) {
  const findings: string[] = [];
  const attributes = [
    ...token.matchAll(/\b(href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),
  ];

  for (const attribute of attributes) {
    const name = attribute[1].toLowerCase();
    const value = decodeHtmlAttribute(
      attribute[2] ?? attribute[3] ?? '',
    ).trim();
    if (!isShopSensitiveAttribute(tag, name, value)) {
      continue;
    }
    findings.push(
      `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} ${tag}[${name}="${truncate(value, 72)}"] is not covered by data-preview-field-path or data-preview-static.`,
    );
  }

  const visibleTextAttributes = [
    ...token.matchAll(
      /\b(placeholder|alt|title|aria-label|value)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    ),
  ];
  const inputTypeMatch = token.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const inputType = (
    inputTypeMatch?.[1] ??
    inputTypeMatch?.[2] ??
    ''
  ).toLowerCase();

  for (const attribute of visibleTextAttributes) {
    const name = attribute[1].toLowerCase();
    const value = normalizeVisibleText(attribute[2] ?? attribute[3] ?? '');
    const relevant =
      name === 'aria-label' ||
      name === 'title' ||
      (name === 'alt' && tag === 'img') ||
      (name === 'placeholder' && ['input', 'textarea'].includes(tag)) ||
      (name === 'value' &&
        ['input', 'button'].includes(tag) &&
        !['hidden', 'checkbox', 'radio'].includes(inputType));
    if (!relevant || !isMeaningfulVisibleText(value)) {
      continue;
    }
    findings.push(
      `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} ${tag}[${name}="${truncate(value, 72)}"] is not covered by data-preview-field-path or data-preview-static.`,
    );
  }

  const style = token.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if (
    style &&
    /(?:background|background-image)\s*:[^;]*url\(/i.test(
      style[1] ?? style[2] ?? '',
    )
  ) {
    findings.push(
      `${artifact.filePath}:${lineNumberAt(artifact.content, offset)} background image is not covered by data-preview-field-path or data-preview-static.`,
    );
  }

  return findings;
}

function isHiddenHtmlElement(token: string, tag: string) {
  if (
    /\bhidden(?:\s|=|\/?>)/i.test(token) ||
    /\baria-hidden\s*=\s*(?:"true"|'true')/i.test(token)
  ) {
    return true;
  }

  if (tag === 'input') {
    const inputType = token.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (
      (inputType?.[1] ?? inputType?.[2] ?? '').trim().toLowerCase() === 'hidden'
    ) {
      return true;
    }
  }

  const style = token.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const styleValue = style?.[1] ?? style?.[2] ?? '';
  return (
    /\bdisplay\s*:\s*none\b/i.test(styleValue) ||
    /\bvisibility\s*:\s*hidden\b/i.test(styleValue)
  );
}

function validateSchemaSectionUniqueness(
  schema: TemplateEditorSchema | null,
  findings: string[],
) {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const section of schema?.sections ?? []) {
    if (seenIds.has(section.id)) {
      findings.push(
        `editorSchema.sections contains duplicate id "${section.id}".`,
      );
    }
    if (seenPaths.has(section.path)) {
      findings.push(
        `editorSchema.sections contains duplicate path "${section.path}".`,
      );
    }
    seenIds.add(section.id);
    seenPaths.add(section.path);
  }
}

function validateSchemaPathUniqueness(
  schema: TemplateEditorSchema | null,
  findings: string[],
) {
  for (const duplicate of findDuplicateTemplateEditorPaths(schema)) {
    const kind =
      duplicate.firstKind === duplicate.duplicateKind
        ? duplicate.firstKind
        : 'field/list';
    findings.push(
      `editorSchema declares duplicate editable ${kind} path "${duplicate.path}" in sections "${duplicate.firstSectionId}" and "${duplicate.duplicateSectionId}". Each editable path must be owned by exactly one section.`,
    );
  }
}

function isShopSensitiveAttribute(tag: string, name: string, value: string) {
  if (
    !value ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.includes('/_next/') ||
    value.includes('${')
  ) {
    return false;
  }

  if (name === 'href') {
    return tag === 'a' && !/^(?:javascript:|data:|blob:)/i.test(value);
  }

  return (
    (name === 'src' && ['img', 'video', 'source'].includes(tag)) ||
    (name === 'poster' && tag === 'video')
  );
}

function normalizeVisibleText(value: string) {
  return decodeHtmlAttribute(value).replace(/\s+/g, ' ').trim();
}

function isMeaningfulVisibleText(value: string) {
  if (value.length <= 2 || !/\p{L}/u.test(value)) {
    return false;
  }
  return !/^(?:true|false|null|undefined)$/i.test(value);
}

function markerAttributeFragment(label: string) {
  if (label === 'editable field') return 'field-path';
  if (label === 'editable list') return 'list-path';
  return 'item-path';
}

function markerCoversPattern(marker: string, expectedPattern: string) {
  if (!expectedPattern.includes('[*]')) {
    return marker === expectedPattern;
  }
  return marker.includes('[*]') && marker === expectedPattern;
}

function pathsOverlap(left: string, right: string) {
  return wildcardPath(left) === wildcardPath(right);
}

function isControlOnly(path: string, controlOnlyPaths: string[]) {
  return controlOnlyPaths.some((controlPath) =>
    controlPath.includes('[*]')
      ? wildcardPath(path) === controlPath
      : path === controlPath,
  );
}

function canonicalizeMarkerPath(value: string) {
  const normalized = value
    .trim()
    .replace(/\[\s*\$\{[^}]+\}\s*\]/g, '[*]')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']');
  return CANONICAL_PATH_PATTERN.test(normalized) ? normalized : null;
}

function wildcardPath(path: string) {
  return path.replace(/\[\d+\]/g, '[*]');
}

function appendPath(basePath: string, key: string) {
  return basePath ? `${basePath}.${key}` : key;
}

function normalizePageRoute(route?: string) {
  if (!route) {
    return null;
  }
  const trimmed = route.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    trimmed.includes('\\') ||
    trimmed.includes('..')
  ) {
    return null;
  }
  if (trimmed === '/') {
    return trimmed;
  }
  return trimmed.replace(/\/+$/, '');
}

function legacyPageRoute(pageId: string) {
  return pageId === 'home' ? '/' : `/${pageId}`;
}

function artifactMatchesRoute(filePath: string, route: string) {
  const normalizedFile = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (route === '/') {
    return normalizedFile === 'index.html';
  }
  const routePath = route.replace(/^\/+/, '');
  return (
    normalizedFile === `${routePath}.html` ||
    normalizedFile === `${routePath}/index.html`
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ');
}

function lineNumberForMarker(marker: TemplateVisualEditMarker) {
  return marker.line;
}

function lineNumberAt(content: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
    }
  }
  return line;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

type PrimitiveType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'image'
  | 'number'
  | 'boolean'
  | 'select';

type BaseNode = {
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Recommended source-image dimensions shown by fivora upload UIs. */
  recommendedWidth?: number;
  recommendedHeight?: number;
};

export type TemplateEditorPrimitiveField = BaseNode & {
  key: string;
  type: PrimitiveType;
  options?: string[];
  sharedFieldKey?: string;
};

export type TemplateEditorObjectField = BaseNode & {
  key: string;
  type: 'object';
  fields: TemplateEditorField[];
};

export type TemplateEditorListField = BaseNode & {
  key: string;
  type: 'list';
  itemLabel?: string;
  itemField?: Omit<TemplateEditorPrimitiveField, 'key'>;
  fields?: TemplateEditorField[];
  minItems?: number;
  maxItems?: number;
};

export type TemplateEditorField =
  | TemplateEditorPrimitiveField
  | TemplateEditorObjectField
  | TemplateEditorListField;

export type TemplateEditorSection = BaseNode & {
  id: string;
  path: string;
  pageKey?: string;
  type: PrimitiveType | 'object' | 'list';
  fields?: TemplateEditorField[];
  itemLabel?: string;
  itemField?: Omit<TemplateEditorPrimitiveField, 'key'>;
  minItems?: number;
  maxItems?: number;
  options?: string[];
  /** Only valid when this section itself is primitive. */
  sharedFieldKey?: string;
};

export type TemplateEditorSchema = {
  version: number;
  sections: TemplateEditorSection[];
};

export type TemplateRenderedContentPathsByPage = Record<string, string[]>;

export type TemplateEditorValidationIssue = {
  path: string;
  label: string;
  message: string;
};

export type DuplicateTemplateEditorPath = {
  path: string;
  firstKind: 'field' | 'list';
  duplicateKind: 'field' | 'list';
  firstSectionId: string;
  duplicateSectionId: string;
};

export type TemplateSharedFieldMember = {
  path: string;
  label: string;
  type: PrimitiveType;
  required: boolean;
  options?: string[];
  underList: boolean;
  order: number;
};

export type TemplateSharedFieldGroup = {
  sharedFieldKey: string;
  canonicalPath: string;
  paths: string[];
  members: TemplateSharedFieldMember[];
};

export type TemplateSharedFieldContractValidation = {
  errors: string[];
  warnings: string[];
};

export type SynchronizeTemplateSharedFieldResult = {
  content: Record<string, unknown>;
  contentSourceMap: Record<string, string>;
  synchronizedPaths: string[];
};

type TemplateEditorPrimitiveNode =
  | TemplateEditorPrimitiveField
  | Omit<TemplateEditorPrimitiveField, 'key'>
  | (TemplateEditorSection & {
      type: Exclude<TemplateEditorSection['type'], 'object' | 'list'>;
    });

type ManifestPage = {
  id: string;
  label: string;
};

const SECTION_METADATA: Record<string, { label: string; pageKey?: string }> = {
  common: { label: 'Common Content' },
  home: { label: 'Home Page', pageKey: 'home' },
  about: { label: 'About Page', pageKey: 'about_us' },
  services: { label: 'Services', pageKey: 'services' },
  products: { label: 'Products', pageKey: 'products' },
  gallery: { label: 'Gallery', pageKey: 'gallery' },
  contact: { label: 'Contact Page', pageKey: 'contact' },
  additionalPages: { label: 'Additional Pages' },
};

const PRIMITIVE_TYPES = new Set<PrimitiveType>([
  'text',
  'textarea',
  'email',
  'tel',
  'url',
  'image',
  'number',
  'boolean',
  'select',
]);

const STANDARD_EDITOR_SCHEMA: TemplateEditorSchema = {
  version: 1,
  sections: [
    {
      id: 'common',
      path: 'common',
      label: 'Common Content',
      type: 'object',
      fields: [
        {
          key: 'logoUrl',
          type: 'image',
          label: 'Website logo',
          description:
            'Used by templates that read content.common.logoUrl or merchant.logoUrl.',
        },
      ],
    },
  ],
};

export function normalizeTemplateEditorSchema(
  input: unknown,
): TemplateEditorSchema | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const sectionCandidates = Array.isArray(candidate.sections)
    ? candidate.sections
    : [];

  const sections = sectionCandidates
    .map((section) => normalizeSection(section))
    .filter((section): section is TemplateEditorSection => Boolean(section));

  if (sections.length === 0) {
    return null;
  }

  return {
    version:
      typeof candidate.version === 'number' &&
      Number.isFinite(candidate.version)
        ? candidate.version
        : 1,
    sections,
  };
}

export function deriveTemplateEditorSchema(
  contentDefaults: Record<string, unknown>,
  manifestPages: ManifestPage[] = [],
): TemplateEditorSchema {
  const pageLabelMap = new Map(
    manifestPages.map((page) => [page.id, page.label]),
  );
  const sections = Object.entries(contentDefaults)
    .map(([key, value]) => deriveSection(key, value, pageLabelMap))
    .filter((section): section is TemplateEditorSection => Boolean(section));

  return {
    version: 1,
    sections,
  };
}

/**
 * A nested section owns its complete subtree. Some older templates declared
 * that subtree both inside an ancestor object and as a dedicated section (for
 * example `gallery.projects`). Keeping both copies makes the shop-owner form and
 * AI field inventory ask for the exact same path twice. Preserve the dedicated
 * section and remove its duplicate node from the ancestor at runtime.
 */
export function canonicalizeTemplateEditorSchema(
  schema: TemplateEditorSchema | null,
): TemplateEditorSchema | null {
  if (!schema) {
    return null;
  }

  const sectionsByPath = new Map<string, TemplateEditorSection>();
  for (const section of schema.sections) {
    const existing = sectionsByPath.get(section.path);
    sectionsByPath.set(
      section.path,
      existing ? mergeSections(existing, section) : section,
    );
  }

  const sections = [...sectionsByPath.values()];
  const sectionPaths = sections.map((section) => section.path);
  const canonicalSections = sections
    .map((section) => {
      const inheritedNodes = sections
        .filter((candidate) =>
          isDescendantEditorPath(section.path, candidate.path),
        )
        .sort(
          (left, right) =>
            editorPathDepth(right.path) - editorPathDepth(left.path),
        )
        .map((ancestor) =>
          findSchemaSectionAtPath(
            { ...schema, sections: [ancestor] },
            section.path,
          ),
        )
        .filter((node): node is TemplateEditorSection => Boolean(node));
      const enrichedSection = inheritedNodes.reduce(
        (primary, fallback) => mergeSections(primary, fallback),
        section,
      );
      const delegatedPaths = new Set(
        sectionPaths.filter(
          (candidate) =>
            candidate !== section.path &&
            isDescendantEditorPath(candidate, section.path),
        ),
      );
      return omitSectionPaths(enrichedSection, delegatedPaths);
    })
    .filter((section): section is TemplateEditorSection => Boolean(section));

  return { ...schema, sections: canonicalSections };
}

/**
 * Reports repeated primitive/list paths before runtime canonicalization. This
 * is used by template certification so new packages receive a clear authoring
 * error, while canonicalization keeps already-published templates usable.
 */
export function findDuplicateTemplateEditorPaths(
  schema: TemplateEditorSchema | null,
): DuplicateTemplateEditorPath[] {
  if (!schema) {
    return [];
  }

  const seen = new Map<string, { kind: 'field' | 'list'; sectionId: string }>();
  const duplicates: DuplicateTemplateEditorPath[] = [];
  const reported = new Set<string>();

  const record = (path: string, kind: 'field' | 'list', sectionId: string) => {
    const canonicalPath = normalizeEditorPathPattern(path);
    const first = seen.get(canonicalPath);
    if (!first) {
      seen.set(canonicalPath, { kind, sectionId });
      return;
    }
    if (reported.has(canonicalPath)) {
      return;
    }
    reported.add(canonicalPath);
    duplicates.push({
      path: canonicalPath,
      firstKind: first.kind,
      duplicateKind: kind,
      firstSectionId: first.sectionId,
      duplicateSectionId: sectionId,
    });
  };

  const visit = (
    path: string,
    node: TemplateEditorSection | TemplateEditorField,
    sectionId: string,
  ) => {
    if (node.type === 'object') {
      for (const field of node.fields ?? []) {
        visit(appendPath(path, field.key), field, sectionId);
      }
      return;
    }
    if (node.type === 'list') {
      const listPath = normalizeEditorPathPattern(path);
      record(listPath, 'list', sectionId);
      const itemPath = `${listPath}[*]`;
      if (node.itemField) {
        record(itemPath, 'field', sectionId);
      }
      for (const field of node.fields ?? []) {
        visit(appendPath(itemPath, field.key), field, sectionId);
      }
      return;
    }
    record(path, 'field', sectionId);
  };

  for (const section of schema.sections) {
    visit(section.path, section, section.id);
  }
  return duplicates;
}

const TEMPLATE_SHARED_FIELD_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const TEMPLATE_SHARED_FIELD_KEY_MAX_LENGTH = 80;

export function isValidTemplateSharedFieldKey(value: string) {
  return (
    value.length <= TEMPLATE_SHARED_FIELD_KEY_MAX_LENGTH &&
    TEMPLATE_SHARED_FIELD_KEY_PATTERN.test(value)
  );
}

/**
 * Compiles authored shared-value declarations in stable schema order. A group
 * keeps multiple physical content paths in sync while templates remain free to
 * render the same business fact in different sections.
 */
export function collectTemplateSharedFieldGroups(
  schema: TemplateEditorSchema | null,
): TemplateSharedFieldGroup[] {
  if (!schema) return [];

  const groups = new Map<string, TemplateSharedFieldMember[]>();
  let order = 0;
  const addPrimitive = (
    path: string,
    node: TemplateEditorPrimitiveNode,
    underList: boolean,
  ) => {
    const sharedFieldKey = readTemplateSharedFieldKey(node);
    if (!sharedFieldKey) return;
    const members = groups.get(sharedFieldKey) ?? [];
    members.push({
      path: normalizeEditorPathPattern(path),
      label: node.label,
      type: node.type,
      required: Boolean(node.required),
      options: node.type === 'select' ? node.options : undefined,
      underList,
      order: order++,
    });
    groups.set(sharedFieldKey, members);
  };
  const visit = (
    path: string,
    node:
      | TemplateEditorSection
      | TemplateEditorField
      | Omit<TemplateEditorPrimitiveField, 'key'>,
    underList: boolean,
  ) => {
    if (node.type === 'object') {
      for (const field of node.fields ?? []) {
        visit(appendPath(path, field.key), field, underList);
      }
      return;
    }
    if (node.type === 'list') {
      const itemPath = `${normalizeEditorPathPattern(path)}[*]`;
      if (node.itemField) {
        addPrimitive(itemPath, node.itemField, true);
      }
      for (const field of node.fields ?? []) {
        visit(appendPath(itemPath, field.key), field, true);
      }
      return;
    }
    addPrimitive(path, node as TemplateEditorPrimitiveNode, underList);
  };

  for (const section of schema.sections) {
    visit(section.path, section, false);
  }

  return [...groups.entries()].map(([sharedFieldKey, unsortedMembers]) => {
    const members = [...unsortedMembers].sort((left, right) => {
      if (left.required !== right.required) {
        return left.required ? -1 : 1;
      }
      return left.order - right.order;
    });
    return {
      sharedFieldKey,
      canonicalPath: members[0].path,
      paths: members.map((member) => member.path),
      members,
    };
  });
}

export function validateTemplateSharedFieldContract(
  schema: TemplateEditorSchema | null,
): TemplateSharedFieldContractValidation {
  if (!schema) return { errors: [], warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];
  const visitDeclarationPlacement = (
    path: string,
    node: TemplateEditorSection | TemplateEditorField,
  ) => {
    const sharedFieldKey = readTemplateSharedFieldKey(node);
    if (sharedFieldKey && (node.type === 'object' || node.type === 'list')) {
      errors.push(
        `editorSchema ${node.type} "${path}" cannot declare sharedFieldKey "${sharedFieldKey}". Put sharedFieldKey only on primitive fields.`,
      );
    }
    if (node.type === 'object') {
      for (const field of node.fields ?? []) {
        visitDeclarationPlacement(appendPath(path, field.key), field);
      }
      return;
    }
    if (node.type === 'list') {
      const itemPath = `${normalizeEditorPathPattern(path)}[*]`;
      if (node.itemField) {
        const itemKey = readTemplateSharedFieldKey(node.itemField);
        if (itemKey && !isValidTemplateSharedFieldKey(itemKey)) {
          errors.push(invalidTemplateSharedFieldKeyMessage(itemKey, itemPath));
        }
      }
      for (const field of node.fields ?? []) {
        visitDeclarationPlacement(appendPath(itemPath, field.key), field);
      }
      return;
    }
    if (sharedFieldKey && !isValidTemplateSharedFieldKey(sharedFieldKey)) {
      errors.push(invalidTemplateSharedFieldKeyMessage(sharedFieldKey, path));
    }
  };
  for (const section of schema.sections) {
    visitDeclarationPlacement(section.path, section);
  }

  for (const group of collectTemplateSharedFieldGroups(schema)) {
    if (!isValidTemplateSharedFieldKey(group.sharedFieldKey)) continue;
    const uniquePaths = new Set(group.paths);
    if (uniquePaths.size !== group.paths.length) {
      errors.push(
        `sharedFieldKey "${group.sharedFieldKey}" declares the same physical path more than once. Keep each path in one editorSchema location.`,
      );
    }
    if (
      group.members.some(
        (member) => member.underList || member.path.includes('[*]'),
      )
    ) {
      errors.push(
        `sharedFieldKey "${group.sharedFieldKey}" cannot include wildcard or list-member paths. Shared fields must be single primitive values.`,
      );
    }
    if (group.members.length < 2) {
      warnings.push(
        `sharedFieldKey "${group.sharedFieldKey}" is declared only once at "${group.canonicalPath}". Add another physical path or remove the key.`,
      );
      continue;
    }

    const families = new Set(
      group.members.map((member) => sharedFieldValueFamily(member.type)),
    );
    if (families.size > 1) {
      errors.push(
        `sharedFieldKey "${group.sharedFieldKey}" mixes incompatible value families (${group.members.map((member) => `${member.path}:${member.type}`).join(', ')}).`,
      );
    }

    const selectMembers = group.members.filter(
      (member) => member.type === 'select',
    );
    if (
      selectMembers.length > 0 &&
      selectMembers.length !== group.members.length
    ) {
      errors.push(
        `sharedFieldKey "${group.sharedFieldKey}" cannot mix select and free-text fields.`,
      );
    } else if (selectMembers.length > 1) {
      const firstOptions = normalizeSharedSelectOptions(
        selectMembers[0].options,
      );
      if (
        selectMembers
          .slice(1)
          .some(
            (member) =>
              normalizeSharedSelectOptions(member.options) !== firstOptions,
          )
      ) {
        errors.push(
          `sharedFieldKey "${group.sharedFieldKey}" has conflicting select options. Every member must allow the same values.`,
        );
      }
    }
  }

  return {
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
  };
}

/**
 * Mirrors a declared shared value to every physical path. Explicitly changed
 * paths win (including an intentional empty value); otherwise the first
 * meaningful value in required-first schema order becomes the shared value.
 */
export function synchronizeTemplateSharedFieldContent(input: {
  content: Record<string, unknown>;
  schema: TemplateEditorSchema | null;
  contentSourceMap?: Record<string, string>;
  preferredPaths?: ReadonlySet<string> | string[];
}): SynchronizeTemplateSharedFieldResult {
  let content = structuredClone(input.content);
  const contentSourceMap = { ...(input.contentSourceMap ?? {}) };
  const preferredPaths =
    input.preferredPaths instanceof Set
      ? input.preferredPaths
      : new Set(input.preferredPaths ?? []);
  const synchronizedPaths = new Set<string>();

  for (const group of collectTemplateSharedFieldGroups(input.schema)) {
    if (!isRuntimeTemplateSharedFieldGroup(group)) continue;
    const preferredMembers = group.members.filter((member) =>
      preferredPaths.has(member.path),
    );
    const orderedMembers = [
      ...preferredMembers,
      ...group.members.filter((member) => !preferredPaths.has(member.path)),
    ];
    const preferredValue = preferredMembers
      .map((member) => ({
        member,
        presentValue: readEditorContentPath(content, member.path),
      }))
      .find(({ presentValue }) => presentValue.present);
    const candidates = orderedMembers.map((member) => ({
      member,
      presentValue: readEditorContentPath(content, member.path),
    }));
    const selected =
      preferredValue ??
      candidates.find(({ presentValue }) =>
        isMeaningfulTemplateSharedFieldValue(presentValue.value),
      ) ??
      candidates.find(({ presentValue }) => presentValue.present);
    if (!selected) continue;

    const selectedSource = contentSourceMap[selected.member.path];
    for (const member of group.members) {
      const current = readEditorContentPath(content, member.path);
      if (
        !current.present ||
        !Object.is(current.value, selected.presentValue.value)
      ) {
        content = setEditorContentPath(
          content,
          member.path,
          selected.presentValue.value,
        );
        synchronizedPaths.add(member.path);
      }
      if (selectedSource) {
        contentSourceMap[member.path] = selectedSource;
      } else {
        delete contentSourceMap[member.path];
      }
    }
  }

  return {
    content,
    contentSourceMap,
    synchronizedPaths: [...synchronizedPaths].sort(),
  };
}

function readTemplateSharedFieldKey(node: unknown) {
  if (!node || typeof node !== 'object') return null;
  const value = (node as { sharedFieldKey?: unknown }).sharedFieldKey;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function invalidTemplateSharedFieldKeyMessage(key: string, path: string) {
  return `editorSchema primitive "${path}" has invalid sharedFieldKey "${key}". Use 1-${TEMPLATE_SHARED_FIELD_KEY_MAX_LENGTH} lowercase letters/numbers separated by dots, underscores, or hyphens.`;
}

function sharedFieldValueFamily(type: PrimitiveType) {
  if (type === 'image') return 'image';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

function normalizeSharedSelectOptions(options?: string[]) {
  return [...new Set(options ?? [])].sort().join('\u0000');
}

function isRuntimeTemplateSharedFieldGroup(group: TemplateSharedFieldGroup) {
  if (
    !isValidTemplateSharedFieldKey(group.sharedFieldKey) ||
    group.members.length < 2 ||
    new Set(group.paths).size !== group.paths.length ||
    group.members.some(
      (member) => member.underList || member.path.includes('[*]'),
    )
  ) {
    return false;
  }
  const families = new Set(
    group.members.map((member) => sharedFieldValueFamily(member.type)),
  );
  if (families.size !== 1) return false;
  const selects = group.members.filter((member) => member.type === 'select');
  if (selects.length > 0 && selects.length !== group.members.length) {
    return false;
  }
  return (
    selects.length < 2 ||
    selects
      .slice(1)
      .every(
        (member) =>
          normalizeSharedSelectOptions(member.options) ===
          normalizeSharedSelectOptions(selects[0].options),
      )
  );
}

function isMeaningfulTemplateSharedFieldValue(value: unknown) {
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

function readEditorContentPath(content: Record<string, unknown>, path: string) {
  let cursor: unknown = content;
  for (const part of path.split('.')) {
    if (!isPlainObject(cursor)) {
      return { present: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, part)) {
      return { present: false, value: undefined };
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return { present: true, value: cursor };
}

function setEditorContentPath(
  content: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const next = structuredClone(content);
  const parts = path.split('.');
  let cursor = next;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

/**
 * Keeps the developer-authored labels, validation rules, and field order while
 * recovering any content paths that exist in site-data.json but were omitted
 * from a partial editorSchema.
 */
export function mergeTemplateEditorSchemas(
  schema: TemplateEditorSchema | null,
  fallbackSchema: TemplateEditorSchema | null,
): TemplateEditorSchema | null {
  if (!schema) {
    return canonicalizeTemplateEditorSchema(fallbackSchema);
  }

  if (!fallbackSchema) {
    return canonicalizeTemplateEditorSchema(schema);
  }

  const primary = canonicalizeTemplateEditorSchema(schema) ?? schema;
  const fallback =
    canonicalizeTemplateEditorSchema(fallbackSchema) ?? fallbackSchema;
  const primaryPaths = primary.sections.map((section) => section.path);
  const mergedSections = primary.sections.map((section) => {
    const fallbackNode = findSchemaSectionAtPath(fallback, section.path);
    if (!fallbackNode) {
      return section;
    }
    const delegatedPaths = new Set(
      primaryPaths.filter(
        (candidate) =>
          candidate !== section.path &&
          isDescendantEditorPath(candidate, section.path),
      ),
    );
    const prunedFallback = omitSectionPaths(fallbackNode, delegatedPaths);
    return prunedFallback ? mergeSections(section, prunedFallback) : section;
  });

  const primaryRootPaths = new Set(primary.sections.map(({ path }) => path));
  const remainingFallbackSections = fallback.sections
    .filter((section) => !primaryRootPaths.has(section.path))
    .map((section) =>
      omitSectionPaths(
        section,
        new Set(
          primaryPaths.filter((candidate) =>
            isDescendantEditorPath(candidate, section.path),
          ),
        ),
      ),
    )
    .filter((section): section is TemplateEditorSection => Boolean(section));

  return canonicalizeTemplateEditorSchema({
    ...fallbackSchema,
    ...schema,
    sections: [...mergedSections, ...remainingFallbackSections],
  });
}

export function addStandardTemplateEditorFields(
  schema: TemplateEditorSchema | null,
) {
  return schema
    ? mergeTemplateEditorSchemas(schema, STANDARD_EDITOR_SCHEMA)
    : null;
}

/**
 * Reconstructs the pre-canonicalization merge only for validating intake-plan
 * hashes stored by older releases. Runtime callers must use
 * mergeTemplateEditorSchemas so duplicate paths are repaired.
 */
export function mergeTemplateEditorSchemasForLegacyHash(
  schema: TemplateEditorSchema | null,
  fallbackSchema: TemplateEditorSchema | null,
): TemplateEditorSchema | null {
  if (!schema) {
    return fallbackSchema;
  }
  if (!fallbackSchema) {
    return schema;
  }

  const fallbackByPath = new Map(
    fallbackSchema.sections.map((section) => [section.path, section]),
  );
  const mergedSections = schema.sections.map((section) => {
    const fallback = fallbackByPath.get(section.path);
    fallbackByPath.delete(section.path);
    return fallback ? mergeSections(section, fallback) : section;
  });

  return {
    ...fallbackSchema,
    ...schema,
    sections: [...mergedSections, ...fallbackByPath.values()],
  };
}

/** See mergeTemplateEditorSchemasForLegacyHash. */
export function addStandardTemplateEditorFieldsForLegacyHash(
  schema: TemplateEditorSchema | null,
) {
  return schema
    ? mergeTemplateEditorSchemasForLegacyHash(schema, STANDARD_EDITOR_SCHEMA)
    : null;
}

export function filterEditorSchemaBySelectedPages(
  schema: TemplateEditorSchema | null,
  selectedPages: string[],
  renderedContentPathsByPage: TemplateRenderedContentPathsByPage = {},
): TemplateEditorSchema | null {
  if (!schema) {
    return null;
  }

  if (selectedPages.length === 0) {
    return schema;
  }

  const hasRenderedMetadata = selectedPages.every((page) =>
    Object.prototype.hasOwnProperty.call(renderedContentPathsByPage, page),
  );
  if (!hasRenderedMetadata) {
    return {
      ...schema,
      sections: schema.sections.filter(
        (section) =>
          !section.pageKey || selectedPages.includes(section.pageKey),
      ),
    };
  }

  const renderedPaths = new Set(
    selectedPages
      .flatMap((page) => renderedContentPathsByPage[page] ?? [])
      .map((path) => path.replace(/\[\d+\]/g, '[*]')),
  );
  const sections = schema.sections
    .map((section): TemplateEditorSection | null =>
      filterSectionByRenderedPaths(section, renderedPaths),
    )
    .filter((section): section is TemplateEditorSection => Boolean(section));

  return { ...schema, sections };
}

function filterSectionByRenderedPaths(
  section: TemplateEditorSection,
  renderedPaths: ReadonlySet<string>,
): TemplateEditorSection | null {
  const filterField = (
    field: TemplateEditorField,
    path: string,
  ): TemplateEditorField | null => {
    if (field.type === 'object') {
      const fields = field.fields
        .map((child) => filterField(child, appendPath(path, child.key)))
        .filter((child): child is TemplateEditorField => Boolean(child));
      return fields.length > 0 ? { ...field, fields } : null;
    }
    if (field.type === 'list') {
      const itemPath = `${path}[*]`;
      const fields = field.fields
        ?.map((child) => filterField(child, appendPath(itemPath, child.key)))
        .filter((child): child is TemplateEditorField => Boolean(child));
      const itemField =
        field.itemField && renderedPaths.has(itemPath)
          ? field.itemField
          : undefined;
      return fields?.length || itemField
        ? {
            ...field,
            fields: fields?.length ? fields : undefined,
            itemField,
          }
        : null;
    }
    return renderedPaths.has(path) ? field : null;
  };

  if (section.type === 'object') {
    const fields = (section.fields ?? [])
      .map((field) => filterField(field, appendPath(section.path, field.key)))
      .filter((field): field is TemplateEditorField => Boolean(field));
    return fields.length > 0 ? { ...section, fields } : null;
  }
  if (section.type === 'list') {
    const itemPath = `${section.path}[*]`;
    const fields = section.fields
      ?.map((field) => filterField(field, appendPath(itemPath, field.key)))
      .filter((field): field is TemplateEditorField => Boolean(field));
    const itemField =
      section.itemField && renderedPaths.has(itemPath)
        ? section.itemField
        : undefined;
    return fields?.length || itemField
      ? {
          ...section,
          fields: fields?.length ? fields : undefined,
          itemField,
        }
      : null;
  }
  return renderedPaths.has(section.path) ? section : null;
}

/**
 * Templates often demand a full demo-sized list (seven services, six projects).
 * A real business only has to supply one item to publish, so the agent-facing
 * schema caps how many items are demanded while keeping the list itself.
 */
export function clampEditorSchemaListMinimums(
  schema: TemplateEditorSchema | null,
  maxMinimumItems: number,
): TemplateEditorSchema | null {
  if (!schema) {
    return null;
  }

  const clampField = (field: TemplateEditorField): TemplateEditorField => {
    if (field.type === 'object') {
      return { ...field, fields: field.fields.map(clampField) };
    }
    if (field.type === 'list') {
      return {
        ...field,
        minItems: clampMinimum(field.minItems, maxMinimumItems, field.maxItems),
        fields: field.fields?.map(clampField),
      };
    }
    return field;
  };

  return {
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      ...(section.type === 'list'
        ? {
            minItems: clampMinimum(
              section.minItems,
              maxMinimumItems,
              section.maxItems,
            ),
          }
        : {}),
      fields: section.fields?.map(clampField),
    })),
  };
}

function clampMinimum(
  minItems: number | undefined,
  maximum: number,
  maxItems?: number,
) {
  if (typeof minItems !== 'number') {
    return minItems;
  }
  const upperBound =
    typeof maxItems === 'number' ? Math.min(maximum, maxItems) : maximum;
  return Math.max(0, Math.min(Math.floor(minItems), upperBound));
}

export function omitEditorSchemaPaths(
  schema: TemplateEditorSchema | null,
  hiddenPaths: string[],
): TemplateEditorSchema | null {
  if (!schema) {
    return null;
  }

  if (hiddenPaths.length === 0) {
    return schema;
  }

  const hidden = new Set(
    hiddenPaths.map((path) => path.trim()).filter(Boolean),
  );
  const sections = schema.sections
    .map((section) => omitSectionPaths(section, hidden))
    .filter((section): section is TemplateEditorSection => Boolean(section));

  if (sections.length === 0) {
    return null;
  }

  return {
    ...schema,
    sections,
  };
}

export function validateContentAgainstEditorSchema(
  content: Record<string, unknown>,
  schema: TemplateEditorSchema | null,
): TemplateEditorValidationIssue[] {
  if (!schema) {
    return [];
  }

  return schema.sections.flatMap((section) =>
    validateSection(section, content),
  );
}

export function validateSectionAgainstEditorSchema(
  content: Record<string, unknown>,
  section: TemplateEditorSection,
): TemplateEditorValidationIssue[] {
  return validateSection(section, content);
}

export function sectionHasRequiredFields(section: TemplateEditorSection) {
  return hasRequiredNodes(section);
}

function hasMeaningfulEditorValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasMeaningfulEditorValue(entry));
  }
  if (isPlainObject(value)) {
    return Object.values(value).some((entry) =>
      hasMeaningfulEditorValue(entry),
    );
  }
  return false;
}

function isEmptyEditorListItem(
  item: unknown,
  node: Extract<TemplateEditorField, { type: 'list' }>,
): boolean {
  if (node.fields?.length) {
    const record = isPlainObject(item) ? item : {};
    const requiredFields = node.fields.filter((field) => field.required);
    if (requiredFields.length > 0) {
      return requiredFields.every(
        (field) => !hasMeaningfulEditorValue(record[field.key]),
      );
    }
    const contentFields = node.fields.filter(
      (field) =>
        !/^(?:id|identifier|uuid|uid|pageKey|slug|route|sortOrder|displayOrder|icon|iconName|iconClass|color|variant|theme)$/i.test(
          field.key,
        ),
    );
    return !(contentFields.length > 0 ? contentFields : node.fields).some(
      (field) => hasMeaningfulEditorValue(record[field.key]),
    );
  }

  if (node.itemField) {
    return !hasMeaningfulEditorValue(item);
  }

  return !hasMeaningfulEditorValue(item);
}

function pruneEditorListNodeValue(
  value: unknown,
  node: TemplateEditorSection | TemplateEditorField,
): unknown {
  if (node.type === 'object') {
    const record = isPlainObject(value) ? { ...value } : {};
    for (const field of node.fields ?? []) {
      record[field.key] = pruneEditorListNodeValue(record[field.key], field);
    }
    return record;
  }

  if (node.type !== 'list') {
    return value;
  }

  const listNode = node as Extract<TemplateEditorField, { type: 'list' }>;
  const items = Array.isArray(value) ? value : [];
  const keptItems = items.filter(
    (item) => !isEmptyEditorListItem(item, listNode),
  );
  if (!listNode.fields?.length) {
    return keptItems;
  }

  return keptItems.map((item) => {
    const record = isPlainObject(item) ? { ...item } : {};
    for (const field of listNode.fields ?? []) {
      record[field.key] = pruneEditorListNodeValue(record[field.key], field);
    }
    return record;
  });
}

function setEditorSectionValueByPath(
  content: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor = content;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = value;
}

/** Removes blank list rows so preview/build only render shop-owner-entered items. */
export function pruneEmptyEditorListItems(
  content: Record<string, unknown>,
  schema: TemplateEditorSchema | null | undefined,
): Record<string, unknown> {
  if (!schema) {
    return content;
  }

  const result = JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
  for (const section of schema.sections) {
    setEditorSectionValueByPath(
      result,
      section.path,
      pruneEditorListNodeValue(getValueByPath(result, section.path), section),
    );
  }
  return result;
}

function normalizeSection(input: unknown): TemplateEditorSection | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const id = normalizeString(candidate.id);
  const path = normalizeString(candidate.path);
  const label = normalizeString(candidate.label);
  const type = normalizeNodeType(candidate.type);

  if (!id || !path || !label || !type) {
    return null;
  }

  const common = {
    id,
    path,
    label,
    description: normalizeString(candidate.description) || undefined,
    required:
      typeof candidate.required === 'boolean' ? candidate.required : undefined,
    placeholder: normalizeString(candidate.placeholder) || undefined,
    maxLength: normalizeMaxLength(candidate.maxLength),
    recommendedWidth: normalizeImageDimension(candidate.recommendedWidth),
    recommendedHeight: normalizeImageDimension(candidate.recommendedHeight),
    pageKey: normalizeString(candidate.pageKey) || undefined,
    ...normalizeTemplateSharedFieldKeyProperty(candidate.sharedFieldKey),
  };

  if (type === 'object') {
    const fields = normalizeFieldList(candidate.fields);
    return {
      ...common,
      type,
      fields,
    };
  }

  if (type === 'list') {
    const fields = normalizeFieldList(candidate.fields);
    const itemField = normalizeItemField(candidate.itemField);
    if (fields.length === 0 && !itemField) {
      return null;
    }

    return {
      ...common,
      type,
      fields: fields.length > 0 ? fields : undefined,
      itemField: itemField ?? undefined,
      itemLabel: normalizeString(candidate.itemLabel) || undefined,
      minItems: normalizeListBound(candidate.minItems),
      maxItems: normalizeListBound(candidate.maxItems),
    };
  }

  return {
    ...common,
    type,
    options:
      type === 'select' ? normalizeOptions(candidate.options) : undefined,
  };
}

function omitSectionPaths(
  section: TemplateEditorSection,
  hiddenPaths: Set<string>,
): TemplateEditorSection | null {
  if (hiddenPaths.has(section.path)) {
    return null;
  }

  if (section.type === 'object') {
    const fields = (section.fields ?? [])
      .map((field) => omitFieldPaths(field, section.path, hiddenPaths))
      .filter((field): field is TemplateEditorField => Boolean(field));

    if (fields.length === 0) {
      return null;
    }

    return {
      ...section,
      fields,
    };
  }

  if (section.type === 'list') {
    const fields = (section.fields ?? [])
      .map((field) => omitFieldPaths(field, section.path, hiddenPaths))
      .filter((field): field is TemplateEditorField => Boolean(field));

    if (
      (section.fields?.length ?? 0) > 0 &&
      fields.length === 0 &&
      !section.itemField
    ) {
      return null;
    }

    return {
      ...section,
      fields: fields.length > 0 ? fields : undefined,
    };
  }

  return section;
}

function omitFieldPaths(
  field: TemplateEditorField,
  parentPath: string,
  hiddenPaths: Set<string>,
): TemplateEditorField | null {
  const fieldPath = appendPath(parentPath, field.key);
  if (hiddenPaths.has(fieldPath)) {
    return null;
  }

  if (field.type === 'object') {
    const fields = field.fields
      .map((child) => omitFieldPaths(child, fieldPath, hiddenPaths))
      .filter((child): child is TemplateEditorField => Boolean(child));

    if (fields.length === 0) {
      return null;
    }

    return {
      ...field,
      fields,
    };
  }

  if (field.type === 'list') {
    const fields = (field.fields ?? [])
      .map((child) => omitFieldPaths(child, fieldPath, hiddenPaths))
      .filter((child): child is TemplateEditorField => Boolean(child));

    if (
      (field.fields?.length ?? 0) > 0 &&
      fields.length === 0 &&
      !field.itemField
    ) {
      return null;
    }

    return {
      ...field,
      fields: fields.length > 0 ? fields : undefined,
    };
  }

  return field;
}

function normalizeFieldList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((field) => normalizeField(field))
    .filter((field): field is TemplateEditorField => Boolean(field));
}

function normalizeField(input: unknown): TemplateEditorField | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const key = normalizeString(candidate.key);
  const label = normalizeString(candidate.label);
  const type = normalizeNodeType(candidate.type);

  if (!key || !label || !type) {
    return null;
  }

  const common = {
    key,
    label,
    description: normalizeString(candidate.description) || undefined,
    required:
      typeof candidate.required === 'boolean' ? candidate.required : undefined,
    placeholder: normalizeString(candidate.placeholder) || undefined,
    maxLength: normalizeMaxLength(candidate.maxLength),
    recommendedWidth: normalizeImageDimension(candidate.recommendedWidth),
    recommendedHeight: normalizeImageDimension(candidate.recommendedHeight),
    ...normalizeTemplateSharedFieldKeyProperty(candidate.sharedFieldKey),
  };

  if (type === 'object') {
    return {
      ...common,
      type,
      fields: normalizeFieldList(candidate.fields),
    };
  }

  if (type === 'list') {
    const fields = normalizeFieldList(candidate.fields);
    const itemField = normalizeItemField(candidate.itemField);
    if (fields.length === 0 && !itemField) {
      return null;
    }

    return {
      ...common,
      type,
      fields: fields.length > 0 ? fields : undefined,
      itemField: itemField ?? undefined,
      itemLabel: normalizeString(candidate.itemLabel) || undefined,
      minItems: normalizeListBound(candidate.minItems),
      maxItems: normalizeListBound(candidate.maxItems),
    };
  }

  return {
    ...common,
    type,
    options:
      type === 'select' ? normalizeOptions(candidate.options) : undefined,
  };
}

function normalizeItemField(
  input: unknown,
): Omit<TemplateEditorPrimitiveField, 'key'> | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const label = normalizeString(candidate.label);
  const type = normalizePrimitiveType(candidate.type);

  if (!label || !type) {
    return null;
  }

  return {
    label,
    type,
    description: normalizeString(candidate.description) || undefined,
    required:
      typeof candidate.required === 'boolean' ? candidate.required : undefined,
    placeholder: normalizeString(candidate.placeholder) || undefined,
    maxLength: normalizeMaxLength(candidate.maxLength),
    recommendedWidth: normalizeImageDimension(candidate.recommendedWidth),
    recommendedHeight: normalizeImageDimension(candidate.recommendedHeight),
    ...normalizeTemplateSharedFieldKeyProperty(candidate.sharedFieldKey),
    options:
      type === 'select' ? normalizeOptions(candidate.options) : undefined,
  };
}

function normalizeTemplateSharedFieldKeyProperty(input: unknown) {
  return typeof input === 'string' && input.trim()
    ? { sharedFieldKey: input.trim() }
    : {};
}

function normalizeOptions(input: unknown) {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const options = input
    .map((value) => normalizeString(value))
    .filter((value): value is string => Boolean(value));

  return options.length > 0 ? options : undefined;
}

function normalizeMaxLength(input: unknown) {
  return typeof input === 'number' &&
    Number.isInteger(input) &&
    input > 0 &&
    input <= 10000
    ? input
    : undefined;
}

function normalizeImageDimension(input: unknown) {
  return typeof input === 'number' && Number.isSafeInteger(input) && input > 0
    ? input
    : undefined;
}

function normalizeListBound(input: unknown) {
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= 0
    ? input
    : undefined;
}

function normalizeNodeType(
  input: unknown,
): TemplateEditorSection['type'] | TemplateEditorField['type'] | null {
  if (input === 'object') {
    return input;
  }

  if (input === 'list' || input === 'array') {
    return 'list';
  }

  return normalizePrimitiveType(input);
}

function normalizePrimitiveType(input: unknown): PrimitiveType | null {
  return typeof input === 'string' &&
    PRIMITIVE_TYPES.has(input as PrimitiveType)
    ? (input as PrimitiveType)
    : null;
}

function deriveSection(
  key: string,
  value: unknown,
  pageLabelMap: Map<string, string>,
): TemplateEditorSection | null {
  const metadata = SECTION_METADATA[key];
  const exactPageKey = pageLabelMap.has(key) ? key : undefined;
  const legacyAboutPageKey =
    !exactPageKey && key === 'about' && pageLabelMap.has('about_us')
      ? 'about_us'
      : undefined;
  const pageKey = exactPageKey || legacyAboutPageKey || metadata?.pageKey;
  const label =
    (pageKey ? pageLabelMap.get(pageKey) : undefined) ||
    metadata?.label ||
    humanizeKey(key);

  if (Array.isArray(value)) {
    return deriveListSection(key, label, pageKey, value);
  }

  if (isPlainObject(value)) {
    return {
      id: key,
      path: key,
      label,
      pageKey,
      type: 'object',
      fields: Object.entries(value).map(([childKey, childValue]) =>
        deriveField(childKey, childValue),
      ),
    };
  }

  return {
    id: key,
    path: key,
    label,
    pageKey,
    ...derivePrimitivePresentation(key, value),
  };
}

function deriveField(key: string, value: unknown): TemplateEditorField {
  const label = humanizeKey(key);

  if (Array.isArray(value)) {
    return deriveListField(key, label, value);
  }

  if (isPlainObject(value)) {
    return {
      key,
      label,
      type: 'object',
      fields: Object.entries(value).map(([childKey, childValue]) =>
        deriveField(childKey, childValue),
      ),
    };
  }

  return {
    key,
    label,
    ...derivePrimitivePresentation(key, value),
  };
}

function deriveListSection(
  key: string,
  label: string,
  pageKey: string | undefined,
  value: unknown[],
): TemplateEditorSection {
  const sample = mergeObjectSamples(value);
  const itemLabel = singularize(label);

  if (isPlainObject(sample)) {
    return {
      id: key,
      path: key,
      label,
      pageKey,
      type: 'list',
      itemLabel,
      fields: Object.entries(sample).map(([childKey, childValue]) =>
        deriveField(childKey, childValue),
      ),
    };
  }

  return {
    id: key,
    path: key,
    label,
    pageKey,
    type: 'list',
    itemLabel,
    itemField: {
      label: itemLabel,
      ...derivePrimitivePresentation(key, sample),
    },
  };
}

function deriveListField(
  key: string,
  label: string,
  value: unknown[],
): TemplateEditorField {
  const sample = mergeObjectSamples(value);
  const itemLabel = singularize(label);

  if (isPlainObject(sample)) {
    return {
      key,
      label,
      type: 'list',
      itemLabel,
      fields: Object.entries(sample).map(([childKey, childValue]) =>
        deriveField(childKey, childValue),
      ),
    };
  }

  return {
    key,
    label,
    type: 'list',
    itemLabel,
    itemField: {
      label: itemLabel,
      ...derivePrimitivePresentation(key, sample),
    },
  };
}

function mergeSections(
  primary: TemplateEditorSection,
  fallback: TemplateEditorSection,
): TemplateEditorSection {
  const common = {
    ...fallback,
    ...primary,
    pageKey: primary.pageKey ?? fallback.pageKey,
    description: primary.description ?? fallback.description,
    placeholder: primary.placeholder ?? fallback.placeholder,
  };

  if (primary.type === 'object' && fallback.type === 'object') {
    return {
      ...common,
      type: 'object',
      fields: mergeFieldLists(primary.fields ?? [], fallback.fields ?? []),
    };
  }

  if (primary.type === 'list' && fallback.type === 'list') {
    const fields = mergeFieldLists(primary.fields ?? [], fallback.fields ?? []);
    return {
      ...common,
      type: 'list',
      fields: fields.length > 0 ? fields : undefined,
      itemField: mergePrimitiveItemFields(
        primary.itemField,
        fallback.itemField,
      ),
      itemLabel: primary.itemLabel ?? fallback.itemLabel,
      minItems: primary.minItems ?? fallback.minItems,
      maxItems: primary.maxItems ?? fallback.maxItems,
    };
  }

  return {
    ...primary,
    recommendedWidth: primary.recommendedWidth ?? fallback.recommendedWidth,
    recommendedHeight: primary.recommendedHeight ?? fallback.recommendedHeight,
  };
}

function mergeFieldLists(
  primaryFields: TemplateEditorField[],
  fallbackFields: TemplateEditorField[],
) {
  const fallbackByKey = new Map(
    fallbackFields.map((field) => [field.key, field]),
  );
  const mergedFields = primaryFields.map((field) => {
    const fallback = fallbackByKey.get(field.key);
    fallbackByKey.delete(field.key);
    return fallback ? mergeFields(field, fallback) : field;
  });

  return [...mergedFields, ...fallbackByKey.values()];
}

function mergeFields(
  primary: TemplateEditorField,
  fallback: TemplateEditorField,
): TemplateEditorField {
  const common = {
    ...fallback,
    ...primary,
    description: primary.description ?? fallback.description,
    placeholder: primary.placeholder ?? fallback.placeholder,
  };

  if (primary.type === 'object' && fallback.type === 'object') {
    return {
      ...common,
      type: 'object',
      fields: mergeFieldLists(primary.fields, fallback.fields),
    };
  }

  if (primary.type === 'list' && fallback.type === 'list') {
    const fields = mergeFieldLists(primary.fields ?? [], fallback.fields ?? []);
    return {
      ...common,
      type: 'list',
      fields: fields.length > 0 ? fields : undefined,
      itemField: mergePrimitiveItemFields(
        primary.itemField,
        fallback.itemField,
      ),
      itemLabel: primary.itemLabel ?? fallback.itemLabel,
      minItems: primary.minItems ?? fallback.minItems,
      maxItems: primary.maxItems ?? fallback.maxItems,
    };
  }

  return {
    ...primary,
    recommendedWidth: primary.recommendedWidth ?? fallback.recommendedWidth,
    recommendedHeight: primary.recommendedHeight ?? fallback.recommendedHeight,
  };
}

function mergePrimitiveItemFields(
  primary: Omit<TemplateEditorPrimitiveField, 'key'> | undefined,
  fallback: Omit<TemplateEditorPrimitiveField, 'key'> | undefined,
) {
  if (!primary) return fallback;
  if (!fallback || primary.type !== fallback.type) return primary;
  return {
    ...fallback,
    ...primary,
    recommendedWidth: primary.recommendedWidth ?? fallback.recommendedWidth,
    recommendedHeight: primary.recommendedHeight ?? fallback.recommendedHeight,
  };
}

function findSchemaSectionAtPath(
  schema: TemplateEditorSchema,
  targetPath: string,
): TemplateEditorSection | null {
  const asSection = (
    field: TemplateEditorField,
    path: string,
    shopOwner: TemplateEditorSection,
  ): TemplateEditorSection => {
    const { key, ...node } = field;
    void key;
    return {
      ...node,
      id: shopOwner.id,
      path,
      pageKey: shopOwner.pageKey,
    };
  };

  const visitField = (
    field: TemplateEditorField,
    path: string,
    shopOwner: TemplateEditorSection,
  ): TemplateEditorSection | null => {
    if (
      normalizeEditorPathPattern(path) ===
      normalizeEditorPathPattern(targetPath)
    ) {
      return asSection(field, path, shopOwner);
    }
    if (field.type === 'object') {
      for (const child of field.fields) {
        const found = visitField(child, appendPath(path, child.key), shopOwner);
        if (found) return found;
      }
    }
    if (field.type === 'list') {
      const itemPath = `${normalizeEditorPathPattern(path)}[*]`;
      for (const child of field.fields ?? []) {
        const found = visitField(child, appendPath(itemPath, child.key), shopOwner);
        if (found) return found;
      }
    }
    return null;
  };

  for (const section of schema.sections) {
    if (
      normalizeEditorPathPattern(section.path) ===
      normalizeEditorPathPattern(targetPath)
    ) {
      return section;
    }
    if (section.type === 'object') {
      for (const field of section.fields ?? []) {
        const found = visitField(
          field,
          appendPath(section.path, field.key),
          section,
        );
        if (found) return found;
      }
    }
    if (section.type === 'list') {
      const itemPath = `${normalizeEditorPathPattern(section.path)}[*]`;
      for (const field of section.fields ?? []) {
        const found = visitField(
          field,
          appendPath(itemPath, field.key),
          section,
        );
        if (found) return found;
      }
    }
  }
  return null;
}

function isDescendantEditorPath(candidate: string, parent: string) {
  const normalizedCandidate = normalizeEditorPathPattern(candidate);
  const normalizedParent = normalizeEditorPathPattern(parent);
  return (
    normalizedCandidate.startsWith(`${normalizedParent}.`) ||
    normalizedCandidate.startsWith(`${normalizedParent}[`)
  );
}

function normalizeEditorPathPattern(path: string) {
  return path.replace(/\[\d+\]/g, '[*]').trim();
}

function editorPathDepth(path: string) {
  return normalizeEditorPathPattern(path).split(/\.|\[/).filter(Boolean).length;
}

function mergeObjectSamples(values: unknown[]) {
  const objectSamples = values.filter(isPlainObject);
  if (objectSamples.length === 0) {
    return values.find((item) => item !== null && item !== undefined);
  }

  return objectSamples.reduce<Record<string, unknown>>(
    (merged, sample) => mergeSampleObjects(merged, sample),
    {},
  );
}

function mergeSampleObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      merged[key] = mergeSampleObjects(existing, value);
      continue;
    }

    if (Array.isArray(existing) && Array.isArray(value)) {
      merged[key] = [...existing, ...value];
      continue;
    }

    if (
      existing === undefined ||
      existing === null ||
      (Array.isArray(existing) && existing.length === 0)
    ) {
      merged[key] = value;
    }
  }

  return merged;
}

function derivePrimitivePresentation(key: string, value: unknown) {
  const type = inferPrimitiveType(key, value);
  if (type !== 'image' || typeof value !== 'string' || !value.trim()) {
    return { type };
  }

  // Many template image services encode the intended source crop directly in
  // their URL (`?w=600&h=400`). Reuse that template-authored information when
  // explicit editorSchema dimensions are absent, so every generated image
  // field can give useful upload guidance without a per-template path table.
  try {
    const url = new URL(value, 'https://fivora-template.invalid');
    const width = normalizeImageDimension(
      Number(url.searchParams.get('w') ?? url.searchParams.get('width')),
    );
    const height = normalizeImageDimension(
      Number(url.searchParams.get('h') ?? url.searchParams.get('height')),
    );
    return {
      type,
      ...(width ? { recommendedWidth: width } : {}),
      ...(height ? { recommendedHeight: height } : {}),
    };
  } catch {
    return { type };
  }
}

function inferPrimitiveType(key: string, value: unknown): PrimitiveType {
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  const normalizedKey = key.toLowerCase();

  if (normalizedKey.includes('email')) {
    return 'email';
  }

  if (
    normalizedKey.includes('phone') ||
    normalizedKey.includes('mobile') ||
    normalizedKey.includes('whatsapp') ||
    normalizedKey.includes('contactnumber')
  ) {
    return 'tel';
  }

  if (
    normalizedKey.includes('image') ||
    normalizedKey.includes('logo') ||
    normalizedKey.includes('banner') ||
    normalizedKey.includes('thumbnail') ||
    normalizedKey.includes('photo')
  ) {
    return 'image';
  }

  if (
    normalizedKey.includes('url') ||
    normalizedKey.includes('link') ||
    (typeof value === 'string' && /^https?:\/\//i.test(value.trim()))
  ) {
    return 'url';
  }

  if (
    normalizedKey.includes('description') ||
    normalizedKey.includes('about') ||
    normalizedKey.includes('mission') ||
    normalizedKey.includes('vision') ||
    normalizedKey.includes('history') ||
    normalizedKey.includes('hours') ||
    normalizedKey.includes('address') ||
    normalizedKey.includes('body') ||
    (typeof value === 'string' && value.length > 120)
  ) {
    return 'textarea';
  }

  return 'text';
}

function validateSection(
  section: TemplateEditorSection,
  content: Record<string, unknown>,
): TemplateEditorValidationIssue[] {
  const value = getValueByPath(content, section.path);
  return validateNode(value, section, section.path, section.label);
}

function validateNode(
  value: unknown,
  node:
    | TemplateEditorSection
    | TemplateEditorField
    | Omit<TemplateEditorPrimitiveField, 'key'>,
  path: string,
  label: string,
): TemplateEditorValidationIssue[] {
  if (node.type === 'object') {
    const objectValue = isPlainObject(value)
      ? (value as Record<string, unknown>)
      : {};
    const fields =
      'fields' in node && Array.isArray(node.fields) ? node.fields : [];
    return fields.flatMap((field) =>
      validateNode(
        objectValue[field.key],
        field,
        appendPath(path, field.key),
        `${label} - ${field.label}`,
      ),
    );
  }

  if (node.type === 'list') {
    const items = Array.isArray(value) ? value : [];
    const minItems =
      'minItems' in node && typeof node.minItems === 'number'
        ? node.minItems
        : node.required
          ? 1
          : 0;
    const maxItems =
      'maxItems' in node && typeof node.maxItems === 'number'
        ? node.maxItems
        : undefined;
    const boundaryIssues: TemplateEditorValidationIssue[] = [];

    if (items.length < minItems) {
      boundaryIssues.push({
        path,
        label,
        message: `${label} requires at least ${minItems} item${minItems === 1 ? '' : 's'}.`,
      });
    }

    if (typeof maxItems === 'number' && items.length > maxItems) {
      boundaryIssues.push({
        path,
        label,
        message: `${label} allows at most ${maxItems} item${maxItems === 1 ? '' : 's'}.`,
      });
    }

    if (boundaryIssues.length > 0) {
      return boundaryIssues;
    }

    if (
      'fields' in node &&
      Array.isArray(node.fields) &&
      node.fields.length > 0
    ) {
      return items.flatMap((item, index) => {
        const objectItem = isPlainObject(item)
          ? (item as Record<string, unknown>)
          : {};
        return node.fields!.flatMap((field) =>
          validateNode(
            objectItem[field.key],
            field,
            appendIndexedPath(path, index, field.key),
            `${label} ${index + 1} - ${field.label}`,
          ),
        );
      });
    }

    if ('itemField' in node && node.itemField) {
      return items.flatMap((item, index) =>
        validatePrimitiveValue(
          item,
          node.itemField!,
          appendIndexedPath(path, index),
          `${label} ${index + 1}`,
        ),
      );
    }

    return [];
  }

  return validatePrimitiveValue(
    value,
    node as TemplateEditorPrimitiveNode,
    path,
    label,
  );
}

function validatePrimitiveValue(
  value: unknown,
  node:
    | TemplateEditorPrimitiveField
    | Omit<TemplateEditorPrimitiveField, 'key'>
    | TemplateEditorPrimitiveNode,
  path: string,
  label: string,
): TemplateEditorValidationIssue[] {
  if (!node.required) {
    return [];
  }

  if (node.type === 'boolean') {
    if (typeof value === 'boolean') {
      return [];
    }

    return [
      {
        path,
        label,
        message: `${label} is required.`,
      },
    ];
  }

  if (node.type === 'number') {
    if (typeof value === 'number') {
      return [];
    }

    if (
      typeof value === 'string' &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return [];
    }

    return [
      {
        path,
        label,
        message: `${label} is required.`,
      },
    ];
  }

  if (typeof value === 'string' && value.trim()) {
    return [];
  }

  return [
    {
      path,
      label,
      message: `${label} is required.`,
    },
  ];
}

function hasRequiredNodes(node: TemplateEditorSection | TemplateEditorField) {
  if ('required' in node && node.required) {
    return true;
  }

  if (node.type === 'object') {
    return (node.fields ?? []).some((field) => hasRequiredNodes(field));
  }

  if (node.type === 'list') {
    if ((node.minItems ?? 0) > 0) {
      return true;
    }

    if (node.itemField?.required) {
      return true;
    }

    return (node.fields ?? []).some((field) => hasRequiredNodes(field));
  }

  return false;
}

function getValueByPath(content: Record<string, unknown>, path: string) {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  let current: unknown = content;
  for (const part of parts) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function normalizeSchemaPathPattern(path: string) {
  return path.replace(/\[\d+\]/g, '[*]');
}

function collectSchemaFieldPathPatterns(
  node: TemplateEditorSection | TemplateEditorField,
  path: string,
  patterns: Set<string>,
) {
  if (node.type === 'object') {
    for (const child of node.fields ?? []) {
      collectSchemaFieldPathPatterns(
        child,
        appendPath(path, child.key),
        patterns,
      );
    }
    return;
  }

  if (node.type === 'list') {
    patterns.add(normalizeSchemaPathPattern(path));
    const itemPath = `${path}[*]`;
    if (node.fields?.length) {
      for (const child of node.fields) {
        collectSchemaFieldPathPatterns(
          child,
          appendPath(itemPath, child.key),
          patterns,
        );
      }
    } else if (node.itemField) {
      patterns.add(normalizeSchemaPathPattern(itemPath));
    }
    return;
  }

  patterns.add(normalizeSchemaPathPattern(path));
}

/**
 * Derives page-to-field-path placement metadata from the editor schema. Strict
 * packages store the authoritative index from exported HTML markers; legacy
 * and uncertified templates fall back to this schema walk so every uploaded
 * template can resolve field locations consistently.
 */
export function deriveRenderedContentPathsByPage(
  schema: TemplateEditorSchema | null,
  pageKeys: string[],
): TemplateRenderedContentPathsByPage {
  if (!schema || pageKeys.length === 0) {
    return {};
  }

  const pageKeySet = new Set(pageKeys);
  const result: Record<string, Set<string>> = {};

  for (const section of schema.sections) {
    const pageKey =
      section.pageKey?.trim() ||
      section.id?.trim() ||
      section.path.split('.')[0]?.trim() ||
      '';
    if (!pageKey || !pageKeySet.has(pageKey)) {
      continue;
    }

    const patterns = new Set<string>();
    collectSchemaFieldPathPatterns(section, section.path, patterns);
    if (!result[pageKey]) {
      result[pageKey] = new Set();
    }
    patterns.forEach((pattern) => result[pageKey].add(pattern));
  }

  return Object.fromEntries(
    Object.entries(result).map(([pageKey, patterns]) => [
      pageKey,
      [...patterns].sort(),
    ]),
  );
}

function appendPath(basePath: string, key: string) {
  return basePath ? `${basePath}.${key}` : key;
}

function appendIndexedPath(basePath: string, index: number, key?: string) {
  const indexed = `${basePath}[${index}]`;
  return key ? `${indexed}.${key}` : indexed;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function singularize(label: string) {
  if (/ies$/i.test(label)) {
    return label.replace(/ies$/i, 'y');
  }

  if (/s$/i.test(label) && !/ss$/i.test(label)) {
    return label.replace(/s$/i, '');
  }

  return label;
}

/**
 * Coerces primitive values to their target schema type (e.g. string "25" -> number 25,
 * string "true" -> boolean true, number/boolean -> string for text fields).
 */
export function coercePrimitiveValue(
  value: unknown,
  type: PrimitiveType,
  defaultValue?: unknown,
): unknown {
  if (value === null || value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    return value;
  }

  if (type === 'number') {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : (defaultValue ?? value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return defaultValue !== undefined ? defaultValue : null;
      }
      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
    if (defaultValue !== undefined && typeof defaultValue === 'number') {
      return defaultValue;
    }
    return value;
  }

  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === '1') return true;
      if (trimmed === 'false' || trimmed === '0') return false;
      if (trimmed === '') {
        return defaultValue !== undefined ? defaultValue : false;
      }
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (defaultValue !== undefined && typeof defaultValue === 'boolean') {
      return defaultValue;
    }
    return Boolean(value);
  }

  if (
    type === 'text' ||
    type === 'textarea' ||
    type === 'email' ||
    type === 'tel' ||
    type === 'url' ||
    type === 'select' ||
    type === 'image'
  ) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return value;
}

function coerceNodeValue(
  value: unknown,
  node: TemplateEditorSection | TemplateEditorField,
  defaultVal?: unknown,
): unknown {
  if (node.type === 'object') {
    if (!isPlainObject(value)) return value;
    const obj = { ...(value as Record<string, unknown>) };
    const defaultObj = isPlainObject(defaultVal)
      ? (defaultVal as Record<string, unknown>)
      : undefined;
    for (const field of node.fields ?? []) {
      if (Object.prototype.hasOwnProperty.call(obj, field.key)) {
        obj[field.key] = coerceNodeValue(
          obj[field.key],
          field,
          defaultObj ? defaultObj[field.key] : undefined,
        );
      }
    }
    return obj;
  }

  if (node.type === 'list') {
    if (!Array.isArray(value)) return value;
    const defaultArr = Array.isArray(defaultVal) ? defaultVal : undefined;
    const sampleDefaultItem =
      defaultArr && defaultArr.length > 0 ? defaultArr[0] : undefined;

    return value.map((item, index) => {
      const itemDefault =
        defaultArr && defaultArr[index] !== undefined
          ? defaultArr[index]
          : sampleDefaultItem;

      if (node.fields && node.fields.length > 0) {
        if (!isPlainObject(item)) return item;
        const itemObj = { ...(item as Record<string, unknown>) };
        const itemDefaultObj = isPlainObject(itemDefault)
          ? (itemDefault as Record<string, unknown>)
          : undefined;
        for (const field of node.fields) {
          if (Object.prototype.hasOwnProperty.call(itemObj, field.key)) {
            itemObj[field.key] = coerceNodeValue(
              itemObj[field.key],
              field,
              itemDefaultObj ? itemDefaultObj[field.key] : undefined,
            );
          }
        }
        return itemObj;
      }

      if (node.itemField) {
        return coercePrimitiveValue(item, node.itemField.type, itemDefault);
      }

      return item;
    });
  }

  return coercePrimitiveValue(
    value,
    node.type as PrimitiveType,
    defaultVal,
  );
}

function coerceAtDottedPath(
  current: Record<string, unknown>,
  pathParts: string[],
  section: TemplateEditorSection,
  defaults?: Record<string, unknown> | null,
): Record<string, unknown> {
  const [head, ...rest] = pathParts;
  if (!head) return current;

  if (rest.length === 0) {
    if (Object.prototype.hasOwnProperty.call(current, head)) {
      const defaultVal =
        defaults && isPlainObject(defaults) ? defaults[head] : undefined;
      current[head] = coerceNodeValue(current[head], section, defaultVal);
    }
    return current;
  }

  if (isPlainObject(current[head])) {
    const nextDefaults =
      defaults && isPlainObject(defaults) && isPlainObject(defaults[head])
        ? (defaults[head] as Record<string, unknown>)
        : undefined;
    current[head] = coerceAtDottedPath(
      current[head] as Record<string, unknown>,
      rest,
      section,
      nextDefaults,
    );
  }

  return current;
}

function coerceViaDefaults(current: unknown, defaultVal: unknown): unknown {
  if (defaultVal === null || defaultVal === undefined) {
    return current;
  }

  if (typeof defaultVal === 'number') {
    return coercePrimitiveValue(current, 'number', defaultVal);
  }

  if (typeof defaultVal === 'boolean') {
    return coercePrimitiveValue(current, 'boolean', defaultVal);
  }

  if (typeof defaultVal === 'string') {
    return coercePrimitiveValue(current, 'text', defaultVal);
  }

  if (Array.isArray(defaultVal)) {
    if (!Array.isArray(current)) return current;
    if (defaultVal.length === 0) return current;

    const sampleItem = defaultVal[0];
    return current.map((item, idx) => {
      const defItem =
        defaultVal[idx] !== undefined ? defaultVal[idx] : sampleItem;
      return coerceViaDefaults(item, defItem);
    });
  }

  if (isPlainObject(defaultVal)) {
    if (!isPlainObject(current)) return current;
    const currentObj = { ...(current as Record<string, unknown>) };
    for (const [k, v] of Object.entries(currentObj)) {
      if (Object.prototype.hasOwnProperty.call(defaultVal, k)) {
        currentObj[k] = coerceViaDefaults(
          v,
          (defaultVal as Record<string, unknown>)[k],
        );
      }
    }
    return currentObj;
  }

  return current;
}

/**
 * Coerces website content values to their intended schema/default primitive types
 * (e.g. numeric strings like "25" to 25, boolean strings like "true" to true).
 * Ensures consistency between form submission, database storage, and template generation.
 */
export function coerceContentTypes(
  content: Record<string, unknown>,
  schema?: TemplateEditorSchema | null,
  defaults?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!content || !isPlainObject(content)) {
    return content;
  }

  let result = structuredClone(content);

  // 1. Coerce via schema sections if schema is provided
  if (schema && Array.isArray(schema.sections) && schema.sections.length > 0) {
    for (const section of schema.sections) {
      const pathParts = section.path
        .split('.')
        .map((p) => p.trim())
        .filter(Boolean);
      if (pathParts.length === 0) continue;

      result = coerceAtDottedPath(result, pathParts, section, defaults);
    }
  }

  // 2. Coerce or reinforce via defaults if defaults is provided
  if (defaults && isPlainObject(defaults)) {
    result = coerceViaDefaults(result, defaults) as Record<string, unknown>;
  }

  return result;
}

import {
  MEDIA_CATEGORIES,
  type MediaCategoryKey,
} from './media.constants';

const MEDIA_ALIASES: Partial<Record<MediaCategoryKey, string[]>> = {
  business_logo: ['logo'],
  website_banner: ['hero', 'banners'],
  gallery: ['gallery'],
  product: ['products'],
  service: ['services'],
  shop_front: ['shopFront'],
  content_image: ['contentImages'],
  company_document: ['documents'],
  brochure_pdf: ['brochures'],
  restaurant_menu_pdf: ['menus'],
};

type ProjectMediaItem = {
  category: string;
  fileUrl: string;
  role?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sortOrder?: number;
  linkedContentPath?: string | null;
  altText?: string | null;
};

export type { ProjectMediaItem };

export function buildProjectMediaMap(items: ProjectMediaItem[]) {
  const media = createEmptyMediaMap();

  for (const item of items) {
    addMediaItem(media, item.category, item.fileUrl);
  }

  return media;
}

export function applyLinkedProjectMedia(
  content: Record<string, unknown> | null,
  items: ProjectMediaItem[],
) {
  const originalContent = content ?? {};
  let result = clone(originalContent);
  const ordered = [...items].sort(
    (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
  );

  for (const item of ordered) {
    if (item.linkedContentPath?.trim()) {
      const linkedPath = item.linkedContentPath.trim();
      const existing = readContentPath(originalContent, linkedPath);
      // An explicit empty string (cleared by user) is authoritative.
      // But undefined or null (uninitialized DB/template default) must be backfilled.
      if (existing !== undefined && existing !== null) {
        continue;
      }
      result = setContentPath(result, linkedPath, item.fileUrl);
      continue;
    }

    const collection =
      item.entityType === 'PRODUCT'
        ? 'products'
        : item.entityType === 'SERVICE'
          ? 'services'
          : null;
    if (!collection || !item.entityId) continue;

    const candidateCollections: Array<{ key: string; entries: unknown[] }> = [];
    if (Array.isArray(result[collection])) {
      candidateCollections.push({
        key: collection,
        entries: result[collection] as unknown[],
      });
    }
    const shop = isRecord(result.shop)
      ? (result.shop as Record<string, unknown>)
      : null;
    if (collection === 'products' && shop && Array.isArray(shop.products)) {
      candidateCollections.push({
        key: 'shop.products',
        entries: shop.products,
      });
    }
    const home = isRecord(result.home)
      ? (result.home as Record<string, unknown>)
      : null;
    if (home) {
      if (collection === 'products') {
        if (Array.isArray(home.products)) {
          candidateCollections.push({
            key: 'home.products',
            entries: home.products,
          });
        }
        if (Array.isArray(home.featuredProducts)) {
          candidateCollections.push({
            key: 'home.featuredProducts',
            entries: home.featuredProducts,
          });
        }
      } else if (collection === 'services') {
        if (Array.isArray(home.services)) {
          candidateCollections.push({
            key: 'home.services',
            entries: home.services,
          });
        }
        if (Array.isArray(home.featuredServices)) {
          candidateCollections.push({
            key: 'home.featuredServices',
            entries: home.featuredServices,
          });
        }
      }
    }

    // Discover any collection dynamically anywhere in result containing this entity
    const foundKeys = new Set(candidateCollections.map((c) => c.key));
    const findCollectionsWithEntity = (obj: unknown, prefix: string) => {
      if (!isRecord(obj)) return;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (Array.isArray(v)) {
          if (!foundKeys.has(path)) {
            const hasMatch = v.some(
              (entry) =>
                isRecord(entry) &&
                (entry.id === item.entityId ||
                  entry.productId === item.entityId ||
                  entry.serviceId === item.entityId),
            );
            if (hasMatch) {
              candidateCollections.push({ key: path, entries: v });
              foundKeys.add(path);
            }
          }
        } else if (isRecord(v) && prefix.split('.').length < 3) {
          findCollectionsWithEntity(v, path);
        }
      }
    };
    findCollectionsWithEntity(result, '');

    for (const { key, entries } of candidateCollections) {
      const index = entries.findIndex(
        (entry) =>
          isRecord(entry) &&
          (entry.id === item.entityId ||
            entry.productId === item.entityId ||
            entry.serviceId === item.entityId),
      );
      if (index >= 0) {
        result = setContentPath(
          result,
          `${key}[${index}].imageUrl`,
          item.fileUrl,
        );
        if (isRecord(entries[index]) && 'image' in entries[index]) {
          result = setContentPath(
            result,
            `${key}[${index}].image`,
            item.fileUrl,
          );
        }
      }
    }
  }
  return result;
}

/** Backfills linked content-image media only when an older record lacks the field or is null. */
export function applyLinkedContentImages(
  content: Record<string, unknown> | null,
  items: ProjectMediaItem[],
) {
  const originalContent = content ?? {};
  let result = clone(originalContent);
  const ordered = [...items]
    .filter(
      (item) =>
        item.category === 'content_image' && item.linkedContentPath?.trim(),
    )
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

  for (const item of ordered) {
    const linkedPath = item.linkedContentPath!.trim();
    const existing = readContentPath(originalContent, linkedPath);
    if (existing !== undefined && existing !== null) {
      continue;
    }
    result = setContentPath(result, linkedPath, item.fileUrl);
  }

  return result;
}

export function buildTemplateValidationSiteData(
  content: Record<string, unknown> | null,
  requiredPages: string[] = [],
) {
  return {
    project: {
      id: 'template-validation',
      slug: 'template-validation',
      title: 'Template Validation',
      status: 'APPROVED',
    },
    siteInstance: {
      id: 'template-validation-instance',
      slug: 'template-validation',
      domain: 'template-validation.fivora.site',
      subdomain: 'template-validation',
      customDomain: null,
      liveUrl: 'https://template-validation.fivora.site',
    },
    api: {
      baseUrl: 'https://api.fivora.site',
      catalogUrl: 'https://api.fivora.site/site-catalog/template-validation/live-data',
      contactUrl: 'https://api.fivora.site/site-contact',
      analyticsUrl: 'https://api.fivora.site/site-analytics/page-view',
    },
    shop: {
      businessName: 'Template Validation Shop',
      description:
        'Validation build payload that mirrors fivora-generated site data.',
      contact: {
        phone: '',
        email: '',
        whatsapp: '',
      },
      address: {
        line1: '',
        city: '',
        district: '',
        province: '',
        postalCode: '',
      },
      social: {
        facebook: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        linkedin: '',
        website: '',
      },
      logoUrl: '',
    },
    template: {
      id: 'template-validation',
      name: 'Template Validation',
      engine: 'NEXT_STATIC_EXPORT',
      structure: null,
    },
    requirements: {
      mainPurpose: '',
      targetCustomers: '',
      preferredLanguage: '',
      preferredColorTheme: '',
      preferredStyle: '',
      requiredPages,
      requiredFeatures: [],
      customerSpecialRequirements: '',
    },
    content: content ?? {},
    media: createEmptyMediaMap(),
    seo: null,
  };
}

function createEmptyMediaMap() {
  const media: Record<string, string[]> = {};

  for (const category of MEDIA_CATEGORIES) {
    media[category.key] = [];

    for (const alias of MEDIA_ALIASES[category.key] ?? []) {
      if (!media[alias]) {
        media[alias] = [];
      }
    }
  }

  return media;
}

function addMediaItem(
  media: Record<string, string[]>,
  category: string,
  fileUrl: string,
) {
  const keys = new Set<string>([category]);
  const aliases = MEDIA_ALIASES[category as MediaCategoryKey] ?? [];
  for (const alias of aliases) {
    keys.add(alias);
  }

  for (const key of keys) {
    if (!media[key]) {
      media[key] = [];
    }
    media[key].push(fileUrl);
  }
}

function setContentPath(
  content: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = parseContentPath(path);
  if (parts.length === 0) return content;

  const result = clone(content);
  let cursor: unknown = result;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (typeof part === 'number') {
      if (!Array.isArray(cursor) || part >= cursor.length) return result;
      cursor = cursor[part];
    } else {
      if (!isRecord(cursor)) return result;
      cursor[part] ??= typeof parts[index + 1] === 'number' ? [] : {};
      cursor = cursor[part];
    }
  }
  const finalPart = parts.at(-1)!;
  if (typeof finalPart === 'number') {
    if (Array.isArray(cursor) && finalPart < cursor.length) {
      cursor[finalPart] = value;
    }
  } else if (isRecord(cursor)) {
    cursor[finalPart] = value;
  }
  return result;
}

export function writeContentPath(
  content: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = parseContentPath(path);
  if (parts.length === 0) return content;

  const result = clone(content);
  let cursor: Record<string, unknown> | unknown[] = result;

  for (let index = 0; index < parts.length - 1; ) {
    const part = parts[index];
    const nextPart = parts[index + 1];

    if (typeof part === 'string' && typeof nextPart === 'number') {
      const record = cursor as Record<string, unknown>;
      if (!Array.isArray(record[part])) {
        record[part] = [];
      }
      const list = record[part] as unknown[];
      const isFinalIndex = index + 1 === parts.length - 1;
      while (list.length <= nextPart) {
        list.push(isFinalIndex ? '' : {});
      }
      if (isFinalIndex) {
        cursor = list;
        break;
      }
      cursor = list[nextPart] as Record<string, unknown>;
      index += 2;
      continue;
    }

    if (typeof part === 'string') {
      const record = cursor as Record<string, unknown>;
      if (!isRecord(record[part])) {
        record[part] = {};
      }
      cursor = record[part] as Record<string, unknown>;
      index += 1;
      continue;
    }

    return result;
  }

  const finalPart = parts.at(-1)!;
  if (typeof finalPart === 'string' && isRecord(cursor)) {
    cursor[finalPart] = value;
    return result;
  }

  if (typeof finalPart === 'number' && Array.isArray(cursor)) {
    while (cursor.length <= finalPart) {
      cursor.push('');
    }
    cursor[finalPart] = value;
  }

  return result;
}

export function readContentPath(
  content: Record<string, unknown>,
  path: string,
) {
  let cursor: unknown = content;
  for (const part of parseContentPath(path)) {
    if (typeof part === 'number') {
      if (!Array.isArray(cursor) || part >= cursor.length) return undefined;
      cursor = cursor[part];
    } else {
      if (!isRecord(cursor) || !(part in cursor)) return undefined;
      cursor = cursor[part];
    }
  }
  return cursor;
}

function parseContentPath(path: string) {
  const parts: Array<string | number> = [];
  for (const match of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    parts.push(match[2] === undefined ? match[1] : Number(match[2]));
  }
  return parts;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

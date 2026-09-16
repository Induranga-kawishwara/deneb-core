import AdmZip from 'adm-zip';

export const TEMPLATE_ARCHIVE_LIMITS = {
  maxEntries: 2_000,
  maxEntryUncompressedBytes: 25 * 1024 * 1024,
  maxTotalUncompressedBytes: 200 * 1024 * 1024,
  maxCompressionRatio: 100,
} as const;

const FORBIDDEN_DIRECTORY_SEGMENTS = new Set([
  '.cache',
  '.git',
  '.next',
  '.npm',
  '.pnpm-store',
  '.turbo',
  '__macosx',
  'node_modules',
]);

const FORBIDDEN_GENERATED_DIRECTORIES = new Set([
  'build',
  'coverage',
  'dist',
  'out',
]);

export type TemplatePackageArchiveInspection = {
  entries: string[];
  forbiddenEntries: string[];
};

/** Returns the same source-only inventory decision used by upload and the CLI. */
export function inspectTemplatePackageArchive(
  buffer: Buffer,
): TemplatePackageArchiveInspection {
  let entries: ReturnType<AdmZip['getEntries']>;

  try {
    entries = new AdmZip(buffer).getEntries();
  } catch {
    throw new Error('Template package is not a valid ZIP archive.');
  }

  const forbiddenEntries = new Set<string>();
  const entryNames: string[] = [];
  let totalUncompressedBytes = 0;

  if (entries.length > TEMPLATE_ARCHIVE_LIMITS.maxEntries) {
    throw new Error(
      `Template ZIP contains too many entries (${entries.length}; maximum ${TEMPLATE_ARCHIVE_LIMITS.maxEntries}).`,
    );
  }

  for (const entry of entries) {
    const normalizedName = normalizeTemplatePackageEntryName(entry.entryName);
    entryNames.push(normalizedName);

    if (isUnsafeTemplatePackageEntryName(normalizedName)) {
      throw new Error(
        `Template ZIP contains an unsafe entry: ${entry.entryName || '(empty path)'}.`,
      );
    }

    if (!entry.isDirectory) {
      const uncompressedBytes = Number(entry.header.size ?? 0);
      const compressedBytes = Number(entry.header.compressedSize ?? 0);
      if (
        !Number.isSafeInteger(uncompressedBytes) ||
        uncompressedBytes < 0 ||
        uncompressedBytes > TEMPLATE_ARCHIVE_LIMITS.maxEntryUncompressedBytes
      ) {
        throw new Error(
          `Template ZIP entry is too large after extraction: ${normalizedName}.`,
        );
      }

      totalUncompressedBytes += uncompressedBytes;
      if (
        totalUncompressedBytes >
        TEMPLATE_ARCHIVE_LIMITS.maxTotalUncompressedBytes
      ) {
        throw new Error(
          `Template ZIP expands beyond the ${TEMPLATE_ARCHIVE_LIMITS.maxTotalUncompressedBytes / (1024 * 1024)} MB limit.`,
        );
      }

      if (
        uncompressedBytes > 1024 * 1024 &&
        uncompressedBytes / Math.max(1, compressedBytes) >
          TEMPLATE_ARCHIVE_LIMITS.maxCompressionRatio
      ) {
        throw new Error(
          `Template ZIP entry has an unsafe compression ratio: ${normalizedName}.`,
        );
      }
    }

    if (!entry.isDirectory && isForbiddenTemplatePackagePath(normalizedName)) {
      forbiddenEntries.add(normalizedName);
    } else if (
      entry.isDirectory &&
      isForbiddenTemplatePackagePath(normalizedName)
    ) {
      forbiddenEntries.add(normalizedName);
    }
  }

  return {
    entries: entryNames,
    forbiddenEntries: [...forbiddenEntries],
  };
}

export function formatTemplatePackageArchivePolicyError(
  forbiddenEntries: readonly string[],
) {
  const examples = forbiddenEntries.slice(0, 8);
  const remaining = forbiddenEntries.length - examples.length;
  return [
    'Template ZIP contains generated, cached, secret, log, or nested archive files that must be removed.',
    `Remove: ${examples.join(', ')}${remaining > 0 ? `, and ${remaining} more` : ''}.`,
    'Create a clean source-only ZIP and upload it again.',
  ].join(' ');
}

export function normalizeTemplatePackageEntryName(entryName: string) {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function isUnsafeTemplatePackageEntryName(normalizedName: string) {
  const segments = getSegments(normalizedName);
  return (
    !normalizedName ||
    normalizedName.includes('\0') ||
    normalizedName.startsWith('/') ||
    /^[a-z]:\//i.test(normalizedName) ||
    segments.includes('..')
  );
}

export function isForbiddenTemplatePackagePath(entryName: string) {
  const normalizedName = normalizeTemplatePackageEntryName(entryName);
  const segments = getSegments(normalizedName);
  const fileName = segments.at(-1) ?? '';
  const hasForbiddenDirectory = segments.some((segment) =>
    FORBIDDEN_DIRECTORY_SEGMENTS.has(segment),
  );
  const hasYarnCache = segments[0] === '.yarn' && segments[1] === 'cache';
  const hasGeneratedDirectory = segments.some((segment) =>
    FORBIDDEN_GENERATED_DIRECTORIES.has(segment),
  );
  const hasDenebInternal = segments.some((segment) =>
    segment === '.deneb' || segment.startsWith('.deneb-backup'),
  );
  const isEnvironmentFile = fileName === '.env' || fileName.startsWith('.env.');
  const isNestedArchive = fileName.endsWith('.zip');
  const isLogFile = fileName.endsWith('.log');
  const isBuildInfo = fileName.endsWith('.tsbuildinfo');
  const isOsMetadata = fileName === '.ds_store' || fileName === 'thumbs.db';

  return (
    hasForbiddenDirectory ||
    hasYarnCache ||
    hasGeneratedDirectory ||
    hasDenebInternal ||
    isEnvironmentFile ||
    isNestedArchive ||
    isLogFile ||
    isBuildInfo ||
    isOsMetadata
  );
}

function getSegments(normalizedName: string) {
  return normalizedName
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
}

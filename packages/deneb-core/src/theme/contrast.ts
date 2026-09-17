/**
 * Determines whether a color is considered "dark" based on perceived relative luminance.
 * Uses standard ITU-R BT.601 formula (r*299 + g*587 + b*114) / 1000 < 130.
 * Supports 3-digit and 6-digit hex values.
 */
export function isDarkColor(color?: unknown): boolean {
  if (typeof color !== 'string' || !color) return false;
  const hex = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{3,6}$/i.test(hex)) return false;
  const fullHex =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = Number.parseInt(fullHex.slice(1, 3), 16);
  const g = Number.parseInt(fullHex.slice(3, 5), 16);
  const b = Number.parseInt(fullHex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 130;
}

/**
 * Returns an auto-contrasting text color (default white for dark backgrounds, dark slate for light backgrounds).
 */
export function getAutoContrastTextColor(
  backgroundColor?: string,
  lightText = '#ffffff',
  darkText = '#0f172a',
): string {
  return isDarkColor(backgroundColor) ? lightText : darkText;
}

/**
 * Normalizes a 3-digit or 6-digit hex color to canonical 6-digit lowercase hex.
 * Returns fallback if invalid.
 */
export function toHexColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return fallback;
}

/**
 * Parses and returns a valid 6-char hex string, or null if invalid.
 */
export function normalizeHexColor(color: string | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return null;
}

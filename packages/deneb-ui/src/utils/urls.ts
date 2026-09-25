/**
 * DENEB UI — URL & Action Helpers
 * Created by Chamika Gayashan & Induranga Kawishwara
 */

export interface MapLocationInput {
  /** Location or branch name, e.g. "Main Roastery", "Downtown Cafe". */
  name?: string | null;
  /** Alternative title property. */
  title?: string | null;
  /** Explicit Google Maps or destination URL. */
  mapUrl?: string | null;
  /** Fivora-paired sibling of `address` (`addressUrl` shares the `address` inspector stem). */
  addressUrl?: string | null;
  /** Generic external or map URL. */
  url?: string | null;
  /** Link URL alias. */
  linkUrl?: string | null;
  /** Street address. */
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  zipCode?: string | null;
  /** Permissive index signature so custom or template-specific keys never trigger TS2561. */
  [key: string]: any;
}

/**
 * Creates a valid WhatsApp click-to-chat URL.
 * Automatically cleans spaces, dashes, and special characters from the phone number.
 */
export function createWhatsAppUrl(phone?: string | null, message?: string | null): string {
  if (!phone) return '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';

  const baseUrl = `https://wa.me/${cleanPhone}`;
  if (message && message.trim()) {
    return `${baseUrl}?text=${encodeURIComponent(message.trim())}`;
  }
  return baseUrl;
}

/**
 * Creates a telephone URI for one-click calling.
 */
export function createPhoneUrl(phone?: string | null): string {
  if (!phone) return '';
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return cleanPhone ? `tel:${cleanPhone}` : '';
}

/**
 * Creates an email mailto: URI with optional subject and body.
 */
export function createEmailUrl(
  email?: string | null,
  subject?: string | null,
  body?: string | null
): string {
  if (!email || !email.trim()) return '';
  const cleanEmail = email.trim();
  const params: string[] = [];

  if (subject && subject.trim()) {
    params.push(`subject=${encodeURIComponent(subject.trim())}`);
  }
  if (body && body.trim()) {
    params.push(`body=${encodeURIComponent(body.trim())}`);
  }

  return params.length > 0 ? `mailto:${cleanEmail}?${params.join('&')}` : `mailto:${cleanEmail}`;
}

/**
 * Creates a Google Maps search or direction URL.
 * Prefers an explicit mapUrl, otherwise constructs a query using address, city, and country.
 */
export function createMapUrl(location?: MapLocationInput | string | null): string {
  if (!location) return '';

  if (typeof location === 'string') {
    if (location.startsWith('http://') || location.startsWith('https://')) {
      return location;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }

  const explicitUrl = (
    location.addressUrl ||
    location.mapUrl ||
    location.url ||
    location.linkUrl ||
    ''
  ).trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const queryParts = [
    location.name || location.title,
    location.address,
    location.city,
    location.state,
    location.country,
    location.postalCode || location.zipCode,
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .map((part) => String(part).trim());

  if (queryParts.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts.join(', '))}`;
  }

  return '';
}

/**
 * Resolves a merchant-entered action URL for CTAs (WhatsApp, tel, mailto, or external http(s)).
 * Phone-like values without a scheme become WhatsApp links when `mode` is `auto`.
 */
export function resolveActionUrl(
  raw?: string | null,
  mode: 'auto' | 'external' = 'auto'
): string {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  if (mode === 'external') {
    return isSafeExternalLink(value) ? value : '';
  }
  if (/^https?:\/\//i.test(value) || /^tel:/i.test(value) || /^mailto:/i.test(value)) {
    return value;
  }
  if (/^\+?[\d\s().-]+$/.test(value)) {
    return createWhatsAppUrl(value);
  }
  return isSafeExternalLink(value) ? value : '';
}

/**
 * Validates if a string is a safe, valid external link (prevents script injection).
 */
export function isSafeExternalLink(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  );
}

/**
 * Resolves static assets and plain browser URLs with subpath prefix support
 * (e.g. Fivora preview lab).
 *
 * Do not pass this result to Next.js `<Link>`, `router.push`,
 * `router.replace`, or `router.prefetch`; Next applies `basePath` to those
 * destinations automatically. Use this helper for local asset URLs and direct
 * `window.location` navigation only.
 */
export function withBasePath(value?: string | null): string {
  const url = value?.trim() ?? '';
  if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url;
  const basePath = (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SITE_BASE_PATH ?? '' : '').replace(
    /\/$/,
    ''
  );
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${basePath}${path}`;
}

/**
 * Resolves standard page route from pageKey.
 */
export function resolvePageRoute(pageKey: string, pages?: Array<{ id: string; route: string }>): string {
  const match = pages?.find((page) => page.id === pageKey);
  return match?.route ?? `/${pageKey.replace(/_/g, '/')}`;
}

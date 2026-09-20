'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DENEB_STYLE_PATCH_MESSAGE,
  patchStyleByPath,
  STYLE_PATCH_MESSAGE,
} from '@deneb-ui/core';
import { DenebComponentStyles } from './DenebComponentStyles';
import { FontLoader } from './fonts/FontLoader';
import { ResponsiveBaseStyles } from './ResponsiveBaseStyles';
import type { ProductItem } from './EditableProductCard';
import type { ServiceItem } from './EditableServiceCard';
import { ThemeStyles } from './ThemeStyles';

export const DENEB_PREVIEW_DATA_MESSAGE = 'DENEB_PREVIEW_SITE_DATA';
export const PREVIEW_DATA_MESSAGE = 'FIVORA_PREVIEW_SITE_DATA';
const PREVIOUS_PREVIEW_PREFIX = `${['MARKET', 'PLACE'].join('')}_PREVIEW_`;
const previousPreviewMessage = (suffix: string) =>
  `${PREVIOUS_PREVIEW_PREFIX}${suffix}`;
const previousPreviewStorageKey = (suffix: string) =>
  `__${PREVIOUS_PREVIEW_PREFIX}${suffix}__`;
export const LEGACY_PREVIEW_DATA_MESSAGE =
  previousPreviewMessage('SITE_DATA');
export const DENEB_PREVIEW_READY_MESSAGE = 'DENEB_PREVIEW_READY';
export const PREVIEW_READY_MESSAGE = 'FIVORA_PREVIEW_READY';
export const LEGACY_PREVIEW_READY_MESSAGE = previousPreviewMessage('READY');
export const DENEB_PREVIEW_FOCUS_MESSAGE = 'DENEB_PREVIEW_FOCUS_PAGE';
export const PREVIEW_FOCUS_MESSAGE = 'FIVORA_PREVIEW_FOCUS_PAGE';
export const LEGACY_PREVIEW_FOCUS_MESSAGE =
  previousPreviewMessage('FOCUS_PAGE');
export const PREVIEW_FIELD_ATTRIBUTE = 'data-preview-field-path';
export { STYLE_PATCH_MESSAGE, DENEB_STYLE_PATCH_MESSAGE } from '@deneb-ui/core';

const PARENT_ORIGIN_KEY = '__FIVORA_PREVIEW_PARENT_ORIGIN__';
const LEGACY_PARENT_ORIGIN_KEY = previousPreviewStorageKey('PARENT_ORIGIN');
const SITE_DATA_CACHE_KEY = '__FIVORA_PREVIEW_SITE_DATA_CACHE__';
const LEGACY_SITE_DATA_CACHE_KEY = previousPreviewStorageKey('SITE_DATA_CACHE');
const SITE_DATA_GLOBAL_KEY = '__FIVORA_PREVIEW_SITE_DATA__';
const LEGACY_SITE_DATA_GLOBAL_KEY = previousPreviewStorageKey('SITE_DATA');

export type GenericRecord = Record<string, any>;

export interface SiteDataApiConfig {
  baseUrl?: string | null;
  catalogUrl?: string | null;
  contactUrl?: string | null;
  analyticsUrl?: string | null;
  [key: string]: unknown;
}

export interface SiteDataProject {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface SiteInstanceData {
  id?: string | null;
  slug?: string | null;
  domain?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  liveUrl?: string | null;
  [key: string]: unknown;
}

export type SiteData = {
  project?: SiteDataProject | null;
  siteInstance?: SiteInstanceData | null;
  api?: SiteDataApiConfig | null;
  shop?: GenericRecord | null;
  merchant?: GenericRecord | null;
  template?: {
    structure?: {
      pages?: string[] | null;
      theme?: GenericRecord | null;
    } | null;
  } | null;
  requirements?: { requiredPages?: string[] | null } | null;
  content?: GenericRecord | null;
  media?: Record<string, string[]> | null;
  seo?: GenericRecord | null;
  styles?: GenericRecord | null;
  [key: string]: unknown;
};

const UNINITIALIZED_SITE_DATA = Symbol('DENEB_UNINITIALIZED_SITE_DATA');
export const SiteDataContext = createContext<SiteData | typeof UNINITIALIZED_SITE_DATA>(
  UNINITIALIZED_SITE_DATA as any
);

export function isRecord(value: unknown): value is GenericRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isDarkColor(color?: unknown): boolean {
  if (typeof color !== "string" || !color) return false;
  const hex = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{3,6}$/.test(hex)) return false;
  const fullHex =
    hex.length === 4
      ? "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      : hex;
  const r = Number.parseInt(fullHex.slice(1, 3), 16);
  const g = Number.parseInt(fullHex.slice(3, 5), 16);
  const b = Number.parseInt(fullHex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 130;
}

export function syncThemeToDocument(theme: unknown) {
  if (typeof document === "undefined" || !isRecord(theme)) return;
  const rootStyle = document.documentElement.style;
  if (typeof theme.primaryColor === "string") {
    rootStyle.setProperty("--brand-primary", theme.primaryColor);
    rootStyle.setProperty("--brand-color", theme.primaryColor);
    rootStyle.setProperty("--color-primary", theme.primaryColor);
    const isPrimaryDark = isDarkColor(theme.primaryColor);
    const autoBtnText = isPrimaryDark ? "#ffffff" : "#0f172a";
    rootStyle.setProperty("--button-bg", String(theme.buttonBackgroundColor || theme.primaryColor));
    rootStyle.setProperty("--button-text", String(theme.buttonTextColor || autoBtnText));
  }
  if (typeof theme.secondaryColor === "string") {
    rootStyle.setProperty("--brand-secondary", theme.secondaryColor);
  }
  if (typeof theme.accentColor === "string") {
    rootStyle.setProperty("--brand-accent", theme.accentColor);
    rootStyle.setProperty("--color-accent", theme.accentColor);
  }
  if (typeof theme.backgroundColor === "string") {
    const isDark = isDarkColor(theme.backgroundColor);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    rootStyle.colorScheme = isDark ? "dark" : "light";
    rootStyle.setProperty("--page-background", theme.backgroundColor);
    rootStyle.setProperty("--card-bg", isDark ? "#111a2e" : "#ffffff");
    rootStyle.setProperty("--product-card-bg", isDark ? "#111a2e" : "#ffffff");
    rootStyle.setProperty("--color-surface", isDark ? "rgba(255,255,255,0.05)" : "#ffffff");
    rootStyle.setProperty("--color-secondary", isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9");
    rootStyle.setProperty("--button-secondary-bg", isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9");
    rootStyle.setProperty("--button-secondary-text", isDark ? "#f8fafc" : "#0f172a");
  }
}

export function mergeSiteData(
  current: unknown,
  incoming: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (depth > 50) return incoming;
  if (Array.isArray(incoming)) return incoming;
  if (!isRecord(incoming)) return incoming;
  if (seen.has(incoming)) return incoming;
  seen.add(incoming);

  const base = isRecord(current) ? current : {};
  const next: GenericRecord = { ...base };
  for (const key of Object.keys(incoming)) {
    // Parent preview always sends complete content/media snapshots. Replacing
    // them wholesale avoids deep-cloning large collections on every keystroke.
    if (key === 'content' || key === 'media' || key === 'styles') {
      next[key] = incoming[key];
      continue;
    }
    next[key] = mergeSiteData(base[key], incoming[key], depth + 1, seen);
  }
  return next;
}

export function normalizeOrigin(value?: string | null, baseOrigin?: string | null): string | null {
  if (!value || value.trim() === 'null') return null;
  try {
    const origin = new URL(value, baseOrigin ?? undefined).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function readRememberedParentOrigin(): string | null {
  try {
    return (
      window.sessionStorage.getItem(PARENT_ORIGIN_KEY) ||
      window.sessionStorage.getItem(LEGACY_PARENT_ORIGIN_KEY)
    );
  } catch {
    return null;
  }
}

function rememberParentOrigin(origin: string | null): void {
  if (!origin) return;
  try {
    window.sessionStorage.setItem(PARENT_ORIGIN_KEY, origin);
    window.sessionStorage.setItem(LEGACY_PARENT_ORIGIN_KEY, origin);
  } catch {
    // Messaging still works without session storage.
  }
}

/**
 * Match the injected preview focus bridge: after in-iframe navigations,
 * document.referrer becomes the previous preview page (same origin), so we
 * must retain the real parent origin from the first embed.
 */
export function resolveParentOrigin(): string | null {
  if (typeof window === 'undefined') return null;

  const currentOrigin = normalizeOrigin(window.location.origin);
  let ancestorOrigin: string | null = null;
  try {
    ancestorOrigin = normalizeOrigin(
      (window.location as unknown as { ancestorOrigins?: { item: (i: number) => string } })
        .ancestorOrigins?.item(0),
      currentOrigin,
    );
  } catch {
    ancestorOrigin = null;
  }

  let accessibleParentOrigin: string | null = null;
  try {
    accessibleParentOrigin =
      window.parent !== window
        ? normalizeOrigin(window.parent.location.origin, currentOrigin)
        : null;
  } catch {
    accessibleParentOrigin = null;
  }

  const referrerOrigin = normalizeOrigin(document.referrer, currentOrigin);
  const rememberedOrigin = normalizeOrigin(readRememberedParentOrigin());

  const resolved =
    ancestorOrigin ??
    accessibleParentOrigin ??
    (referrerOrigin && referrerOrigin !== currentOrigin
      ? referrerOrigin
      : null) ??
    rememberedOrigin ??
    referrerOrigin;

  rememberParentOrigin(resolved);
  return resolved;
}

export function readCachedSiteData<T = SiteData>(): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const globalStore = window as unknown as Record<string, unknown>;
    const globalData =
      globalStore[SITE_DATA_GLOBAL_KEY] ??
      globalStore[LEGACY_SITE_DATA_GLOBAL_KEY];
    if (isRecord(globalData)) {
      return globalData as T;
    }
  } catch {
    // Ignore non-extensible window environments.
  }

  try {
    const raw =
      window.sessionStorage.getItem(SITE_DATA_CACHE_KEY) ||
      window.sessionStorage.getItem(LEGACY_SITE_DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export interface SiteDataProviderProps<T = SiteData> {
  children: ReactNode;
  initialSiteData?: T;
  fallbackSiteData?: T;
  /**
   * Optional custom live catalog endpoint.
   * If omitted, defaults to `/api/site-catalog/${slug}/live-data`.
   */
  liveCatalogEndpoint?: string;
  /**
   * Optional site slug for live rehydration. If omitted, resolved from initialSiteData.
   */
  siteSlug?: string;
}

export function SiteDataProvider<T extends SiteData = SiteData>({
  children,
  initialSiteData,
  fallbackSiteData,
  liveCatalogEndpoint,
  siteSlug,
}: SiteDataProviderProps<T>) {
  // SSR HTML and the first client paint must match. Reading sessionStorage here
  // causes React hydration error #418 when a previous preview left merchant
  // content in the cache. Cache is applied after mount in useEffect instead.
  const [siteData, setSiteData] = useState<T>(() => {
    return (initialSiteData ?? fallbackSiteData ?? ({} as T));
  });

  // Real-time catalog & theme hydration for standalone live sites
  useEffect(() => {
    if (typeof window === "undefined" || window.parent !== window) return;

    const candidateSlug =
      siteSlug ||
      initialSiteData?.siteInstance?.slug ||
      initialSiteData?.project?.slug ||
      initialSiteData?.project?.id;

    const endpoint =
      liveCatalogEndpoint ||
      initialSiteData?.api?.catalogUrl ||
      (candidateSlug && initialSiteData?.api?.baseUrl
        ? `${initialSiteData.api.baseUrl.replace(/\/+$/, '')}/site-catalog/${candidateSlug}/live-data`
        : candidateSlug
          ? `/site-catalog/${candidateSlug}/live-data`
          : null);

    if (!endpoint) return;

    let stopped = false;
    let activeController: AbortController | null = null;
    let retryTimer: number | null = null;
    let lastSuccessfulFetchAt = 0;
    const retryDelays = [750, 2_000, 5_000];

    const applyLiveCatalog = (live: GenericRecord) => {
      setSiteData((current) => {
        const currentContent = isRecord(current.content) ? current.content : {};
        const currentHome = isRecord(currentContent.home) ? currentContent.home : null;
        const currentCommon = isRecord(currentContent.common) ? currentContent.common : {};
        const currentContact = isRecord(currentContent.contact) ? currentContent.contact : {};

        const rawLiveProducts = Array.isArray(live.products) ? live.products : currentContent.products;
        const nextProducts = Array.isArray(rawLiveProducts)
          ? rawLiveProducts.map((p: any) => {
              if (!isRecord(p)) return p;
              const customData = isRecord(p.customData) ? p.customData : {};
              return {
                ...customData,
                ...p,
              };
            })
          : rawLiveProducts;
        const nextServices = Array.isArray(live.services)
          ? live.services
          : currentContent.services;
        const nextReviews = Array.isArray(live.reviews)
          ? live.reviews
          : null;

        // Shop / Merchant profile live synchronization
        let nextShop = isRecord(current.shop) ? { ...current.shop } : {};
        let nextMerchant = isRecord(current.merchant) ? { ...current.merchant } : {};
        const nextCommon = { ...currentCommon };
        const nextContact = { ...currentContact };
        const nextHome = currentHome ? { ...currentHome } : {};

        if (isRecord(live.shop)) {
          nextShop = mergeSiteData(nextShop, live.shop) as GenericRecord;
          nextMerchant = mergeSiteData(nextMerchant, live.shop) as GenericRecord;

          const contact = isRecord(live.shop.contact) ? live.shop.contact : null;
          const address = isRecord(live.shop.address) ? live.shop.address : null;

          if (contact) {
            if (typeof contact.phone === 'string' && contact.phone.trim()) {
              nextContact.phone = contact.phone;
              nextContact.contactNumber = contact.phone;
              nextCommon.contactNumber = contact.phone;
            }
            if (typeof contact.whatsapp === 'string' && contact.whatsapp.trim()) {
              nextContact.whatsapp = contact.whatsapp;
              nextCommon.whatsapp = contact.whatsapp;
              const cleanWa = contact.whatsapp.replace(/\D/g, '');
              if (cleanWa) {
                nextContact.whatsappNumber = cleanWa;
                nextCommon.whatsappNumber = cleanWa;

                // Dynamically update any hardcoded or static wa.me URLs across home and common
                const waRegex = /(https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=))\d+/gi;
                for (const key of ['whatsappCtaUrl', 'whatsappOrderUrl', 'whatsappUrl']) {
                  if (typeof nextHome[key] === 'string' && waRegex.test(nextHome[key])) {
                    nextHome[key] = nextHome[key].replace(waRegex, `$1${cleanWa}`);
                  }
                  if (typeof nextCommon[key] === 'string' && waRegex.test(nextCommon[key])) {
                    nextCommon[key] = nextCommon[key].replace(waRegex, `$1${cleanWa}`);
                  }
                }
                if (!nextCommon.whatsappUrl || waRegex.test(nextCommon.whatsappUrl)) {
                  nextCommon.whatsappUrl = `https://wa.me/${cleanWa}`;
                }
              }
            }
            if (typeof contact.email === 'string' && contact.email.trim()) {
              nextContact.email = contact.email;
              nextCommon.email = contact.email;
            }
          }

          if (address) {
            const street = address.street || address.line1;
            if (typeof street === 'string' && street.trim()) {
              nextContact.address = street;
              nextCommon.address = street;
              nextCommon.footerAddress = street;
            }
            if (typeof address.mapLocation === 'string' && address.mapLocation.trim()) {
              nextContact.googleMapLink = address.mapLocation;
              nextContact.mapLocation = address.mapLocation;
              nextContact.mapUrl = address.mapLocation;
            }
          }

          if (live.shop.openingHours) {
            nextContact.hours = live.shop.openingHours;
            nextContact.openingHours = live.shop.openingHours;
            nextCommon.openingHours = live.shop.openingHours;
            nextHome.businessHours = live.shop.openingHours;
          }

          if (typeof live.shop.businessName === 'string' && live.shop.businessName.trim()) {
            nextCommon.websiteTitle = live.shop.businessName;
          }

          if (typeof live.shop.logoUrl === 'string' && live.shop.logoUrl.trim()) {
            nextCommon.logoUrl = live.shop.logoUrl;
          }
        }

        // Reviews / Testimonials live synchronization
        if (nextReviews) {
          nextHome.reviews = nextReviews;
          nextHome.testimonials = nextReviews;
          nextHome.feedbacks = nextReviews;
        }

        return {
          ...current,
          shop: nextShop,
          merchant: nextMerchant,
          reviews: nextReviews ?? (current as any).reviews,
          content: {
            ...currentContent,
            common: nextCommon,
            contact: nextContact,
            ...(nextProducts !== undefined ? { products: nextProducts } : {}),
            ...(nextServices !== undefined ? { services: nextServices } : {}),
            ...(nextReviews !== null ? { reviews: nextReviews, testimonials: nextReviews, feedbacks: nextReviews } : {}),
            ...(currentHome || Object.keys(nextHome).length > 0
              ? {
                  home: {
                    ...nextHome,
                    ...(nextProducts !== undefined && 'products' in (currentHome || {})
                      ? { products: nextProducts }
                      : {}),
                    ...(nextServices !== undefined && 'services' in (currentHome || {})
                      ? { services: nextServices }
                      : {}),
                    ...(nextProducts !== undefined && 'featuredProducts' in (currentHome || {})
                      ? { featuredProducts: nextProducts }
                      : {}),
                    ...(nextServices !== undefined && 'featuredServices' in (currentHome || {})
                      ? { featuredServices: nextServices }
                      : {}),
                  },
                }
              : {}),
          },
        } as T;
      });

      // Dynamic theme variable injection for instant color updates
      if (isRecord(live.theme)) {
        syncThemeToDocument(live.theme);
      }
    };

    const loadLiveCatalog = async (attempt = 0) => {
      if (stopped) return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch(endpoint, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Live catalog request failed with ${response.status}`);
        }
        const live: unknown = await response.json();
        if (stopped || !isRecord(live)) return;
        applyLiveCatalog(live);
        lastSuccessfulFetchAt = Date.now();
      } catch (error) {
        if (
          stopped ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        const retryDelay = retryDelays[attempt];
        if (retryDelay !== undefined) {
          retryTimer = window.setTimeout(() => {
            void loadLiveCatalog(attempt + 1);
          }, retryDelay);
        }
      }
    };

    const refreshIfStale = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastSuccessfulFetchAt >= 30_000
      ) {
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = null;
        void loadLiveCatalog();
      }
    };

    void loadLiveCatalog();
    window.addEventListener("focus", refreshIfStale);
    window.addEventListener("online", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);

    return () => {
      stopped = true;
      activeController?.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener("focus", refreshIfStale);
      window.removeEventListener("online", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [liveCatalogEndpoint, siteSlug, initialSiteData]);

  useEffect(() => {
    let parentOrigin = resolveParentOrigin();

    const applyIncomingSiteData = (incoming: unknown) => {
      if (!isRecord(incoming)) return;
      setSiteData((current) => mergeSiteData(current, incoming) as T);
      try {
        const inc = incoming as GenericRecord;
        const theme = (isRecord(inc.template) && isRecord((inc.template as GenericRecord).structure))
          ? (inc.template as GenericRecord).structure?.theme
          : inc.theme;
        if (theme) syncThemeToDocument(theme);
      } catch {
        // Best-effort
      }
      try {
        (window as unknown as Record<string, unknown>)[SITE_DATA_GLOBAL_KEY] =
          incoming;
        (window as unknown as Record<string, unknown>)[
          LEGACY_SITE_DATA_GLOBAL_KEY
        ] = incoming;
      } catch {
        // Ignore non-extensible window environments.
      }
      // Debounce session cache writes — stringify of large templates is costly.
      const win = window as unknown as {
        __fivoraSiteDataPersistTimer?: number;
      };
      window.clearTimeout(win.__fivoraSiteDataPersistTimer);
      win.__fivoraSiteDataPersistTimer = window.setTimeout(() => {
        try {
          const serialized = JSON.stringify(incoming);
          window.sessionStorage.setItem(SITE_DATA_CACHE_KEY, serialized);
          window.sessionStorage.setItem(LEGACY_SITE_DATA_CACHE_KEY, serialized);
        } catch {
          // Cache is best-effort.
        }
      }, 750);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!isRecord(event.data)) return;
      const isData =
        event.data.type === DENEB_PREVIEW_DATA_MESSAGE ||
        event.data.type === PREVIEW_DATA_MESSAGE ||
        event.data.type === LEGACY_PREVIEW_DATA_MESSAGE;
      const isFocus =
        event.data.type === DENEB_PREVIEW_FOCUS_MESSAGE ||
        event.data.type === PREVIEW_FOCUS_MESSAGE ||
        event.data.type === LEGACY_PREVIEW_FOCUS_MESSAGE;
      const isStylePatch =
        event.data.type === STYLE_PATCH_MESSAGE ||
        event.data.type === DENEB_STYLE_PATCH_MESSAGE;
      if (!isData && !isFocus && !isStylePatch) {
        return;
      }

      // Pin the first concrete parent origin when referrer was suppressed.
      if (!parentOrigin) {
        try {
          const candidateOrigin = new URL(event.origin).origin;
          if (candidateOrigin !== 'null') {
            parentOrigin = candidateOrigin;
            rememberParentOrigin(candidateOrigin);
          }
        } catch {
          return;
        }
      }

      // Accept the remembered/resolved parent origin, or a same-origin relay
      // from the injected focus bridge (used after in-iframe navigations).
      const trustedOrigins = new Set(
        [parentOrigin, window.location.origin].filter(Boolean) as string[],
      );
      if (!trustedOrigins.has(event.origin)) return;

      if (isData && isRecord(event.data.siteData)) {
        applyIncomingSiteData(event.data.siteData);
        try {
          const target = parentOrigin && parentOrigin !== 'null' ? parentOrigin : '*';
          const appliedFull = (event.data as Record<string, unknown>).full !== false;
          window.parent.postMessage(
            { type: 'FIVORA_PREVIEW_SITE_DATA_APPLIED', full: appliedFull },
            target,
          );
        } catch {
          // ignore
        }
        return;
      }

      if (isStylePatch) {
        const targetPath =
          typeof event.data.targetPath === 'string' ? event.data.targetPath : '';
        const styleType =
          typeof event.data.styleType === 'string' ? event.data.styleType : 'text';
        const properties = isRecord(event.data.properties) ? event.data.properties : {};
        if (targetPath) {
          patchStyleByPath(
            targetPath,
            styleType as 'text' | 'card' | 'button' | 'grid' | 'section',
            properties,
          );
        }
        return;
      }

      if (isFocus) {
        const fieldPath =
          typeof event.data.fieldPath === 'string' ? event.data.fieldPath : '';
        if (!fieldPath) return;
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>(
            `[${PREVIEW_FIELD_ATTRIBUTE}="${CSS.escape(fieldPath)}"]`,
          );
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    };

    window.addEventListener('message', onMessage);

    // Re-apply cache after mount in case the bridge published between
    // useState init and listener registration.
    const cached = readCachedSiteData<T>();
    if (cached) {
      applyIncomingSiteData(cached);
    }

    window.parent.postMessage(
      { type: DENEB_PREVIEW_READY_MESSAGE, pathname: window.location.pathname },
      parentOrigin ?? '*',
    );
    window.parent.postMessage(
      { type: PREVIEW_READY_MESSAGE, pathname: window.location.pathname },
      parentOrigin ?? '*',
    );
    window.parent.postMessage(
      { type: LEGACY_PREVIEW_READY_MESSAGE, pathname: window.location.pathname },
      parentOrigin ?? '*',
    );
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const value = useMemo(() => siteData as SiteData, [siteData]);
  return (
    <SiteDataContext.Provider value={value}>
      <ThemeStyles theme={(value as GenericRecord)?.theme as any} />
      <FontLoader />
      <ResponsiveBaseStyles />
      <DenebComponentStyles />
      {children}
    </SiteDataContext.Provider>
  );
}

export function useSiteData<T = SiteData>(): T {
  const ctx = useContext(SiteDataContext);
  if (ctx === UNINITIALIZED_SITE_DATA) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Deneb UI] useSiteData() was called outside of <SiteDataProvider>. ' +
        'Ensure your root layout.tsx or _app.tsx wraps the tree with: ' +
        '<SiteDataProvider initialSiteData={initialSiteData}>. Falling back to empty data.'
      );
    }
    return {} as T;
  }
  return ctx as T;
}

export function contentObject(value: unknown): GenericRecord {
  return isRecord(value) ? value : {};
}

export function contentText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function contentList<Item = unknown>(value: unknown): Item[] {
  return Array.isArray(value) ? (value as Item[]) : [];
}

export function contentNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

export function parseFieldPath(path: string): Array<string | number> {
  if (!path) return [];
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function getFieldStyle(
  content: unknown,
  path?: string,
): GenericRecord | null {
  if (!content || !path || typeof content !== "object") return null;
  const parts = parseFieldPath(path);
  if (parts.length === 0) return null;

  const last = parts.pop();
  if (last === undefined) return null;

  let current: unknown = content;
  for (const part of parts) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) return null;
      current = current[part];
    } else {
      if (!isRecord(current)) return null;
      current = current[part];
    }
  }

  if (!isRecord(current)) return null;
  const styleKey = `${String(last)}Style`;
  const styleObj = current[styleKey];
  return isRecord(styleObj) ? (styleObj as GenericRecord) : null;
}

export function useFieldStyle(path?: string): GenericRecord | null {
  const siteData = useSiteData();
  const content = siteData?.content;
  return useMemo(() => {
    if (!path || !content) return null;
    return getFieldStyle(content, path);
  }, [content, path]);
}

/**
 * Official DENEB UI data aliases for modern storefront development.
 * Fully compatible with Fivora visual editing engine and marketplace preview.
 */
export const DenebDataProvider = SiteDataProvider;
export const useDenebData = useSiteData;
export const DenebDataContext = SiteDataContext;
export type DenebData = SiteData;


/**
 * Hook to retrieve products cleanly from SiteData, supporting both
 * top-level content.products and nested content.home.products.
 */
export function useProducts(fallback: ProductItem[] = []): ProductItem[] {
  const siteData = useSiteData();
  const content = isRecord(siteData?.content) ? siteData.content : null;
  if (!content) return fallback;

  let rawList: ProductItem[] | null = null;
  if (Array.isArray(content.products) && content.products.length > 0) {
    rawList = content.products as ProductItem[];
  } else {
    const home = isRecord(content.home) ? content.home : null;
    if (home) {
      if (Array.isArray(home.products) && home.products.length > 0) {
        rawList = home.products as ProductItem[];
      } else if (Array.isArray(home.featuredProducts) && home.featuredProducts.length > 0) {
        rawList = home.featuredProducts as ProductItem[];
      }
    }
  }

  if (!rawList) return fallback;

  return rawList.map((p) => {
    if (!isRecord(p)) return p;
    const customData = isRecord(p.customData) ? p.customData : {};
    return {
      ...customData,
      ...p,
    } as ProductItem;
  });
}

/**
 * Hook to retrieve services cleanly from SiteData, supporting both
 * top-level content.services and nested content.home.services.
 */
export function useServices(fallback: ServiceItem[] = []): ServiceItem[] {
  const siteData = useSiteData();
  const content = isRecord(siteData?.content) ? siteData.content : null;
  if (!content) return fallback;

  if (Array.isArray(content.services) && content.services.length > 0) {
    return content.services as ServiceItem[];
  }
  const home = isRecord(content.home) ? content.home : null;
  if (home) {
    if (Array.isArray(home.services) && home.services.length > 0) {
      return home.services as ServiceItem[];
    }
    if (Array.isArray(home.featuredServices) && home.featuredServices.length > 0) {
      return home.featuredServices as ServiceItem[];
    }
  }
  return fallback;
}

/**
 * Hook to access official Fivora backend API endpoints (catalogUrl, contactUrl, analyticsUrl).
 */
export function useSiteApi(): SiteDataApiConfig | null {
  const siteData = useSiteData();
  return (siteData?.api as SiteDataApiConfig) ?? null;
}

/**
 * Hook to access full catalog metadata and live status.
 */
export function useSiteCatalog() {
  const products = useProducts();
  const services = useServices();
  const siteData = useSiteData();
  return {
    products,
    services,
    project: siteData?.project ?? null,
    siteInstance: siteData?.siteInstance ?? null,
    api: siteData?.api ?? null,
  };
}


/**
 * Hook to retrieve shop profile cleanly from SiteData, supporting both
 * top-level siteData.shop and siteData.merchant.
 */
export function useShop(fallback: GenericRecord = {}): GenericRecord {
  const siteData = useSiteData();
  if (isRecord(siteData?.shop)) return siteData.shop;
  if (isRecord(siteData?.merchant)) return siteData.merchant;
  return fallback;
}

/**
 * Hook to retrieve customer reviews / testimonials cleanly from SiteData.
 */
export function useReviews(fallback: GenericRecord[] = []): GenericRecord[] {
  const siteData = useSiteData();
  const content = isRecord(siteData?.content) ? siteData.content : null;
  if (content) {
    if (Array.isArray(content.reviews) && content.reviews.length > 0) {
      return content.reviews as GenericRecord[];
    }
    if (Array.isArray(content.testimonials) && content.testimonials.length > 0) {
      return content.testimonials as GenericRecord[];
    }
    if (Array.isArray(content.customerReviews) && content.customerReviews.length > 0) {
      return content.customerReviews as GenericRecord[];
    }
    const home = isRecord(content.home) ? content.home : null;
    if (home) {
      if (Array.isArray(home.reviews) && home.reviews.length > 0) {
        return home.reviews as GenericRecord[];
      }
      if (Array.isArray(home.testimonials) && home.testimonials.length > 0) {
        return home.testimonials as GenericRecord[];
      }
      if (Array.isArray(home.feedbacks) && home.feedbacks.length > 0) {
        return home.feedbacks as GenericRecord[];
      }
    }
  }
  if (Array.isArray((siteData as any)?.reviews) && (siteData as any).reviews.length > 0) {
    return (siteData as any).reviews as GenericRecord[];
  }
  return fallback;
}

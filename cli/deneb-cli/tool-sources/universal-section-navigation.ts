export const UNIVERSAL_SECTION_NAVIGATION_FILE =
  '__fivora-section-navigation.js';
export const UNIVERSAL_SECTION_NAVIGATION_VERSION = '1';

declare global {
  interface Window {
    __fivoraSectionNavigationInstalled?: boolean;
  }
}

export function installUniversalSectionNavigation() {
  if (window.__fivoraSectionNavigationInstalled) return;
  window.__fivoraSectionNavigationInstalled = true;

  const escapeSelector = (value: string) => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, (character) =>
      `\\${character.codePointAt(0)?.toString(16) ?? ''} `,
    );
  };

  const previewRoot = () =>
    window.location.pathname.match(
      /^(\/uploads\/generated-sites\/(?:template-preview|preview|live|candidate)\/[^/]+)/,
    )?.[1] ?? '';

  const routeSectionKey = (url: URL) => {
    const root = previewRoot();
    const relativePath = root && url.pathname.startsWith(root)
      ? url.pathname.slice(root.length)
      : url.pathname;
    const segments = relativePath
      .replace(/\/(?:index\.html?)?$/i, '')
      .split('/')
      .filter(Boolean);
    return (segments[segments.length - 1] ?? 'home').replace(/\.html?$/i, '');
  };

  const findTarget = (anchor: HTMLAnchorElement) => {
    const rawHref = anchor.getAttribute('href')?.trim();
    if (!rawHref || anchor.hasAttribute('download')) return null;
    if (anchor.target && anchor.target !== '_self') return null;
    if (/^(mailto:|tel:|sms:|whatsapp:|javascript:)/i.test(rawHref)) {
      return null;
    }

    let url: URL;
    try {
      url = new URL(rawHref, window.location.href);
    } catch {
      return null;
    }
    if (url.origin !== window.location.origin) return null;

    const hashKey = url.hash
      ? decodeURIComponent(url.hash.slice(1)).trim()
      : '';
    const key = hashKey || routeSectionKey(url);
    if (!key) return null;

    if (hashKey) {
      const byId = document.getElementById(hashKey);
      if (byId) return { target: byId, key };
    }

    // Route-to-section fallback is intentionally restricted to semantic
    // section markers. A normal multi-page link must continue to navigate
    // unless the requested section is actually present in this document.
    const escaped = escapeSelector(key);
    const target = document.querySelector<HTMLElement>(
      `section#${escaped},section[data-fivora-section="${escaped}"],section[data-section-id="${escaped}"],[data-preview-page-key="${escaped}"]`,
    );
    return target ? { target, key } : null;
  };

  const fixedHeaderOffset = () => {
    let offset = 0;
    for (const element of document.querySelectorAll<HTMLElement>(
      'header,nav,[data-fivora-sticky-header]',
    )) {
      const style = window.getComputedStyle(element);
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      const rect = element.getBoundingClientRect();
      if (rect.height <= 0 || rect.top > 4 || rect.bottom <= 0) continue;
      offset = Math.max(offset, rect.bottom);
    }
    return offset;
  };

  const scrollToTarget = (target: HTMLElement, key: string, updateHash: boolean) => {
    const top = Math.max(
      0,
      window.scrollY + target.getBoundingClientRect().top - fixedHeaderOffset() - 8,
    );
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (updateHash && window.location.hash !== `#${key}`) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(key)}`);
    }
    window.dispatchEvent(
      new CustomEvent('fivora:section-navigation', {
        detail: { key, target },
      }),
    );
  };

  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const resolved = findTarget(anchor);
      if (!resolved || resolved.target === anchor) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      scrollToTarget(resolved.target, resolved.key, true);
    },
    true,
  );

  const revealInitialHash = () => {
    if (!window.location.hash) return;
    const syntheticAnchor = document.createElement('a');
    syntheticAnchor.href = window.location.hash;
    const resolved = findTarget(syntheticAnchor);
    if (resolved) scrollToTarget(resolved.target, resolved.key, false);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(revealInitialHash));
}

const NAME_SHIM =
  "var __name = typeof __name === 'function' ? __name : ((target, value) => (typeof Object.defineProperty === 'function' ? Object.defineProperty(target, 'name', { value, configurable: true }) : target));\n";

export const UNIVERSAL_SECTION_NAVIGATION_SCRIPT =
  NAME_SHIM + `;(${installUniversalSectionNavigation.toString()})();`;

export function upsertUniversalSectionNavigationTag(
  html: string,
  scriptSource: string,
) {
  const scriptTag = `<script src="${scriptSource}" data-fivora-section-navigation></script>`;
  const existingTag =
    /<script\b(?=[^>]*\bdata-fivora-section-navigation\b)[^>]*>\s*<\/script>/i;
  if (existingTag.test(html)) return html.replace(existingTag, scriptTag);
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${scriptTag}</body>`)
    : `${html}${scriptTag}`;
}

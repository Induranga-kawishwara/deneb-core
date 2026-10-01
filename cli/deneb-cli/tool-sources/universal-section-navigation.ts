export function installUniversalSectionNavigation() {
  const state = window as Window & {
    __fivoraSectionNavigationInstalled?: boolean;
  };
  if (state.__fivoraSectionNavigationInstalled) return;
  state.__fivoraSectionNavigationInstalled = true;

  const escapeSelector = (value: string) =>
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/[^a-zA-Z0-9_-]/g, (character) =>
          `\\${character.codePointAt(0)?.toString(16) ?? ''} `,
        );
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
    if (/^(mailto:|tel:|sms:|whatsapp:|javascript:)/i.test(rawHref)) return null;
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
      if (rect.height > 0 && rect.top <= 4 && rect.bottom > 0) {
        offset = Math.max(offset, rect.bottom);
      }
    }
    return offset;
  };
  const scrollToTarget = (target: HTMLElement, key: string, updateHash: boolean) => {
    const top = Math.max(
      0,
      window.scrollY + target.getBoundingClientRect().top - fixedHeaderOffset() - 8,
    );
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (updateHash && window.location.hash !== `#${key}`) {
      window.history.pushState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#${encodeURIComponent(key)}`,
      );
    }
  };

  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
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
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => {
      if (!window.location.hash) return;
      const anchor = document.createElement('a');
      anchor.href = window.location.hash;
      const resolved = findTarget(anchor);
      if (resolved) scrollToTarget(resolved.target, resolved.key, false);
    }),
  );
}


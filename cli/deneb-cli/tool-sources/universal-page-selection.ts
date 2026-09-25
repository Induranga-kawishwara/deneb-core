import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const UNIVERSAL_PAGE_SELECTION_STYLE_ID =
  'fivora-page-selection-style';
export const UNIVERSAL_PAGE_SELECTION_SCRIPT_ID =
  'fivora-page-selection-script';

export type FivoraTemplatePageDefinition = {
  id: string;
  label: string;
  route: string;
};

export function getTemplateValidationSelectedPages(
  pages: Array<{ id: string; required?: boolean }>,
) {
  const selected = pages
    .filter((page, index) => page.required === true || index === 0)
    .map((page) => page.id);
  return selected.length > 0
    ? selected
    : pages.slice(0, 1).map((page) => page.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRoute(value: string, pageId: string, isFirstPage: boolean) {
  const route = value.trim().split(/[?#]/, 1)[0];
  if (route === '/' || route === '') return isFirstPage ? '/' : `/${pageId}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(route) || route.startsWith('//')) {
    return isFirstPage ? '/' : `/${pageId}`;
  }
  return `/${route.replace(/^\/+|\/+$/g, '')}`;
}

export function normalizeTemplatePageDefinitions(
  manifest: unknown,
  fallbackPageIds: string[] = [],
): FivoraTemplatePageDefinition[] {
  const manifestPages =
    isRecord(manifest) && Array.isArray(manifest.pages) ? manifest.pages : [];
  const definitions = manifestPages.flatMap((page, index) => {
    if (!isRecord(page) || typeof page.id !== 'string' || !page.id.trim()) {
      return [];
    }
    const id = page.id.trim();
    const label =
      typeof page.label === 'string' && page.label.trim()
        ? page.label.trim()
        : id.replace(/_/g, ' ');
    return [
      {
        id,
        label,
        route: normalizeRoute(
          typeof page.route === 'string' ? page.route : '',
          id,
          index === 0,
        ),
      },
    ];
  });
  if (definitions.length > 0) return definitions;

  const fallback = fallbackPageIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id, index) => ({
      id,
      label: id.replace(/_/g, ' '),
      route: index === 0 ? '/' : `/${id}`,
    }));
  return fallback;
}

/**
 * Hides navigation and teaser UI that targets unselected pages. Keep this
 * function self-contained because it is serialized into preview/final HTML.
 */
export function enforceSelectedTemplatePages(
  siteDataValue: unknown,
  documentValue?: Document,
) {
  const doc = documentValue ?? document;
  const record =
    siteDataValue &&
    typeof siteDataValue === 'object' &&
    !Array.isArray(siteDataValue)
      ? (siteDataValue as Record<string, unknown>)
      : null;
  const requirements =
    record?.requirements &&
    typeof record.requirements === 'object' &&
    !Array.isArray(record.requirements)
      ? (record.requirements as Record<string, unknown>)
      : null;
  const template =
    record?.template &&
    typeof record.template === 'object' &&
    !Array.isArray(record.template)
      ? (record.template as Record<string, unknown>)
      : null;
  const structure =
    template?.structure &&
    typeof template.structure === 'object' &&
    !Array.isArray(template.structure)
      ? (template.structure as Record<string, unknown>)
      : null;
  const hasRequiredPages = Array.isArray(requirements?.requiredPages);
  const hasStructurePages = Array.isArray(structure?.pages);
  if (!hasRequiredPages && !hasStructurePages) return;

  const selectedSource = hasRequiredPages
    ? (requirements?.requiredPages as unknown[])
    : (structure?.pages as unknown[]);
  const selected = new Set(
    selectedSource
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const templateDefinitions = Array.isArray(template?.pageDefinitions)
    ? template.pageDefinitions
    : [];
  const structureDefinitions = Array.isArray(structure?.pageDefinitions)
    ? structure.pageDefinitions
    : [];
  const providedDefinitions =
    templateDefinitions.length > 0 ? templateDefinitions : structureDefinitions;
  const definitions = providedDefinitions.flatMap((page) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) return [];
    const value = page as Record<string, unknown>;
    if (typeof value.id !== 'string' || !value.id.trim()) return [];
    const id = value.id.trim();
    const label =
      typeof value.label === 'string' && value.label.trim()
        ? value.label.trim()
        : id.replace(/_/g, ' ');
    const rawRoute = typeof value.route === 'string' ? value.route.trim() : '';
    const route =
      rawRoute === '/' ? '/' : `/${(rawRoute || id).replace(/^\/+|\/+$/g, '')}`;
    return [{ id, label, route }];
  });
  const fallbackPageSource = hasStructurePages
    ? (structure?.pages as unknown[])
    : selectedSource;
  const fallbackDefinitions = fallbackPageSource
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((id, index) => ({
      id,
      label: id.replace(/_/g, ' '),
      route: index === 0 ? '/' : `/${id}`,
    }));
  const pages = definitions.length > 0 ? definitions : fallbackDefinitions;
  if (pages.length === 0) return;
  const disabledPages = pages.filter((page) => !selected.has(page.id));
  if (disabledPages.length === 0) {
    doc
      .querySelectorAll('[data-fivora-page-disabled]')
      .forEach((element) =>
        element.removeAttribute('data-fivora-page-disabled'),
      );
    return;
  }

  let style = doc.getElementById('fivora-page-selection-style');
  if (!style || style.tagName !== 'STYLE') {
    style = doc.createElement('style');
    style.id = 'fivora-page-selection-style';
    style.textContent =
      '[data-fivora-page-disabled="true"]{display:none!important}';
    doc.head.appendChild(style);
  }
  doc
    .querySelectorAll('[data-fivora-page-disabled]')
    .forEach((element) =>
      element.removeAttribute('data-fivora-page-disabled'),
    );

  const normalizePath = (value: string) => {
    let pathname = value;
    try {
      const url = new URL(value, doc.baseURI);
      if (url.origin !== doc.location?.origin) return '';
      pathname = url.pathname;
    } catch {
      return '';
    }
    const previewRoot = pathname.match(
      /^(\/uploads\/generated-sites\/(?:template-preview|preview|live)\/[^/]+)/,
    )?.[1];
    if (previewRoot && pathname.startsWith(previewRoot)) {
      pathname = pathname.slice(previewRoot.length) || '/';
    }
    pathname = pathname.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
    const clean = pathname.replace(/\/+$/g, '') || '/';
    return clean.startsWith('/') ? clean : `/${clean}`;
  };
  const pageForPath = (path: string) =>
    pages.find((page) => {
      const route = normalizePath(page.route);
      if (!route) return false;
      if (route === '/') return path === '/';
      return path === route || path.startsWith(`${route}/`);
    });
  const pageForControl = (element: Element) => {
    for (const attribute of [
      'href',
      'formaction',
      'data-href',
      'data-route',
      'data-url',
    ]) {
      const destination = element.getAttribute(attribute);
      if (!destination) continue;
      const page = pageForPath(normalizePath(destination));
      if (page) return page;
    }
    return undefined;
  };
  const disable = (element: Element | null) => {
    if (element) element.setAttribute('data-fivora-page-disabled', 'true');
  };

  for (const page of disabledPages) {
    for (const attribute of [
      'data-page-key',
      'data-required-page',
      'data-target-page',
    ]) {
      doc.querySelectorAll(`[${attribute}]`).forEach((element) => {
        if (element.getAttribute(attribute) === page.id) disable(element);
      });
    }
  }

  const anchors = Array.from(
    doc.querySelectorAll<HTMLAnchorElement>('a[href]'),
  );
  for (const anchor of anchors) {
    const targetPage = pageForControl(anchor);
    if (!targetPage || selected.has(targetPage.id)) continue;
    const fullCardLink =
      anchor.classList.contains('absolute') &&
      (anchor.classList.contains('inset-0') ||
        (anchor.classList.contains('inset-x-0') &&
          anchor.classList.contains('inset-y-0')));
    if (fullCardLink) {
      disable(
        anchor.closest(
          '[data-preview-item-path],[data-design-card],article,li',
        ),
      );
    } else {
      const listItem = anchor.closest('li');
      disable(
        listItem && listItem.querySelectorAll('a[href]').length === 1
          ? listItem
          : anchor,
      );
    }
  }

  const buttons = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'button,[role="button"],[data-href],[data-route],[data-url]',
    ),
  ).filter((element) => element.tagName !== 'A');
  for (const button of buttons) {
    const targetPage = pageForControl(button);
    if (!targetPage || selected.has(targetPage.id)) continue;
    const listItem = button.closest('li');
    disable(
      listItem &&
        listItem.querySelectorAll(
          'a[href],button,[role="button"],[data-href],[data-route],[data-url]',
        ).length === 1
        ? listItem
        : button,
    );
  }

  const firstMainSection = doc.querySelector('main section');
  for (const section of doc.querySelectorAll<HTMLElement>('main section')) {
    const allActions = Array.from(
      section.querySelectorAll<HTMLElement>(
        'a[href],button,[role="button"],[data-href],[data-route],[data-url]',
      ),
    );
    const routeLinks = allActions
      .map(pageForControl)
      .filter((page): page is { id: string; label: string; route: string } =>
        Boolean(page),
      );
    const isPageRoot = section.hasAttribute('data-preview-page-key');
    const isLikelyHero =
      section === firstMainSection ||
      section.hasAttribute('data-design-hero') ||
      /(?:^|\s)(?:hero|banner|masthead)(?:\s|$)/i.test(section.className) ||
      Boolean(section.querySelector('h1'));
    if (
      !isPageRoot &&
      !isLikelyHero &&
      routeLinks.length > 0 &&
      routeLinks.length === allActions.length &&
      routeLinks.every((page) => !selected.has(page.id))
    ) {
      disable(section);
    }
  }
}

function pageSelectionPayload(siteData: unknown, basePath = '') {
  if (!isRecord(siteData)) return null;
  const requirements = isRecord(siteData.requirements)
    ? siteData.requirements
    : null;
  const template = isRecord(siteData.template) ? siteData.template : null;
  const structure = isRecord(template?.structure) ? template.structure : null;
  const requiredPages = Array.isArray(requirements?.requiredPages)
    ? requirements.requiredPages.filter(
        (page): page is string => typeof page === 'string',
      )
    : undefined;
  const structurePages = Array.isArray(structure?.pages)
    ? structure.pages.filter((page): page is string => typeof page === 'string')
    : undefined;
  const pageDefinitions = normalizeTemplatePageDefinitions(
    {
      pages:
        Array.isArray(template?.pageDefinitions)
          ? template.pageDefinitions
          : Array.isArray(structure?.pageDefinitions)
            ? structure.pageDefinitions
            : undefined,
    },
    requiredPages ?? structurePages ?? [],
  );
  const routes = Object.fromEntries(
    pageDefinitions.map((page) => [page.id, page.route]),
  );
  return {
    basePath: basePath.replace(/\/+$/g, ''),
    routes,
    requirements: {
      requiredPages,
    },
    template: {
      pageDefinitions: Array.isArray(template?.pageDefinitions)
        ? template.pageDefinitions
        : undefined,
      structure: {
        pages: structurePages,
        pageDefinitions: Array.isArray(structure?.pageDefinitions)
          ? structure.pageDefinitions
          : undefined,
      },
    },
  };
}

function installProgressivePageNavigation(
  payload: {
    basePath?: string;
    routes?: Record<string, string>;
  },
  doc: Document = document,
) {
  const win = doc.defaultView;
  if (!win || (win as Window & { __fivoraProgressiveNav?: boolean }).__fivoraProgressiveNav) {
    return;
  }
  (win as Window & { __fivoraProgressiveNav?: boolean }).__fivoraProgressiveNav =
    true;
  const routes = payload.routes ?? {};
  const base = (payload.basePath ?? '').replace(/\/+$/g, '');
  doc.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest('[data-target-page]');
      if (
        !control ||
        control.getAttribute('data-fivora-page-disabled') === 'true'
      ) {
        return;
      }
      if (control.tagName === 'A' && control.getAttribute('href')) return;
      const pageKey = control.getAttribute('data-target-page');
      if (!pageKey) return;
      const route = routes[pageKey];
      if (!route) return;
      event.preventDefault();
      const path = route === '/' ? '/' : route.startsWith('/') ? route : `/${route}`;
      win.location.assign(`${base}${path}`);
    },
    true,
  );
}

export function upsertUniversalPageSelection(
  html: string,
  siteData: unknown,
  basePath = '',
) {
  const payload = pageSelectionPayload(siteData, basePath);
  const stylePattern = new RegExp(
    `<style\\b[^>]*\\bid=["']${UNIVERSAL_PAGE_SELECTION_STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>`,
    'gi',
  );
  const scriptPattern = new RegExp(
    `<script\\b[^>]*\\bid=["']${UNIVERSAL_PAGE_SELECTION_SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/script>`,
    'gi',
  );
  let updated = html.replace(stylePattern, '').replace(scriptPattern, '');
  if (!payload) return updated;
  const style = `<style id="${UNIVERSAL_PAGE_SELECTION_STYLE_ID}">[data-fivora-page-disabled="true"]{display:none!important}</style>`;
  const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const script =
    `<script id="${UNIVERSAL_PAGE_SELECTION_SCRIPT_ID}">` +
    `;(()=>{const d=${payloadJson};` +
    `const n=${installProgressivePageNavigation.toString()};n(d,document);` +
    `const f=${enforceSelectedTemplatePages.toString()};` +
    `const a=()=>f(d,document);if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',a,{once:true})}else{a()}` +
    `;[0,80,300,1000].forEach(t=>setTimeout(a,t));})();</script>`;
  updated = /<\/head>/i.test(updated)
    ? updated.replace(/<\/head>/i, `${style}</head>`)
    : `${style}${updated}`;
  return /<\/body>/i.test(updated)
    ? updated.replace(/<\/body>/i, `${script}</body>`)
    : `${updated}${script}`;
}

export async function applyUniversalPageSelectionToDirectory(input: {
  root: string;
  siteData: unknown;
  basePath?: string;
}) {
  const htmlFiles: string[] = [];
  const visit = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        htmlFiles.push(path);
      }
    }
  };
  await visit(input.root);
  await Promise.all(
    htmlFiles.map(async (filePath) => {
      const html = await readFile(filePath, 'utf8');
      await writeFile(
        filePath,
        upsertUniversalPageSelection(
          html,
          input.siteData,
          input.basePath ?? '',
        ),
        'utf8',
      );
    }),
  );
  return { pageCount: htmlFiles.length };
}

export function findLinksToUnselectedPages(input: {
  html: string;
  pageDefinitions: FivoraTemplatePageDefinition[];
  selectedPages: string[];
  basePath?: string;
}) {
  const selected = new Set(input.selectedPages);
  const disabled = input.pageDefinitions.filter(
    (page) => !selected.has(page.id),
  );
  const findings: Array<{ pageId: string; route: string; href: string }> = [];
  for (const match of input.html.matchAll(
    /<[a-z][^>]*\b(?:href|formaction|data-href|data-route|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi,
  )) {
    const rawHref = match[1] ?? match[2] ?? '';
    if (
      !rawHref.trim() ||
      rawHref.trim().startsWith('#') ||
      /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(rawHref.trim())
    ) {
      continue;
    }
    const href = rawHref.split(/[?#]/, 1)[0];
    const normalizedBasePath = input.basePath?.replace(/\/+$/g, '') || '';
    const withoutBase =
      normalizedBasePath &&
      (href === normalizedBasePath || href.startsWith(`${normalizedBasePath}/`))
        ? href.slice(normalizedBasePath.length) || '/'
        : href;
    const normalized = `/${withoutBase
      .replace(/\/index\.html$/i, '/')
      .replace(/\.html$/i, '')
      .replace(/^\.\//, '')
      .replace(/^\/+|\/+$/g, '')}`;
    const path = normalized === '/' ? '/' : normalized;
    const page = disabled.find((candidate) => {
      const route =
        candidate.route === '/'
          ? '/'
          : `/${candidate.route.replace(/^\/+|\/+$/g, '')}`;
      return route === '/'
        ? path === '/'
        : path === route || path.startsWith(`${route}/`);
    });
    if (page) findings.push({ pageId: page.id, route: page.route, href });
  }
  return findings;
}

/**
 * Next's client router applies next.config `basePath` automatically. Wrapping
 * a router destination in a helper that also prepends the base path duplicates
 * the generated-site prefix at runtime.
 */
export function findDoubleBasePathNextRouterCalls(source: string) {
  const findings: Array<{ line: number; expression: string }> = [];
  const patterns = [
    /\b(?:router|navigation)\s*\.\s*(?:push|replace|prefetch)\s*\(\s*withBasePath\s*\(/g,
    /<Link\b[^>]{0,500}?\bhref\s*=\s*\{\s*withBasePath\s*\(/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const offset = match.index ?? 0;
      findings.push({
        line: source.slice(0, offset).split(/\r?\n/).length,
        expression: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return findings;
}

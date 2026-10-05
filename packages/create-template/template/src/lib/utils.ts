export function withBasePath(value?: string | null) {
  let url = value?.trim() ?? '';
  if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url;

  // Deduplicate any repeated generated-sites prefix segments
  const generatedSitesMatch = url.match(
    /^(\/uploads\/generated-sites\/(?:template-preview|preview|live|candidate)\/[^/]+)/i,
  );
  if (generatedSitesMatch) {
    const root = generatedSitesMatch[1];
    let rest = url.slice(root.length);
    while (rest.toLowerCase().startsWith(root.toLowerCase())) {
      rest = rest.slice(root.length);
    }
    url = `${root}${rest}`;
  }

  const basePath = (process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? '').replace(
    /\/$/,
    '',
  );
  if (!basePath) return url.startsWith('/') ? url : `/${url}`;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path === basePath || path.startsWith(`${basePath}/`) || path.startsWith(`${basePath}?`)) {
    return path;
  }
  return `${basePath}${path}`;
}

export function pageRoute(pageKey: string) {
  return pageKey === 'home' ? '/' : `/${pageKey}`;
}

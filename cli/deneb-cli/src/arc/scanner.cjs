'use strict';

const fs = require('fs');
const path = require('path');
const {
  walkFiles,
  readJsonSafe,
  detectPackageManager,
  findFirstExisting,
  isJsxFile,
  isSourceFile,
  rel,
  shortHash,
  toPosix,
} = require('./fs-utils.cjs');
const { ARC_VERSION } = require('./version.cjs');

const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];

function readPackage(projectDir) {
  return readJsonSafe(path.join(projectDir, 'package.json'), {}) || {};
}

function allDeps(pkg) {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
}

function depVersion(deps, name) {
  return deps[name] ? String(deps[name]).replace(/^[^\d]*/, '') : undefined;
}

function parseTsconfig(projectDir) {
  const file = findFirstExisting([
    path.join(projectDir, 'tsconfig.json'),
    path.join(projectDir, 'jsconfig.json'),
  ]);
  if (!file) return { file: null, config: {}, aliases: {} };
  const config = readJsonSafe(file, {}) || {};
  const paths = config.compilerOptions?.paths || {};
  const baseUrl = config.compilerOptions?.baseUrl || '.';
  const aliases = {};
  for (const [alias, targets] of Object.entries(paths)) {
    const target = Array.isArray(targets) ? targets[0] : targets;
    if (!target) continue;
    aliases[alias] = path.resolve(projectDir, baseUrl, target);
  }
  return { file, config, aliases };
}

function detectFramework(pkg, deps, projectDir) {
  if (deps.next) {
    return {
      framework: 'nextjs',
      frameworkVersion: depVersion(deps, 'next'),
    };
  }
  if (deps.vite || findFirstExisting([
    path.join(projectDir, 'vite.config.ts'),
    path.join(projectDir, 'vite.config.js'),
    path.join(projectDir, 'vite.config.mjs'),
  ])) {
    return {
      framework: 'vite-react',
      frameworkVersion: depVersion(deps, 'vite'),
    };
  }
  if (deps.react) {
    return {
      framework: 'react',
      frameworkVersion: depVersion(deps, 'react'),
    };
  }
  return { framework: 'unknown' };
}

function detectRouter(projectDir, framework) {
  const appDir = findFirstExisting([
    path.join(projectDir, 'src', 'app'),
    path.join(projectDir, 'app'),
  ]);
  const pagesDir = findFirstExisting([
    path.join(projectDir, 'src', 'pages'),
    path.join(projectDir, 'pages'),
  ]);

  if (framework === 'nextjs' && appDir) {
    return { router: 'next-app', appDir, pagesDir };
  }
  if (framework === 'nextjs' && pagesDir) {
    return { router: 'next-pages', appDir: null, pagesDir };
  }
  if (findReactRouter(projectDir)) {
    return { router: 'react-router', appDir, pagesDir };
  }
  return { router: pagesDir || appDir ? 'custom' : 'unknown', appDir, pagesDir };
}

function findReactRouter(projectDir) {
  const pkg = readPackage(projectDir);
  const deps = allDeps(pkg);
  return Boolean(deps['react-router'] || deps['react-router-dom']);
}

function detectCssSystems(deps, projectDir) {
  const systems = [];
  const hasTailwindPkg = Boolean(deps.tailwindcss);
  const hasTailwindConfig = Boolean(findFirstExisting([
    path.join(projectDir, 'tailwind.config.js'),
    path.join(projectDir, 'tailwind.config.ts'),
    path.join(projectDir, 'tailwind.config.mjs'),
    path.join(projectDir, 'tailwind.config.cjs'),
  ]));
  const hasTailwindV4 =
    (hasTailwindPkg && /^4\b/.test(String(deps.tailwindcss || '').replace(/^[^\d]*/, ''))) ||
    Boolean(deps['@tailwindcss/postcss']) ||
    Boolean(deps['@tailwindcss/vite']);

  if (hasTailwindPkg || hasTailwindConfig || hasTailwindV4) {
    systems.push(hasTailwindV4 ? 'tailwind-v4' : 'tailwind-v3');
  }
  if (deps.sass || deps['sass-embedded']) systems.push('scss');
  if (walkFiles(projectDir, { include: (_p, name) => name.endsWith('.module.css') }).length) {
    systems.push('css-modules');
  }
  if (walkFiles(projectDir, { include: (_p, name) => name.endsWith('.css') && !name.endsWith('.module.css') }).length) {
    systems.push('vanilla-css');
  }
  return [...new Set(systems)];
}

function detectLibraries(deps, projectDir) {
  const componentLibraries = [];
  const animationLibraries = [];
  const iconLibraries = [];

  const hasShadcn = Boolean(
    fs.existsSync(path.join(projectDir, 'components.json')) ||
    deps['@radix-ui/react-slot'] ||
    deps['class-variance-authority']
  );
  if (hasShadcn) componentLibraries.push('shadcn');
  if (Object.keys(deps).some((d) => d.startsWith('@radix-ui/'))) componentLibraries.push('radix');
  if (deps['@heroui/react'] || deps['@nextui-org/react'] || Object.keys(deps).some((d) => d.startsWith('@heroui/') || d.startsWith('@nextui-org/'))) {
    componentLibraries.push('heroui');
  }
  if (deps['react-bits'] || Object.keys(deps).some((d) => d.includes('react-bits') || d.startsWith('@react-bits/'))) {
    componentLibraries.push('react-bits');
  }
  if (deps['@headlessui/react']) componentLibraries.push('headless-ui');
  if (deps['styled-components'] || deps['@emotion/react'] || deps['@emotion/styled']) {
    componentLibraries.push('css-in-js');
  }

  if (deps['framer-motion'] || deps.motion) animationLibraries.push('framer-motion');
  if (deps['gsap']) animationLibraries.push('gsap');

  if (deps['lucide-react']) iconLibraries.push('lucide');
  if (deps['@heroicons/react']) iconLibraries.push('heroicons');
  if (deps['react-icons']) iconLibraries.push('react-icons');
  if (deps['@tabler/icons-react']) iconLibraries.push('tabler');

  return { componentLibraries: [...new Set(componentLibraries)], animationLibraries, iconLibraries, hasShadcn };
}

function titleize(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function routeIdFromSegments(segments) {
  const cleaned = segments.filter(Boolean).join('_') || 'home';
  return cleaned.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

function scanAppRouterRoutes(appDir, projectDir) {
  const routes = [];
  if (!appDir) return routes;

  function walk(dir, urlSegments, groupLayouts) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const layoutFile = ['layout.tsx', 'layout.jsx', 'layout.js']
      .map((name) => path.join(dir, name))
      .find((file) => fs.existsSync(file));
    const pageFile = ['page.tsx', 'page.jsx', 'page.js']
      .map((name) => path.join(dir, name))
      .find((file) => fs.existsSync(file));
    const layouts = layoutFile ? [...groupLayouts, rel(projectDir, layoutFile)] : groupLayouts;

    if (pageFile) {
      const routePath = '/' + urlSegments.filter(Boolean).join('/');
      const id = routePath === '/' ? 'home' : routeIdFromSegments(urlSegments.filter((s) => !s.startsWith('[')));
      routes.push({
        id,
        label: routePath === '/' ? 'Home' : titleize(urlSegments.filter((s) => !s.startsWith('[')).join(' ') || id),
        route: routePath === '/' ? '/' : routePath.replace(/\/+/g, '/'),
        file: rel(projectDir, pageFile),
        layouts,
        required: id === 'home' || id === 'contact' || routePath === '/contact',
        dynamic: urlSegments.some((s) => s.startsWith('[')),
        router: 'next-app',
      });
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith('_') || name === 'api' || name === 'favicon.ico') continue;
      const nextUrl = name.startsWith('(') && name.endsWith(')')
        ? urlSegments
        : [...urlSegments, name];
      walk(path.join(dir, name), nextUrl, layouts);
    }
  }

  walk(appDir, [], []);
  return routes;
}

function scanPagesRouterRoutes(pagesDir, projectDir) {
  const routes = [];
  if (!pagesDir) return routes;

  function walk(dir, urlSegments) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('_') || entry.name === 'api') continue;
        walk(full, [...urlSegments, entry.name]);
        continue;
      }
      if (!/\.(tsx|jsx|js)$/.test(entry.name)) continue;
      const base = entry.name.replace(/\.(tsx|jsx|js)$/, '');
      if (base.startsWith('_')) continue;
      if (base === 'api') continue;
      const last = base === 'index' ? urlSegments : [...urlSegments, base];
      const routePath = '/' + last.join('/');
      const id = routePath === '/' ? 'home' : routeIdFromSegments(last.filter((s) => !s.startsWith('[')));
      routes.push({
        id,
        label: routePath === '/' ? 'Home' : titleize(last.filter((s) => !s.startsWith('[')).join(' ') || id),
        route: routePath === '/' ? '/' : routePath.replace(/\/+/g, '/'),
        file: rel(projectDir, full),
        layouts: [],
        required: id === 'home' || id === 'contact',
        dynamic: last.some((s) => s.startsWith('[')),
        router: 'next-pages',
      });
    }
  }

  walk(pagesDir, []);
  return routes;
}

/**
 * Fivora's strict contract requires every manifest page to resolve to an
 * exported HTML file. Inventing a route that has no page component on disk
 * guarantees "route has no exported HTML file" at ingest time, so ARC only
 * ever declares routes it actually found.
 */
function keepExportableRoutes(routes) {
  const exportable = routes.filter((route) => !route.dynamic && (route.file || route.inferred));
  return exportable.length ? exportable : routes.filter((route) => route.inferred);
}

function resolvePageFileOnDisk(projectDir, page) {
  if (!page) return null;
  if (page.file && fs.existsSync(path.join(projectDir, page.file))) return page.file.replace(/\\/g, '/');
  const route = String(page.route || '').replace(/^\//, '').replace(/\/+$/, '');
  const id = page.id === 'home' ? '' : page.id;
  const segments = route || id || '';
  const candidates = [];
  if (!segments || page.id === 'home' || page.route === '/') {
    candidates.push(
      'src/app/page.tsx',
      'src/app/page.jsx',
      'src/app/page.js',
      'app/page.tsx',
      'app/page.jsx',
      'app/page.js',
      'pages/index.tsx',
      'pages/index.jsx',
      'pages/index.js',
      'src/pages/index.tsx',
      'src/pages/index.jsx',
      'src/pages/index.js',
    );
  }
  if (segments) {
    for (const base of ['src/app', 'app']) {
      for (const name of ['page.tsx', 'page.jsx', 'page.js']) {
        candidates.push(`${base}/${segments}/${name}`);
      }
    }
    for (const base of ['pages', 'src/pages']) {
      for (const ext of ['tsx', 'jsx', 'js']) {
        candidates.push(`${base}/${segments}.${ext}`);
        candidates.push(`${base}/${segments}/index.${ext}`);
      }
    }
  }
  for (const relative of candidates) {
    if (fs.existsSync(path.join(projectDir, relative))) return relative.replace(/\\/g, '/');
  }
  return null;
}

function detectLanguage(sourceFiles) {
  let ts = 0;
  let js = 0;
  for (const file of sourceFiles) {
    if (/\.(tsx|ts)$/.test(file)) ts++;
    else if (/\.(jsx|js|mjs|cjs)$/.test(file)) js++;
  }
  if (ts && js) return 'mixed';
  if (ts) return 'typescript';
  return 'javascript';
}

function fileHasUseClient(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf8').slice(0, 800);
    return /['"]use client['"]/.test(head);
  } catch {
    return false;
  }
}

function detectGlobalCss(projectDir, appDir, pagesDir) {
  const candidates = [
    appDir && path.join(appDir, 'globals.css'),
    appDir && path.join(appDir, 'global.css'),
    pagesDir && path.join(path.dirname(pagesDir), 'styles', 'globals.css'),
    path.join(projectDir, 'src', 'app', 'globals.css'),
    path.join(projectDir, 'src', 'index.css'),
    path.join(projectDir, 'src', 'styles', 'globals.css'),
    path.join(projectDir, 'app', 'globals.css'),
  ].filter(Boolean);
  const hit = findFirstExisting(candidates);
  return hit ? rel(projectDir, hit) : null;
}

function listAssets(projectDir) {
  const publicDir = findFirstExisting([
    path.join(projectDir, 'public'),
    path.join(projectDir, 'src', 'public'),
  ]);
  if (!publicDir) return [];
  return walkFiles(publicDir, {
    include: (_p, name) => /\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|ico)$/i.test(name),
  }).map((file) => ({
    file: rel(projectDir, file),
    kind: 'public',
  }));
}

function listContentSources(projectDir) {
  const files = walkFiles(projectDir, {
    include: (_p, name) => /\.(json|md|mdx)$/.test(name) && !name.includes('package'),
  }).filter((file) => /\/(data|content|messages|locales)\//i.test(toPosix(file)));
  return files.map((file) => ({ file: rel(projectDir, file), kind: 'static-file' }));
}

function classifyComponentFile(filePath, projectDir) {
  const relative = rel(projectDir, filePath);
  const base = path.basename(filePath).replace(/\.(tsx|jsx|ts|js)$/, '');
  const posix = toPosix(relative).toLowerCase();
  let role = 'component';
  if (/(^|\/)layout\./.test(posix)) role = 'layout';
  else if (/(^|\/)page\./.test(posix) || /(^|\/)pages\//.test(posix)) role = 'page';
  else if (/nav|header|navbar/.test(base.toLowerCase()) || /nav|header/.test(posix)) role = 'navigation';
  else if (/footer/.test(base.toLowerCase()) || /footer/.test(posix)) role = 'footer';
  else if (/hero/.test(base.toLowerCase())) role = 'hero';
  else if (/product/.test(base.toLowerCase())) role = 'product';
  return {
    file: relative,
    name: base,
    role,
    client: fileHasUseClient(filePath),
  };
}

function buildArchitectureFingerprint(profile) {
  return shortHash(JSON.stringify({
    framework: profile.framework,
    router: profile.router,
    css: profile.cssSystems,
    libs: profile.componentLibraries,
    icons: profile.iconLibraries,
    animation: profile.animationLibraries,
    language: profile.language,
    routeCount: profile.routes.length,
    hasSrc: profile.hasSrc,
  }));
}

function scanProject(projectDir) {
  const pkg = readPackage(projectDir);
  const deps = allDeps(pkg);
  const tsconfig = parseTsconfig(projectDir);
  const { framework, frameworkVersion } = detectFramework(pkg, deps, projectDir);
  const { router, appDir, pagesDir } = detectRouter(projectDir, framework);
  const sourceFilesAbs = walkFiles(projectDir, { include: (_p, name) => isSourceFile(name) });
  const jsxFilesAbs = sourceFilesAbs.filter((file) => isJsxFile(file));
  let routes = router === 'next-pages'
    ? scanPagesRouterRoutes(pagesDir, projectDir)
    : scanAppRouterRoutes(appDir, projectDir);
  if (!routes.length) {
    routes = [{ id: 'home', label: 'Home', route: '/', required: true, inferred: true }];
  }
  routes = keepExportableRoutes(routes);

  const libs = detectLibraries(deps, projectDir);
  const components = jsxFilesAbs.map((file) => classifyComponentFile(file, projectDir));
  const hasSrc = fs.existsSync(path.join(projectDir, 'src'));

  const profile = {
    engine: 'deneb-arc',
    arcVersion: ARC_VERSION,
    root: projectDir,
    name: pkg.name || path.basename(projectDir),
    framework,
    frameworkVersion,
    language: detectLanguage(sourceFilesAbs),
    router,
    packageManager: detectPackageManager(projectDir),
    cssSystems: detectCssSystems(deps, projectDir),
    componentLibraries: libs.componentLibraries,
    animationLibraries: libs.animationLibraries,
    iconLibraries: libs.iconLibraries,
    aliases: Object.fromEntries(
      Object.entries(tsconfig.aliases).map(([k, v]) => [k, rel(projectDir, v)])
    ),
    aliasMap: tsconfig.aliases,
    tsconfigFile: tsconfig.file ? rel(projectDir, tsconfig.file) : null,
    tsconfig: tsconfig.config,
    hasSrc,
    appDir: appDir ? rel(projectDir, appDir) : null,
    pagesDir: pagesDir ? rel(projectDir, pagesDir) : null,
    uiDir: relIfExists(projectDir, [
      path.join(projectDir, 'src', 'components', 'ui'),
      path.join(projectDir, 'components', 'ui'),
    ]),
    routes,
    components,
    sourceFiles: sourceFilesAbs.map((file) => rel(projectDir, file)),
    jsxFiles: jsxFilesAbs.map((file) => rel(projectDir, file)),
    contentSources: listContentSources(projectDir),
    assets: listAssets(projectDir),
    globalCssEntry: detectGlobalCss(projectDir, appDir, pagesDir),
    tailwindVersion: detectCssSystems(deps, projectDir).includes('tailwind-v4') ? 4 : detectCssSystems(deps, projectDir).some((s) => s.startsWith('tailwind')) ? 3 : null,
    shadcn: libs.hasShadcn || libs.componentLibraries.includes('shadcn'),
    heroui: libs.componentLibraries.includes('heroui'),
    reactBits: libs.componentLibraries.includes('react-bits'),
    clientComponentFiles: components.filter((c) => c.client).map((c) => c.file),
    serverComponentFiles: components.filter((c) => !c.client && (c.role === 'page' || c.role === 'layout')).map((c) => c.file),
    packageName: pkg.name || path.basename(projectDir),
    dependencies: deps,
    pkg,
  };
  profile.architectureFingerprint = buildArchitectureFingerprint(profile);
  return profile;
}

function relIfExists(projectDir, candidates) {
  const hit = findFirstExisting(candidates);
  return hit ? rel(projectDir, hit) : null;
}

function resolveImportSpecifier(profile, fromFileAbs, specifier) {
  if (!specifier || specifier.startsWith('\0')) return null;
  if (specifier.startsWith('.')) {
    return resolveWithExtensions(path.resolve(path.dirname(fromFileAbs), specifier));
  }

  for (const [alias, target] of Object.entries(profile.aliasMap || {})) {
    const aliasPrefix = alias.replace(/\*$/, '');
    const targetPrefix = String(target).replace(/\*$/, '');
    if (alias.includes('*')) {
      if (specifier.startsWith(aliasPrefix)) {
        const remainder = specifier.slice(aliasPrefix.length);
        return resolveWithExtensions(path.join(targetPrefix, remainder));
      }
    } else if (specifier === alias || specifier.startsWith(alias + '/')) {
      const remainder = specifier.slice(alias.length);
      return resolveWithExtensions(path.join(targetPrefix, remainder));
    }
  }
  return null;
}

function resolveWithExtensions(base) {
  const candidates = [
    base,
    ...SOURCE_EXT.map((ext) => base + ext),
    ...SOURCE_EXT.map((ext) => path.join(base, 'index' + ext)),
    path.join(base, 'page.tsx'),
    path.join(base, 'page.jsx'),
  ];
  return findFirstExisting(candidates);
}

function extractImportSpecifiers(code) {
  const specs = [];
  const re = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(code))) specs.push(match[1]);
  const re2 = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = re2.exec(code))) specs.push(match[1]);
  const re3 = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = re3.exec(code))) specs.push(match[1]);
  return specs;
}

function buildDependencyGraph(profile) {
  const projectDir = profile.root;
  const nodes = {};
  const edges = [];

  for (const relative of profile.jsxFiles) {
    const abs = path.join(projectDir, relative);
    let code = '';
    try {
      code = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const specifiers = extractImportSpecifiers(code);
    const imports = [];
    for (const spec of specifiers) {
      const resolved = resolveImportSpecifier(profile, abs, spec);
      if (resolved) {
        const relFile = rel(projectDir, resolved);
        imports.push(relFile);
        edges.push({ from: relative, to: relFile, specifier: spec });
      } else {
        imports.push(spec);
        edges.push({ from: relative, to: spec, specifier: spec, external: true });
      }
    }
    nodes[relative] = { file: relative, imports };
  }

  const usageCount = {};
  for (const edge of edges) {
    if (edge.external) continue;
    usageCount[edge.to] = (usageCount[edge.to] || 0) + 1;
  }

  const routeFiles = new Set(profile.routes.map((r) => r.file).filter(Boolean));
  const sharedFiles = Object.entries(usageCount)
    .filter(([, count]) => count >= 2)
    .map(([file]) => file);

  const graph = {
    nodes,
    edges,
    usageCount,
    routeFiles: [...routeFiles],
    sharedFiles,
  };
  graph.routeClosure = buildRouteClosure(profile, graph);
  graph.routesByFile = invertRouteClosure(graph.routeClosure);
  return graph;
}

/**
 * Maps each route id to every source file that renders on it (page component
 * plus its layouts plus the transitive import closure of both). ARC needs this
 * to decide whether an editable field is page-owned or globally shared: Fivora
 * rejects an editorSchema section whose pageKey names a route that never
 * renders the section's markers.
 */
function buildRouteClosure(profile, graph) {
  const closure = {};

  for (const route of profile.routes || []) {
    const seen = new Set();
    const queue = [route.file, ...(route.layouts || [])].filter(Boolean);
    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      for (const next of graph.nodes[current]?.imports || []) {
        if (!seen.has(next) && graph.nodes[next]) queue.push(next);
      }
    }
    closure[route.id] = [...seen];
  }

  return closure;
}

function invertRouteClosure(routeClosure) {
  const byFile = {};
  for (const [routeId, files] of Object.entries(routeClosure || {})) {
    for (const file of files) {
      byFile[file] = byFile[file] || [];
      if (!byFile[file].includes(routeId)) byFile[file].push(routeId);
    }
  }
  return byFile;
}

function inferOwnerScope(profile, graph, relativeFile) {
  const posix = toPosix(relativeFile).toLowerCase();
  const component = (profile.components || []).find((c) => c.file === relativeFile);
  if (component?.role === 'navigation' || component?.role === 'footer' || component?.role === 'layout') {
    return 'common';
  }
  if (/layout\.(tsx|jsx|js)$/.test(posix)) return 'common';
  if (/(header|navbar|nav|footer|announcement)/.test(posix)) return 'common';

  // Reachability is authoritative: a file rendered by more than one route owns
  // shared content, and a file rendered by exactly one route owns that route's
  // content. Name-based guessing is only a fallback.
  const owningRoutes = graph.routesByFile?.[relativeFile];
  if (owningRoutes?.length > 1) return 'common';
  if (owningRoutes?.length === 1) return owningRoutes[0];

  if ((graph.sharedFiles || []).includes(relativeFile)) return 'common';

  for (const route of profile.routes || []) {
    if (route.file === relativeFile) return route.id || 'home';
    if (route.file && posix.includes(`/${route.id}/`)) return route.id;
  }
  return (profile.routes || [])[0]?.id || 'home';
}

module.exports = {
  scanProject,
  buildDependencyGraph,
  inferOwnerScope,
  resolveImportSpecifier,
  extractImportSpecifiers,
  parseTsconfig,
  keepExportableRoutes,
  resolvePageFileOnDisk,
};

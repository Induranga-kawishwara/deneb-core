'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanProject, buildDependencyGraph } = require('../scanner.cjs');
const { analyzeFile } = require('../semantic.cjs');
const { planTransformations } = require('../planner.cjs');
const { applyFilePlan } = require('../transformer.cjs');
const { buildFieldPath, inferFieldName, isListActionCtaKey } = require('../field-paths.cjs');
const { enrichSchemasFromContent } = require('../manifest.cjs');
const { runDenebArc } = require('../index.cjs');
const { parseSource } = require('../ast.cjs');
const { loadFingerprintBoost } = require('../learning.cjs');
const { classifyActionIntent } = require('../adapters.cjs');
const { validateGeneratedCode } = require('../ai-agent.cjs');
const { auditRuntimeIntegrity, healRuntimeIntegrity, runAiEvaluatorPipeline } = require('../ai-evaluator.cjs');

test('field-paths recognizes list action CTA keys', () => {
  assert.equal(isListActionCtaKey('preOrderCta'), true);
  assert.equal(isListActionCtaKey('addToTrayCta'), true);
  assert.equal(isListActionCtaKey('features'), false);
});

test('manifest enrichSchemasFromContent registers list CTA and paired directions fields', () => {
  const sections = [
    {
      id: 'contact',
      path: 'contact',
      type: 'object',
      label: 'Contact',
      fields: [],
    },
    {
      id: 'home',
      path: 'home',
      type: 'object',
      label: 'Home',
      fields: [],
    },
  ];
  enrichSchemasFromContent(
    {
      contact: {
        directionsLabel: 'Get Directions',
        directionsUrl: 'https://maps.example',
      },
      home: {
        demoPreOrderCta: [{ buttonLabel: 'Order', buttonUrl: 'https://wa.me/123' }],
      },
    },
    sections
  );
  const contactFields = sections.find((s) => s.id === 'contact').fields;
  assert.ok(contactFields.some((f) => f.key === 'directionsUrl' && f.type === 'url'));
  assert.ok(contactFields.some((f) => f.key === 'directionsLabel'));
  const homeFields = sections.find((s) => s.id === 'home').fields;
  const list = homeFields.find((f) => f.key === 'demoPreOrderCta');
  assert.ok(list && list.type === 'list');
  assert.ok(list.fields.some((f) => f.key === 'buttonLabel'));
  assert.ok(list.fields.some((f) => f.key === 'buttonUrl' && f.type === 'url'));
});

test('unseen fingerprints do not change planner confidence', () => {
  const hint = loadFingerprintBoost(null);
  assert.equal(hint.boost, 0);
  assert.equal(hint.skip, false);
});
const contract = require('../fivora-contract.cjs');
const { ensureStaticExportConfig } = require('../next-config.cjs');

const FIXTURE = path.join(__dirname, '..', '__fixtures__', 'next-app-basic');

function silence(fn) {
  const log = console.log;
  const err = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.error = err;
  }
}

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-arc-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

test('scanner detects Next.js App Router, TypeScript, and Tailwind', () => {
  const profile = scanProject(FIXTURE);
  assert.equal(profile.framework, 'nextjs');
  assert.equal(profile.router, 'next-app');
  assert.equal(profile.language, 'typescript');
  assert.ok(profile.cssSystems.some((s) => s.startsWith('tailwind')));
  assert.ok(profile.routes.some((r) => r.id === 'home' && r.route === '/'));
  assert.ok(profile.jsxFiles.some((f) => f.includes('Hero.tsx')));
  assert.ok(profile.architectureFingerprint);
});

test('field paths are semantic and stable', () => {
  const used = new Set();
  const a = buildFieldPath({ scope: 'home', section: 'hero', field: 'title', used });
  const b = buildFieldPath({ scope: 'home', section: 'hero', field: 'title', used });
  assert.equal(a, 'home.hero.title');
  assert.equal(b, 'home.hero.title2');
  assert.equal(inferFieldName('url', 'a', 'Chat Now', { action: 'whatsapp' }), 'whatsappUrl');
  assert.equal(inferFieldName('label', 'a', 'Chat Now', { action: 'whatsapp', paired: true }), 'whatsappLabel');
});

test('semantic engine splits WhatsApp action/label contracts', () => {
  const code = fs.readFileSync(path.join(FIXTURE, 'src', 'components', 'Hero.tsx'), 'utf8');
  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/Hero.tsx',
    profile: scanProject(FIXTURE),
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'Hero', role: 'hero' },
  });
  const split = analysis.candidates.find((c) => c.operation === 'split-action-contract');
  assert.ok(split, 'expected split-action-contract candidate');
  assert.equal(split.extra.action, 'whatsapp');
  assert.match(split.label, /Start a Conversation/);
  const heading = analysis.candidates.find((c) => c.operation === 'extract-text' && c.tag === 'h1');
  assert.ok(heading);
  assert.equal(heading.value, 'Summer Collection');
});

test('AST transformer preserves className and uses nullish fallbacks', () => {
  const relativeFile = 'src/components/Hero.tsx';
  const code = fs.readFileSync(path.join(FIXTURE, relativeFile), 'utf8');
  const profile = scanProject(FIXTURE);
  const analysis = analyzeFile({
    code,
    relativeFile,
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'Hero', role: 'hero' },
  });
  analysis.relativeFile = relativeFile;
  analysis.code = code;
  const plan = planTransformations({
    profile,
    analyses: [analysis],
    recipe: { actionRules: { splitActionAndLabel: true } },
  });
  const result = applyFilePlan(plan.files[0], profile);
  assert.equal(result.changed, true);
  assert.match(result.code, /className="hero"/);
  assert.match(result.code, /data-preview-field-path=/);
  assert.match(result.code, /\?\?/);
  assert.match(result.code, /<span[\s\S]*data-preview-field-path="/);
  assert.match(result.code, /<a\b[^>]*data-preview-field-path=/);
  assert.doesNotMatch(result.code, /<span[^>]*hidden[^>]*data-preview-field-path/);
  assert.doesNotMatch(result.code, /'use client'/);
  assert.match(result.code, /site-data\.json|@\/data\/site-data\.json/);
  assert.match(result.code, /data-preview-style-target=/);
  assert.match(result.code, /data-preview-style-type="text"/);
  parseSource(result.code, relativeFile);
});

test('planner emits style-bind next to content transforms', () => {
  const relativeFile = 'src/components/Hero.tsx';
  const code = fs.readFileSync(path.join(FIXTURE, relativeFile), 'utf8');
  const analysis = analyzeFile({
    code,
    relativeFile,
    profile: scanProject(FIXTURE),
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'Hero', role: 'hero' },
  });
  analysis.relativeFile = relativeFile;
  analysis.code = code;
  const plan = planTransformations({
    profile: scanProject(FIXTURE),
    analyses: [analysis],
    recipe: { actionRules: { splitActionAndLabel: true } },
  });
  const binds = plan.files[0].transformations.filter((t) => t.operation === 'style-bind');
  assert.ok(binds.length >= 1, 'expected style-bind operations');
  assert.ok(binds.every((t) => t.stylePath && t.styleKind));
  assert.ok(plan.stats.styleBinds >= 1);
});

test('dry-run does not modify source files', () => {
  const dir = copyFixture();
  const before = fs.readFileSync(path.join(dir, 'src', 'components', 'Hero.tsx'), 'utf8');
  const result = silence(() => runDenebArc(dir, 'arc-fixture', { dryRun: true }));
  const after = fs.readFileSync(path.join(dir, 'src', 'components', 'Hero.tsx'), 'utf8');
  assert.equal(before, after);
  assert.equal(result.outcome, 'dry-run');
  assert.equal(fs.existsSync(path.join(dir, 'src', 'data', 'site-data.json')), false);
});

test('ARC converts a Next.js fixture into Fivora contracts without redesigning', () => {
  const dir = copyFixture();
  const result = silence(() => runDenebArc(dir, 'arc-fixture', { telemetry: 'off' }));
  assert.equal(result.outcome, 'success');

  const hero = fs.readFileSync(path.join(dir, 'src', 'components', 'Hero.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(dir, 'src', 'app', 'layout.tsx'), 'utf8');
  const page = fs.readFileSync(path.join(dir, 'src', 'app', 'page.tsx'), 'utf8');
  const promo = fs.readFileSync(path.join(dir, 'src', 'components', 'PromoBanner.tsx'), 'utf8');
  const siteData = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'data', 'site-data.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'fivora-template.json'), 'utf8'));

  assert.match(layout, /SiteDataProvider/);
  assert.match(page, /data-preview-page-key="home"/);
  assert.doesNotMatch(layout, /'use client'/);
  assert.match(hero, /data-preview-field-path="/);
  assert.match(hero, /whatsapp/i);
  assert.match(hero, /className="hero"/);
  assert.match(hero, /className="btn cta"/);
  assert.doesNotMatch(hero, /'use client'/);
  assert.doesNotMatch(hero, /trueUrl/);
  assert.match(promo, /useSiteData/);
  assert.doesNotMatch(promo, /use client';;/);
  assert.doesNotMatch(JSON.stringify(siteData.content), /VANTA/);
  assert.ok(siteData.content.home.hero.title);
  assert.ok(siteData.theme?.headingFont);
  assert.ok(siteData.theme?.bodyFont);
  assert.equal(typeof siteData.styles, 'object');
  assert.ok(Object.keys(siteData.styles).length >= 1, 'style-bind seeds site-data.styles');
  assert.match(hero, /data-preview-style-type=/);
  assert.ok(manifest.editorSchema.sections.length >= 1);
  assert.ok(manifest.editorSchema.sections.length < 12);
  assert.equal(manifest.arcVersion, result.arcVersion);
  assert.equal(result.designPreservation >= 90, true, `design preservation ${result.designPreservation}`);

  const second = silence(() => runDenebArc(dir, 'arc-fixture', { telemetry: 'off' }));
  assert.equal(second.outcome, 'success');
  const hero2 = fs.readFileSync(path.join(dir, 'src', 'components', 'Hero.tsx'), 'utf8');
  const spanCount1 = (hero.match(/<span[\s\S]*?data-preview-field-path=/g) || []).length;
  const spanCount2 = (hero2.match(/<span[\s\S]*?data-preview-field-path=/g) || []).length;
  assert.equal(spanCount2, spanCount1);
});

test('dependency graph marks shared header as common-capable', () => {
  const profile = scanProject(FIXTURE);
  const graph = buildDependencyGraph(profile);
  assert.ok(graph.nodes['src/app/page.tsx']);
  assert.ok(graph.edges.some((e) => String(e.to).includes('Hero')));
});

// ---------------------------------------------------------------------------
// Fivora strict-contract conformance
// ---------------------------------------------------------------------------

const STOREFRONT_FIXTURE = path.join(__dirname, '..', '__fixtures__', 'next-app-storefront');

function copyOf(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-arc-'));
  fs.cpSync(fixture, dir, { recursive: true });
  return dir;
}

function readSources(root) {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.deneb')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        out.push({ rel: path.relative(root, abs).replace(/\\/g, '/'), code: fs.readFileSync(abs, 'utf8') });
      }
    }
  })(root);
  return out;
}

/** Applies the ported Fivora strict rules the same way the ingest pipeline does. */
function auditFivora(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'fivora-template.json'), 'utf8'));
  const siteData = JSON.parse(fs.readFileSync(path.join(dir, manifest.siteDataFile), 'utf8'));
  const sources = readSources(dir);

  const markers = [];
  const pageKeysByFile = {};
  const errors = [];

  for (const source of sources) {
    const extracted = contract.extractMarkers(source.code, source.rel);
    markers.push(...extracted.markers);
    const pages = extracted.markers.filter((m) => m.kind === 'page').map((m) => m.value);
    if (pages.length) pageKeysByFile[source.rel] = pages;
    errors.push(...contract.auditMarkerPlacement(source.code, source.rel));
    errors.push(...contract.auditActionLabelCollision(source.code, source.rel));
    for (const finding of contract.findUncoveredVisibleText(source.code, source.rel)) {
      errors.push(`${finding.filePath}:${finding.line} uncovered visible text "${finding.text}"`);
    }
  }

  // Resolve manifest pages to source files for both Next.js routers.
  const routeFiles = {};
  for (const page of manifest.pages || []) {
    const segment = page.route === '/' ? '' : String(page.route).replace(/^\//, '');
    const candidates = [];
    for (const base of ['src/app', 'app']) {
      for (const ext of ['tsx', 'jsx', 'js']) {
        candidates.push(segment ? path.join(base, segment, `page.${ext}`) : path.join(base, `page.${ext}`));
      }
    }
    for (const base of ['src/pages', 'pages']) {
      for (const ext of ['tsx', 'jsx', 'js']) {
        candidates.push(path.join(base, `${segment || 'index'}.${ext}`));
        if (segment) candidates.push(path.join(base, segment, `index.${ext}`));
      }
    }
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(dir, candidate))) {
        routeFiles[page.id] = candidate.replace(/\\/g, '/');
        break;
      }
    }
  }

  errors.push(
    ...contract.auditPathCoverage({
      content: siteData.content,
      editorSchema: manifest.editorSchema,
      markers,
      controlOnlyPaths: manifest.visualEditing?.controlOnlyPaths || [],
    }).errors
  );
  errors.push(...contract.auditSchemaUniqueness(manifest.editorSchema));
  errors.push(...contract.auditPageCoverage({ pages: manifest.pages, routeFiles, pageMarkersByFile: pageKeysByFile }));
  errors.push(...contract.auditPreviewRuntime(sources.map((s) => s.code)));

  return { errors: [...new Set(errors)], manifest, siteData };
}

test('converted basic fixture satisfies the Fivora strict contract', () => {
  const dir = copyOf(FIXTURE);
  silence(() => runDenebArc(dir, 'basic-store', { telemetry: 'off' }));
  const { errors } = auditFivora(dir);
  assert.deepEqual(errors, []);
});

test('converted storefront fixture satisfies the Fivora strict contract', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const { errors } = auditFivora(dir);
  assert.deepEqual(errors, []);
});

test('every unbound site-data field is declared control-only', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const { manifest, siteData } = auditFivora(dir);
  const controlOnly = manifest.visualEditing.controlOnlyPaths;

  // The merchant baseline ARC always writes is never rendered by an arbitrary
  // project, so it must be control-only rather than a coverage failure.
  assert.ok(controlOnly.includes('common.business.phone'));
  assert.ok(controlOnly.includes('common.websiteTitle'));
  assert.ok(!controlOnly.includes('home.hero.title'), 'bound fields stay visually editable');

  const inventory = contract.enumerateContentPaths(siteData.content);
  for (const declared of controlOnly) {
    assert.ok(
      inventory.concreteFields.has(declared) ||
        [...inventory.fieldPatterns].some((p) => p === contract.wildcardPath(declared)),
      `controlOnlyPaths entry "${declared}" must exist in site-data content`
    );
  }
});

test('ARC never declares a manifest page without a page file on disk', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const { manifest } = auditFivora(dir);
  const ids = manifest.pages.map((page) => page.id);
  assert.deepEqual(ids.sort(), ['about', 'home']);
  assert.ok(!ids.includes('contact'), 'a contact route with no page component must not be invented');
});

test('static-array collections become list contracts without changing render logic', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const grid = fs.readFileSync(path.join(dir, 'src', 'components', 'ProductGrid.tsx'), 'utf8');

  assert.match(grid, /data-preview-list-path="home\.products"/);
  assert.match(grid, /data-preview-style-type="grid"/);
  assert.match(grid, /data-preview-style-type="card"/);
  assert.match(grid, /data-preview-item-path=\{`home\.products\[\$\{index\}\]`\}/);
  assert.match(grid, /data-preview-field-path=\{`home\.products\[\$\{index\}\]\.title`\}/);
  // The array is site-data backed with the developer's literal as fallback.
  assert.match(grid, /const products = siteData\?\.content\?\.home\?\.products \?\? \[/);
  // Render logic is untouched: items are still read off the map variable.
  assert.match(grid, /\{product\.title\}/);
  assert.match(grid, /className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"/);

  const { manifest, siteData } = auditFivora(dir);
  const home = manifest.editorSchema.sections.find((s) => s.id === 'home');
  const products = home.fields.find((f) => f.key === 'products');
  assert.equal(products.type, 'list');
  assert.deepEqual(products.fields.map((f) => f.key).sort(), ['description', 'image', 'price', 'title']);
  assert.equal(siteData.content.home.products.length, 3);
  assert.equal(siteData.content.home.products[0].title, 'Minimalist Smart Watch');
});

test('collections holding component references are left alone', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const features = fs.readFileSync(path.join(dir, 'src', 'components', 'Features.tsx'), 'utf8');
  assert.ok(!features.includes('data-preview-list-path'), 'icon component refs are not merchant content');
  assert.match(features, /icon: Truck/);
});

test('literal text inside a broad container is wrapped instead of marked illegally', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const about = fs.readFileSync(path.join(dir, 'src', 'app', 'about', 'page.tsx'), 'utf8');

  // Fivora rejects data-preview-field-path on <div>, so the text gets a span.
  assert.match(about, /<div[\s\S]*className="mt-10 text-sm text-slate-500"[\s\S]*<span[\s\S]*data-preview-field-path=/);
  assert.ok(!/<div[^>]*data-preview-field-path/.test(about));
});

test('shadcn Button asChild keeps the action on the link and the label in a span', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const hero = fs.readFileSync(path.join(dir, 'src', 'components', 'Hero.tsx'), 'utf8');

  assert.match(hero, /<Button asChild>/);
  assert.match(hero, /href=\{siteData\?\.content\?\.home\?\.hero\?\.shopCollectionUrl \?\? "\/products"\}/);
  assert.match(hero, /<span[\s\S]*data-preview-field-path="home\.hero\.shopCollectionLabel"/);
  // The decorative icon stays static.
  assert.match(hero, /<ArrowRight className="ml-2 size-4" aria-hidden="true" \/>/);
});

test('a second init run converges on identical sources and manifest', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const firstSources = readSources(dir).map((s) => s.code).join('\n---\n');
  const firstManifest = fs.readFileSync(path.join(dir, 'fivora-template.json'), 'utf8');

  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const secondSources = readSources(dir).map((s) => s.code).join('\n---\n');
  const secondManifest = fs.readFileSync(path.join(dir, 'fivora-template.json'), 'utf8');

  assert.equal(secondSources, firstSources, 'sources must not drift on re-run');
  assert.equal(secondManifest, firstManifest, 'manifest must not lose schema on re-run');
  assert.deepEqual(auditFivora(dir).errors, []);
});

const PAGES_FIXTURE = path.join(__dirname, '..', '__fixtures__', 'next-pages-basic');

test('Pages Router projects convert and satisfy the strict contract', () => {
  const dir = copyOf(PAGES_FIXTURE);
  silence(() => runDenebArc(dir, 'pottery-shop', { telemetry: 'off' }));

  const profile = scanProject(dir);
  assert.equal(profile.router, 'next-pages');

  const index = fs.readFileSync(path.join(dir, 'pages', 'index.jsx'), 'utf8');
  const contact = fs.readFileSync(path.join(dir, 'pages', 'contact.jsx'), 'utf8');
  const app = fs.readFileSync(path.join(dir, 'pages', '_app.jsx'), 'utf8');

  // Page keys must come from the route id, not an App Router filename pattern.
  assert.match(index, /<main data-preview-page-key="home"/);
  assert.match(contact, /<main data-preview-page-key="contact"/);
  // The provider mounts in _app for this router.
  assert.match(app, /<SiteDataProvider initialSiteData=\{initialSiteData\}>/);
  // No path alias exists here, so the import must be relative.
  assert.match(index, /from "\.\.\/data\/site-data\.json"/);
  // tel: actions are split into url + label.
  assert.match(index, /href=\{siteData\?\.content\?\.home\?\.contact\?\.phoneUrl \?\? "tel:\+94771234567"\}/);
  assert.match(index, /<span[\s\S]*data-preview-field-path="home\.contact\.phoneLabel"/);
  // Original class names are untouched.
  assert.match(index, /className="wrapper"/);
  assert.match(contact, /className="photo"/);

  const { errors } = auditFivora(dir);
  assert.deepEqual(errors, []);
});

test('static export is configured without discarding an existing next config', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-arc-cfg-'));
  fs.writeFileSync(
    path.join(dir, 'next.config.ts'),
    `import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

// Keep MDX support enabled.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
};

export default createMDX()(nextConfig);
`,
    'utf8'
  );

  const result = ensureStaticExportConfig(dir, { language: 'typescript' });
  const code = fs.readFileSync(path.join(dir, 'next.config.ts'), 'utf8');

  assert.equal(result.updated, true);
  assert.match(code, /output: "export"/);
  assert.match(code, /unoptimized: true/);
  assert.match(code, /const basePath = process\.env\.NEXT_PUBLIC_SITE_BASE_PATH \|\| ""/);
  // Existing plugin wiring, options and comments survive.
  assert.match(code, /export default createMDX\(\)\(nextConfig\)/);
  assert.match(code, /reactStrictMode: true/);
  assert.match(code, /pageExtensions: \['ts', 'tsx', 'mdx'\]/);
  assert.match(code, /\/\/ Keep MDX support enabled\./);

  // Re-running must not duplicate any setting.
  ensureStaticExportConfig(dir, { language: 'typescript' });
  const again = fs.readFileSync(path.join(dir, 'next.config.ts'), 'utf8');
  assert.equal((again.match(/output:/g) || []).length, 1);
  assert.equal((again.match(/const basePath =/g) || []).length, 1);
});

test('a developer output setting is reported instead of overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-arc-cfg2-'));
  fs.writeFileSync(
    path.join(dir, 'next.config.js'),
    `module.exports = { output: 'standalone' };\n`,
    'utf8'
  );

  const result = ensureStaticExportConfig(dir, { language: 'javascript' });
  assert.match(result.warnings.join(' '), /output: 'standalone'/);
  assert.match(fs.readFileSync(path.join(dir, 'next.config.js'), 'utf8'), /standalone/);
});

test('schema sections only claim a pageKey when reachability proves it', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const { manifest } = auditFivora(dir);
  const sections = manifest.editorSchema.sections;

  const common = sections.find((s) => s.id === 'common');
  assert.equal(common.pageKey, undefined, 'shared content renders on every route');
  assert.equal(sections.find((s) => s.id === 'home').pageKey, 'home');
  assert.equal(sections.find((s) => s.id === 'about').pageKey, 'about');
});

test('conflicting data-preview-static is stripped when element has editable markers', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  // Introduce a conflicting static marker on an element with an editable marker
  const heroPath = path.join(dir, 'src', 'components', 'Hero.tsx');
  let heroCode = fs.readFileSync(heroPath, 'utf8');
  heroCode = heroCode.replace(
    '<p className="mt-4',
    '<p data-preview-static="legacy static description" className="mt-4'
  );
  fs.writeFileSync(heroPath, heroCode, 'utf8');

  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const updatedHero = fs.readFileSync(heroPath, 'utf8');

  // data-preview-static must be stripped since the paragraph has data-preview-field-path
  assert.ok(!updatedHero.includes('data-preview-static="legacy static description"'));
  assert.ok(updatedHero.includes('data-preview-field-path'));

  const { errors } = auditFivora(dir);
  const placementErrors = errors.filter((e) => e.includes('cannot share an element with data-preview-static'));
  assert.equal(placementErrors.length, 0);
});

test('sanitizeDuplicateBindings keeps a single useSiteData import', () => {
  const { parseSource, printSource, sanitizeDuplicateBindings } = require('../ast.cjs');
  const code = `'use client';
import { useSiteData, contentText } from '@/lib/siteDataContext';
import { useSiteData, contentObject } from '@deneb-ui/ui';
export function Shop() {
  const siteData = useSiteData();
  return <div>{contentText(contentObject(siteData).title)}</div>;
}
`;
  const ast = parseSource(code, 'shop.tsx');
  sanitizeDuplicateBindings(ast);
  const out = printSource(ast, code);
  const importUses = [...out.matchAll(/import\s*\{([^}]+)\}\s*from/g)].flatMap((m) =>
    m[1].split(',').map((s) => s.trim()).filter((s) => s === 'useSiteData')
  );
  assert.equal(importUses.length, 1);
  assert.match(out, /siteDataContext/);
  assert.doesNotMatch(out, /import\s*\{[^}]*useSiteData[^}]*\}\s*from\s*['"]@deneb-ui\/ui['"]/);
});

test('recursive SiteDataProvider wrappers are flattened to a package re-export', () => {
  const { rewriteRecursiveSiteDataContext } = require('../transformer.cjs');
  const code = `'use client';
import { SiteDataProvider as BaseSiteDataProvider } from '@deneb-ui/ui';
import initialSiteData from '@/data/site-data.json';
export function SiteDataProvider({ children, ...props }) {
  return (
    <BaseSiteDataProvider initialSiteData={initialSiteData} {...props}>
      {children}
    </BaseSiteDataProvider>
  );
}
`;
  const out = rewriteRecursiveSiteDataContext(code);
  assert.equal(out.updated, true);
  assert.match(out.code, /export \{/);
  assert.match(out.code, /SiteDataProvider/);
  assert.match(out.code, /from '@deneb-ui\/ui'/);
  assert.doesNotMatch(out.code, /export function SiteDataProvider/);
  assert.doesNotMatch(out.code, /BaseSiteDataProvider/);
});

test('import plus export of useSiteData is rewritten to export-from', () => {
  const { parseSource, printSource, sanitizeDuplicateBindings } = require('../ast.cjs');
  const code = `'use client';
import { SiteDataProvider as BaseSiteDataProvider, useSiteData, contentText } from '@deneb-ui/ui';
export function SiteDataProvider({ children }) {
  return <BaseSiteDataProvider>{children}</BaseSiteDataProvider>;
}
export { useSiteData, contentText };
`;
  const ast = parseSource(code, 'siteDataContext.tsx');
  sanitizeDuplicateBindings(ast);
  const out = printSource(ast, code);
  assert.match(out, /export\s*\{[^}]*useSiteData[^}]*\}\s*from\s*['"]@deneb-ui\/ui['"]/);
  assert.doesNotMatch(out, /import\s*\{[^}]*useSiteData/);
});

test('toCamel and optionalMember safely handle strings starting with numbers without syntax errors', () => {
  const { toCamel } = require('../field-paths.cjs');
  const { optionalMember, parseSource } = require('../ast.cjs');
  const recast = require('recast');

  // toCamel prefixes identifiers starting with a number
  assert.equal(toCamel(['1800840AURA']), 'item1800840aura');
  assert.equal(toCamel(['25-Min', 'Express']), 'item25MinExpress');

  // optionalMember safely falls back to computed string literal for non-identifier keys
  const chain = optionalMember(['siteData', 'content', 'home', '100EncryptedLabel']);
  const code = recast.print(chain).code;
  assert.equal(code, 'siteData?.content?.home?.["100EncryptedLabel"]');

  // Verify it parses as valid JS without syntax errors
  assert.doesNotThrow(() => parseSource(`const x = ${code};`, 'test.tsx'));
});

test('bindArrayDeclaration transforms module-scope array into DEFAULT_ fallback in client components', () => {
  const clientCode = `'use client';
import React from 'react';

const BRANDS = [
  { name: 'Apple' },
  { name: 'Samsung' },
];

export function BrandMarquee() {
  return (
    <div>
      {BRANDS.map((b) => (
        <div key={b.name} className="brand-item">
          <span>{b.name}</span>
        </div>
      ))}
    </div>
  );
}
`;

  const profile = {
    root: os.tmpdir(),
    framework: 'nextjs',
    router: 'next-app',
    language: 'typescript',
    cssSystems: ['tailwind'],
    hasSrc: true,
    aliasMap: { '@/*': ['src/*'] },
  };

  const analysis = analyzeFile({
    code: clientCode,
    relativeFile: 'src/components/BrandMarquee.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'BrandMarquee', role: 'about' },
  });
  analysis.code = clientCode;
  analysis.relativeFile = 'src/components/BrandMarquee.tsx';

  const plan = planTransformations({ profile, analyses: [analysis] });
  const result = applyFilePlan(plan.files[0], profile);

  assert.equal(result.changed, true);
  // Module-scope array renamed to DEFAULT_BRANDS with literal array preserved
  assert.match(result.code, /const DEFAULT_BRANDS = \[\s*\{\s*name:\s*['"]Apple['"]\s*\}/);
  // Inside component body: useSiteData hook followed by dynamic BRANDS binding
  assert.match(result.code, /const siteData = useSiteData\(\);/);
  assert.match(result.code, /const BRANDS = siteData\?\.content\?\.home\?\.BRANDS \?\? DEFAULT_BRANDS;/);
  // Verify AST parses cleanly
  assert.doesNotThrow(() => parseSource(result.code, 'BrandMarquee.tsx'));
});

test('classifyActionIntent identifies action keywords and assigns correct fallback URLs', () => {
  const wa = classifyActionIntent('Order on WhatsApp', null);
  assert.equal(wa?.action, 'whatsapp');
  assert.equal(wa?.defaultUrl, 'https://wa.me/1234567890');
  assert.equal(wa?.external, true);

  const call = classifyActionIntent('Call Us', null);
  assert.equal(call?.action, 'phone');
  assert.equal(call?.defaultUrl, 'tel:+1234567890');

  const dir = classifyActionIntent('Get Directions', null);
  assert.equal(dir?.action, 'directions');
  assert.equal(dir?.defaultUrl, 'https://maps.google.com/?q=store+location');
  assert.equal(dir?.external, true);

  const loc = classifyActionIntent('Our Location', null);
  assert.equal(loc?.action, 'location');
  assert.equal(loc?.defaultUrl, 'https://maps.google.com/?q=store+location');
  assert.equal(loc?.external, true);

  const shop = classifyActionIntent('Shop Now', null);
  assert.equal(shop?.action, 'shop');
  assert.equal(shop?.defaultUrl, '/shop');
  assert.equal(shop?.external, false);

  const formSubmit = classifyActionIntent('Submit Form', null);
  assert.equal(formSubmit?.action, 'form-submit');
  assert.equal(formSubmit?.defaultUrl, 'https://wa.me/1234567890');
  assert.equal(formSubmit?.external, true);

  const nonAction = classifyActionIntent('Random Content Text', null);
  assert.equal(nonAction, null);
});

test('semantic engine recognizes <button> with action text as split-action-contract', () => {
  const code = `
export function ContactBar() {
  return (
    <div className="contact-bar">
      <button className="btn-primary">Order on WhatsApp</button>
      <button className="btn-secondary">Get Directions</button>
      <button type="submit">Submit Feedback</button>
    </div>
  );
}
`;
  const profile = {
    root: os.tmpdir(),
    framework: 'nextjs',
    router: 'next-app',
    language: 'typescript',
    cssSystems: ['tailwind'],
    hasSrc: true,
  };

  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/ContactBar.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'ContactBar', role: 'contact' },
  });

  const waSplit = analysis.candidates.find((c) => c.operation === 'split-action-contract' && c.label === 'Order on WhatsApp');
  assert.ok(waSplit, 'expected split-action-contract for WhatsApp button');
  assert.equal(waSplit.extra.action, 'whatsapp');
  assert.equal(waSplit.value, 'https://wa.me/1234567890');

  const dirSplit = analysis.candidates.find((c) => c.operation === 'split-action-contract' && c.label === 'Get Directions');
  assert.ok(dirSplit, 'expected split-action-contract for Directions button');
  assert.equal(dirSplit.extra.action, 'directions');

  // Submit button should NOT be split into a redirect link
  const submitSplit = analysis.candidates.find((c) => c.label === 'Submit Feedback' && c.operation === 'split-action-contract');
  assert.equal(submitSplit, undefined, 'submit button must not be an action redirect');
});

test('AST transformer converts <button> action to <a> with redirect URL and editable text label', () => {
  const code = `
export function ActionPanel() {
  return (
    <div className="panel">
      <button className="px-4 py-2 bg-green-600 text-white rounded">Order on WhatsApp</button>
    </div>
  );
}
`;
  const profile = {
    root: os.tmpdir(),
    framework: 'nextjs',
    router: 'next-app',
    language: 'typescript',
    cssSystems: ['tailwind'],
    hasSrc: true,
    aliasMap: { '@/*': ['src/*'] },
  };

  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/ActionPanel.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'ActionPanel', role: 'hero' },
  });
  analysis.code = code;
  analysis.relativeFile = 'src/components/ActionPanel.tsx';

  const plan = planTransformations({ profile, analyses: [analysis] });
  const result = applyFilePlan(plan.files[0], profile);

  assert.equal(result.changed, true);
  // Converted from <button> to <a ...>
  assert.match(result.code, /<a\s+[^>]*href=\{siteData\?\.content\?\.home\?\.hero\?\.whatsappUrl \?\? "https:\/\/wa\.me\/1234567890"\}/);
  assert.match(result.code, /target="_blank"/);
  assert.match(result.code, /rel="noopener noreferrer"/);
  // URL field path is bound directly to outer <a> element (never hidden, never static conflict)
  assert.match(result.code, /<a\s+[^>]*data-preview-field-path=\{?"home\.hero\.whatsappUrl"?\}/);
  // Text label wrapped in editable span
  assert.match(result.code, /<span\s+data-preview-field-path="home\.hero\.whatsappLabel"[^>]*>\{siteData\?\.content\?\.home\?\.hero\?\.whatsappLabel \?\? "Order on WhatsApp"\}<\/span>/);
  // Never emit hidden preview markers
  assert.doesNotMatch(result.code, /<span[^>]*hidden[^>]*data-preview-field-path/);
  // No parse errors
  assert.doesNotThrow(() => parseSource(result.code, 'ActionPanel.tsx'));
});

test('end-to-end ARC conversion transforms action buttons and passes strict Fivora audit', () => {
  const dir = copyOf(FIXTURE);
  const actionPagePath = path.join(dir, 'src', 'components', 'ActionPage.tsx');
  fs.writeFileSync(
    actionPagePath,
    `
export function ActionPage() {
  return (
    <div className="action-page p-8">
      <h1>Connect & Visit</h1>
      <button className="btn-wa">Order on WhatsApp</button>
      <button className="btn-call">Call Us</button>
      <button className="btn-dir">Get Directions</button>
      <button className="btn-loc">Our Location</button>
      <button className="btn-shop">Shop Now</button>
    </div>
  );
}
`
  );

  // Link ActionPage in page.tsx
  const pageFile = path.join(dir, 'src', 'app', 'page.tsx');
  const pageSrc = fs.readFileSync(pageFile, 'utf8');
  fs.writeFileSync(
    pageFile,
    `import { ActionPage } from '../components/ActionPage';\n` +
      pageSrc.replace('</main>', '  <ActionPage />\n    </main>')
  );

  silence(() => runDenebArc(dir, 'actions-fixture', { telemetry: 'off' }));

  const transformed = fs.readFileSync(actionPagePath, 'utf8');
  // All 5 buttons converted to <a> tags with href
  assert.match(transformed, /<a\s+[^>]*href=\{siteData\?\.content\?\.home\?\.contact\?\.whatsappUrl/);
  assert.match(transformed, /<a\s+[^>]*href=\{siteData\?\.content\?\.home\?\.contact\?\.phoneUrl/);
  assert.match(transformed, /<a\s+[^>]*href=\{siteData\?\.content\?\.home\?\.contact\?\.getDirectionsUrl/);
  assert.match(transformed, /<a\s+[^>]*href=\{siteData\?\.content\?\.home\?\.contact\?\.ourLocationUrl/);
  assert.match(transformed, /<a\s+[^>]*href=\{siteData\?\.content\?\.home\?\.shop\?\.shopNowUrl/);

  // All 5 buttons have editable labels
  assert.match(transformed, /data-preview-field-path="home\.contact\.whatsappLabel"/);
  assert.match(transformed, /data-preview-field-path="home\.contact\.phoneLabel"/);
  assert.match(transformed, /data-preview-field-path="home\.contact\.getDirectionsLabel"/);
  assert.match(transformed, /data-preview-field-path="home\.contact\.ourLocationLabel"/);
  assert.match(transformed, /data-preview-field-path="home\.shop\.shopNowLabel"/);

  // Strict Fivora audit passes with 0 errors
  const { errors } = auditFivora(dir);
  assert.deepEqual(errors, []);
});

test('parseSource parses TypeScript interface declarations without experimental syntax errors', () => {
  const tsCode = `
import React from 'react';
import { EditableText } from './EditableText';

export interface EditableTradeinSectionProps {
  itemPath: string;
  title: string;
}

export function EditableTradeinSection({ itemPath, title }: EditableTradeinSectionProps) {
  return (
    <div data-preview-item-path={itemPath}>
      <EditableText as="h2" id={\`\${itemPath}.title\`} data-preview-field-path={\`\${itemPath}.title\`} defaultValue={title} />
    </div>
  );
}
`;
  assert.doesNotThrow(() => {
    parseSource(tsCode, 'EditableTradeinSection.tsx');
  });
});

test('validateGeneratedCode catches data-preview-field-path placed on broad <div> containers', () => {
  const invalidCode = `
import React from 'react';
import { EditableText } from './EditableText';

export interface EditableCardProps {
  itemPath: string;
}

export function EditableCard({ itemPath }: EditableCardProps) {
  return (
    <div data-preview-item-path={itemPath}>
      <div data-preview-field-path={\`\${itemPath}.content\`}>Some broad content</div>
    </div>
  );
}
`;
  const res = validateGeneratedCode(invalidCode, 'EditableCard.tsx');
  assert.equal(res.passed, false);
  assert.ok(res.errors.some((e) => e.includes('cannot be placed on broad <div> content containers')));
});

test('AST transformer wraps literal text inside <div> with <span> instead of placing field path on <div>', () => {
  const code = `
export function Card() {
  return (
    <div className="card">
      <div className="title-row">In-Store VIP Lab</div>
    </div>
  );
}
`;
  const profile = {
    root: os.tmpdir(),
    framework: 'nextjs',
    router: 'next-app',
    language: 'typescript',
    cssSystems: ['tailwind'],
    hasSrc: true,
    aliasMap: { '@/*': ['src/*'] },
  };

  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/Card.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'Card', role: 'card' },
  });
  analysis.code = code;
  analysis.relativeFile = 'src/components/Card.tsx';

  const plan = planTransformations({ profile, analyses: [analysis] });
  const res = applyFilePlan(plan.files[0], profile);
  assert.equal(res.changed, true);
  // The outer <div> must NOT have data-preview-field-path
  assert.doesNotMatch(res.code, /<div[^>]*data-preview-field-path/);
  // The inner text must be wrapped in a <span> with data-preview-field-path
  assert.match(res.code, /<span[^>]*data-preview-field-path=/);
});

test('AI Evaluator audits and heals RSC duplicate SiteDataProvider in layout.tsx', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-eval-'));
  const appDir = path.join(tmp, 'src', 'app');
  fs.mkdirSync(appDir, { recursive: true });

  const brokenLayout = `
import { SiteDataProvider } from '@deneb-ui/ui';
import { Providers } from '@/components/providers';
import initialSiteData from '@/data/site-data.json';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteDataProvider initialSiteData={initialSiteData}>
            {children}
          </SiteDataProvider>
        </Providers>
      </body>
    </html>
  );
}
`;
  fs.writeFileSync(path.join(appDir, 'layout.tsx'), brokenLayout, 'utf8');

  const profile = {
    root: tmp,
    framework: 'nextjs',
    router: 'next-app',
    appDir: 'src/app',
    language: 'typescript',
    jsxFiles: ['src/app/layout.tsx'],
  };

  const issues = auditRuntimeIntegrity(tmp, profile);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'rsc-duplicate-provider');

  const healRes = await healRuntimeIntegrity(tmp, profile, issues);
  assert.equal(healRes.healedCount, 1);
  assert.equal(healRes.remainingCount, 0);

  const fixed = fs.readFileSync(path.join(appDir, 'layout.tsx'), 'utf8');
  assert.doesNotMatch(fixed, /<SiteDataProvider/);
  assert.match(fixed, /<Providers>\s*\{children\}\s*<\/Providers>/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('AI Evaluator detects missing component exports in page.tsx imports', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-eval-exp-'));
  const appDir = path.join(tmp, 'src', 'app');
  const compDir = path.join(tmp, 'src', 'components');
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(compDir, { recursive: true });

  fs.writeFileSync(
    path.join(appDir, 'page.tsx'),
    `import { ProductList, MissingHero } from '@/components/Widgets';\nexport default function Page() { return <div><ProductList /></div>; }`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(compDir, 'Widgets.tsx'),
    `export function ProductList() { return <div>Products</div>; }`,
    'utf8'
  );

  const profile = {
    root: tmp,
    framework: 'nextjs',
    router: 'next-app',
    appDir: 'src/app',
    language: 'typescript',
    jsxFiles: ['src/app/page.tsx', 'src/components/Widgets.tsx'],
  };

  const issues = auditRuntimeIntegrity(tmp, profile);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'missing-named-export');
  assert.equal(issues[0].meta?.componentName, 'MissingHero');

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('AI Evaluator runAiEvaluatorPipeline passes on clean valid project', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-eval-clean-'));
  const appDir = path.join(tmp, 'src', 'app');
  fs.mkdirSync(appDir, { recursive: true });

  fs.writeFileSync(
    path.join(appDir, 'layout.tsx'),
    `import { Providers } from '@/components/providers';\nexport default function RootLayout({ children }: { children: React.ReactNode }) { return <html><body><Providers>{children}</Providers></body></html>; }`,
    'utf8'
  );

  const profile = {
    root: tmp,
    framework: 'nextjs',
    router: 'next-app',
    appDir: 'src/app',
    language: 'typescript',
    jsxFiles: ['src/app/layout.tsx'],
  };

  const res = await runAiEvaluatorPipeline(tmp, profile);
  assert.equal(res.passed, true);
  assert.equal(res.issuesFound, 0);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('AI Evaluator audits and heals missing global CSS stylesheet import in layout.tsx', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-eval-css-'));
  const appDir = path.join(tmp, 'src', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'globals.css'), '@import "tailwindcss";', 'utf8');

  const unstyledLayout = `
import { Providers } from '@/components/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body><Providers>{children}</Providers></body></html>;
}
`;
  fs.writeFileSync(path.join(appDir, 'layout.tsx'), unstyledLayout, 'utf8');

  const profile = {
    root: tmp,
    framework: 'nextjs',
    router: 'next-app',
    appDir: 'src/app',
    language: 'typescript',
    jsxFiles: ['src/app/layout.tsx'],
  };

  const issues = auditRuntimeIntegrity(tmp, profile);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'missing-global-css-import');

  const healRes = await healRuntimeIntegrity(tmp, profile, issues);
  assert.equal(healRes.healedCount, 1);

  const fixed = fs.readFileSync(path.join(appDir, 'layout.tsx'), 'utf8');
  assert.match(fixed, /import\s+['"]\.\/globals\.css['"]/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('collections with nested arrays, objects, and TS as const convert to editable list contracts', () => {
  const code = `
const phones = [
  {
    name: 'iPhone 16 Pro Max',
    brand: 'Apple',
    subtitle: 'Grade 5 Titanium' as const,
    price: 1199,
    storageOptions: ['256GB', '512GB', '1TB'],
    colors: [{ name: 'Desert Titanium', hex: '#bba795' }],
  },
  {
    name: 'Galaxy S25 Ultra',
    brand: 'Samsung',
    subtitle: 'Armor Titanium' as const,
    price: 1299,
    storageOptions: ['256GB', '512GB'],
    colors: [{ name: 'Titanium Gray', hex: '#5e6166' }],
  },
];

export function FeaturedPhones() {
  return (
    <div className="phones-grid">
      {phones.map((phone, idx) => (
        <div key={phone.name} className="phone-card">
          <h4>{phone.brand}</h4>
          <h3>{phone.name}</h3>
          <p>{phone.subtitle}</p>
          <span>Rs {phone.price}</span>
        </div>
      ))}
    </div>
  );
}
`;

  const profile = { framework: 'nextjs', router: 'next-app', appDir: 'src/app', language: 'typescript' };
  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/FeaturedPhones.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'FeaturedPhones', role: 'shop' },
  });

  const collectionCandidate = analysis.candidates.find((c) => c.kind === 'collection');
  assert.ok(collectionCandidate, 'collection with nested arrays and TS as const must be detected');
  assert.equal(collectionCandidate.extra.objectItems, true);
  assert.ok(collectionCandidate.confidence >= 0.8, 'collection must have high confidence');

  const plan = planTransformations({
    profile,
    analyses: [analysis],
  });

  assert.equal(plan.files.length, 1);
  const collectionTransform = plan.files[0].transformations.find((t) => t.fieldType === 'list');
  assert.ok(collectionTransform, 'collection must be planned as list field');
  assert.equal(collectionTransform.listField, 'home.phones');
  assert.ok(collectionTransform.itemFields.some((f) => f.key === 'name'));
  assert.ok(collectionTransform.itemFields.some((f) => f.key === 'price'));
});

test('proceed to order button is recognized as WhatsApp order split-action contract', () => {
  const code = `
export function CartDrawer() {
  return (
    <div className="cart-footer">
      <button type="button" className="btn-primary w-full py-4 font-bold">
        Proceed to Order · RS 1299
      </button>
    </div>
  );
}
`;

  const profile = { framework: 'nextjs', router: 'next-app', appDir: 'src/app', language: 'typescript' };
  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/CartDrawer.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'CartDrawer', role: 'cart' },
  });

  const actionCandidate = analysis.candidates.find((c) => c.kind === 'split-action-contract');
  assert.ok(actionCandidate, 'proceed to order must be recognized as split-action-contract');
  assert.equal(actionCandidate.extra.action, 'whatsapp');

  const plan = planTransformations({
    profile,
    analyses: [analysis],
  });

  const filePlan = plan.files[0];
  const splitAction = filePlan.transformations.find((t) => t.operation === 'split-action-contract');
  assert.ok(splitAction, 'split action must be planned');
  assert.match(splitAction.urlField, /whatsapp/i);
});

test('classifyActionIntent recognizes form submit action keywords', () => {
  const submit = classifyActionIntent('Submit', null);
  assert.equal(submit?.action, 'form-submit');
  assert.equal(submit?.defaultUrl, 'https://wa.me/1234567890');

  const sendMessage = classifyActionIntent('Send Message', null);
  assert.equal(sendMessage?.action, 'form-submit');

  const confirmBooking = classifyActionIntent('Confirm Booking', null);
  assert.equal(confirmBooking?.action, 'form-submit');

  const getQuote = classifyActionIntent('Get Quote', null);
  assert.equal(getQuote?.action, 'form-submit');
});

test('semantic engine recognizes form inputs, labels, placeholders, and form-submit-action buttons', () => {
  const code = `
export function BookingForm() {
  return (
    <form className="booking-form">
      <h2>Book Appointment</h2>
      <label>Full Name</label>
      <input type="text" placeholder="Enter your full name" />
      <label>Email Address</label>
      <input type="email" placeholder="you@example.com" />
      <label>Special Instructions</label>
      <textarea placeholder="Describe your request..." />
      <button type="submit">Confirm Booking</button>
    </form>
  );
}
`;
  const profile = {
    root: os.tmpdir(),
    framework: 'nextjs',
    router: 'next-app',
    language: 'typescript',
    cssSystems: ['tailwind'],
    hasSrc: true,
  };

  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/BookingForm.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'BookingForm', role: 'form' },
  });

  const placeholders = analysis.candidates.filter((c) => c.kind === 'placeholder');
  assert.equal(placeholders.length, 3, 'expected 3 placeholder candidates');

  const labels = analysis.candidates.filter((c) => c.kind === 'text' && c.tag === 'label');
  assert.equal(labels.length, 3, 'expected 3 label candidates');

  const submitAction = analysis.candidates.find((c) => c.kind === 'form-submit-action');
  assert.ok(submitAction, 'expected form-submit-action candidate');
  assert.equal(submitAction.label, 'Confirm Booking');
  assert.equal(submitAction.extra.action, 'form-submit');
  assert.equal(submitAction.extra.insideForm, true);
});

test('planner and transformer make entire form editable with submit button and WhatsApp URL binding', () => {
  const code = `
import React from 'react';

export function ContactSection() {
  return (
    <form className="contact-form">
      <label>Your Name</label>
      <input type="text" placeholder="John Doe" />
      <button type="submit">Send Message</button>
    </form>
  );
}
`;
  const profile = {
    root: os.tmpdir(),
    framework: 'nextjs',
    router: 'next-app',
    language: 'typescript',
    cssSystems: ['tailwind'],
    hasSrc: true,
    aliasMap: { '@/*': ['src/*'] },
  };

  const analysis = analyzeFile({
    code,
    relativeFile: 'src/components/ContactSection.tsx',
    profile,
    graph: { sharedFiles: [] },
    ownerScope: 'home',
    componentMeta: { name: 'ContactSection', role: 'contact' },
  });
  analysis.code = code;
  analysis.relativeFile = 'src/components/ContactSection.tsx';

  const plan = planTransformations({
    profile,
    analyses: [analysis],
  });

  const filePlan = plan.files[0];
  const formSubmit = filePlan.transformations.find((t) => t.operation === 'form-submit-action');
  assert.ok(formSubmit, 'form-submit-action must be planned');
  assert.match(formSubmit.urlField, /formWhatsappUrl/i);
  assert.match(formSubmit.labelField, /formSubmitLabel/i);

  const transformed = applyFilePlan(filePlan, profile);
  assert.ok(transformed.changed, 'file must be changed');
  assert.match(transformed.code, /data-preview-field-path/);
  assert.match(transformed.code, /formSubmitLabel/);
  assert.match(transformed.code, /type="submit"/);
  assert.doesNotMatch(transformed.code, /<span[^>]*hidden/);
  assert.doesNotMatch(transformed.code, /data-preview-static[\s\S]*data-preview-field-path/);
});

test('auditMarkerPlacement detects and rejects hidden preview markers', () => {
  const hiddenCode = `
    <div>
      <span className="hidden" aria-hidden="true" data-preview-field-path="home.hero.buttonUrl">https://wa.me/123</span>
      <span>Click me</span>
    </div>
  `;
  const errors = contract.auditMarkerPlacement(hiddenCode, 'TestHidden.tsx');
  assert.ok(errors.some((e) => e.includes('data-preview field/list/item marker is hidden')));
});

test('auditCoupledListMarkers detects and rejects coupling parallel list arrays by index', () => {
  const coupledCode = `
    <div data-preview-item-path="seasonal.items[0]">
      <span data-preview-field-path="seasonal.preOrderCta[0].buttonLabel">Pre-Order</span>
    </div>
  `;
  const errors = contract.auditCoupledListMarkers(coupledCode, 'TestCoupled.tsx');
  assert.ok(errors.some((e) => e.includes('belongs to a different list')));
});



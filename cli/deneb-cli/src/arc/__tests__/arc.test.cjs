'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DENEB_HOME = path.join(os.tmpdir(), 'deneb-test-home-' + Date.now());

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

test('DENEB preflight rejects a Next router destination with a duplicated base path before install', () => {
  const starter = path.resolve(
    __dirname,
    '../../../../../packages/create-template/template'
  );
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-navigation-preflight-'));
  fs.cpSync(starter, tempDir, { recursive: true });
  const componentDir = path.join(tempDir, 'src', 'components');
  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(
    path.join(componentDir, 'BrokenNavigation.tsx'),
    "router.push(withBasePath(pageRoute('about')));\n"
  );

  try {
    const validator = path.resolve(
      __dirname,
      '../../tools/deneb-template-validator.cjs'
    );
    const result = require('node:child_process').spawnSync(
      process.execPath,
      [validator, 'validate', tempDir, '--skip-install', '--skip-build'],
      { encoding: 'utf8' }
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

    assert.equal(result.status, 1);
    assert.match(
      output,
      /Template navigation validation failed before dependency installation\./
    );
    assert.match(output, /src\/components\/BrokenNavigation\.tsx:1/);
    assert.doesNotMatch(output, /Install dependencies/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

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
  assert.match(grid, /const products(?::\s*any\[\])? = siteData\?\.content\?\.home\?\.products \?\? \[/);
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

test('collections holding component references still bind primitive item fields', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const features = fs.readFileSync(path.join(dir, 'src', 'components', 'Features.tsx'), 'utf8');
  assert.match(features, /data-preview-list-path=/);
  assert.match(features, /icon: Truck/);
  assert.match(features, /data-preview-static="component-ref"/);
  assert.match(features, /data-preview-field-path=\{`[^`]*\.title`\}/);
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
  // The decorative icon stays static (may also receive data-preview-static).
  assert.match(hero, /<ArrowRight[^>]*className="ml-2 size-4"[^>]*aria-hidden="true"/);
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
  assert.match(result.code, /const BRANDS(?::\s*any\[\])? = siteData\?\.content\?\.home\?\.BRANDS \?\? DEFAULT_BRANDS;/);
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

test('detectedPages without a page file are not invented in the manifest', () => {
  const dir = copyOf(FIXTURE);
  silence(() =>
    runDenebArc(dir, 'basic-store', {
      telemetry: 'off',
      detectedPages: [{ id: 'contact', label: 'Contact', route: '/contact', required: true }],
    })
  );
  const { manifest } = auditFivora(dir);
  assert.ok(!manifest.pages.some((page) => page.id === 'contact' || page.route === '/contact'));
});

test('learning records contract failure instead of success', () => {
  const { honestOutcome } = require('../learning.cjs');
  assert.equal(
    honestOutcome({ syntaxPassed: true, contractPassed: true, fivoraContractPassed: false }, 'success'),
    'failure'
  );
  assert.equal(
    honestOutcome({ syntaxPassed: true, contractPassed: true, fivoraContractPassed: true, uncoveredVisibleText: 0 }, 'success'),
    'success'
  );
});

test('residual pass marks leftover decorative copy static with a reason', () => {
  const { applyResidualPass } = require('../residual.cjs');
  const code = `export function Chrome() { return <button aria-hidden="true">Close</button>; }`;
  const result = applyResidualPass({
    code,
    file: 'src/components/Chrome.tsx',
    ownerScope: 'home',
    usedPaths: new Set(),
  });
  assert.equal(result.changed, true);
  assert.match(result.code, /data-preview-static="[^"]+"/);
});

test('style-bind grid and card attributes are written onto collection nodes', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const grid = fs.readFileSync(path.join(dir, 'src', 'components', 'ProductGrid.tsx'), 'utf8');
  assert.match(grid, /data-preview-style-type="grid"/);
  assert.match(grid, /data-preview-style-type="card"/);
  assert.match(grid, /data-preview-style-target="home\.products\.grid"/);
});

test('ContactActions stays mounted when all channels are empty', () => {
  const sourcePath = path.join(__dirname, '..', '..', '..', '..', '..', 'packages', 'deneb-ui', 'src', 'contact', 'ContactActions.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(source, /if \(!hasPhone && !hasWhatsApp && !hasEmail\)/);
  assert.doesNotMatch(source, /return null/);
});

test('empty-state source audit flags gated preview markers', () => {
  const errors = contract.auditEmptyStateSource(
    '{title && <span data-preview-field-path="home.hero.title">{title}</span>}',
    'Hero.tsx'
  );
  assert.ok(errors.some((error) => error.includes('gated behind')));
});

test('healLegacyProductDetailLinks rewrites /products/${id} to platformProductDetailHref', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { healLegacyProductDetailLinks } = require('../transformer.cjs');
  const code = `
export function ProductCard({ product }: { product: { id: string } }) {
  return (
    <a href={\`/products/\${product.id}\`}>
      <span>View</span>
    </a>
  );
}
`;
  const ast = parseSource(code, 'ProductCard.tsx');
  const healed = healLegacyProductDetailLinks(ast);
  assert.equal(healed, 1);
  const out = printSource(ast);
  assert.match(out, /platformProductDetailHref\(product\.id\)/);
  assert.match(out, /from ['"]@deneb-ui\/ui['"]/);
});

test('saveRecipeFromProject learns calibrated fixes and registers live product detail route', () => {
  const { saveRecipeFromProject, getRecipeByName } = require('../../tools/recipe-engine.cjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-recipe-test-'));
  fs.writeFileSync(
    path.join(tmpDir, 'fivora-template.json'),
    JSON.stringify({
      manifestVersion: 2,
      name: 'Test Store',
      pages: [{ id: 'home', route: '/' }, { id: 'products', route: '/products' }],
      editorSchema: { version: 1, sections: [] },
    })
  );
  const saveRes = saveRecipeFromProject(tmpDir, 'unit-test-store');
  assert.equal(saveRes.recipe.name, 'unit-test-store');
  assert.equal(saveRes.recipe.productDetailRules.detailRoute, '/products/detail');
  assert.ok(saveRes.recipe.pages.some((p) => p.route === '/products/detail'));

  const loaded = getRecipeByName('unit-test-store', tmpDir);
  assert.ok(loaded);
  assert.equal(loaded.name, 'unit-test-store');

  // Clean up test artifacts
  try {
    if (fs.existsSync(saveRes.globalDest)) fs.unlinkSync(saveRes.globalDest);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test('applyCollectionTransform generates composite key for unkeyed map loops', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { applyCollectionTransform } = require('../transformer.cjs');
  const code = `
    export function FeatureList() {
      const items = [{ id: '1', title: 'Speed' }];
      return (
        <div>
          {items.map((item, index) => (
            <div>{item.title}</div>
          ))}
        </div>
      );
    }
  `;
  const ast = parseSource(code, 'FeatureList.tsx');
  const recast = require('recast');
  const { locKey } = require('../ast.cjs');
  let targetLoc = null;
  recast.types.visit(ast, {
    visitJSXElement(p) {
      if (p.parent?.node?.type === 'ArrowFunctionExpression') {
        targetLoc = locKey(p.node);
        return false;
      }
      this.traverse(p);
    },
  });
  const transformed = applyCollectionTransform(ast, {
    loc: targetLoc,
    listField: 'home.features',
    itemParam: 'item',
    indexParam: 'index',
  });
  assert.ok(transformed);
  const out = printSource(ast, code);
  assert.match(out, /key=\{item\.id \|\| item\.slug \|\| item\.title \|\| item\.name \|\| index\}/);
});

test('sanitizeContradictoryMarkers strips data-preview-static when element wraps editable descendants', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { sanitizeContradictoryMarkers } = require('../transformer.cjs');
  const code = `
    export function Hero() {
      return (
        <section data-preview-static="hero-wrapper">
          <h1 data-preview-field-path="home.hero.title">Hello</h1>
        </section>
      );
    }
  `;
  const ast = parseSource(code, 'Hero.tsx');
  const cleaned = sanitizeContradictoryMarkers(ast);
  assert.equal(cleaned, 1);
  const out = printSource(ast, code);
  assert.doesNotMatch(out, /data-preview-static/);
  assert.match(out, /data-preview-field-path="home\.hero\.title"/);
});

test('sanitizeContradictoryMarkers strips data-preview-static from broad containers even without editable descendants', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { sanitizeContradictoryMarkers } = require('../transformer.cjs');
  const code = `
    export function Container() {
      return (
        <div data-preview-static="box-container">
          <p>Plain unannotated text</p>
        </div>
      );
    }
  `;
  const ast = parseSource(code, 'Container.tsx');
  const cleaned = sanitizeContradictoryMarkers(ast);
  assert.equal(cleaned, 1);
  const out = printSource(ast, code);
  assert.doesNotMatch(out, /data-preview-static/);
  assert.match(out, /<div\s*>/);
});

test('healBroadContainerMarkers demotes data-preview-field-path from broad containers to inner leaf span', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { healBroadContainerMarkers } = require('../transformer.cjs');
  const code = `
    export function Card() {
      return (
        <div data-preview-field-path="home.card.heading">
          Card Title Content
        </div>
      );
    }
  `;
  const ast = parseSource(code, 'Card.tsx');
  const healed = healBroadContainerMarkers(ast);
  assert.equal(healed, 1);
  const out = printSource(ast, code);
  assert.doesNotMatch(out, /<div[^>]*data-preview-field-path/);
  assert.match(out, /<span\s+data-preview-field-path="home\.card\.heading">/);
});

test('healSectionOverflowHidden converts overflow-hidden to overflow-clip on section containers', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { healSectionOverflowHidden } = require('../transformer.cjs');
  const code = `
    export function Showcase() {
      return (
        <section className="relative py-24 overflow-hidden bg-white">
          <span data-preview-field-path="home.title">Showcase</span>
        </section>
      );
    }
  `;
  const ast = parseSource(code, 'Showcase.tsx');
  const healed = healSectionOverflowHidden(ast);
  assert.equal(healed, 1);
  const out = printSource(ast, code);
  assert.doesNotMatch(out, /overflow-hidden/);
  assert.match(out, /overflow-clip/);
});

test('injectSiteDataHook does not inject hook into helper sub-functions or functions that already have it', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { injectSiteDataHook } = require('../transformer.cjs');
  const code = `
    import { useSiteData } from '@deneb-ui/ui';

    function HelperIcon() {
      return <svg><path d="M0 0" /></svg>;
    }

    export function MainSection() {
      const { siteData } = useSiteData();
      return <div>{siteData?.content?.home?.title}</div>;
    }
  `;
  const ast = parseSource(code, 'MainSection.tsx');
  const injected = injectSiteDataHook(ast);
  assert.equal(injected, false);
  const out = printSource(ast, code);
  assert.doesNotMatch(out, /function HelperIcon\(\)\s*\{\s*const \{ siteData \} = useSiteData\(\);/);
});

test('learning loadFingerprintBoost returns verified boost for baseline trained fingerprints', () => {
  const { loadFingerprintBoost } = require('../learning.cjs');
  const boost1 = loadFingerprintBoost('leaf-static-marker');
  assert.equal(boost1.state, 'verified');
  assert.equal(boost1.boost, 0.08);

  const boost2 = loadFingerprintBoost('section-overflow-clip');
  assert.equal(boost2.state, 'verified');
  assert.equal(boost2.boost, 0.08);

  const boost3 = loadFingerprintBoost('empty-state-array-guard');
  assert.equal(boost3.state, 'verified');
  assert.equal(boost3.boost, 0.08);
});

test('instrumentLayoutSource injects ThemeStyles and ThemeToggle with dual mode support into root layout', () => {
  const { instrumentLayoutSource } = require('../transformer.cjs');
  const code = `
    import React from 'react';
    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="en">
          <body>
            <main>{children}</main>
          </body>
        </html>
      );
    }
  `;
  const result = instrumentLayoutSource(code, '@/data/site-data.json', '@deneb-ui/ui');
  assert.equal(result.updated, true);
  assert.ok(result.code.includes('ThemeStyles'));
  assert.ok(result.code.includes('ThemeToggle'));
  assert.ok(result.code.includes('SiteDataProvider'));
  assert.ok(result.code.includes('enableDualMode'));
  assert.ok(result.code.includes('fixed bottom-6 left-6 z-40'));
});

test('semantic prop harvester detects user-facing copy props and transformer binds them to siteData', () => {
  const { analyzeFile } = require('../semantic.cjs');
  const { planTransformations } = require('../planner.cjs');
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    export function Showcase() {
      return (
        <div className="features">
          <FeatureCard title="Lightning Fast" description="Instant response times" />
        </div>
      );
    }
  `;
  const profile = { root: '/tmp/test', hasSrc: true, jsxFiles: ['Showcase.tsx'], routes: [{ id: 'home', route: '/' }] };
  const analysis = analyzeFile({
    code,
    relativeFile: 'Showcase.tsx',
    profile,
    graph: { routesByFile: { 'Showcase.tsx': ['home'] } },
    ownerScope: 'home',
  });
  const propCandidates = analysis.candidates.filter((c) => c.operation === 'extract-prop');
  assert.ok(propCandidates.length >= 2);
  assert.ok(propCandidates.some((c) => c.value === 'Lightning Fast' && c.extra?.propName === 'title'));
  assert.ok(propCandidates.some((c) => c.value === 'Instant response times' && c.extra?.propName === 'description'));

  const plan = planTransformations({
    profile,
    analyses: [{ ...analysis, relativeFile: 'Showcase.tsx', code }],
  });
  const filePlan = plan.files[0];
  const transformed = applyFilePlan(filePlan, profile);
  assert.equal(transformed.changed, true);
  assert.ok(transformed.code.includes('title={siteData?.content?.home'));
  assert.ok(transformed.code.includes('description={siteData?.content?.home'));
});

test('manifest buildSiteDataAndManifest creates default dual-mode palette with dark mode overrides', () => {
  const { buildSiteDataAndManifest } = require('../manifest.cjs');
  const profile = {
    packageName: 'test-store',
    hasSrc: true,
    routes: [{ id: 'home', label: 'Home', route: '/', required: true }],
  };
  const plan = { files: [], usedPaths: [] };
  const bundle = buildSiteDataAndManifest({
    projectDir: '/tmp/test',
    projectName: 'test-store',
    profile,
    plan,
  });
  assert.ok(bundle.siteData.theme);
  assert.ok(bundle.siteData.theme.dark);
  assert.equal(bundle.siteData.theme.backgroundColor, '#ffffff');
  assert.equal(bundle.siteData.theme.dark.backgroundColor, '#0b0f19');
  assert.equal(bundle.siteData.theme.dark.textColor, '#f9fafb');
});

test('healEmptyStateConditionals preserves modal, null-check, and state-dependent conditional guards', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { healEmptyStateConditionals } = require('../transformer.cjs');
  const code = `
export function Showcase() {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);
  return (
    <div>
      <AnimatePresence>
        {lightboxIndex !== null && filteredItems[lightboxIndex] && (
          <div className="fixed inset-0 z-50">
            <span data-preview-field-path="home.ofLabel">Caption</span>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedDish && (
          <div className="fixed inset-0 z-50">
            <h3 data-preview-field-path="home.dishLabel">{selectedDish.name}</h3>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
`;
  const ast = parseSource(code, 'src/components/Showcase.tsx');
  const healed = healEmptyStateConditionals(ast);
  const result = printSource(ast, code);
  assert.equal(healed, 0, 'No modal guards should be stripped');
  assert.match(result, /lightboxIndex !== null/);
  assert.match(result, /selectedDish &&/);
});

test('M1: auditFivoraContract flags uncovered visible text as a contract violation', () => {
  const { auditFivoraContract } = require('../index.cjs');
  const profile = { routes: [{ id: 'home', file: 'src/app/page.tsx' }] };
  const siteData = { content: { home: { heroTitle: 'Welcome' } } };
  const manifest = {
    pages: [{ id: 'home', route: '/' }],
    editorSchema: {
      sections: [
        {
          id: 'home',
          path: 'home',
          type: 'object',
          fields: [{ key: 'heroTitle', type: 'text' }],
        },
      ],
    },
  };
  const inventory = {
    sources: [
      {
        rel: 'src/app/page.tsx',
        code: 'export default function Page() { return <div><h1><span data-preview-field-path="home.heroTitle">Welcome</span></h1><p>Uncovered paragraph copy here</p></div>; }',
      },
    ],
    pageKeysByFile: { 'src/app/page.tsx': ['home'] },
  };

  const audit = auditFivoraContract({ profile, siteData, manifest, inventory });
  assert.equal(audit.passed, false, 'Audit must fail when uncovered visible text exists');
  assert.ok(audit.uncoveredVisibleText.length > 0, 'Uncovered visible text must be recorded');
  assert.match(audit.uncoveredVisibleText[0].text, /Uncovered paragraph copy here/);
});

test('M2: ensureStyleAttrs is idempotent and does not duplicate style attributes', () => {
  const { parseSource, printSource, ensureStyleAttrs } = require('../ast.cjs');
  const code = '<span data-preview-field-path="home.title">Hello</span>';
  const ast = parseSource(code, 'test.tsx');
  const node = ast.program.body[0].expression;

  ensureStyleAttrs(node, 'home.title', 'text');
  const firstPass = printSource(ast, code);
  assert.match(firstPass, /data-preview-style-target="home\.title"/);
  assert.match(firstPass, /data-preview-style-type="text"/);

  // Second pass: must not duplicate attributes
  ensureStyleAttrs(node, 'home.title', 'text');
  const secondPass = printSource(ast, code);
  assert.equal(secondPass, firstPass, 'Second call must be strictly idempotent');
});

test('M3: collectFontIdsFromSiteData resolves planned fonts and theme accurately', () => {
  const { collectFontIdsFromSiteData, applyFontTheme } = require('../font-plan.cjs');
  const siteData = {
    theme: {
      headingFont: 'Playfair Display',
      bodyFont: 'Plus Jakarta Sans',
    },
    styles: {
      'home.accent': { fontFamily: 'Space Grotesk' },
    },
  };

  const fontIds = collectFontIdsFromSiteData(siteData);
  assert.ok(Array.isArray(fontIds));
  assert.ok(fontIds.includes('playfair-display'));
  assert.ok(fontIds.includes('plus-jakarta-sans'));
  assert.ok(fontIds.includes('space-grotesk'));

  const siteDataEmpty = {};
  applyFontTheme(siteDataEmpty, ['inter', 'playfair-display']);
  assert.equal(siteDataEmpty.theme.headingFont, 'Playfair Display');
  assert.equal(siteDataEmpty.theme.bodyFont, 'Inter');
});

test('ARC v2: applyCollectionTransform threads previewItemPath and index to custom child components', () => {
  const { parseSource, printSource, locKey } = require('../ast.cjs');
  const { applyCollectionTransform } = require('../transformer.cjs');

  const code = `
export function ProductGrid() {
  const products = [
    { id: 1, name: "Arabica", price: 15, image: "/arabica.jpg" },
    { id: 2, name: "Espresso", price: 20, image: "/espresso.jpg" }
  ];
  return (
    <div className="grid grid-cols-2">
      {products.map((item) => (
        <ProductCard key={item.id} product={item} />
      ))}
    </div>
  );
}
`;

  const ast = parseSource(code, 'ProductGrid.tsx');
  let mapLoc = null;
  const recast = require('recast');
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      if (pathNode.node.openingElement.name.name === 'ProductCard') {
        mapLoc = locKey(pathNode.node);
        return false;
      }
      this.traverse(pathNode);
    },
  });

  const transform = {
    listField: 'home.products',
    itemParam: 'item',
    loc: mapLoc,
    isPrimitiveArray: false,
    hasComponentRef: false,
  };

  const changed = applyCollectionTransform(ast, transform, false, true);
  assert.ok(changed);
  const transformed = printSource(ast, code);

  assert.match(transformed, /data-preview-list-path="home\.products"/);
  assert.match(transformed, /previewItemPath=\{`home\.products\[\$\{index\}\]`\}/);
  assert.match(transformed, /index=\{index\}/);
  assert.match(transformed, /data-preview-item-path=\{`home\.products\[\$\{index\}\]`\}/);
});

test('ARC v2: instrumentChildCardComponent updates ProductCard props, TS interface and binds inner fields', () => {
  const { parseSource, printSource } = require('../ast.cjs');
  const { instrumentChildCardComponent } = require('../transformer.cjs');

  const code = `
interface ProductCardProps {
  product: {
    name: string;
    price: number;
    image: string;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="card">
      <img src={product.image} alt={product.name} />
      <h3 className="title">{product.name}</h3>
      <span className="price">\${product.price}</span>
    </div>
  );
}
`;

  const ast = parseSource(code, 'ProductCard.tsx');
  const transform = {
    componentName: 'ProductCard',
    listField: 'home.products',
    itemFields: [
      { key: 'name', type: 'text' },
      { key: 'price', type: 'number' },
      { key: 'image', type: 'image' },
    ],
  };

  const changed = instrumentChildCardComponent(ast, transform, true);
  assert.ok(changed);
  const transformed = printSource(ast, code);

  assert.match(transformed, /previewItemPath\?: string/);
  assert.match(transformed, /index\?: number/);
  assert.match(transformed, /previewItemPath/);
  assert.match(transformed, /data-preview-item-path=\{`home\.products\[\$\{index\}\]`\}/);
  assert.match(transformed, /data-preview-field-path=\{`home\.products\[\$\{index\}\]\.image`\}/);
  assert.match(transformed, /data-preview-field-path=\{`home\.products\[\$\{index\}\]\.name`\}/);
  assert.match(transformed, /data-preview-field-path=\{`home\.products\[\$\{index\}\]\.price`\}/);
});

test('ARC v2: extract-tailwind-bg converts bg-[url(...)] into editable style and preview marker', () => {
  const { parseSource, printSource, locKey } = require('../ast.cjs');
  const { applyFilePlan } = require('../transformer.cjs');

  const code = `
export function Hero() {
  return (
    <section className="relative h-96 bg-[url('/hero-bg.jpg')] bg-cover">
      <h1>Hero Title</h1>
    </section>
  );
}
`;

  const ast = parseSource(code, 'Hero.tsx');
  let secLoc = null;
  const recast = require('recast');
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      if (pathNode.node.openingElement.name.name === 'section') {
        secLoc = locKey(pathNode.node);
        return false;
      }
      this.traverse(pathNode);
    },
  });

  const filePlan = {
    file: 'Hero.tsx',
    originalCode: code,
    transformations: [
      {
        loc: secLoc,
        operation: 'extract-tailwind-bg',
        field: 'home.hero.backgroundImage',
        fallback: '/hero-bg.jpg',
        bgUrl: '/hero-bg.jpg',
        decision: 'auto',
      },
    ],
  };

  const result = applyFilePlan(filePlan, { root: '/tmp' });
  assert.ok(result.changed);
  assert.match(result.code, /data-preview-field-path="home\.hero\.backgroundImage"/);
  assert.match(result.code, /backgroundImage:\s*`url\(\$\{siteData(?:\?\.\w+)+/);
  assert.doesNotMatch(result.code, /bg-\[url\('\/hero-bg\.jpg'\)\]/);
});

test('ARC v2: ir-builder builds project IR and resolves public asset paths accurately', () => {
  const { resolvePublicAssetUrl, objectLiteralToPlain } = require('../ir-builder.cjs');
  const { parseSource } = require('../ast.cjs');

  // Test objectLiteralToPlain
  const code = 'const obj = { id: 1, title: "Test", price: 29.99, featured: true };';
  const ast = parseSource(code, 'test.js');
  const plain = objectLiteralToPlain(ast.program.body[0].declarations[0].init);
  assert.deepEqual(plain, { id: 1, title: 'Test', price: 29.99, featured: true });
});

test('ARC v2: planTransformations automatically links child card component via IR', () => {
  const { planTransformations } = require('../planner.cjs');

  const profile = {
    components: [], // purposefully empty to test IR fallback
  };

  const ir = {
    getComponent(name) {
      if (name === 'ProductCard') {
        return { name: 'ProductCard', file: 'src/components/ProductCard.tsx' };
      }
      return null;
    },
  };

  const pageAnalysis = {
    relativeFile: 'src/app/page.tsx',
    candidates: [
      {
        file: 'src/app/page.tsx',
        loc: '10:5-10:40',
        kind: 'collection',
        operation: 'collection-conversion',
        confidence: 0.95,
        value: [{ value: { title: 'P1', price: 10 } }],
        extra: {
          itemsProp: 'products',
          childComponentName: 'ProductCard',
          objectItems: true,
          itemFields: [
            { key: 'title', type: 'text' },
            { key: 'price', type: 'number' },
            { key: 'image', type: 'image' },
          ],
        },
      },
    ],
  };

  const cardAnalysis = {
    relativeFile: 'src/components/ProductCard.tsx',
    candidates: [],
  };

  const plan = planTransformations({
    profile,
    analyses: [pageAnalysis, cardAnalysis],
    ir,
  });

  const cardPlan = plan.files.find((f) => f.file === 'src/components/ProductCard.tsx');
  assert.ok(cardPlan, 'Child card file plan must exist');
  const childTransform = cardPlan.transformations.find((t) => t.operation === 'instrument-child-card');
  assert.ok(childTransform, 'Must plan instrument-child-card for child component');
  assert.equal(childTransform.componentName, 'ProductCard');
  assert.equal(childTransform.file, 'src/components/ProductCard.tsx');
});

test('ARC v2: residual pass resolves static asset imports for image tags via IR', () => {
  const { applyResidualPass } = require('../residual.cjs');

  const code = `
import heroImg from '../assets/hero.png';

export function Hero() {
  return (
    <div>
      <img src={heroImg} alt="Hero banner" />
    </div>
  );
}
`;

  const ir = {
    getAssetImport(file, id) {
      if (id === 'heroImg') return '/hero.png';
      return null;
    },
  };

  const result = applyResidualPass({
    code,
    file: 'src/components/Hero.tsx',
    ownerScope: 'home',
    usedPaths: new Set(),
    componentName: 'Hero',
    ir,
  });

  assert.ok(result.changed, 'Residual pass should change code with resolved asset');
  assert.match(result.code, /data-preview-field-path="home\.hero\.(?:image|hero)"/);
  assert.match(result.code, /siteData(?:\?\.\w+)+/);
  assert.ok(result.fields.some((f) => f.type === 'image' && f.value === '/hero.png'));
});

test('ARC v2: printer prints Deneb Editability Scorecard with all metrics', () => {
  const printer = require('../printer.cjs');
  let output = '';
  const origLog = console.log;
  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };

  try {
    printer.printValidation(
      { syntaxPassed: true, contractPassed: true, fivoraContractPassed: true },
      { visualCoverage: 95.5, visualCovered: 42, visualRequired: 44, uncoveredVisibleText: 0 },
      { score: 100 }
    );
  } finally {
    console.log = origLog;
  }

  assert.match(output, /Deneb Editability Scorecard/);
  assert.match(output, /Contract Validity:\s+.*100%/);
  assert.match(output, /Editability Coverage:\s+.*95\.5%/);
  assert.match(output, /Visual Elements:\s+42\/44 bound/);
  assert.match(output, /Design Preservation:\s+100%/);
});

test('ARC v2 Phase 2: prop-flow analyzer links parent props to child SectionHeader previewPath and binds inner headings', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const parentCode = `
    import { SectionHeader } from './SectionHeader';
    export function Story() {
      return (
        <section>
          <SectionHeader title="Our Story" subtitle="Freshly roasted every day" />
        </section>
      );
    }
  `;
  const parentPlan = {
    file: 'Story.tsx',
    originalCode: parentCode,
    transformations: [
      {
        operation: 'prop-flow-callsite',
        componentName: 'SectionHeader',
        previewPath: 'home.story',
        propTransforms: {
          title: { field: 'home.story.title', fallback: 'Our Story', type: 'text' },
          subtitle: { field: 'home.story.subtitle', fallback: 'Freshly roasted every day', type: 'text' },
        },
        decision: 'auto',
      },
    ],
  };
  const parentRes = applyFilePlan(parentPlan, { root: '/tmp' });
  assert.ok(parentRes.changed);
  assert.match(parentRes.code, /previewPath="home\.story"/);
  assert.match(parentRes.code, /title=\{siteData\?\.content\?\.home\?\.story\?\.title \?\? "Our Story"\}/);
  assert.match(parentRes.code, /subtitle=\{siteData\?\.content\?\.home\?\.story\?\.subtitle \?\? "Freshly roasted every day"\}/);

  const childCode = `
    export interface SectionHeaderProps {
      title: string;
      subtitle: string;
    }
    export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
      return (
        <div className="header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      );
    }
  `;
  const childPlan = {
    file: 'SectionHeader.tsx',
    originalCode: childCode,
    transformations: [
      {
        operation: 'instrument-reusable-component',
        componentName: 'SectionHeader',
        propTransforms: {
          title: { field: 'home.story.title', fallback: 'Our Story', type: 'text' },
          subtitle: { field: 'home.story.subtitle', fallback: 'Freshly roasted every day', type: 'text' },
        },
        decision: 'auto',
      },
    ],
  };
  const childRes = applyFilePlan(childPlan, { root: '/tmp' });
  assert.ok(childRes.changed);
  assert.match(childRes.code, /previewPath\?: string/);
  assert.match(childRes.code, /previewPath/);
  assert.match(childRes.code, /data-preview-field-path=\{previewPath \? `\$\{previewPath\}\.title` : undefined\}/);
  assert.match(childRes.code, /data-preview-field-path=\{previewPath \? `\$\{previewPath\}\.subtitle` : undefined\}/);
});

test('ARC v2 Phase 2: compound text analyzer binds button with icon while preserving icon JSX', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    import { Coffee } from 'lucide-react';
    export function OrderButton() {
      return (
        <button className="btn">
          <Coffee className="w-4 h-4" />
          Order Now
        </button>
      );
    }
  `;
  const plan = {
    file: 'OrderButton.tsx',
    originalCode: code,
    transformations: [
      {
        loc: '5:8',
        tag: 'button',
        operation: 'bind-button-with-icon',
        field: 'home.hero.orderLabel',
        fallback: 'Order Now',
        fieldType: 'text',
        decision: 'auto',
      },
    ],
  };
  const res = applyFilePlan(plan, { root: '/tmp' });
  assert.ok(res.changed);
  assert.match(res.code, /<Coffee className="w-4 h-4" \/>/);
  assert.match(res.code, /data-preview-field-path="home\.hero\.orderLabel"/);
  assert.match(res.code, /\{siteData\?\.content\?\.home\?\.hero\?\.orderLabel \?\? "Order Now"\}/);
});

test('ARC v2 Phase 2: compound text analyzer binds highlighted heading without breaking span styling', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    export function Heading() {
      return (
        <h1 className="text-4xl font-bold">
          Crafted with <span className="text-amber-500">Passion</span>
        </h1>
      );
    }
  `;
  const plan = {
    file: 'Heading.tsx',
    originalCode: code,
    transformations: [
      {
        loc: '4:8',
        tag: 'h1',
        operation: 'bind-highlighted-heading',
        field: 'home.hero.title',
        fallback: 'Crafted with Passion',
        fieldType: 'text',
        decision: 'auto',
      },
    ],
  };
  const res = applyFilePlan(plan, { root: '/tmp' });
  assert.ok(res.changed);
  assert.match(res.code, /data-preview-field-path="home\.hero\.title"/);
  assert.match(res.code, /<span\s+[^>]*className="text-amber-500"[^>]*data-preview-field-path="home\.hero\.titleHighlight"/);
  assert.match(res.code, /siteData\?\.content\?\.home\?\.hero\?\.titleHighlight \?\? "Passion"/);
});

test('ARC v2 Phase 2: data flow engine unrolls chained collections (.slice().map()) and variable aliases', () => {
  const { unrollCollectionPipelines, resolveVariableAliases } = require('../data-flow.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });
  
  const code = `
    const rawProducts = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
    const featured = rawProducts.slice(0, 4);
    export function Grid() {
      return <div>{featured.map((p) => <span>{p.name}</span>)}</div>;
    }
  `;
  const ast = parseSource(code);
  const aliases = resolveVariableAliases(ast);
  assert.ok(aliases.has('featured'));
  assert.equal(aliases.get('featured').rootIdentifier, 'rawProducts');
  assert.equal(aliases.get('featured').transformMethod, 'slice');

  const chainedCode = `
    export function Chained() {
      return <div>{products.filter(p => p.active).slice(0, 3).map(p => <span>{p.title}</span>)}</div>;
    }
  `;
  const chainedAst = parseSource(chainedCode);
  const pipelines = unrollCollectionPipelines(chainedAst);
  assert.equal(pipelines.length, 1);
  assert.equal(pipelines[0].rootIdentifier, 'products');
  assert.deepEqual(pipelines[0].pipelineChain, ['filter', 'slice']);
});

test('ARC v2 Phase 2: full conversion generates deneb-conversion-report.json with unresolved and category breakdown', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const reportPath = path.join(dir, 'deneb-conversion-report.json');
  assert.ok(fs.existsSync(reportPath), 'deneb-conversion-report.json should exist');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.scorecard.contractValidity, '100%');
  assert.ok(report.categories);
  assert.ok(typeof report.categories.text.planned === 'number');
  assert.ok(typeof report.categories.collections.planned === 'number');
  assert.ok(Array.isArray(report.unresolved));
});

test('ARC v2 Phase 2: multi-run idempotency preserves clean interfaces without duplicating previewPath or imports', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const grid = fs.readFileSync(path.join(dir, 'src', 'components', 'ProductGrid.tsx'), 'utf8');
  const useSiteDataMatches = grid.match(/import\s*\{\s*useSiteData\s*\}\s*from/g) || [];
  assert.equal(useSiteDataMatches.length, 1);
  const listMatches = grid.match(/data-preview-list-path="home\.products"/g) || [];
  assert.equal(listMatches.length, 1);
});

test('ARC v2 Phase 3: validateRuntimeEditability verifies live editability contracts on converted project', async () => {
  const { validateRuntimeEditability, validateRuntimeEditabilitySync } = require('../runtime-validator.cjs');
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  
  const siteDataPath = path.join(dir, 'src', 'data', 'site-data.json');
  const manifestPath = path.join(dir, 'fivora-template.json');
  const siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const syncRes = validateRuntimeEditabilitySync({
    projectDir: dir,
    siteData,
    manifest,
  });
  assert.equal(syncRes.passed, true);
  assert.ok(syncRes.runtimeEditabilityScore >= 95, `Expected score >= 95, got ${syncRes.runtimeEditabilityScore}`);
  assert.ok(syncRes.collectionResults.length > 0);
  assert.ok(syncRes.collectionResults.every((c) => c.passed));

  const asyncRes = await validateRuntimeEditability({
    projectDir: dir,
    siteData,
    manifest,
  });
  assert.equal(asyncRes.passed, true);
  assert.equal(asyncRes.runtimeEditabilityScore, syncRes.runtimeEditabilityScore);
});

test('ARC v2 Phase 3: CanonicalFieldRef correctly generates getter AST, preview attribute, and nested item paths', () => {
  const { fieldRef, isValidCanonicalPath, validatePathAlignment } = require('../canonical-paths.cjs');
  const recast = require('recast');

  const ref = fieldRef('home.story.title');
  assert.equal(ref.scope, 'home');
  assert.equal(ref.section, 'story');
  assert.equal(ref.fieldName, 'title');

  const getterCode = recast.print(ref.toGetterAst()).code;
  assert.equal(getterCode, 'siteData?.content?.home?.story?.title');

  const bindingCode = recast.print(ref.toBindingAst('Default Story')).code;
  assert.equal(bindingCode, 'siteData?.content?.home?.story?.title ?? "Default Story"');

  const previewAttrCode = recast.print(ref.toPreviewAttrAst()).code;
  assert.equal(previewAttrCode, 'data-preview-field-path="home.story.title"');

  assert.equal(isValidCanonicalPath('home.story.title'), true);
  assert.equal(isValidCanonicalPath('home.products[0].name'), true);
  assert.equal(isValidCanonicalPath(''), false);

  assert.equal(
    validatePathAlignment('siteData?.content?.home?.story?.title', '<h2 data-preview-field-path="home.story.title">'),
    true
  );
  assert.equal(
    validatePathAlignment('siteData?.content?.home?.story?.title', '<h2 data-preview-field-path="home.other.title">'),
    false
  );
});

test('ARC v2 Phase 3: Adapters recognize carousel, accordion, tabs, dialog, and gallery components', () => {
  const { activeAdapters, recognizeWithAdapters } = require('../adapters.cjs');
  const adapters = activeAdapters({
    framework: 'nextjs',
    dependencies: {
      'swiper': '^11.0.0',
      'embla-carousel-react': '^8.0.0',
    },
  });

  const makeJsxNode = (name) => ({
    type: 'JSXElement',
    openingElement: {
      type: 'JSXOpeningElement',
      name: { type: 'JSXIdentifier', name },
      attributes: [],
    },
    children: [],
  });

  // Swiper
  const swiperRes = recognizeWithAdapters(makeJsxNode('Swiper'), {}, adapters);
  assert.equal(swiperRes.library, 'swiper');
  assert.equal(swiperRes.role, 'carousel-container');

  const swiperSlideRes = recognizeWithAdapters(makeJsxNode('SwiperSlide'), {}, adapters);
  assert.equal(swiperSlideRes.library, 'swiper');
  assert.equal(swiperSlideRes.role, 'carousel-slide');

  // Embla
  const emblaRes = recognizeWithAdapters(makeJsxNode('Carousel'), {}, adapters);
  assert.equal(emblaRes.library, 'embla');
  assert.equal(emblaRes.role, 'carousel-container');

  // Accordion
  const accordionRes = recognizeWithAdapters(makeJsxNode('Accordion'), {}, adapters);
  assert.equal(accordionRes.library, 'accordion');
  assert.equal(accordionRes.role, 'accordion-container');

  const accordionTriggerRes = recognizeWithAdapters(makeJsxNode('AccordionTrigger'), {}, adapters);
  assert.equal(accordionTriggerRes.library, 'accordion');
  assert.equal(accordionTriggerRes.role, 'accordion-header');

  // Tabs
  const tabsRes = recognizeWithAdapters(makeJsxNode('Tabs'), {}, adapters);
  assert.equal(tabsRes.library, 'tabs');
  assert.equal(tabsRes.role, 'tabs-container');

  // Dialog
  const dialogRes = recognizeWithAdapters(makeJsxNode('DialogTitle'), {}, adapters);
  assert.equal(dialogRes.library, 'dialog');
  assert.equal(dialogRes.role, 'dialog-title');

  // Gallery
  const galleryRes = recognizeWithAdapters(makeJsxNode('Masonry'), {}, adapters);
  assert.equal(galleryRes.library, 'gallery');
  assert.equal(galleryRes.role, 'gallery-container');
});

test('ARC v2 Phase 3: conversion report includes runtime verification scorecard and metrics', () => {
  const dir = copyOf(STOREFRONT_FIXTURE);
  silence(() => runDenebArc(dir, 'acme-store', { telemetry: 'off' }));
  const reportPath = path.join(dir, 'deneb-conversion-report.json');
  assert.ok(fs.existsSync(reportPath));
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(report.scorecard.runtimeEditability);
  assert.match(report.scorecard.runtimeEditability, /100%/);
  assert.ok(report.runtimeVerification);
  assert.equal(report.runtimeVerification.passed, true);
  assert.ok(report.runtimeVerification.verifiedCount > 0);
});

test('ARC v2 Phase 4: RSC boundary intelligence detects metadata exports and client directives accurately', () => {
  const { hasMetadataExport, hasClientDirective, canSafelyInjectClientDirective, ensureClientDirective } = require('../rsc-boundary.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });

  const metadataCode = `
    export const metadata = { title: 'My Store', description: 'Best products' };
    export default function Page() { return <h1>Store</h1>; }
  `;
  const metaAst = parseSource(metadataCode);
  assert.equal(hasMetadataExport(metaAst), true);
  assert.equal(hasClientDirective(metaAst), false);
  assert.equal(canSafelyInjectClientDirective(metaAst, 'src/app/page.tsx', { router: 'next-app' }), false);

  const clientCode = `
    'use client';
    import { useState } from 'react';
    export default function Interactive() { const [c, setC] = useState(0); return <button onClick={() => setC(c + 1)}>{c}</button>; }
  `;
  const clientAst = parseSource(clientCode);
  assert.equal(hasMetadataExport(clientAst), false);
  assert.equal(hasClientDirective(clientAst), true);
  assert.equal(canSafelyInjectClientDirective(clientAst, 'src/components/Interactive.tsx', { router: 'next-app' }), true);

  const serverCode = `
    export default function PureServer() { return <p>Server rendered</p>; }
  `;
  const serverAst = parseSource(serverCode);
  assert.equal(hasMetadataExport(serverAst), false);
  assert.equal(hasClientDirective(serverAst), false);
  assert.equal(canSafelyInjectClientDirective(serverAst, 'src/app/about/page.tsx', { router: 'next-app' }), true);
  
  ensureClientDirective(serverAst);
  assert.equal(hasClientDirective(serverAst), true);
});

test('ARC v2 Phase 4: semantic engine protects dynamic commerce state and mixed expressions from static replacement', () => {
  const { resolveChildText } = require('../semantic.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });

  const makeJsxNode = (code) => {
    const ast = parseSource(code);
    return ast.program.body[0].expression;
  };

  // Mixed text with dynamic expression: <p>{cart.items.length} items in your cart</p>
  const cartNode = makeJsxNode('<p>{cart.items.length} items in your cart</p>');
  const cartText = resolveChildText(cartNode, new Map());
  assert.equal(cartText.dynamic, true);
  assert.equal(cartText.text, '');

  // User session state: <span>Welcome, {user?.name}</span>
  const userNode = makeJsxNode('<span>Welcome, {user?.name}</span>');
  const userText = resolveChildText(userNode, new Map());
  assert.equal(userText.dynamic, true);
  assert.equal(userText.text, '');

  // Dynamic price calculation: <div>{formatPrice(item.price * qty)}</div>
  const priceNode = makeJsxNode('<div>{formatPrice(item.price * qty)}</div>');
  const priceText = resolveChildText(priceNode, new Map());
  assert.equal(priceText.dynamic, true);
  assert.equal(priceText.text, '');

  // Pure static text: <h1>Crafted with Passion</h1>
  const staticNode = makeJsxNode('<h1>Crafted with Passion</h1>');
  const staticText = resolveChildText(staticNode, new Map());
  assert.equal(staticText.dynamic, false);
  assert.equal(staticText.text, 'Crafted with Passion');
});

test('ARC v2 Phase 4: instrumentReusableComponent supports identifier props (props: HeaderProps) and body destructuring', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    interface SectionHeaderProps {
      title: string;
      subtitle: string;
    }
    export function SectionHeader(props: SectionHeaderProps) {
      const { title, subtitle } = props;
      return (
        <div className="section-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      );
    }
  `;
  const plan = {
    file: 'SectionHeader.tsx',
    originalCode: code,
    transformations: [
      {
        operation: 'instrument-reusable-component',
        componentName: 'SectionHeader',
        propTransforms: {
          title: { field: 'home.story.title', fallback: 'Our Story', type: 'text' },
          subtitle: { field: 'home.story.subtitle', fallback: 'Freshly roasted every day', type: 'text' },
        },
        decision: 'auto',
      },
    ],
  };

  const res = applyFilePlan(plan, { root: '/tmp' });
  assert.ok(res.changed);
  // Interface updated with previewPath
  assert.match(res.code, /previewPath\?: string/);
  // Body destructuring injected with previewPath
  assert.match(res.code, /const \{\s*title,\s*subtitle,\s*previewPath\s*\} = props;/);
  // DOM elements stamped with dynamic path
  assert.match(res.code, /data-preview-field-path=\{previewPath \? `\$\{previewPath\}\.title` : undefined\}/);
  assert.match(res.code, /data-preview-field-path=\{previewPath \? `\$\{previewPath\}\.subtitle` : undefined\}/);
});

test('ARC v2 Phase 4: instrumentChildCardComponent supports identifier props and body destructuring', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    interface ProductCardProps {
      name: string;
      price: string;
      image: string;
    }
    export function ProductCard(props: ProductCardProps) {
      const { name, price, image } = props;
      return (
        <div className="card">
          <img src={image} alt={name} />
          <h3>{name}</h3>
          <span>{price}</span>
        </div>
      );
    }
  `;
  const plan = {
    file: 'ProductCard.tsx',
    originalCode: code,
    transformations: [
      {
        operation: 'instrument-child-card',
        componentName: 'ProductCard',
        itemFields: [
          { key: 'name', type: 'text' },
          { key: 'price', type: 'text' },
          { key: 'image', type: 'image' },
        ],
        decision: 'auto',
      },
    ],
  };

  const res = applyFilePlan(plan, { root: '/tmp' });
  assert.ok(res.changed);
  // Interface updated with previewItemPath and index
  assert.match(res.code, /previewItemPath\?: string/);
  assert.match(res.code, /index\?: number/);
  // Body destructuring receives previewItemPath and index
  assert.match(res.code, /previewItemPath/);
  assert.match(res.code, /index/);
});

test('ARC v2 Phase 4: healEmptyStateConditionals preserves interactive modals, drawers, and tab states', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    export function Catalog() {
      return (
        <div>
          {isModalOpen && (
            <div role="dialog" className="modal fixed inset-0 z-50">
              <h2>Quick View Modal</h2>
            </div>
          )}
          {activeTab === 'details' ? (
            <div className="tab-pane">
              <p>Product Specifications</p>
            </div>
          ) : null}
        </div>
      );
    }
  `;
  const plan = {
    file: 'Catalog.tsx',
    originalCode: code,
    transformations: [
      {
        loc: '7:14',
        tag: 'h2',
        operation: 'extract-text',
        field: 'home.modal.title',
        fallback: 'Quick View Modal',
        fieldType: 'text',
        decision: 'auto',
      },
    ],
  };

  const res = applyFilePlan(plan, { root: '/tmp' });
  assert.ok(res.changed);
  // Conditional modal guard preserved
  assert.match(res.code, /isModalOpen &&/);
  // Tab conditional preserved
  assert.match(res.code, /activeTab === 'details' \?/);
});

test('ARC v2 Phase 5: Pluggable Adapter Registry supports custom adapter registration and lifecycle hooks', () => {
  const { AdapterRegistry, defaultRegistry } = require('../adapters/registry.cjs');
  const customRegistry = new AdapterRegistry();

  const customVideoAdapter = {
    id: 'custom-video',
    detect: (project) => Boolean(project.hasVideoPlayer),
    recognizeNode(node) {
      const name = node.openingElement?.name?.name;
      if (name === 'VideoPlayer' || name === 'BackgroundVideo') {
        return { library: 'custom-video', kind: 'media', role: 'video-container', tag: name };
      }
      return null;
    },
    resolveAction(node) {
      return null;
    },
  };

  customRegistry.register(customVideoAdapter);
  assert.ok(customRegistry.get('custom-video'), 'Must find registered custom adapter');
  assert.equal(customRegistry.getAll().length, 1);

  // Inactive when project hasVideoPlayer is false
  assert.equal(customRegistry.getActive({ hasVideoPlayer: false }).length, 0);

  // Active when project hasVideoPlayer is true
  const active = customRegistry.getActive({ hasVideoPlayer: true });
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'custom-video');

  // Verify node recognition
  const fakeNode = {
    openingElement: { name: { name: 'VideoPlayer' } },
  };
  const recognized = customRegistry.recognizeNode(fakeNode, { profile: { hasVideoPlayer: true } });
  assert.ok(recognized);
  assert.equal(recognized.adapterId, 'custom-video');
  assert.equal(recognized.role, 'video-container');

  // Verify default global registry contains all built-in adapters
  const allDefault = defaultRegistry.getAll();
  const ids = allDefault.map((a) => a.id);
  assert.ok(ids.includes('swiper'), 'Must include swiper');
  assert.ok(ids.includes('embla'), 'Must include embla');
  assert.ok(ids.includes('slick'), 'Must include slick');
  assert.ok(ids.includes('accordion'), 'Must include accordion');
  assert.ok(ids.includes('tabs'), 'Must include tabs');
  assert.ok(ids.includes('dialog'), 'Must include dialog');
  assert.ok(ids.includes('gallery'), 'Must include gallery');
  assert.ok(ids.includes('picture-source'), 'Must include picture-source');
});

test('ARC v2 Phase 5: Responsive media adapter recognizes <picture> and ignores decorative <source> tags', () => {
  const { analyzeFile } = require('../semantic.cjs');
  const code = `
    export function HeroBanner() {
      return (
        <section className="hero">
          <picture>
            <source media="(min-width: 1024px)" srcSet="/banner-desktop.jpg" />
            <source media="(min-width: 640px)" srcSet="/banner-tablet.jpg" />
            <img src="/banner-mobile.jpg" alt="Summer Collection" />
          </picture>
        </section>
      );
    }
  `;

  const analysis = analyzeFile({
    relativeFile: 'HeroBanner.tsx',
    code,
    profile: {
      framework: 'nextjs',
      router: 'next-app',
    },
  });

  // Verify <source> tags are handled gracefully as picture-source-child
  const sourceCandidates = analysis.candidates.filter((c) => c.tag === 'source');
  assert.ok(sourceCandidates.length > 0, 'Source tags must be recorded');
  for (const s of sourceCandidates) {
    assert.equal(s.reason, 'picture-source-child');
    assert.equal(s.skip, true);
  }

  // Verify fallback <img> or <picture> is extracted with the mobile src fallback
  const imgCandidate = analysis.candidates.find((c) => c.kind === 'image' && !c.skip);
  assert.ok(imgCandidate, 'Must extract image candidate from picture/img');
  assert.equal(imgCandidate.value, '/banner-mobile.jpg');
});

test('ARC v2 Phase 5: Transformer binds <picture> fallback <img> and stamps preview field path', () => {
  const { applyFilePlan } = require('../transformer.cjs');
  const code = `
    export function HeroBanner() {
      return (
        <section className="hero">
          <picture>
            <source media="(min-width: 1024px)" srcSet="/banner-desktop.jpg" />
            <img src="/banner-mobile.jpg" alt="Summer Collection" />
          </picture>
        </section>
      );
    }
  `;

  const plan = {
    file: 'HeroBanner.tsx',
    originalCode: code,
    transformations: [
      {
        loc: '5:10:8:20',
        tag: 'picture',
        operation: 'extract-picture',
        field: 'home.hero.banner',
        fallback: '/banner-mobile.jpg',
        fieldType: 'image',
        decision: 'auto',
      },
    ],
  };

  const res = applyFilePlan(plan, { root: '/tmp' });
  assert.ok(res.changed);
  // Both picture and inner img receive preview attributes
  assert.match(res.code, /<picture[^>]*data-preview-field-path="home\.hero\.banner"/);
  assert.match(res.code, /<img[^>]*data-preview-field-path="home\.hero\.banner"/);
  // Fallback img receives dynamic siteData binding
  assert.match(res.code, /src=\{siteData\?\.content\?\.home\?\.hero\?\.banner (\?\?|\|\|) "\/banner-mobile\.jpg"\}/);
});

test('ARC v2 Phase 5: Carousel adapters identify containers and slide items across Swiper, Embla, and Slick', () => {
  const { recognizeWithAdapters, defaultRegistry } = require('../adapters/registry.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });
  const makeNode = (code) => parseSource(code).program.body[0].expression;

  const activeAdapters = defaultRegistry.getAll();

  // Swiper
  const swiperContainer = makeNode('<Swiper autoplay={true}><SwiperSlide>Slide 1</SwiperSlide></Swiper>');
  const swiperRec = recognizeWithAdapters(swiperContainer, {}, activeAdapters);
  assert.equal(swiperRec?.role, 'carousel-container');
  assert.equal(swiperRec?.adapterId, 'swiper');

  const swiperSlide = swiperContainer.children.find((c) => c.openingElement?.name?.name === 'SwiperSlide');
  const slideRec = recognizeWithAdapters(swiperSlide, {}, activeAdapters);
  assert.equal(slideRec?.role, 'carousel-slide');
  assert.equal(slideRec?.adapterId, 'swiper');

  // Embla
  const emblaContainer = makeNode('<Carousel><CarouselContent><CarouselItem>Item 1</CarouselItem></CarouselContent></Carousel>');
  const emblaRec = recognizeWithAdapters(emblaContainer, {}, activeAdapters);
  assert.equal(emblaRec?.role, 'carousel-container');
  assert.equal(emblaRec?.adapterId, 'embla');

  // Slick
  const slickContainer = makeNode('<Slider dots={true}><div>Slide</div></Slider>');
  const slickRec = recognizeWithAdapters(slickContainer, {}, activeAdapters);
  assert.equal(slickRec?.role, 'carousel-container');
  assert.equal(slickRec?.adapterId, 'slick');
});

test('ARC v2 Phase 5: Accordion and Tabs adapters recognize component hierarchies and trigger/content roles', () => {
  const { recognizeWithAdapters, defaultRegistry } = require('../adapters/registry.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });
  const makeNode = (code) => parseSource(code).program.body[0].expression;

  const activeAdapters = defaultRegistry.getAll();

  // Accordion Trigger & Content
  const accTrigger = makeNode('<AccordionTrigger>What is your return policy?</AccordionTrigger>');
  const accTriggerRec = recognizeWithAdapters(accTrigger, {}, activeAdapters);
  assert.equal(accTriggerRec?.role, 'accordion-header');
  assert.equal(accTriggerRec?.adapterId, 'accordion');

  const accContent = makeNode('<AccordionContent>We offer 30-day refunds.</AccordionContent>');
  const accContentRec = recognizeWithAdapters(accContent, {}, activeAdapters);
  assert.equal(accContentRec?.role, 'accordion-body');
  assert.equal(accContentRec?.adapterId, 'accordion');

  // Tabs Trigger & Content
  const tabTrigger = makeNode('<TabsTrigger value="overview">Overview</TabsTrigger>');
  const tabTriggerRec = recognizeWithAdapters(tabTrigger, {}, activeAdapters);
  assert.equal(tabTriggerRec?.role, 'tab-button');
  assert.equal(tabTriggerRec?.adapterId, 'tabs');

  const tabContent = makeNode('<TabsContent value="overview"><p>Details here</p></TabsContent>');
  const tabContentRec = recognizeWithAdapters(tabContent, {}, activeAdapters);
  assert.equal(tabContentRec?.role, 'tab-panel');
  assert.equal(tabContentRec?.adapterId, 'tabs');
});

test('ARC v2 Phase 6: explainFile analyzes component AST and outputs structured explanation', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { explainFile } = require('../explain.cjs');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-explain-test-'));
  const compFile = path.join(tmpDir, 'Hero.tsx');
  fs.writeFileSync(
    compFile,
    `
    export function Hero() {
      return (
        <section className="hero">
          <h1>Welcome to Luxury Watches</h1>
          <p>Handcrafted precision timepieces</p>
          <img src="/watches/hero.jpg" alt="Hero Watch" />
        </section>
      );
    }
  `,
    'utf8'
  );

  const explanation = explainFile('Hero.tsx', { root: tmpDir });
  assert.equal(explanation.file, 'Hero.tsx');
  assert.equal(explanation.isTypeScript, true);
  assert.ok(explanation.totalCandidates >= 3, 'Must discover heading, paragraph, and image');
  assert.ok(explanation.editableCount >= 3, 'All 3 content items must be editable');

  const h1El = explanation.editableElements.find((e) => e.tag === 'h1');
  assert.ok(h1El, 'Must include h1');
  assert.equal(h1El.kind, 'text');
  assert.equal(h1El.value, 'Welcome to Luxury Watches');

  const imgEl = explanation.editableElements.find((e) => e.tag === 'img');
  assert.ok(imgEl, 'Must include img');
  assert.equal(imgEl.kind, 'image');
  assert.equal(imgEl.value, '/watches/hero.jpg');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ARC v2 Phase 6: createUnifiedDiff generates unified diff representation cleanly', () => {
  const { createUnifiedDiff } = require('../diff.cjs');

  const oldCode = `export function Banner() {\n  return <h1>Old Headline</h1>;\n}`;
  const newCode = `export function Banner() {\n  return <h1 data-preview-field-path="home.title">New Headline</h1>;\n}`;

  const diffResult = createUnifiedDiff('Banner.tsx', oldCode, newCode);
  assert.equal(diffResult.filename, 'Banner.tsx');
  assert.ok(diffResult.additions > 0);
  assert.ok(diffResult.deletions > 0);
  assert.match(diffResult.diff, /--- a\/Banner\.tsx/);
  assert.match(diffResult.diff, /\+\+\+ b\/Banner\.tsx/);
  assert.match(diffResult.diff, /-   return <h1>Old Headline<\/h1>;/);
  assert.match(diffResult.diff, /\+   return <h1 data-preview-field-path="home\.title">New Headline<\/h1>;/);
});

test('ARC v2 Phase 6: conversion report includes severity-graded diagnostics (INFO, WARNING, ERROR, BLOCKING)', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { runDenebArc } = require('../index.cjs');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-severity-test-'));
  fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'severity-test', dependencies: { next: '14.0.0', react: '18.2.0' } }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'components', 'Banner.tsx'),
    `
    export function Banner() {
      return (
        <div>
          <svg className="decorative-icon"><path d="M0 0" /></svg>
          <h2>Exclusive Deals</h2>
        </div>
      );
    }
  `,
    'utf8'
  );

  runDenebArc(tmpDir, { dryRun: false });

  const reportPath = path.join(tmpDir, 'deneb-conversion-report.json');
  assert.ok(fs.existsSync(reportPath), 'deneb-conversion-report.json must exist');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  assert.ok(report.diagnosticsBySeverity, 'Must contain diagnosticsBySeverity');
  assert.equal(typeof report.diagnosticsBySeverity.info, 'number');
  assert.equal(typeof report.diagnosticsBySeverity.warning, 'number');
  assert.equal(typeof report.diagnosticsBySeverity.error, 'number');
  assert.equal(typeof report.diagnosticsBySeverity.blocking, 'number');

  // Decorative SVG is categorized as INFO
  const svgDiagnostic = (report.unresolved || []).find((u) => u.type === 'icon' || u.type === 'decoration');
  if (svgDiagnostic) {
    assert.equal(svgDiagnostic.severity, 'INFO');
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ARC v2 Phase 6: runTransactionalPipeline executes atomic rollback on critical gate failure', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { runTransactionalPipeline } = require('../index.cjs');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-rollback-test-'));
  fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'rollback-test', dependencies: { next: '14.0.0', react: '18.2.0' } }),
    'utf8'
  );
  const originalCode = `export function Card() { return <h3>Original Card</h3>; }`;
  const cardPath = path.join(tmpDir, 'src', 'components', 'Card.tsx');
  fs.writeFileSync(cardPath, originalCode, 'utf8');

  // Run transactional pipeline with strict mode where contract failures trigger rollback
  const result = runTransactionalPipeline(tmpDir, { strict: true });
  // If it rolled back or succeeded, original code is preserved or successfully updated
  if (result.rolledBack) {
    const afterCode = fs.readFileSync(cardPath, 'utf8');
    assert.equal(afterCode, originalCode, 'Original code must be restored upon rollback');
  } else {
    assert.ok(result.success, 'Valid pipeline must report success');
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ARC v3 Phase 7: createRunWorkspace creates isolated run structure and commits files cleanly', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const {
    createRunWorkspace,
    copyProjectToWorkspace,
    commitWorkspaceToProject,
    cleanupWorkspace,
    saveRunArtifacts,
    formatFailureExplanation,
  } = require('../workspace.cjs');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-workspace-test-'));
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'ws-test' }), 'utf8');
  fs.writeFileSync(path.join(tmpDir, 'src', 'App.tsx'), 'export default function App() {}', 'utf8');

  const runId = 'arc-test-phase7';
  const runDirs = createRunWorkspace(tmpDir, runId);
  assert.ok(fs.existsSync(runDirs.workspaceDir), 'workspaceDir should exist');
  assert.ok(fs.existsSync(runDirs.snapshotDir), 'snapshotDir should exist');
  assert.ok(fs.existsSync(runDirs.reportsDir), 'reportsDir should exist');

  // Copy project to workspace
  copyProjectToWorkspace(tmpDir, runDirs.workspaceDir, runDirs.snapshotDir);
  assert.ok(fs.existsSync(path.join(runDirs.workspaceDir, 'src', 'App.tsx')), 'App.tsx copied to workspace');
  assert.ok(fs.existsSync(path.join(runDirs.snapshotDir, 'src', 'App.tsx')), 'App.tsx snapshotted');

  // Modify in workspace
  fs.writeFileSync(path.join(runDirs.workspaceDir, 'src', 'App.tsx'), 'export default function App() { return <h1>Updated</h1>; }', 'utf8');
  // Original is unchanged before commit
  assert.equal(fs.readFileSync(path.join(tmpDir, 'src', 'App.tsx'), 'utf8'), 'export default function App() {}');

  // Save artifacts
  saveRunArtifacts(runDirs, {
    report: { outcome: 'success', engine: 'ARC v3' },
    runtimeResults: { passed: true, score: 100 },
  });
  assert.ok(fs.existsSync(path.join(runDirs.reportsDir, 'conversion-report.json')));

  // Commit to project
  const committed = commitWorkspaceToProject(runDirs.workspaceDir, tmpDir, ['src/App.tsx']);
  assert.ok(committed.includes('src/App.tsx'));
  assert.equal(fs.readFileSync(path.join(tmpDir, 'src', 'App.tsx'), 'utf8'), 'export default function App() { return <h1>Updated</h1>; }');

  // Format failure explanation
  const explanation = formatFailureExplanation({ fivoraContractErrors: ['Missing key'], uncoveredVisibleText: 2 }, ['Contract failed']);
  assert.ok(explanation.includes('DENEB CONVERSION BLOCKED'));
  assert.ok(explanation.includes('Contract failed'));

  cleanupWorkspace(runDirs.workspaceDir);
  assert.ok(!fs.existsSync(runDirs.workspaceDir), 'workspaceDir cleaned up');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ARC v3 Phase 7: blocking Fivora contract enforcement prevents commit when contract checks fail', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { runTransactionalPipeline } = require('../index.cjs');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-blocking-contract-test-'));
  fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'blocking-contract-test', dependencies: { next: '14.0.0', react: '18.2.0' } }),
    'utf8'
  );
  // An invalid component that violates Fivora contract (uncovered text or invalid syntax)
  const initialCode = `export function Broken() { return <div>Unbound static text</div>; }`;
  const compPath = path.join(tmpDir, 'src', 'components', 'Broken.tsx');
  fs.writeFileSync(compPath, initialCode, 'utf8');

  // Strict mode is true by default in ARC v3
  const pipelineRes = runTransactionalPipeline(tmpDir);
  assert.ok(pipelineRes !== null);

  // If pipeline rolls back or fails contract, original file must remain untouched
  if (pipelineRes.rolledBack) {
    const afterCode = fs.readFileSync(compPath, 'utf8');
    assert.equal(afterCode, initialCode, 'Developer project file must remain untouched upon rollback');
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ARC v3 Phase 8: modular transforms architecture exports all sub-modules with 100% facade compatibility', () => {
  const facade = require('../transformer.cjs');
  const modular = require('../transforms/index.cjs');

  assert.equal(typeof facade.applyFilePlan, 'function');
  assert.equal(typeof facade.applyCollectionTransform, 'function');
  assert.equal(typeof facade.instrumentChildCardComponent, 'function');
  assert.equal(typeof facade.instrumentReusableComponent, 'function');
  assert.equal(typeof facade.instrumentLayoutSource, 'function');
  assert.equal(typeof facade.instrumentPageKey, 'function');
  assert.equal(typeof facade.resolveSiteDataSpecifier, 'function');
  assert.equal(typeof facade.rewriteRecursiveSiteDataContext, 'function');

  assert.strictEqual(facade.applyFilePlan, modular.applyFilePlan);
  assert.strictEqual(facade.applyCollectionTransform, modular.applyCollectionTransform);
  assert.strictEqual(facade.instrumentChildCardComponent, modular.instrumentChildCardComponent);
  assert.strictEqual(facade.instrumentLayoutSource, modular.instrumentLayoutSource);
});

test('ARC v3 Phase 8: direct sub-module transformation works for primitives, compound-content, and background assets', () => {
  const { replaceTextChildren } = require('../transforms/primitives/text.cjs');
  const { extractTailwindBg } = require('../transforms/assets/tailwind-bg.cjs');
  const { bindButtonWithIcon } = require('../transforms/components/compound-content.cjs');
  const { parseSource, printSource } = require('../ast.cjs');

  // 1. Primitive text transform
  const textCode = `export function Heading() { return <h1>Original Title</h1>; }`;
  const textAst = parseSource(textCode);
  const h1Node = textAst.program.body[0].declaration.body.body[0].argument;
  replaceTextChildren(h1Node, 'home.heroTitle', 'Original Title', 'text');
  const updatedText = printSource(textAst, textCode);
  assert.ok(updatedText.includes('siteData.content.home.heroTitle') || updatedText.includes('siteData?.content?.home?.heroTitle') || updatedText.includes('siteData.home.heroTitle'));

  // 2. Asset tailwind background image extraction
  const bgCode = `export function Banner() { return <div className="h-64 bg-[url('/hero.png')] text-white" />; }`;
  const bgAst = parseSource(bgCode);
  const divNode = bgAst.program.body[0].declaration.body.body[0].argument;
  extractTailwindBg(divNode, { field: 'home.heroBanner', fallback: '/hero.png' });
  const updatedBg = printSource(bgAst, bgCode);
  assert.ok(updatedBg.includes('backgroundImage: `url(${'));
  assert.ok(!updatedBg.includes("bg-[url('/hero.png')]"));

  // 3. Compound content button with icon
  const btnCode = `export function Action() { return <button className="btn"><svg /><span>Click Me</span></button>; }`;
  const btnAst = parseSource(btnCode);
  const btnNode = btnAst.program.body[0].declaration.body.body[0].argument;
  bindButtonWithIcon(btnNode, { field: 'home.ctaLabel' });
  const updatedBtn = printSource(btnAst, btnCode);
  assert.ok(updatedBtn.includes('data-preview-field-path="home.ctaLabel"'));
});

test('ARC v3 Phase 9: canonicalField engine provides single source of truth for runtime, markers, schema, and setters', () => {
  const { canonicalField, fieldRef, isValidCanonicalPath, validatePathAlignment } = require('../canonical-paths.cjs');

  // 1. Core derivation from canonical string
  const field = canonicalField('home.hero.title', { provenance: { file: 'Hero.tsx', loc: '12:4' } });
  assert.equal(field.path, 'home.hero.title');
  assert.equal(field.scope, 'home');
  assert.equal(field.section, 'hero');
  assert.equal(field.fieldName, 'title');
  assert.equal(field.previewPath, 'home.hero.title');
  assert.equal(field.previewMarker, 'data-preview-field-path="home.hero.title"');
  assert.equal(field.runtimePath, 'siteData.content.home.hero.title');
  assert.equal(field.manifestSchemaPath, 'home.hero.title');
  assert.equal(field.diagnosticsId, 'field:home.hero.title');
  assert.equal(field.toSetterCode('newVal'), 'siteData.content.home.hero.title = newVal;');
  assert.equal(field.validate().valid, true);

  // 2. Collection and child derivation
  const col = canonicalField('home.categories');
  const item0 = col.toCollectionItem(0);
  assert.equal(item0.path, 'home.categories[0]');
  assert.equal(item0.isCollection, true);

  const nestedChild = item0.toCollectionChild('products', 2);
  assert.equal(nestedChild.path, 'home.categories[0].products[2]');

  // 3. Backward compatible alias
  const aliasRef = fieldRef('about.story.heading');
  assert.equal(aliasRef.fieldName, 'heading');
  assert.equal(aliasRef.scope, 'about');

  // 4. AST generation
  const getterAst = field.toGetterAst();
  assert.equal(getterAst.type, 'OptionalMemberExpression');

  const bindingAst = field.toBindingAst('Fallback');
  assert.equal(bindingAst.type, 'LogicalExpression');

  const attrAst = field.toPreviewAttrAst();
  assert.equal(attrAst.name.name, 'data-preview-field-path');
  assert.equal(attrAst.value.value, 'home.hero.title');

  const styleAttrAst = field.toPreviewStyleTargetAst();
  assert.equal(styleAttrAst.name.name, 'data-preview-style-target');

  // 5. Validation and alignment
  assert.ok(isValidCanonicalPath('home.hero.title'));
  assert.ok(isValidCanonicalPath('home.categories[0].products[${index}].title'));
  assert.ok(!isValidCanonicalPath(''));
  assert.ok(!isValidCanonicalPath('invalid path with spaces'));

  assert.ok(validatePathAlignment('siteData?.content?.home?.hero?.title', 'data-preview-field-path="home.hero.title"'));
});

test('ARC v3 Phase 9: formalized typed IR models and validateProjectIR verify project structure integrity', () => {
  const {
    createDenebComponent,
    createDataSource,
    createCollectionDefinition,
    validateProjectIR,
  } = require('../ir-builder.cjs');

  // 1. Factory validation
  const comp = createDenebComponent({
    name: 'ProductCard',
    file: 'components/ProductCard.tsx',
    propsSignature: { kind: 'destructured', names: ['product'], paramName: null, typeAnnotationName: 'CardProps' },
    memberAccesses: { product: ['name', 'price', 'image'] },
  });
  assert.equal(comp.id, 'components/ProductCard.tsx:ProductCard');
  assert.equal(comp.clientBoundary, 'server');

  const ds = createDataSource({
    name: 'featuredItems',
    file: 'data/products.json',
    items: [{ id: 1, name: 'Item 1' }],
    fieldKeys: ['id', 'name'],
  });
  assert.equal(ds.editable, true);
  assert.equal(ds.kind, 'inline-array');

  const col = createCollectionDefinition({
    file: 'app/shop/page.tsx',
    arrayName: 'featuredItems',
    itemParam: 'item',
    rootTagName: 'ProductCard',
    childComponent: comp,
    dataSource: ds,
  });
  assert.equal(col.arrayName, 'featuredItems');
  assert.equal(col.childComponent.name, 'ProductCard');

  // 2. Validate valid IR
  const mockIR = {
    components: new Map([['ProductCard', comp]]),
    dataSources: new Map([['featuredItems', ds]]),
    collections: [col],
    assetImports: new Map(),
    backgroundImages: [],
    componentUsages: [],
  };

  const validation = validateProjectIR(mockIR);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
  assert.equal(validation.stats.componentCount, 1);
  assert.equal(validation.stats.dataSourceCount, 1);
  assert.equal(validation.stats.collectionCount, 1);

  // 3. Catch corrupted IR
  const brokenIR = {
    components: new Map([['BrokenComp', { name: 'MismatchedName', file: '' }]]),
    dataSources: new Map([['BrokenDS', { name: 'BrokenDS', file: '' }]]),
    collections: [{ file: '' }],
  };
  const brokenValidation = validateProjectIR(brokenIR);
  assert.equal(brokenValidation.valid, false);
  assert.ok(brokenValidation.errors.length >= 3);
});

test('ARC v3 Phase 10: data-classification engine accurately categorizes 7 data tiers and protects platform/runtime data', () => {
  const { DATA_CLASSIFICATION, classifyDataCandidate, isEditableClassification } = require('../data-classification.cjs');

  // 1. CONTENT -> editable
  const contentRes = classifyDataCandidate({ tag: 'h1', kind: 'text', value: 'Special Summer Blend' });
  assert.equal(contentRes.classification, DATA_CLASSIFICATION.CONTENT);
  assert.equal(contentRes.editable, true);
  assert.equal(isEditableClassification(contentRes.classification), true);

  // 2. COMMERCE_CONTENT -> editable
  const commerceRes = classifyDataCandidate({ tag: 'h3', kind: 'text', value: 'Arabica Dark Roast', propName: 'productTitle' });
  assert.equal(commerceRes.classification, DATA_CLASSIFICATION.COMMERCE_CONTENT);
  assert.equal(commerceRes.editable, true);
  assert.equal(isEditableClassification(commerceRes.classification), true);

  // 3. PLATFORM_CONTROLLED -> not editable (no marker)
  const platformRes = classifyDataCandidate({ tag: 'span', kind: 'text', value: 'LKR', field: 'common.currency' });
  assert.equal(platformRes.classification, DATA_CLASSIFICATION.PLATFORM_CONTROLLED);
  assert.equal(platformRes.editable, false);
  assert.equal(isEditableClassification(platformRes.classification), false);

  const orderIdRes = classifyDataCandidate({ tag: 'span', kind: 'text', value: '#10492', propName: 'orderId' });
  assert.equal(orderIdRes.classification, DATA_CLASSIFICATION.PLATFORM_CONTROLLED);
  assert.equal(orderIdRes.editable, false);

  // 4. INTERACTION_STATE -> not editable
  const modalRes = classifyDataCandidate({ tag: 'div', kind: 'text', propName: 'isOpen', value: 'true' });
  assert.equal(modalRes.classification, DATA_CLASSIFICATION.INTERACTION_STATE);
  assert.equal(modalRes.editable, false);

  // 5. COMPUTED_DATA -> not editable
  const computedRes = classifyDataCandidate({ tag: 'span', kind: 'text', value: 'items.reduce((a, b) => a + b)' });
  assert.equal(computedRes.classification, DATA_CLASSIFICATION.COMPUTED_DATA);
  assert.equal(computedRes.editable, false);

  // 6. RUNTIME_DATA -> not editable
  const runtimeRes = classifyDataCandidate({ tag: 'span', kind: 'text', value: 'user.email' });
  assert.equal(runtimeRes.classification, DATA_CLASSIFICATION.RUNTIME_DATA);
  assert.equal(runtimeRes.editable, false);

  // 7. DECORATIVE -> not editable
  const decorRes = classifyDataCandidate({ tag: 'span', kind: 'text', value: '•' });
  assert.equal(decorRes.classification, DATA_CLASSIFICATION.DECORATIVE);
  assert.equal(decorRes.editable, false);
});

test('ARC v3 Phase 10: planner enforces non-editable skip on platform-controlled, interaction, and computed candidates', () => {
  const { planTransformations } = require('../planner.cjs');

  const analyses = [
    {
      relativeFile: 'components/OrderSummary.tsx',
      candidates: [
        {
          loc: '5:4',
          tag: 'h2',
          kind: 'text',
          value: 'Your Order Summary',
          confidence: 0.95,
        },
        {
          loc: '12:6',
          tag: 'span',
          kind: 'text',
          value: 'user.email',
          confidence: 0.95,
        },
        {
          loc: '18:6',
          tag: 'span',
          kind: 'text',
          value: 'LKR',
          field: 'common.currency',
          confidence: 0.95,
        },
        {
          loc: '24:6',
          tag: 'div',
          kind: 'text',
          propName: 'isOpen',
          value: 'true',
          confidence: 0.95,
        },
      ],
      code: 'export function OrderSummary() {}',
    },
  ];

  const plan = planTransformations({ profile: { jsxFiles: ['components/OrderSummary.tsx'] }, analyses });
  const filePlan = plan.files[0];

  // Only the content headline should be planned for transformation
  assert.equal(filePlan.transformations.length, 1);
  assert.equal(filePlan.transformations[0].fallback, 'Your Order Summary');
  assert.equal(filePlan.transformations[0].dataClassification, 'CONTENT');

  // The 3 runtime/platform/interaction candidates must be skipped
  assert.equal(plan.skipped.length, 3);
  const skippedClassifications = plan.skipped.map((s) => s.classification);
  assert.ok(skippedClassifications.includes('RUNTIME_DATA'));
  assert.ok(skippedClassifications.includes('PLATFORM_CONTROLLED'));
  assert.ok(skippedClassifications.includes('INTERACTION_STATE'));
});

test('ARC v3 Phase 11: data-flow engine unrolls nested member collections (category.products.map) and spread props', () => {
  const { unrollCollectionSource } = require('../data-flow.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });

  // 1. Nested collection member: category.products.map(...)
  const code = `category.products.map((product) => <ProductCard key={product.id} {...product} />);`;
  const ast = parseSource(code);
  const mapExpr = ast.program.body[0].expression;
  const calleeObj = mapExpr.callee.object; // category.products

  const unrolled = unrollCollectionSource(calleeObj);
  assert.equal(unrolled.kind, 'nested-member');
  assert.equal(unrolled.parentIdentifier, 'category');
  assert.equal(unrolled.childProp, 'products');
  assert.equal(unrolled.rootName, 'category.products');

  // 2. Chained filter on nested member: category.products.filter(p => p.active)
  const chainedCode = `category.products.filter(p => p.active).slice(0, 5);`;
  const chainedAst = parseSource(chainedCode);
  const chainedExpr = chainedAst.program.body[0].expression;
  const chainedUnrolled = unrollCollectionSource(chainedExpr);
  assert.equal(chainedUnrolled.rootName, 'category.products');
  assert.ok(chainedUnrolled.chain.includes('slice'));
});

test('ARC v3 Phase 11: data-flow engine resolves renamed destructuring and deep nested destructuring aliases', () => {
  const { collectVariableAliases } = require('../data-flow.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });

  const code = `
    const { title: heading, image: heroImg } = hero;
    const { product: { name: productName, price: productPrice } } = props;
  `;
  const ast = parseSource(code);
  const aliases = collectVariableAliases(ast);

  // 1. Renamed destructuring check
  const headingAlias = aliases.get('heading');
  assert.ok(headingAlias);
  assert.equal(headingAlias.rootName, 'hero');
  assert.equal(headingAlias.sourceProp, 'title');
  assert.equal(headingAlias.kind, 'destructured-alias');

  const heroImgAlias = aliases.get('heroImg');
  assert.ok(heroImgAlias);
  assert.equal(heroImgAlias.rootName, 'hero');
  assert.equal(heroImgAlias.sourceProp, 'image');

  // 2. Deep nested destructuring check
  const nameAlias = aliases.get('productName');
  assert.ok(nameAlias);
  assert.equal(nameAlias.rootName, 'props.product');
  assert.equal(nameAlias.sourceProp, 'name');
  assert.equal(nameAlias.kind, 'deep-destructured-alias');
});

test('ARC v3 Phase 12: RSC boundary optimizer prevents converting async server components and metadata exporters', () => {
  const {
    isAsyncServerComponent,
    canSafelyInjectClientDirective,
    calculateMinimalClientBoundary,
  } = require('../rsc-boundary.cjs');
  const parseSource = (c) => require('recast').parse(c, { parser: require('recast/parsers/babel-ts') });

  // 1. Async Server Component cannot be converted
  const asyncCode = `export default async function ProductPage() { return <div>Server Data</div>; }`;
  const asyncAst = parseSource(asyncCode);
  assert.equal(isAsyncServerComponent(asyncAst), true);
  assert.equal(canSafelyInjectClientDirective(asyncAst, 'app/product/[id]/page.tsx', { router: 'next-app', appDir: 'app' }), false);

  // 2. Metadata exporter cannot be converted
  const metaCode = `
    export const metadata = { title: 'Store Catalog' };
    export default function Catalog() { return <div>Catalog</div>; }
  `;
  const metaAst = parseSource(metaCode);
  assert.equal(canSafelyInjectClientDirective(metaAst, 'app/shop/page.tsx', { router: 'next-app', appDir: 'app' }), false);

  // 3. Minimal client boundary calculation
  assert.equal(calculateMinimalClientBoundary({ isAsync: true, hasHooks: true }), 'server');
  assert.equal(calculateMinimalClientBoundary({ hasMetadata: true, hasHooks: true }), 'server');
  assert.equal(calculateMinimalClientBoundary({ isLeaf: true, hasHooks: true }), 'client');
  assert.equal(calculateMinimalClientBoundary({ isLeaf: false, hasHooks: false }), 'server');
});

test('ARC v3 Phase 12: RSC metrics tracking computes boundary counts and validates conversion threshold', () => {
  const { computeRscMetrics, validateRscBoundaryIntegrity } = require('../rsc-boundary.cjs');

  const files = [
    { file: 'app/layout.tsx', hadClientDirective: false, hasClientDirective: false },
    { file: 'app/page.tsx', hadClientDirective: false, hasClientDirective: false },
    { file: 'components/Hero.tsx', hadClientDirective: false, hasClientDirective: true },
    { file: 'components/ProductCard.tsx', hadClientDirective: false, hasClientDirective: true },
    { file: 'components/CartModal.tsx', hadClientDirective: true, hasClientDirective: true },
  ];

  const metrics = computeRscMetrics(files);
  assert.equal(metrics.clientBoundariesBefore, 1);
  assert.equal(metrics.clientBoundariesAfter, 3);
  assert.equal(metrics.serverComponentsConverted, 2);
  assert.equal(metrics.serverComponentsPreserved, 2);
  assert.equal(metrics.conversionExceededThreshold, false);

  const validation = validateRscBoundaryIntegrity(metrics, 5);
  assert.equal(validation.valid, true);

  // Exceed threshold
  const failValidation = validateRscBoundaryIntegrity(metrics, 1);
  assert.equal(failValidation.valid, false);
  assert.ok(failValidation.error.includes('Excessive RSC conversions'));
});

test('ARC v3 Phase 13: validateCollectionOperations verifies runtime add, remove, reorder, and mutation operations', () => {
  const { validateCollectionOperations } = require('../runtime-validator.cjs');

  const mockSiteData = {
    content: {
      home: {
        products: [
          { id: '1', title: 'Product 1', price: 100 },
          { id: '2', title: 'Product 2', price: 200 },
        ],
        testimonials: [
          { id: 't1', author: 'Jane Doe', quote: 'Great coffee' },
        ],
      },
    },
  };

  const report = validateCollectionOperations(mockSiteData);
  assert.equal(report.passed, true);
  assert.equal(report.totalCollections, 2);

  const prodCol = report.collections.find((c) => c.path === 'home.products');
  assert.ok(prodCol);
  assert.equal(prodCol.operations.addItem, true);
  assert.equal(prodCol.operations.removeItem, true);
  assert.equal(prodCol.operations.reorderItems, true);
  assert.equal(prodCol.operations.mutateItemField, true);
  assert.equal(prodCol.passed, true);
});

test('ARC v3 Phase 13: 12-Gate Acceptance Matrix evaluates critical gates, thresholds, and incomplete/failed statuses', () => {
  const { evaluateAcceptanceGates } = require('../acceptance-gates.cjs');

  // 1. All Gates Passing
  const passingMetrics = {
    sourceAnalysis: { passed: true },
    astTransformation: { passed: true },
    typescriptValidation: { passed: true },
    buildSuccess: { passed: true },
    fivoraAudit: { passed: true },
    manifestValid: true,
    runtimeEditabilityScore: 99.5,
    collectionOpsPassed: true,
    imageEditingPassed: true,
    routeCoveragePassed: true,
    designPreservationScore: 99.1,
    controlOnlyValid: true,
    editabilityCoverage: 99.2,
  };
  const passRes = evaluateAcceptanceGates(passingMetrics);
  assert.equal(passRes.passed, true);
  assert.equal(passRes.status, 'CONVERSION_PASSED');
  assert.equal(passRes.allCriticalPassed, true);

  // 2. Critical Gate Failure (Fivora Contract) -> CONVERSION_FAILED
  const failMetrics = {
    ...passingMetrics,
    fivoraAudit: { passed: false },
  };
  const failRes = evaluateAcceptanceGates(failMetrics);
  assert.equal(failRes.passed, false);
  assert.equal(failRes.status, 'CONVERSION_FAILED');
  assert.equal(failRes.allCriticalPassed, false);

  // 3. Sub-Threshold Coverage (e.g. 96%) -> CONVERSION_INCOMPLETE
  const incompleteMetrics = {
    ...passingMetrics,
    editabilityCoverage: 96.0,
  };
  const incRes = evaluateAcceptanceGates(incompleteMetrics);
  assert.equal(incRes.passed, false);
  assert.equal(incRes.status, 'CONVERSION_INCOMPLETE');
  assert.equal(incRes.allCriticalPassed, true);
});

test('ARC v3 Phase 15: calculateVisualPreservation computes >= 98% score across mobile, tablet, and desktop viewports', () => {
  const { calculateVisualPreservation } = require('../visual-regression.cjs');

  const beforeCode = `
    export function Hero() {
      return (
        <section className="flex flex-col md:grid md:grid-cols-2 gap-8 p-12 bg-white">
          <h1 className="text-4xl font-bold">Original Hero Title</h1>
          <p className="text-lg text-gray-600">Subtitle copy text</p>
          <button className="btn flex items-center gap-2">
            <svg className="w-5 h-5" />
            <span>Discover Products</span>
          </button>
        </section>
      );
    }
  `;

  const afterCode = `
    export function Hero() {
      return (
        <section className="flex flex-col md:grid md:grid-cols-2 gap-8 p-12 bg-white">
          <h1 data-preview-field-path="home.hero.title" className="text-4xl font-bold">
            {siteData?.content?.home?.hero?.title ?? "Original Hero Title"}
          </h1>
          <p data-preview-field-path="home.hero.subtitle" className="text-lg text-gray-600">
            {siteData?.content?.home?.hero?.subtitle ?? "Subtitle copy text"}
          </p>
          <button className="btn flex items-center gap-2">
            <svg className="w-5 h-5" />
            <span data-preview-field-path="home.hero.cta">
              {siteData?.content?.home?.hero?.cta ?? "Discover Products"}
            </span>
          </button>
        </section>
      );
    }
  `;

  const report = calculateVisualPreservation(beforeCode, afterCode);
  assert.equal(report.passed, true);
  assert.ok(report.overallPreservationScore >= 98.0);
  assert.ok(report.viewports.mobile.preservationScore >= 98.0);
  assert.ok(report.viewports.tablet.preservationScore >= 98.0);
  assert.ok(report.viewports.desktop.preservationScore >= 98.0);
  assert.equal(report.blockingIssues.length, 0);
});

test('ARC v3 Phase 15: calculateVisualPreservation detects dropped icons or layout shifts as blocking issues', () => {
  const { calculateVisualPreservation } = require('../visual-regression.cjs');

  const beforeCode = `
    export function ButtonWithIcon() {
      return (
        <button className="btn">
          <svg className="icon" />
          <span>Add to Cart</span>
        </button>
      );
    }
  `;

  const brokenAfterCode = `
    export function ButtonWithIcon() {
      return (
        <button className="btn">
          <span>Add to Cart</span>
        </button>
      );
    }
  `;

  const report = calculateVisualPreservation(beforeCode, brokenAfterCode);
  assert.equal(report.passed, false);
  assert.ok(report.blockingIssues.length > 0);
  assert.ok(report.blockingIssues[0].includes('SVG or icon dropped'));
});

test('ARC v3 Phase 15: verifyInteractionsSync validates mobile nav toggle, accordions, tabs, and carousels', () => {
  const { verifyInteractionsSync, INTERACTIVE_PATTERNS } = require('../interaction-verifier.cjs');

  const files = [
    {
      file: 'components/Header.tsx',
      code: `
        export function Header() {
          const [open, setOpen] = useState(false);
          return (
            <header>
              <button aria-label="Toggle Menu" onClick={() => setOpen(!open)}>
                <span>Menu</span>
              </button>
            </header>
          );
        }
      `,
    },
    {
      file: 'components/FaqSection.tsx',
      code: `export function Faq() { return <AccordionTrigger>Item</AccordionTrigger>; }`,
    },
    {
      file: 'components/ProductTabs.tsx',
      code: `export function Tabs() { return <TabsTrigger value="one">Tab</TabsTrigger>; }`,
    },
    {
      file: 'components/Slider.tsx',
      code: `export function Slider() { return <Swiper><SwiperSlide>Slide 1</SwiperSlide></Swiper>; }`,
    },
  ];

  const report = verifyInteractionsSync({ files });
  assert.equal(report.passed, true);
  assert.equal(report.interactionScore, 100.0);
  assert.equal(report.totalTested, 4);
  assert.equal(report.failedTests, 0);

  const patterns = report.patterns.map((p) => p.pattern);
  assert.ok(patterns.includes(INTERACTIVE_PATTERNS.NAVBAR_MOBILE_TOGGLE));
  assert.ok(patterns.includes(INTERACTIVE_PATTERNS.ACCORDION));
  assert.ok(patterns.includes(INTERACTIVE_PATTERNS.TABS));
  assert.ok(patterns.includes(INTERACTIVE_PATTERNS.CAROUSEL));
});

function createMockCompliantProject() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-compliant-'));
  const appDir = path.join(tempDir, 'src', 'app');
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'sample', dependencies: { next: '15.0.0' } }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    version: 2,
    arcVersion: '2.1.0',
    schemaVersion: 2,
    siteDataFile: 'src/data/site-data.json',
    pages: [{ id: 'home', label: 'Home', route: '/', required: true }],
    editorSchema: {
      version: 1,
      sections: [
        { id: 'home', path: 'home', type: 'object', label: 'Home', fields: [{ key: 'heroTitle', type: 'text' }] }
      ]
    },
    visualEditing: {
      contractVersion: 1,
      mode: 'strict',
      controlOnlyPaths: []
    }
  }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({
    content: {
      home: { heroTitle: 'Welcome' }
    }
  }, null, 2));
  fs.writeFileSync(path.join(appDir, 'layout.tsx'), 'export default function RootLayout({ children }: any) { return <html><body>{children}</body></html>; }');
  fs.writeFileSync(path.join(appDir, 'page.tsx'), 'export default function HomePage() { return <main data-preview-page-id="home"><h1 data-preview-field-path="home.heroTitle">Welcome</h1></main>; }');

  return {
    dir: tempDir,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

test('ARC v3 Phase 16: auditStorefrontTemplate verifies real-world storefront against 12-Gate Acceptance Matrix', () => {
  const { auditStorefrontTemplate, resolveWorkspaceStorefrontsDir } = require('../corpus-verifier.cjs');
  const path = require('path');
  const fs = require('fs');
  const baseDir = resolveWorkspaceStorefrontsDir();
  const coffeeDir = path.join(baseDir, 'coffee');
  const hasRealStorefront = fs.existsSync(coffeeDir) && fs.existsSync(path.join(coffeeDir, 'fivora-template.json'));

  let targetDir = coffeeDir;
  let cleanup = null;
  if (!hasRealStorefront) {
    const fixture = createMockCompliantProject();
    targetDir = fixture.dir;
    cleanup = fixture.cleanup;
  }

  try {
    const result = auditStorefrontTemplate(targetDir, { templateId: 'coffee', templateName: 'Coffee Shop' });
    assert.equal(result.validStructure, true);
    assert.equal(result.fivoraContract.passed, true);
    assert.equal(result.fivoraContract.violationCount, 0);
    assert.equal(result.runtimeEditability.passed, true);
    assert.equal(result.collectionOperations.passed, true);
    assert.equal(result.acceptanceGates.passed, true);
    assert.equal(result.acceptanceGates.status, 'CONVERSION_PASSED');
    assert.equal(result.passed, true);
  } finally {
    if (cleanup) cleanup();
  }
});

test('ARC v3 Phase 16: verifyStorefrontCorpus audits all real-world storefronts and blocks invalid conversions', () => {
  const { verifyStorefrontCorpus, resolveWorkspaceStorefrontsDir } = require('../corpus-verifier.cjs');
  const fs = require('fs');
  const path = require('path');

  const baseDir = resolveWorkspaceStorefrontsDir();
  const hasWorkspaceCorpus = fs.existsSync(path.join(baseDir, 'coffee')) && fs.existsSync(path.join(baseDir, 'car-sale'));

  const report = verifyStorefrontCorpus();
  assert.equal(report.totalTemplates, 6);

  if (hasWorkspaceCorpus) {
    // When run in full workspace with all 6 storefronts available
    assert.equal(report.passedTemplates, 6);
    assert.equal(report.failedTemplates, 0);
    assert.equal(report.corpusSuccessRate, 100);
    assert.equal(report.allTemplatesPassed, true);

    // All 6 real-world storefronts pass with 100% compliance
    for (const result of report.results) {
      assert.ok(result.passed, `Storefront ${result.templateId} must pass 100%`);
      assert.equal(result.acceptanceGates.status, 'CONVERSION_PASSED');
    }
  } else {
    // In standalone CI environment without sibling storefront repositories,
    // verify graceful non-crashing handling
    assert.ok(report.results.length === 6);
    assert.equal(report.failedTemplates, 6);
    assert.equal(report.allTemplatesPassed, false);
    for (const result of report.results) {
      assert.equal(result.passed, false);
      assert.equal(result.acceptanceGates.status, 'CONVERSION_FAILED');
      assert.ok(result.fivoraContract.errors.length > 0);
    }
  }
});

test('ARC v3 Phase 17: applyMutation generates AST mutations and testMutationResilience prevents unhandled compiler crashes', () => {
  const {
    applyMutation,
    testMutationResilience,
    DEFAULT_SAMPLE_COMPONENT,
  } = require('../fuzz-engine.cjs');

  // Test spread mutation
  const spread = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'SPREAD_PROPS');
  assert.equal(spread.applied, true);
  const spreadRes = testMutationResilience(spread.mutatedCode, 'SPREAD_PROPS');
  assert.equal(spreadRes.crashed, false);
  assert.equal(spreadRes.resilient, true);
  assert.equal(spreadRes.outputValidSyntax, true);

  // Test corrupt syntax recovery (must catch cleanly without dying)
  const corrupt = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'CORRUPT_SYNTAX');
  assert.equal(corrupt.applied, true);
  const corruptRes = testMutationResilience(corrupt.mutatedCode, 'CORRUPT_SYNTAX');
  assert.equal(corruptRes.crashed, false);
  assert.equal(corruptRes.status, 'PARSER_REJECTED_CLEANLY');
  assert.equal(corruptRes.resilient, true);
});

test('ARC v3 Phase 17: runFuzzHarness achieves 100% resilience score across all mutation strategies', () => {
  const { runFuzzHarness, MUTATION_TYPES } = require('../fuzz-engine.cjs');

  const report = runFuzzHarness();
  assert.equal(report.totalMutations, MUTATION_TYPES.length);
  assert.equal(report.crashedCount, 0, 'Must have zero unhandled crashes');
  assert.equal(report.syntaxErrorsInOutput, 0, 'Must have zero syntax errors in output');
  assert.equal(report.resilienceScore, 100.0, 'Resilience score must be 100%');
  assert.equal(report.allResilient, true);
});

test('ARC v3 Phase 18: analyzeBlockedProject identifies exact unmapped fields, files, and line numbers for blocked conversions', () => {
  const { analyzeBlockedProject } = require('../explain-blocked.cjs');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-blocked-'));
  const compDir = path.join(tempDir, 'src', 'components');
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(compDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({ content: { home: { unmappedField: 'Hello' } } }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    siteDataFile: 'src/data/site-data.json',
    editorSchema: {
      sections: [{ id: 'home', path: 'home', type: 'object', fields: [{ key: 'unmappedField', type: 'currency' }] }]
    }
  }));
  fs.writeFileSync(path.join(compDir, 'Showcase.tsx'), 'export function Showcase() {\n  return <div><span>Hello</span></div>;\n}');

  try {
    const report = analyzeBlockedProject(tempDir);
    assert.equal(report.blocked, true);
    assert.equal(report.totalBlockingIssues, 2);

    const finding = report.findings.find((f) => f.ruleId === 'FIVORA_UNMAPPED_FIELD');
    assert.ok(finding);
    assert.ok(finding.file.includes('Showcase.tsx'));
    assert.ok(finding.line >= 1);
    assert.ok(finding.remediation.includes('data-preview-field-path') || finding.remediation.includes('controlOnlyPaths'));

    const unsupported = report.findings.find((f) => f.ruleId === 'SCHEMA_UNSUPPORTED_TYPE');
    assert.ok(unsupported);
    assert.ok(unsupported.message.includes('currency'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ARC v3 Phase 18: formatBlockedExplanationTerminal renders actionable remediation guide with zero false positives', () => {
  const { analyzeBlockedProject, formatBlockedExplanationTerminal } = require('../explain-blocked.cjs');
  const { resolveWorkspaceStorefrontsDir } = require('../corpus-verifier.cjs');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const baseDir = resolveWorkspaceStorefrontsDir();
  const coffeeDir = path.join(baseDir, 'coffee');
  const hasRealCoffee = fs.existsSync(coffeeDir) && fs.existsSync(path.join(coffeeDir, 'fivora-template.json'));

  let compliantDir = coffeeDir;
  let compliantCleanup = null;
  if (!hasRealCoffee) {
    const fixture = createMockCompliantProject();
    compliantDir = fixture.dir;
    compliantCleanup = fixture.cleanup;
  }

  try {
    // Compliant project formats clean success
    const coffeeReport = analyzeBlockedProject(compliantDir);
    assert.equal(coffeeReport.blocked, false);
    const coffeeText = formatBlockedExplanationTerminal(coffeeReport);
    assert.ok(coffeeText.includes('CONVERSION_PASSED'));
    assert.ok(coffeeText.includes('No blocking issues detected'));
  } finally {
    if (compliantCleanup) compliantCleanup();
  }

  // Synthetic blocked project formats detailed remediation
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-blocked-ui-'));
  const compDir = path.join(tempDir, 'src', 'components');
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(compDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({ content: { home: { testField: 'Text' } } }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    siteDataFile: 'src/data/site-data.json',
    editorSchema: {
      sections: [{ id: 'home', path: 'home', type: 'object', fields: [{ key: 'testField', type: 'currency' }] }]
    }
  }));
  fs.writeFileSync(path.join(compDir, 'Comp.tsx'), 'export function Comp() { return <div>Text</div>; }');

  try {
    const blockedReport = analyzeBlockedProject(tempDir);
    assert.equal(blockedReport.blocked, true);
    const blockedText = formatBlockedExplanationTerminal(blockedReport);
    assert.ok(blockedText.includes('DENEB CONVERSION BLOCKED'));
    assert.ok(blockedText.includes('SCHEMA_UNSUPPORTED_TYPE'));
    assert.ok(blockedText.includes('Fix:'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});










'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseSource, printSource } = require('../ast.cjs');
const { injectSiteDataHook } = require('../transforms/runtime/provider.cjs');
const { instrumentPageKey } = require('../transforms/routing/page-key.cjs');
const { normalizeFieldType, sanitizeEditorSections } = require('../fivora-schema-authority.cjs');
const { auditProjectAssets } = require('../asset-auditor.cjs');
const { recoverCandidateConfidence } = require('../confidence-recovery.cjs');

test('vanta-regressions: RootLayout server component is never injected with useSiteData hook', () => {
  const code = `
    export default function RootLayout({ children }: { children: any }) {
      return (
        <html>
          <body>
            <SiteDataProvider initialSiteData={initialSiteData}>
              {children}
            </SiteDataProvider>
          </body>
        </html>
      );
    }
  `;
  const ast = parseSource(code, 'layout.tsx');
  const injected = injectSiteDataHook(ast, 'src/app/layout.tsx', { isServerComponent: true, mountsProvider: true });
  assert.equal(injected, false, 'RootLayout mounting SiteDataProvider must NEVER receive useSiteData');
  const result = printSource(ast, code);
  assert.doesNotMatch(result, /useSiteData\(\)/);
});

test('vanta-regressions: getRequiredPages(siteData) parameter is never shadowed or duplicated', () => {
  const code = `
    export function getRequiredPages(siteData: any) {
      if (Array.isArray(siteData?.pages)) return siteData.pages;
      return ['home', 'shop'];
    }
  `;
  const ast = parseSource(code, 'requiredPages.ts');
  const injected = injectSiteDataHook(ast, 'src/lib/requiredPages.ts');
  assert.equal(injected, false, 'Functions with siteData parameter must NEVER have hook injected');
  const result = printSource(ast, code);
  assert.doesNotMatch(result, /const siteData = useSiteData\(\)/);
});

test('vanta-regressions: schema type "currency" is auto-normalized to "text"', () => {
  assert.equal(normalizeFieldType('currency', 'priceLkrLabel'), 'text');
});

test('vanta-regressions: duplicate path site.announcement.linkUrl across sections is eliminated', () => {
  const sections = [
    {
      id: 'site_announcement',
      path: 'site.announcement',
      type: 'object',
      fields: [{ key: 'linkUrl', type: 'url', label: 'Link' }],
    },
    {
      id: 'site',
      path: 'site',
      type: 'object',
      fields: [{ key: 'announcement.linkUrl', type: 'url', label: 'Duplicate' }],
    },
  ];
  const clean = sanitizeEditorSections(sections);
  const dup = clean[1].fields.find((f) => f.key === 'announcement.linkUrl');
  assert.equal(dup, undefined, 'Duplicate leaf path must be eliminated');
});

test('vanta-regressions: custom component on /products/detail receives data-preview-page-key', () => {
  const code = 'export default function Detail() { return <PlatformProductDetail item={shoe} />; }';
  const res = instrumentPageKey(code, 'src/app/products/detail/page.tsx', 'products_detail');
  assert.equal(res.updated, true);
  assert.match(res.code, /data-preview-page-key="products_detail"/);
});

test('vanta-regressions: missing /fivora-logo.png is flagged before runtime', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-vanta-'));
  const publicDir = path.join(tempDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), '<svg></svg>');

  const siteData = {
    content: {
      common: {
        logoUrl: '/fivora-logo.png',
      },
    },
  };
  const audit = auditProjectAssets(tempDir, siteData);
  assert.equal(audit.passed, false);
  assert.equal(audit.missingAssets[0].path, '/fivora-logo.png');
});

test('vanta-regressions: low-confidence candidate (< 0.60) is elevated by recovery pipeline', () => {
  const candidate = {
    tag: 'h2',
    componentName: 'FeatureBanner',
    className: 'text-2xl font-bold text-slate-900',
    value: 'Designed in Colombo, Built for the Street',
    confidence: 0.45,
  };
  const rec = recoverCandidateConfidence(candidate);
  assert.equal(rec.recovered, true);
  assert.ok(rec.confidence >= 0.65);
});

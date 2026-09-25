'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { instrumentPageKey } = require('../transforms/routing/page-key.cjs');
const { auditProjectAssets } = require('../asset-auditor.cjs');

test('routing-and-assets: instrumentPageKey stamps custom root components like PlatformProductDetail', () => {
  const code = `
    export default function ProductDetailPage() {
      return <PlatformProductDetail initialProduct={product} />;
    }
  `;
  const result = instrumentPageKey(code, 'src/app/products/detail/page.tsx', 'products_detail');
  assert.equal(result.updated, true);
  assert.match(result.code, /<PlatformProductDetail\s+data-preview-page-key="products_detail"/);
});

test('routing-and-assets: instrumentPageKey updates mismatched existing page key to canonical route id', () => {
  const code = `
    export default function VantaPage() {
      return <main data-preview-page-key="products"><h1>Vanta Aero</h1></main>;
    }
  `;
  const result = instrumentPageKey(code, 'src/app/products/vanta-aero-x/page.tsx', 'products_vanta-aero-x');
  assert.equal(result.updated, true);
  assert.match(result.code, /data-preview-page-key="products_vanta-aero-x"/);
});

test('routing-and-assets: auditProjectAssets reports missing assets against public directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-assets-'));
  const publicDir = path.join(tempDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), '<svg></svg>');

  const siteData = {
    content: {
      common: {
        logoUrl: '/logo.svg',
        brokenLogo: '/fivora-logo.png',
      },
    },
  };

  const audit = auditProjectAssets(tempDir, siteData);
  assert.equal(audit.passed, false);
  assert.equal(audit.missingAssets.length, 1);
  assert.equal(audit.missingAssets[0].path, '/fivora-logo.png');
  assert.equal(audit.verifiedAssets.length, 1);
  assert.equal(audit.verifiedAssets[0].path, '/logo.svg');
});

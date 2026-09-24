'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  KNOWN_STOREFRONTS,
  resolveWorkspaceStorefrontsDir,
  auditStorefrontTemplate,
  verifyStorefrontCorpus,
} = require('../corpus-verifier.cjs');

function createMockCompliantProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-corpus-compliant-'));
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

function createMockBlockedProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-corpus-blocked-'));
  const appDir = path.join(tempDir, 'src', 'app');
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'blocked-sample', dependencies: { next: '15.0.0' } }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    version: 2,
    arcVersion: '2.1.0',
    schemaVersion: 2,
    siteDataFile: 'src/data/site-data.json',
    pages: [{ id: 'home', label: 'Home', route: '/', required: true }],
    editorSchema: {
      sections: [
        { id: 'home', path: 'home', type: 'object', fields: [{ key: 'unmappedField', type: 'currency' }] }
      ]
    }
  }));
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({
    content: { home: { unmappedField: 'Hello' } }
  }));
  fs.writeFileSync(path.join(appDir, 'page.tsx'), 'export default function Page() { return <div>No Marker</div>; }');

  return {
    dir: tempDir,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

test('Corpus Verifier: audits storefront and verifies 100% pass across all 12 gates', () => {
  const baseDir = resolveWorkspaceStorefrontsDir();
  const coffeeDir = path.join(baseDir, 'coffee');
  const hasRealCoffee = fs.existsSync(coffeeDir) && fs.existsSync(path.join(coffeeDir, 'fivora-template.json'));

  let targetDir = coffeeDir;
  let cleanup = null;
  if (!hasRealCoffee) {
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

test('Corpus Verifier: blocks conversions with contract violations and refuses false success', () => {
  const fixture = createMockBlockedProject();
  try {
    const result = auditStorefrontTemplate(fixture.dir, { templateId: 'blocked', templateName: 'Blocked Template' });
    assert.equal(result.fivoraContract.passed, false);
    assert.ok(result.fivoraContract.violationCount > 0);
    assert.equal(result.acceptanceGates.status, 'CONVERSION_FAILED');
    assert.equal(result.passed, false);
  } finally {
    fixture.cleanup();
  }
});

test('Corpus Verifier: executes corpus verification across all known storefronts', () => {
  const baseDir = resolveWorkspaceStorefrontsDir();
  const hasWorkspaceCorpus = fs.existsSync(path.join(baseDir, 'coffee')) && fs.existsSync(path.join(baseDir, 'car-sale'));

  const report = verifyStorefrontCorpus();
  assert.equal(report.totalTemplates, 6);

  if (hasWorkspaceCorpus) {
    assert.equal(report.passedTemplates, 6);
    assert.equal(report.failedTemplates, 0);
    assert.equal(report.corpusSuccessRate, 100);
    assert.equal(report.allTemplatesPassed, true);
  } else {
    assert.ok(report.results.length === 6);
    assert.equal(report.failedTemplates, 6);
    assert.equal(report.allTemplatesPassed, false);
  }
});

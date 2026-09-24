'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  analyzeBlockedProject,
  formatBlockedExplanationTerminal,
} = require('../explain-blocked.cjs');
const { resolveWorkspaceStorefrontsDir } = require('../corpus-verifier.cjs');

function createMockCompliantProject() {
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

test('Explain Blocked: identifies clean status for compliant storefront (coffee)', () => {
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
    const report = analyzeBlockedProject(compliantDir);
    assert.equal(report.blocked, false);
    assert.equal(report.totalBlockingIssues, 0);
    assert.equal(report.findings.length, 0);
    assert.equal(report.summary.contractPassed, true);
  } finally {
    if (compliantCleanup) compliantCleanup();
  }
});

test('Explain Blocked: pinpoints exact unmapped field paths and locations for blocked storefront', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-explain-unmapped-'));
  const compDir = path.join(tempDir, 'src', 'components');
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(compDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({
    content: {
      home: {
        missingField: 'Unmapped Content',
      },
    },
  }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    siteDataFile: 'src/data/site-data.json',
    editorSchema: {
      sections: [{ id: 'home', path: 'home', type: 'object', fields: [{ key: 'missingField', type: 'text' }] }],
    },
  }));
  fs.writeFileSync(path.join(compDir, 'Showcase.tsx'), 'export function Showcase() {\n  return <div><span>No Marker</span></div>;\n}');

  try {
    const report = analyzeBlockedProject(tempDir);
    assert.equal(report.blocked, true);
    assert.equal(report.totalBlockingIssues, 1);
    assert.equal(report.summary.contractPassed, false);

    const first = report.findings[0];
    assert.equal(first.ruleId, 'FIVORA_UNMAPPED_FIELD');
    assert.ok(first.file.includes('Showcase.tsx'));
    assert.ok(first.line >= 1);
    assert.ok(first.remediation.includes('data-preview-field-path') || first.remediation.includes('controlOnlyPaths'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Explain Blocked: identifies unsupported schema type and duplicate sections for blocked storefront', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-explain-schema-'));
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({ content: {} }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    siteDataFile: 'src/data/site-data.json',
    editorSchema: {
      sections: [
        {
          id: 'shop',
          path: 'shop',
          type: 'object',
          fields: [
            { key: 'price', type: 'currency', label: 'Price' },
            { key: 'dup', type: 'text', label: 'Dup' },
          ],
        },
        {
          id: 'shop_dup',
          path: 'shop',
          type: 'object',
          fields: [
            { key: 'dup', type: 'text', label: 'Dup' },
          ],
        },
      ],
    },
  }));

  try {
    const report = analyzeBlockedProject(tempDir);
    assert.equal(report.blocked, true);
    assert.ok(report.totalBlockingIssues >= 2);

    const hasUnsupportedType = report.findings.some((f) => f.ruleId === 'SCHEMA_UNSUPPORTED_TYPE');
    assert.equal(hasUnsupportedType, true);

    const unsupported = report.findings.find((f) => f.ruleId === 'SCHEMA_UNSUPPORTED_TYPE');
    assert.ok(unsupported.message.includes('currency'));
    assert.ok(unsupported.remediation.includes('Replace type \'currency\' with \'number\' or \'text\''));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Explain Blocked: formats terminal UI with clear problem and fix descriptions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-explain-ui-'));
  const compDir = path.join(tempDir, 'src', 'components');
  const dataDir = path.join(tempDir, 'src', 'data');
  fs.mkdirSync(compDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify({
    content: { home: { testField: 'Hello' } },
  }));
  fs.writeFileSync(path.join(tempDir, 'fivora-template.json'), JSON.stringify({
    framework: 'nextjs-static-export',
    siteDataFile: 'src/data/site-data.json',
    editorSchema: {
      sections: [{ id: 'home', path: 'home', type: 'object', fields: [{ key: 'testField', type: 'text' }] }],
    },
  }));
  fs.writeFileSync(path.join(compDir, 'Comp.tsx'), 'export function Comp() { return <div>Unbound</div>; }');

  try {
    const report = analyzeBlockedProject(tempDir);
    const terminal = formatBlockedExplanationTerminal(report);

    assert.ok(terminal.includes('DENEB CONVERSION BLOCKED'));
    assert.ok(terminal.includes('Comp.tsx'));
    assert.ok(terminal.includes('Fix:'));
    assert.ok(terminal.includes('npx @deneb-ui/cli init'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

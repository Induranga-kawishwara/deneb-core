'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSource } = require('../ast.cjs');
const {
  SCOPE_STATUS,
  classifySiteDataRequirement,
} = require('../transforms/runtime/site-data-scope.cjs');
const { injectSiteDataHook } = require('../transforms/runtime/provider.cjs');

test('site-data-scope: classifies function with siteData parameter as PROP_BOUND', () => {
  const code = 'export function getRequiredPages(siteData: any) { return siteData.pages; }';
  const ast = parseSource(code, 'requiredPages.ts');
  const fn = ast.program.body[0].declaration;
  const status = classifySiteDataRequirement(fn, 'getRequiredPages', { filePath: 'src/lib/requiredPages.ts' });
  assert.equal(status, SCOPE_STATUS.PROP_BOUND);

  const injected = injectSiteDataHook(ast, 'src/lib/requiredPages.ts');
  assert.equal(injected, false, 'Should not inject hook when siteData is already a prop/param');
});

test('site-data-scope: classifies RootLayout mounting SiteDataProvider as PROVIDER_OWNER', () => {
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
  const fn = ast.program.body[0].declaration;
  const status = classifySiteDataRequirement(fn, 'RootLayout', {
    filePath: 'src/app/layout.tsx',
    mountsProvider: true,
    isServerComponent: true,
  });
  assert.equal(status, SCOPE_STATUS.PROVIDER_OWNER);

  const injected = injectSiteDataHook(ast, 'src/app/layout.tsx');
  assert.equal(injected, false, 'Should not inject hook into RootLayout or Provider owner');
});

test('site-data-scope: classifies async function as SERVER_BOUNDARY', () => {
  const code = `
    export default async function Page() {
      const data = await fetch('https://api.example.com');
      return <div>{siteData.title}</div>;
    }
  `;
  const ast = parseSource(code, 'page.tsx');
  const fn = ast.program.body[0].declaration;
  const status = classifySiteDataRequirement(fn, 'Page', { filePath: 'src/app/page.tsx', isServerComponent: true });
  assert.equal(status, SCOPE_STATUS.SERVER_BOUNDARY);

  const injected = injectSiteDataHook(ast, 'src/app/page.tsx', { isServerComponent: true });
  assert.equal(injected, false, 'Should not inject hook into async server component');
});

test('site-data-scope: classifies plain utility function without JSX as UTILITY_FUNCTION', () => {
  const code = `
    export function calculateTotal(items: any[]) {
      return items.reduce((acc, x) => acc + x.price, 0);
    }
  `;
  const ast = parseSource(code, 'utils.ts');
  const fn = ast.program.body[0].declaration;
  const status = classifySiteDataRequirement(fn, 'calculateTotal', { filePath: 'src/lib/utils.ts' });
  assert.equal(status, SCOPE_STATUS.UTILITY_FUNCTION);

  const injected = injectSiteDataHook(ast, 'src/lib/utils.ts');
  assert.equal(injected, false, 'Should not inject hook into utility functions');
});

test('site-data-scope: classifies React component referencing siteData as HOOK_SAFE', () => {
  const code = `
    export function HeroBanner() {
      return <h1>{siteData.home.heroTitle}</h1>;
    }
  `;
  const ast = parseSource(code, 'HeroBanner.tsx');
  const fn = ast.program.body[0].declaration;
  const status = classifySiteDataRequirement(fn, 'HeroBanner', { filePath: 'src/components/HeroBanner.tsx', isClientComponent: true });
  assert.equal(status, SCOPE_STATUS.HOOK_SAFE);

  const injected = injectSiteDataHook(ast, 'src/components/HeroBanner.tsx', { isClientComponent: true });
  assert.equal(injected, true, 'Should safely inject hook into valid UI component');
});

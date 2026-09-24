'use strict';

const recast = require('recast');
const {
  parseSource,
  printSource,
  getJsxName,
  hasJsxAttribute,
  ensureImport,
  ensureDefaultImport,
  sanitizeDuplicateBindings,
  b,
} = require('../../ast.cjs');

function ensureHtmlBodyHydration(ast) {
  recast.types.visit(ast, {
    visitJSXOpeningElement(pathNode) {
      const name = pathNode.node.name;
      const tag = name && name.type === 'JSXIdentifier' ? name.name : '';
      if (tag === 'html' || tag === 'body') {
        const has = (pathNode.node.attributes || []).some(
          (attr) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'suppressHydrationWarning',
        );
        if (!has) {
          pathNode.node.attributes.push(b.jsxAttribute(b.jsxIdentifier('suppressHydrationWarning')));
        }
      }
      this.traverse(pathNode);
    },
  });
}

function findSiteDataJsonLocalName(ast) {
  const program = ast.program || ast;
  for (const node of program.body || []) {
    if (node.type !== 'ImportDeclaration') continue;
    const src = node.source && node.source.value;
    if (typeof src !== 'string' || !/site-data\.json/.test(src)) continue;
    const spec = (node.specifiers || []).find((s) => s.type === 'ImportDefaultSpecifier');
    if (spec && spec.local) return spec.local.name;
  }
  return null;
}

function ensureProviderInitialData(ast, ident) {
  let added = false;
  recast.types.visit(ast, {
    visitJSXOpeningElement(pathNode) {
      const name = pathNode.node.name;
      const tag = name && name.type === 'JSXIdentifier' ? name.name : '';
      if (tag === 'SiteDataProvider' || tag === 'DenebDataProvider' || tag === 'DenebSiteDataProvider') {
        const has = hasJsxAttribute(pathNode.node, 'initialSiteData');
        if (!has) {
          pathNode.node.attributes = pathNode.node.attributes || [];
          pathNode.node.attributes.push(
            b.jsxAttribute(
              b.jsxIdentifier('initialSiteData'),
              b.jsxExpressionContainer(b.identifier(ident))
            )
          );
          added = true;
        }
      }
      this.traverse(pathNode);
    },
  });
  return added;
}

function injectDualModeTheme(ast, jsonIdent, providerImport = '@deneb-ui/ui') {
  if (!ast) return;
  let hasThemeStyles = false;
  let hasThemeToggle = false;
  recast.types.visit(ast, {
    visitJSXIdentifier(pathNode) {
      if (pathNode.node.name === 'ThemeStyles') hasThemeStyles = true;
      if (pathNode.node.name === 'ThemeToggle') hasThemeToggle = true;
      this.traverse(pathNode);
    },
  });

  const importsToAdd = [];
  if (!hasThemeStyles) importsToAdd.push('ThemeStyles');
  if (!hasThemeToggle) importsToAdd.push('ThemeToggle');
  if (importsToAdd.length === 0) return;

  if (!hasThemeStyles) {
    let stylesInjected = false;
    const snippet = parseSource(
      `<ThemeStyles theme={${jsonIdent}?.template?.structure?.theme || ${jsonIdent}?.theme} enableDualMode />`,
      'snippet.tsx'
    );
    const stylesEl = snippet.program.body[0].expression;

    // Try <head> first
    recast.types.visit(ast, {
      visitJSXElement(pathNode) {
        if (stylesInjected) return false;
        const name = getJsxName(pathNode.node);
        if (name === 'head' || name === 'Head') {
          pathNode.node.children = [b.jsxText('\n        '), stylesEl, ...(pathNode.node.children || [])];
          stylesInjected = true;
          return false;
        }
        this.traverse(pathNode);
      },
    });

    // If no <head>, inject inside SiteDataProvider or <body>
    if (!stylesInjected) {
      recast.types.visit(ast, {
        visitJSXElement(pathNode) {
          if (stylesInjected) return false;
          const name = getJsxName(pathNode.node);
          if (name === 'SiteDataProvider' || name === 'body') {
            pathNode.node.children = [b.jsxText('\n        '), stylesEl, ...(pathNode.node.children || [])];
            stylesInjected = true;
            return false;
          }
          this.traverse(pathNode);
        },
      });
    }
  }

  if (!hasThemeToggle) {
    let toggleInjected = false;
    const snippet = parseSource(
      '<ThemeToggle showLabel className="fixed bottom-6 left-6 z-40" />',
      'snippet.tsx'
    );
    const toggleEl = snippet.program.body[0].expression;

    recast.types.visit(ast, {
      visitJSXElement(pathNode) {
        if (toggleInjected) return false;
        const name = getJsxName(pathNode.node);
        if (name === 'SiteDataProvider' || name === 'body') {
          pathNode.node.children = [...(pathNode.node.children || []), b.jsxText('\n        '), toggleEl];
          toggleInjected = true;
          return false;
        }
        this.traverse(pathNode);
      },
    });
  }

  ensureImport(ast, providerImport || '@deneb-ui/ui', importsToAdd);
}

function injectPlatformAdditionalPages(ast, providerImport) {
  if (!ast) return;
  let alreadyPresent = false;
  recast.types.visit(ast, {
    visitJSXIdentifier(pathNode) {
      if (pathNode.node.name === 'PlatformAdditionalPages') {
        alreadyPresent = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  if (alreadyPresent) return;

  let injected = false;
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      if (injected) return false;
      const name = getJsxName(pathNode.node);
      if (name === 'main') {
        const parent = pathNode.parent;
        if (!parent || !Array.isArray(parent.node.children)) {
          this.traverse(pathNode);
          return;
        }
        const siblings = parent.node.children;
        const idx = siblings.indexOf(pathNode.node);
        if (idx === -1) {
          this.traverse(pathNode);
          return;
        }
        const platformElement = b.jsxElement(
          b.jsxOpeningElement(
            b.jsxIdentifier('PlatformAdditionalPages'),
            [],
            true
          ),
          null,
          [],
          true
        );
        const newline = b.jsxText('\n            ');
        siblings.splice(idx + 1, 0, newline, platformElement);
        ensureImport(ast, providerImport || '@deneb-ui/ui', ['PlatformAdditionalPages']);
        injected = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
}

function instrumentLayoutSource(code, siteDataImport, providerImport = '@deneb-ui/ui') {
  const ast = parseSource(code, 'layout.tsx');
  ensureHtmlBodyHydration(ast);

  let jsonIdent = findSiteDataJsonLocalName(ast);
  if (!jsonIdent) {
    jsonIdent = 'initialSiteData';
    ensureDefaultImport(ast, siteDataImport, jsonIdent);
  }

  const hasProvider = /SiteDataProvider|DenebDataProvider|<Providers\b/.test(code);
  let wrapped = hasProvider;

  if (!hasProvider) {
    ensureImport(ast, providerImport, ['SiteDataProvider']);
    recast.types.visit(ast, {
      visitJSXExpressionContainer(pathNode) {
        if (wrapped) return false;
        const expr = pathNode.node.expression;
        if (expr && expr.type === 'Identifier' && expr.name === 'children') {
          pathNode.replace(
            b.jsxElement(
              b.jsxOpeningElement(
                b.jsxIdentifier('SiteDataProvider'),
                [
                  b.jsxAttribute(
                    b.jsxIdentifier('initialSiteData'),
                    b.jsxExpressionContainer(b.identifier(jsonIdent))
                  ),
                ],
                false
              ),
              b.jsxClosingElement(b.jsxIdentifier('SiteDataProvider')),
              [pathNode.node],
              false
            )
          );
          wrapped = true;
          return false;
        }
        this.traverse(pathNode);
      },
    });

    if (!wrapped) {
      recast.types.visit(ast, {
        visitJSXElement(pathNode) {
          if (wrapped) return false;
          const name = getJsxName(pathNode.node);
          if (name === 'Component') {
            pathNode.replace(
              b.jsxElement(
                b.jsxOpeningElement(
                  b.jsxIdentifier('SiteDataProvider'),
                  [
                    b.jsxAttribute(
                      b.jsxIdentifier('initialSiteData'),
                      b.jsxExpressionContainer(b.identifier(jsonIdent))
                    ),
                  ],
                  false
                ),
                b.jsxClosingElement(b.jsxIdentifier('SiteDataProvider')),
                [pathNode.node],
                false
              )
            );
            wrapped = true;
            return false;
          }
          this.traverse(pathNode);
        },
      });
    }
  }

  ensureProviderInitialData(ast, jsonIdent);
  injectPlatformAdditionalPages(ast, providerImport);
  injectDualModeTheme(ast, jsonIdent, providerImport);
  sanitizeDuplicateBindings(ast);
  const next = printSource(ast, code);
  return { code: next, updated: next !== code };
}

module.exports = {
  instrumentLayoutSource,
  ensureHtmlBodyHydration,
  findSiteDataJsonLocalName,
  ensureProviderInitialData,
  injectDualModeTheme,
  injectPlatformAdditionalPages,
};

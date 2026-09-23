'use strict';

const recast = require('recast');
const b = recast.types.builders;

/**
 * RSC (React Server Components) Boundary Intelligence for Next.js App Router.
 * Ensures proper placement of 'use client' directives and prevents metadata export conflicts.
 */

/**
 * Detects if the AST exports 'metadata' or 'generateMetadata'.
 * In Next.js App Router, Client Components ('use client') CANNOT export metadata.
 */
function hasMetadataExport(ast) {
  let hasMetadata = false;

  recast.types.visit(ast, {
    visitExportNamedDeclaration(pathNode) {
      const decl = pathNode.node.declaration;
      if (decl) {
        // export const metadata = { ... }
        if (decl.type === 'VariableDeclaration') {
          for (const declarator of decl.declarations || []) {
            const name = declarator.id?.name;
            if (name === 'metadata' || name === 'generateMetadata') {
              hasMetadata = true;
              return false;
            }
          }
        }
        // export async function generateMetadata(...) { ... }
        if (decl.type === 'FunctionDeclaration') {
          if (decl.id?.name === 'generateMetadata' || decl.id?.name === 'metadata') {
            hasMetadata = true;
            return false;
          }
        }
      }

      // export { metadata, generateMetadata }
      for (const specifier of pathNode.node.specifiers || []) {
        const exportedName = specifier.exported?.name;
        if (exportedName === 'metadata' || exportedName === 'generateMetadata') {
          hasMetadata = true;
          return false;
        }
      }

      this.traverse(pathNode);
    },
  });

  return hasMetadata;
}

/**
 * Detects if the AST has a 'use client' directive.
 */
function hasClientDirective(ast) {
  if (!ast || !ast.program) return false;

  // Directives in Babel / recast AST
  if (Array.isArray(ast.program.directives)) {
    for (const d of ast.program.directives) {
      const val = d.value?.value || d.value;
      if (val === 'use client') return true;
    }
  }

  // Also check top-level expression statement: "use client";
  const body = ast.program.body || [];
  if (body.length > 0) {
    const first = body[0];
    if (first.type === 'ExpressionStatement') {
      const expr = first.expression;
      if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) {
        if (expr.value === 'use client') return true;
      }
    }
  }

  return false;
}

/**
 * Detects if a component needs 'use client' because it uses React client hooks,
 * event handlers, browser APIs, or client-only libraries.
 */
function needsClientDirective(ast, code = '') {
  if (hasClientDirective(ast)) return true;

  const clientHookRegex = /\buse(?:State|Effect|Context|Reducer|Ref|ImperativeHandle|LayoutEffect|InsertionEffect|Transition|DeferredValue|Id|Router|Pathname|SearchParams|SiteData)\b/;
  if (clientHookRegex.test(code)) return true;

  const eventHandlerRegex = /\bon(?:Click|Submit|Change|KeyDown|KeyUp|KeyPress|MouseDown|MouseUp|MouseEnter|MouseLeave|Focus|Blur|Scroll|TouchStart|TouchEnd)\s*=/;
  if (eventHandlerRegex.test(code)) return true;

  if (/\b(?:window\.|document\.|localStorage\.|sessionStorage\.)/.test(code)) return true;

  return false;
}

/**
 * Determines whether 'use client' can be safely injected into the file.
 * Returns false if:
 * 1. File exports metadata or generateMetadata.
 * 2. File is a layout with metadata.
 */
function canSafelyInjectClientDirective(ast, relativeFile = '', profile = {}) {
  const isAppRouter = profile.router === 'next-app' || (profile.appDir && relativeFile.startsWith(profile.appDir));
  if (!isAppRouter) {
    return true;
  }

  if (hasMetadataExport(ast)) {
    return false;
  }

  return true;
}

/**
 * Injects 'use client' directive at the top of the AST program.
 * Idempotent: does nothing if already present.
 */
function ensureClientDirective(ast) {
  if (!ast || !ast.program) return false;
  if (hasClientDirective(ast)) return false;

  const expr = b.expressionStatement(b.stringLiteral('use client'));
  if (Array.isArray(ast.program.body)) {
    ast.program.body.unshift(expr);
  }

  const directiveNode = b.directive
    ? b.directive(b.directiveLiteral('use client'))
    : expr;
  if (Array.isArray(ast.program.directives)) {
    ast.program.directives.unshift(directiveNode);
  } else {
    ast.program.directives = [directiveNode];
  }

  return true;
}

module.exports = {
  hasMetadataExport,
  hasClientDirective,
  needsClientDirective,
  canSafelyInjectClientDirective,
  ensureClientDirective,
};

'use strict';

const recast = require('recast');
const {
  parseSource,
  printSource,
  getJsxName,
  b,
} = require('../../ast.cjs');
const { toPosix } = require('../../fs-utils.cjs');

function inferPageKey(relativeFile) {
  const posix = toPosix(relativeFile);
  if (/(^|\/)page\.(tsx|jsx|js)$/.test(posix)) {
    const parts = posix.split('/');
    const idx = parts.lastIndexOf('app');
    const segs = parts.slice(idx + 1, -1).filter((s) => !(s.startsWith('(') && s.endsWith(')')));
    if (!segs.length) return 'home';
    return segs.join('_').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }
  return 'home';
}

/**
 * Stamps a route's page component with data-preview-page-key. Fivora requires
 * exactly one per exported route, so the key comes from the scanned route id
 * rather than being guessed from the filename — Pages Router uses
 * `pages/contact.jsx`, App Router uses `app/contact/page.tsx`.
 *
 * `<main>` is preferred, but any project shape is supported by falling back to
 * the outermost element the page component returns.
 */
function instrumentPageKey(code, relativeFile, pageKey) {
  if (code.includes('data-preview-page-key')) return { code, updated: false };
  const key = pageKey || inferPageKey(relativeFile);

  let ast;
  try {
    ast = parseSource(code, relativeFile);
  } catch {
    return { code, updated: false };
  }

  const attribute = () =>
    b.jsxAttribute(b.jsxIdentifier('data-preview-page-key'), b.stringLiteral(key));

  let target = null;
  recast.types.visit(ast, {
    visitJSXOpeningElement(pathNode) {
      const name = pathNode.node.name && pathNode.node.name.name;
      if (!target && name === 'main') {
        target = pathNode.node;
        return false;
      }
      this.traverse(pathNode);
    },
  });

  if (!target) {
    // No <main>: use the first host element of the returned tree so the marker
    // still lands inside this route's exported HTML.
    recast.types.visit(ast, {
      visitJSXElement(pathNode) {
        if (target) return false;
        const name = getJsxName(pathNode.node);
        if (typeof name === 'string' && /^[a-z]/.test(name)) {
          target = pathNode.node.openingElement;
          return false;
        }
        this.traverse(pathNode);
      },
    });
  }

  if (!target) return { code, updated: false };
  target.attributes = target.attributes || [];
  target.attributes.unshift(attribute());
  return { code: printSource(ast, code), updated: true };
}

module.exports = {
  instrumentPageKey,
  inferPageKey,
};

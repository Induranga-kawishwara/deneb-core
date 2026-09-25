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
 * <main> is preferred, then any host element (div/section), then any root component element.
 */
function instrumentPageKey(code, relativeFile, pageKey) {
  const key = pageKey || inferPageKey(relativeFile);

  let ast;
  try {
    ast = parseSource(code, relativeFile);
  } catch {
    return { code, updated: false };
  }

  let existingAttr = null;
  let target = null;
  let fallbackTarget = null;

  recast.types.visit(ast, {
    visitJSXOpeningElement(pathNode) {
      const attrs = pathNode.node.attributes || [];
      const pageKeyAttr = attrs.find(
        (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'data-preview-page-key'
      );
      if (pageKeyAttr) {
        existingAttr = pageKeyAttr;
        return false;
      }

      const name = pathNode.node.name && pathNode.node.name.name;
      if (!target && name === 'main') {
        target = pathNode.node;
      } else if (!fallbackTarget && typeof name === 'string' && /^[a-z]/.test(name)) {
        fallbackTarget = pathNode.node;
      } else if (!fallbackTarget) {
        // Root custom component (e.g. <PlatformProductDetail />)
        fallbackTarget = pathNode.node;
      }

      this.traverse(pathNode);
    },
  });

  // If already has data-preview-page-key, ensure its value matches the expected page key
  if (existingAttr) {
    let currentValue = null;
    if (existingAttr.value) {
      if (existingAttr.value.type === 'StringLiteral') {
        currentValue = existingAttr.value.value;
      } else if (existingAttr.value.type === 'JSXExpressionContainer' && existingAttr.value.expression.type === 'StringLiteral') {
        currentValue = existingAttr.value.expression.value;
      }
    }
    if (currentValue === key) {
      return { code, updated: false };
    }
    // Update to correct key
    existingAttr.value = b.stringLiteral(key);
    return { code: printSource(ast, code), updated: true };
  }

  const finalTarget = target || fallbackTarget;
  if (!finalTarget) return { code, updated: false };

  finalTarget.attributes = finalTarget.attributes || [];
  finalTarget.attributes.unshift(
    b.jsxAttribute(b.jsxIdentifier('data-preview-page-key'), b.stringLiteral(key))
  );

  return { code: printSource(ast, code), updated: true };
}

module.exports = {
  instrumentPageKey,
  inferPageKey,
};

'use strict';

const {
  siteDataBinding,
  wrapTextInEditableSpan,
  b,
} = require('../../ast.cjs');

function replaceTextChildren(node, fieldPath, fallback, fieldType) {
  const children = node.children || [];
  const hasDynamicExpr = children.some(
    (c) =>
      c &&
      c.type === 'JSXExpressionContainer' &&
      c.expression &&
      c.expression.type !== 'StringLiteral' &&
      c.expression.type !== 'Literal'
  );

  // If there are dynamic runtime expressions, preserve them and wrap the static literal text
  if (hasDynamicExpr) {
    wrapLiteralTextChildren(node, fieldPath, fallback);
    return;
  }

  const nextChildren = [];
  let replaced = false;
  for (const child of children) {
    if (!child) continue;
    if (child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
      nextChildren.push(b.jsxExpressionContainer(siteDataBinding(fieldPath.split('.'), fallback, fieldType)));
      replaced = true;
    } else if (
      child.type === 'JSXExpressionContainer' &&
      child.expression &&
      (child.expression.type === 'StringLiteral' ||
        child.expression.type === 'Literal' ||
        child.expression.type === 'Identifier')
    ) {
      nextChildren.push(b.jsxExpressionContainer(siteDataBinding(fieldPath.split('.'), fallback, fieldType)));
      replaced = true;
    } else {
      nextChildren.push(child);
    }
  }
  if (!replaced) {
    nextChildren.push(b.jsxExpressionContainer(siteDataBinding(fieldPath.split('.'), fallback, fieldType)));
  }
  node.children = nextChildren;
}

/**
 * Replaces literal text children with an editable <span>, leaving the container
 * element, icons, and dynamic expressions untouched.
 */
function wrapLiteralTextChildren(node, fieldPath, fallback) {
  const nextChildren = [];
  let wrapped = false;

  for (const child of node.children || []) {
    if (!child) continue;
    if (!wrapped && child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
      const leading = child.value.match(/^\s*/)?.[0] || '';
      const trailing = child.value.match(/\s*$/)?.[0] || '';
      if (leading) nextChildren.push(b.jsxText(leading));
      nextChildren.push(wrapTextInEditableSpan(fieldPath, fallback, 'text'));
      if (trailing) nextChildren.push(b.jsxText(trailing));
      wrapped = true;
      continue;
    }
    if (child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) continue;
    nextChildren.push(child);
  }

  if (wrapped) node.children = nextChildren;
}

module.exports = {
  replaceTextChildren,
  wrapLiteralTextChildren,
};

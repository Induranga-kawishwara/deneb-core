'use strict';

const {
  ensureStyleAttrs,
  siteDataBinding,
  b,
} = require('../../ast.cjs');
const { ensurePreviewPath } = require('../transform-context.cjs');

function bindButtonWithIcon(node, transform) {
  ensurePreviewPath(node, transform.field);
  ensureStyleAttrs(node, transform.field, 'button');
  for (let i = 0; i < (node.children || []).length; i++) {
    const child = node.children[i];
    if (child.type === 'JSXText' && child.value.trim().length > 0) {
      node.children[i] = b.jsxExpressionContainer(
        siteDataBinding(transform.field.split('.'), child.value.trim(), 'text')
      );
    }
  }
}

function bindHighlightedHeading(node, transform) {
  ensurePreviewPath(node, transform.field);
  ensureStyleAttrs(node, transform.field, 'text');
  for (let i = 0; i < (node.children || []).length; i++) {
    const child = node.children[i];
    if (child.type === 'JSXText' && child.value.trim().length > 0) {
      node.children[i] = b.jsxExpressionContainer(
        siteDataBinding(transform.field.split('.'), child.value.trim(), 'text')
      );
    } else if (child.type === 'JSXElement') {
      const highlightField = `${transform.field}Highlight`;
      ensurePreviewPath(child, highlightField);
      for (let j = 0; j < (child.children || []).length; j++) {
        if (child.children[j].type === 'JSXText' && child.children[j].value.trim().length > 0) {
          child.children[j] = b.jsxExpressionContainer(
            siteDataBinding(highlightField.split('.'), child.children[j].value.trim(), 'text')
          );
        }
      }
    }
  }
}

module.exports = {
  bindButtonWithIcon,
  bindHighlightedHeading,
};

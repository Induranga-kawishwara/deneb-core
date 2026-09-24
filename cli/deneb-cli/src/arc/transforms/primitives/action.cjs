'use strict';

const {
  getJsxName,
  hasJsxAttribute,
  jsxPreviewAttr,
  wrapTextInEditableSpan,
  ensureStyleAttrs,
  siteDataBinding,
  b,
} = require('../../ast.cjs');
const { ensurePreviewPath } = require('../transform-context.cjs');
const { replaceTextChildren } = require('./text.cjs');

function splitActionChildren(node, labelField, labelFallback) {
  const nextChildren = [];
  let wrapped = false;
  for (const child of node.children || []) {
    if (!child) continue;
    if (child.type === 'JSXElement' && getJsxName(child) === 'span' && !hasJsxAttribute(child, 'data-preview-field-path')) {
      ensurePreviewPath(child, labelField);
      ensureStyleAttrs(child, labelField, 'text');
      replaceTextChildren(child, labelField, labelFallback, 'text');
      nextChildren.push(child);
      wrapped = true;
    } else if (child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
      const leading = child.value.match(/^\s*/)?.[0] || '';
      const trailing = child.value.match(/\s*$/)?.[0] || '';
      if (leading) nextChildren.push(b.jsxText(leading));
      nextChildren.push(wrapTextInEditableSpan(labelField, labelFallback, 'text'));
      if (trailing && trailing !== leading) nextChildren.push(b.jsxText(trailing));
      wrapped = true;
    } else if (
      child.type === 'JSXExpressionContainer' &&
      child.expression &&
      (child.expression.type === 'StringLiteral' || child.expression.type === 'Literal')
    ) {
      nextChildren.push(wrapTextInEditableSpan(labelField, labelFallback, 'text'));
      wrapped = true;
    } else {
      nextChildren.push(child);
    }
  }
  if (!wrapped) {
    nextChildren.push(wrapTextInEditableSpan(labelField, labelFallback, 'text'));
  }
  node.children = nextChildren;
}

function wrapHiddenUrlSibling(pathNode, urlField, fallback) {
  const urlParts = urlField.split('.');
  const hiddenUrl = b.jsxElement(
    b.jsxOpeningElement(
      b.jsxIdentifier('span'),
      [
        b.jsxAttribute(b.jsxIdentifier('hidden')),
        b.jsxAttribute(b.jsxIdentifier('aria-hidden'), b.stringLiteral('true')),
        jsxPreviewAttr(urlField),
      ],
      false
    ),
    b.jsxClosingElement(b.jsxIdentifier('span')),
    [b.jsxExpressionContainer(siteDataBinding(urlParts, fallback, 'url'))],
    false
  );
  if (pathNode.parent && Array.isArray(pathNode.parent.node?.children)) {
    pathNode.insertAfter(hiddenUrl);
  } else if (pathNode.node && Array.isArray(pathNode.node.children)) {
    pathNode.node.children = [hiddenUrl, ...(pathNode.node.children || [])];
  }
}

module.exports = {
  splitActionChildren,
  wrapHiddenUrlSibling,
};

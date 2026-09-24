'use strict';

const {
  findJsxAttribute,
  siteDataBinding,
  b,
} = require('../../ast.cjs');
const { replaceAttrValue, ensurePreviewPath } = require('../transform-context.cjs');

function extractTailwindBg(node, transform) {
  const classAttr = findJsxAttribute(node, 'className') || findJsxAttribute(node, 'class');
  if (classAttr && classAttr.value) {
    if (classAttr.value.type === 'StringLiteral' || classAttr.value.type === 'Literal') {
      const cleaned = String(classAttr.value.value).replace(/\bbg-\[url\([^)]+\)\]\s*/g, '').trim();
      classAttr.value = b.stringLiteral(cleaned);
    }
  }
  const urlParts = transform.field.split('.');
  const styleExpr = b.objectExpression([
    b.property(
      'init',
      b.identifier('backgroundImage'),
      b.templateLiteral(
        [
          b.templateElement({ raw: 'url(', cooked: 'url(' }, false),
          b.templateElement({ raw: ')', cooked: ')' }, true),
        ],
        [siteDataBinding(urlParts, transform.fallback || transform.bgUrl || '', 'image')]
      )
    ),
  ]);
  replaceAttrValue(node, 'style', styleExpr);
  ensurePreviewPath(node, transform.field);
}

module.exports = {
  extractTailwindBg,
};

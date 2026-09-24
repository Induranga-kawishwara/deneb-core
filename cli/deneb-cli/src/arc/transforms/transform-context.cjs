'use strict';

const recast = require('recast');
const {
  locKey,
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  jsxPreviewAttr,
  b,
} = require('../ast.cjs');

function findElementByLoc(ast, loc, tagName = null) {
  if (!loc && !tagName) return null;
  const parts = loc ? loc.split(':') : [];
  const targetLoc = parts.length > 4 ? parts.slice(0, 4).join(':') : loc;
  let found = null;
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const k = locKey(pathNode.node);
      const name = getJsxName(pathNode.node);
      if (loc && (k === targetLoc || k === loc || (parts.length >= 2 && k && k.startsWith(`${parts[0]}:${parts[1]}`)))) {
        found = pathNode;
        return false;
      }
      if (!loc && tagName && (name === tagName || name.endsWith(`.${tagName}`))) {
        found = pathNode;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return found;
}

function replaceAttrValue(node, attrName, expression) {
  const attr = findJsxAttribute(node, attrName);
  if (!attr) {
    node.openingElement.attributes.push(
      b.jsxAttribute(b.jsxIdentifier(attrName), b.jsxExpressionContainer(expression))
    );
    return;
  }
  attr.value = b.jsxExpressionContainer(expression);
}

function stripStaticAttribute(node) {
  if (node && node.openingElement && Array.isArray(node.openingElement.attributes)) {
    node.openingElement.attributes = node.openingElement.attributes.filter(
      (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'data-preview-static')
    );
  }
}

function ensurePreviewPath(node, fieldPath) {
  stripStaticAttribute(node);
  if (hasJsxAttribute(node, 'data-preview-field-path')) return;
  node.openingElement.attributes.push(jsxPreviewAttr(fieldPath));
}

function findAncestorJsxElement(pathNode) {
  let current = pathNode.parent;
  while (current) {
    const candidate = current.node || current.value;
    if (candidate?.type === 'JSXElement') return candidate;
    current = current.parentPath || current.parent;
  }
  return null;
}

function inferButtonKind(tag) {
  if (tag === 'button' || tag === 'Button') return 'button';
  return 'text';
}

function isModuleLevel(pathNode) {
  let current = pathNode.parentPath || pathNode.parent;
  while (current) {
    const type = current.node?.type;
    if (
      type === 'FunctionDeclaration' ||
      type === 'FunctionExpression' ||
      type === 'ArrowFunctionExpression'
    ) {
      return false;
    }
    if (type === 'Program') return true;
    current = current.parentPath || current.parent;
  }
  return true;
}

function findEnclosingFunction(pathNode) {
  let current = pathNode.parentPath || pathNode.parent;
  while (current) {
    const type = current.node?.type;
    if (
      type === 'FunctionDeclaration' ||
      type === 'FunctionExpression' ||
      type === 'ArrowFunctionExpression'
    ) {
      return current;
    }
    current = current.parentPath || current.parent;
  }
  return null;
}

module.exports = {
  findElementByLoc,
  replaceAttrValue,
  stripStaticAttribute,
  ensurePreviewPath,
  findAncestorJsxElement,
  inferButtonKind,
  isModuleLevel,
  findEnclosingFunction,
};

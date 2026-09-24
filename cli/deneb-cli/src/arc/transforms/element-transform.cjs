'use strict';

const {
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  siteDataBinding,
  ensureStyleAttrs,
  b,
} = require('../ast.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('../fivora-contract.cjs');
const {
  replaceAttrValue,
  ensurePreviewPath,
  findAncestorJsxElement,
  inferButtonKind,
} = require('./transform-context.cjs');
const { replaceTextChildren, wrapLiteralTextChildren } = require('./primitives/text.cjs');
const { splitActionChildren } = require('./primitives/action.cjs');
const { bindButtonWithIcon, bindHighlightedHeading } = require('./components/compound-content.cjs');
const { extractTailwindBg } = require('./assets/tailwind-bg.cjs');

function applyTransformToElement(pathNode, transform) {
  const node = pathNode.node;
  if (transform.operation === 'form-submit-action') {
    const tagName = getJsxName(node);
    if (!hasJsxAttribute(node, 'type') && tagName === 'button') {
      node.openingElement.attributes.push(
        b.jsxAttribute(b.jsxIdentifier('type'), b.stringLiteral('submit'))
      );
    }
    if (transform.labelField) {
      if (hasJsxAttribute(node, 'data-preview-static')) {
        node.openingElement.attributes = node.openingElement.attributes.filter(
          (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'data-preview-static')
        );
      }
      if (hasJsxAttribute(node, 'data-preview-field-path')) {
        node.openingElement.attributes = node.openingElement.attributes.filter(
          (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'data-preview-field-path')
        );
      }
      splitActionChildren(node, transform.labelField, transform.labelFallback || '');
    } else if (!hasJsxAttribute(node, 'data-preview-static')) {
      node.openingElement.attributes.push(
        b.jsxAttribute(b.jsxIdentifier('data-preview-static'), b.stringLiteral('action-button'))
      );
    }
    return;
  }
  if (transform.operation === 'split-action-contract') {
    const tagName = getJsxName(node);
    if (tagName === 'button') {
      node.openingElement.name = b.jsxIdentifier('a');
      if (node.closingElement) {
        node.closingElement.name = b.jsxIdentifier('a');
      }
      node.openingElement.attributes = (node.openingElement.attributes || []).filter(
        (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'type')
      );
    }

    const urlParts = transform.urlField.split('.');
    replaceAttrValue(node, 'href', siteDataBinding(urlParts, transform.fallback, 'url'));

    const isExternal =
      transform.extra?.external ||
      ['whatsapp', 'directions', 'location'].includes(transform.extra?.action) ||
      /^https?:\/\//i.test(String(transform.fallback || ''));

    if (isExternal && (tagName === 'button' || tagName === 'a')) {
      if (!hasJsxAttribute(node, 'target')) {
        node.openingElement.attributes.push(
          b.jsxAttribute(b.jsxIdentifier('target'), b.stringLiteral('_blank'))
        );
      }
      if (!hasJsxAttribute(node, 'rel')) {
        node.openingElement.attributes.push(
          b.jsxAttribute(b.jsxIdentifier('rel'), b.stringLiteral('noopener noreferrer'))
        );
      }
    }

    replaceAttrValue(node, 'data-preview-field-path', b.stringLiteral(transform.urlField));
    if (hasJsxAttribute(node, 'data-preview-static')) {
      node.openingElement.attributes = node.openingElement.attributes.filter(
        (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'data-preview-static')
      );
    }
    splitActionChildren(node, transform.labelField, transform.labelFallback || '');
    return;
  }
  if (transform.operation === 'extract-url') {
    replaceAttrValue(node, 'href', siteDataBinding(transform.field.split('.'), transform.fallback, 'url'));
    ensurePreviewPath(node, transform.field);
    return;
  }
  if (transform.operation === 'extract-image' || transform.operation === 'extract-picture') {
    const tagName = getJsxName(node);
    if (tagName === 'picture') {
      const children = node.children || [];
      const imgChild = children.find((c) => c && c.type === 'JSXElement' && (getJsxName(c) === 'img' || getJsxName(c) === 'Image'));
      if (imgChild) {
        replaceAttrValue(imgChild, 'src', siteDataBinding(transform.field.split('.'), transform.fallback, 'image'));
        ensurePreviewPath(imgChild, transform.field);
      }
      ensurePreviewPath(node, transform.field);
      return;
    }
    replaceAttrValue(node, 'src', siteDataBinding(transform.field.split('.'), transform.fallback, 'image'));
    ensurePreviewPath(node, transform.field);
    return;
  }
  if (transform.operation === 'extract-alt') {
    replaceAttrValue(node, 'alt', siteDataBinding(transform.field.split('.'), transform.fallback, 'text'));
    return;
  }
  if (transform.operation === 'extract-placeholder') {
    replaceAttrValue(node, 'placeholder', siteDataBinding(transform.field.split('.'), transform.fallback, 'text'));
    ensurePreviewPath(node, transform.field);
    return;
  }
  if (transform.operation === 'extract-prop') {
    const propName = transform.propName || 'title';
    replaceAttrValue(node, propName, siteDataBinding(transform.field.split('.'), transform.fallback, transform.fieldType || 'text'));
    if (!hasJsxAttribute(node, 'data-preview-field-path') && !hasJsxAttribute(node, 'data-preview-list-path')) {
      ensurePreviewPath(node, transform.field);
    }
    return;
  }
  if (transform.operation === 'bind-button-with-icon') {
    bindButtonWithIcon(node, transform);
    return;
  }
  if (transform.operation === 'bind-highlighted-heading') {
    bindHighlightedHeading(node, transform);
    return;
  }
  if (transform.operation === 'prop-flow-callsite') {
    if (transform.propTransforms) {
      for (const [propName, propInfo] of Object.entries(transform.propTransforms)) {
        replaceAttrValue(
          node,
          propName,
          siteDataBinding(propInfo.field.split('.'), propInfo.fallback, propInfo.type || 'text')
        );
      }
    }
    if (transform.previewPath && !hasJsxAttribute(node, 'previewPath')) {
      node.openingElement.attributes.push(
        b.jsxAttribute(b.jsxIdentifier('previewPath'), b.stringLiteral(transform.previewPath))
      );
    }
    return;
  }
  if (transform.operation === 'wrap-text-span') {
    wrapLiteralTextChildren(node, transform.field, transform.fallback);
    return;
  }
  if (transform.operation === 'extract-text') {
    const tagName = getJsxName(node);
    if (BROAD_CONTENT_CONTAINERS.has(tagName)) {
      wrapLiteralTextChildren(node, transform.field, transform.fallback);
      return;
    }
    ensurePreviewPath(node, transform.field);
    ensureStyleAttrs(node, transform.field, inferButtonKind(transform.tag));
    replaceTextChildren(node, transform.field, transform.fallback, transform.fieldType || 'text');
    return;
  }
  if (transform.operation === 'style-bind') {
    if (transform.styleKind === 'grid') {
      const container = findAncestorJsxElement(pathNode) || node;
      ensureStyleAttrs(container, transform.stylePath, 'grid');
      return;
    }
    if (transform.styleKind === 'card') {
      ensureStyleAttrs(node, transform.stylePath, 'card');
      return;
    }
    ensureStyleAttrs(node, transform.stylePath, transform.styleKind || 'text');
    return;
  }
  if (transform.operation === 'extract-tailwind-bg') {
    extractTailwindBg(node, transform);
    return;
  }
}

module.exports = {
  applyTransformToElement,
};

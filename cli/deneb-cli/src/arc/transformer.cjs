'use strict';

const recast = require('recast');
const path = require('path');
const fs = require('fs');
const {
  parseSource,
  printSource,
  locKey,
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  hasDirective,
  ensureImport,
  ensureDefaultImport,
  sanitizeDuplicateBindings,
  siteDataBinding,
  siteDataListBinding,
  jsxPreviewAttr,
  jsxTemplatePathAttr,
  wrapTextInEditableSpan,
  unwrapExpr,
  extractItemMemberName,
  jsxStyleAttrs,
  ensureStyleAttrs,
  b,
} = require('./ast.cjs');
const { toPosix } = require('./fs-utils.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('./fivora-contract.cjs');
const {
  hasMetadataExport,
  hasClientDirective,
  needsClientDirective,
  canSafelyInjectClientDirective,
  ensureClientDirective,
} = require('./rsc-boundary.cjs');

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

function replaceTextChildren(node, fieldPath, fallback, fieldType) {
  const nextChildren = [];
  let replaced = false;
  for (const child of node.children || []) {
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

    // Fivora Strict Action/Label Contract:
    // Bind the URL action marker directly to the outer <a> element (never hidden)
    replaceAttrValue(node, 'data-preview-field-path', b.stringLiteral(transform.urlField));
    // Remove data-preview-static if present to prevent static/field collisions
    if (hasJsxAttribute(node, 'data-preview-static')) {
      node.openingElement.attributes = node.openingElement.attributes.filter(
        (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'data-preview-static')
      );
    }
    // Bind the label to the inner text child
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
    return;
  }
  if (transform.operation === 'bind-highlighted-heading') {
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
    return;
  }
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

/**
 * Replaces literal text children with an editable <span>, leaving the container
 * element and every one of its classes untouched.
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

function buildCompositeKeyAttribute(binding, indexName) {
  const fields = ['id', 'slug', 'title', 'name'];
  let expr = b.memberExpression(b.identifier(binding), b.identifier(fields[0]), false);
  for (let i = 1; i < fields.length; i++) {
    expr = b.logicalExpression(
      '||',
      expr,
      b.memberExpression(b.identifier(binding), b.identifier(fields[i]), false)
    );
  }
  expr = b.logicalExpression('||', expr, b.identifier(indexName));
  return b.jsxAttribute(b.jsxIdentifier('key'), b.jsxExpressionContainer(expr));
}

/**
 * Converts a literal-array `.map()` render into a Fivora list contract.
 *
 * The developer's array declaration becomes site-data backed with the original
 * literal as fallback, so `{item.title}` keeps working untouched. Markers are
 * emitted as JSX template literals (`items[${index}].title`) so added and
 * reordered items stay editable, which is what strict mode requires.
 */
function applyCollectionTransform(ast, transform, isClient = false, isTypeScript = false) {
  const listPath = transform.listField;
  const binding = transform.itemParam;
  if (!listPath || !binding) return false;

  const mapCall = findMapCall(ast, transform.loc);
  if (!mapCall) return false;

  const callback = (mapCall.node.arguments || [])[0];
  if (!callback) return false;

  // The contract needs a concrete index for each item marker.
  let indexName = transform.indexParam;
  if (!indexName) {
    if (callback.params && callback.params.length >= 2 && callback.params[1]?.type === 'Identifier') {
      indexName = callback.params[1].name;
    } else {
      indexName = callback.params.some((p) => p?.name === 'index') ? 'denebIndex' : 'index';
      const indexId = b.identifier(indexName);
      if (isTypeScript) {
        indexId.typeAnnotation = b.tsTypeAnnotation(b.tsNumberKeyword());
      }
      callback.params.push(indexId);
    }
  }

  // In TypeScript files, prevent TS7006 implicit any on callback parameters
  if (isTypeScript && callback.params && callback.params.length > 0) {
    const itemParam = callback.params[0];
    if (itemParam && !itemParam.typeAnnotation) {
      itemParam.typeAnnotation = b.tsTypeAnnotation(b.tsAnyKeyword());
    }
    if (callback.params.length >= 2) {
      const idxParam = callback.params[1];
      if (idxParam && !idxParam.typeAnnotation) {
        idxParam.typeAnnotation = b.tsTypeAnnotation(b.tsNumberKeyword());
      }
    }
  }

  const itemRoot = findElementByLoc(ast, transform.loc);
  if (!itemRoot) return false;

  const rootTagName = getJsxName(itemRoot.node);
  const isCustomChild = /^[A-Z]/.test(rootTagName);

  if (isCustomChild) {
    if (!hasJsxAttribute(itemRoot.node, 'previewItemPath')) {
      itemRoot.node.openingElement.attributes.push(
        jsxTemplatePathAttr('previewItemPath', listPath, indexName)
      );
    }
    if (!hasJsxAttribute(itemRoot.node, 'index')) {
      itemRoot.node.openingElement.attributes.push(
        b.jsxAttribute(b.jsxIdentifier('index'), b.jsxExpressionContainer(b.identifier(indexName)))
      );
    }
  }

  if (!hasJsxAttribute(itemRoot.node, 'data-preview-item-path')) {
    itemRoot.node.openingElement.attributes.push(
      jsxTemplatePathAttr('data-preview-item-path', listPath, indexName)
    );
  }
  if (!hasJsxAttribute(itemRoot.node, 'data-preview-style-target')) {
    itemRoot.node.openingElement.attributes.push(
      jsxTemplatePathAttr('data-preview-style-target', listPath, indexName, '.card')
    );
    itemRoot.node.openingElement.attributes.push(
      b.jsxAttribute(b.jsxIdentifier('data-preview-style-type'), b.stringLiteral('card'))
    );
  }
  if (!hasJsxAttribute(itemRoot.node, 'key')) {
    itemRoot.node.openingElement.attributes.push(
      buildCompositeKeyAttribute(binding, indexName)
    );
  }

  if (transform.isPrimitiveArray) {
    markPrimitiveItemFields(callback, { listPath, binding, indexName });
  } else {
    markItemFields(callback, { listPath, binding, indexName });
  }
  if (!isCustomChild) {
    markComponentRefItemsStatic(callback, binding);
  }

  const container = findListContainer(mapCall);
  if (container && !hasJsxAttribute(container, 'data-preview-list-path')) {
    container.openingElement.attributes.push(
      b.jsxAttribute(b.jsxIdentifier('data-preview-list-path'), b.stringLiteral(listPath))
    );
  }
  if (container && !hasJsxAttribute(container, 'data-preview-style-target')) {
    container.openingElement.attributes.push(
      b.jsxAttribute(b.jsxIdentifier('data-preview-style-target'), b.stringLiteral(`${listPath}.grid`))
    );
    container.openingElement.attributes.push(
      b.jsxAttribute(b.jsxIdentifier('data-preview-style-type'), b.stringLiteral('grid'))
    );
  }

  return bindArrayDeclaration(ast, mapCall, listPath, isClient, Boolean(transform.hasComponentRef), isTypeScript);
}

function findMapCall(ast, loc) {
  let found = null;
  recast.types.visit(ast, {
    visitCallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (
        !found &&
        callee?.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property?.name === 'map'
      ) {
        let hit = false;
        recast.types.visit(pathNode.node, {
          visitJSXElement(inner) {
            if (locKey(inner.node) === loc) {
              hit = true;
              return false;
            }
            this.traverse(inner);
          },
        });
        if (hit) {
          found = pathNode;
          return false;
        }
      }
      this.traverse(pathNode);
    },
  });
  return found;
}

/** Attaches field markers to the elements that render item properties. */
function markItemFields(callback, { listPath, binding, indexName }) {
  recast.types.visit(callback, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;

      for (const attr of node.openingElement.attributes || []) {
        if (attr.type !== 'JSXAttribute' || !attr.value) continue;
        const attrName = attr.name?.name;
        if (attrName !== 'src' && attrName !== 'href') continue;
        const property = itemMemberName(attr.value.expression, binding);
        if (!property) continue;
        if (!hasJsxAttribute(node, 'data-preview-field-path')) {
          node.openingElement.attributes.push(
            jsxTemplatePathAttr('data-preview-field-path', listPath, indexName, `.${property}`)
          );
        }
      }

      const textChild = (node.children || []).find(
        (child) => child.type === 'JSXExpressionContainer' && itemMemberName(child.expression, binding)
      );
      if (textChild && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const property = itemMemberName(textChild.expression, binding);
        const tagName = getJsxName(node);
        if (BROAD_CONTENT_CONTAINERS.has(tagName) || BROAD_CONTENT_CONTAINERS.has(String(tagName).toLowerCase())) {
          wrapItemFieldInSpan(node, textChild, listPath, indexName, property);
        } else {
          node.openingElement.attributes.push(
            jsxTemplatePathAttr('data-preview-field-path', listPath, indexName, `.${property}`)
          );
        }
      }

      this.traverse(pathNode);
    },
  });
}

function wrapItemFieldInSpan(node, textChild, listPath, indexName, property) {
  const nextChildren = [];
  for (const child of node.children || []) {
    if (child === textChild) {
      nextChildren.push(
        b.jsxElement(
          b.jsxOpeningElement(
            b.jsxIdentifier('span'),
            [jsxTemplatePathAttr('data-preview-field-path', listPath, indexName, `.${property}`)],
            false
          ),
          b.jsxClosingElement(b.jsxIdentifier('span')),
          [child],
          false
        )
      );
    } else {
      nextChildren.push(child);
    }
  }
  node.children = nextChildren;
}

function markComponentRefItemsStatic(callback, binding) {
  recast.types.visit(callback, {
    visitJSXElement(pathNode) {
      const name = pathNode.node.openingElement && pathNode.node.openingElement.name;
      if (
        name &&
        name.type === 'JSXMemberExpression' &&
        name.object &&
        (name.object.type === 'Identifier' || name.object.type === 'JSXIdentifier') &&
        name.object.name === binding
      ) {
        if (!hasJsxAttribute(pathNode.node, 'data-preview-static') && !hasJsxAttribute(pathNode.node, 'data-preview-field-path')) {
          pathNode.node.openingElement.attributes.push(
            b.jsxAttribute(b.jsxIdentifier('data-preview-static'), b.stringLiteral('component-ref'))
          );
        }
      }
      this.traverse(pathNode);
    },
  });
}

function itemMemberName(expr, binding) {
  return extractItemMemberName(expr, binding);
}

function isDirectItemExpr(expr, binding) {
  if (!expr) return false;
  const unwrapped = unwrapExpr(expr);
  return Boolean(
    unwrapped &&
      (unwrapped.type === 'Identifier' || unwrapped.type === 'JSXIdentifier') &&
      unwrapped.name === binding
  );
}

function markPrimitiveItemFields(callback, { listPath, binding, indexName }) {
  recast.types.visit(callback, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const textChild = (node.children || []).find(
        (child) => child.type === 'JSXExpressionContainer' && isDirectItemExpr(child.expression, binding)
      );
      if (textChild && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const tagName = getJsxName(node);
        if (
          node.children.length === 1 &&
          (tagName === 'span' || tagName === 'p' || tagName === 'li') &&
          !hasJsxAttribute(node, 'data-preview-item-path')
        ) {
          node.openingElement.attributes.push(
            jsxTemplatePathAttr('data-preview-field-path', listPath, indexName, '')
          );
        } else {
          wrapPrimitiveItemFieldInSpan(node, textChild, listPath, indexName);
        }
      }
      this.traverse(pathNode);
    },
  });
}

function wrapPrimitiveItemFieldInSpan(node, textChild, listPath, indexName) {
  const nextChildren = [];
  for (const child of node.children || []) {
    if (child === textChild) {
      nextChildren.push(
        b.jsxElement(
          b.jsxOpeningElement(
            b.jsxIdentifier('span'),
            [jsxTemplatePathAttr('data-preview-field-path', listPath, indexName, '')],
            false
          ),
          b.jsxClosingElement(b.jsxIdentifier('span')),
          [child],
          false
        )
      );
    } else {
      nextChildren.push(child);
    }
  }
  node.children = nextChildren;
}

function instrumentChildCardComponent(ast, transform, isTypeScript = false) {
  const componentName = transform.componentName;
  const listPath = transform.listField || transform.listPath || '';
  if (!componentName) return false;

  let instrumented = false;

  function updateTsInterface(rootAst, interfaceName) {
    recast.types.visit(rootAst, {
      visitTSInterfaceDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName) {
          const body = pathNode.node.body?.body || [];
          if (!body.some((prop) => prop.key?.name === 'previewItemPath')) {
            const sig1 = b.tsPropertySignature(b.identifier('previewItemPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig1.optional = true;
            body.push(sig1);
            instrumented = true;
          }
          if (!body.some((prop) => prop.key?.name === 'index')) {
            const sig2 = b.tsPropertySignature(b.identifier('index'), b.tsTypeAnnotation(b.tsNumberKeyword()));
            sig2.optional = true;
            body.push(sig2);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
      visitTSTypeAliasDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName && pathNode.node.typeAnnotation?.type === 'TSTypeLiteral') {
          const members = pathNode.node.typeAnnotation.members || [];
          if (!members.some((m) => m.key?.name === 'previewItemPath')) {
            const sig1 = b.tsPropertySignature(b.identifier('previewItemPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig1.optional = true;
            members.push(sig1);
            instrumented = true;
          }
          if (!members.some((m) => m.key?.name === 'index')) {
            const sig2 = b.tsPropertySignature(b.identifier('index'), b.tsTypeAnnotation(b.tsNumberKeyword()));
            sig2.optional = true;
            members.push(sig2);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
    });
  }

  function instrumentFunctionProps(fnNode, isTs) {
    let changed = false;
    let params = fnNode.params || [];
    if (!params.length) {
      fnNode.params = [
        b.objectPattern([
          b.property('init', b.identifier('previewItemPath'), b.identifier('previewItemPath')),
          b.property('init', b.identifier('index'), b.identifier('index')),
        ]),
      ];
      changed = true;
    } else {
      const firstParam = params[0];
      if (firstParam.type === 'ObjectPattern') {
        const hasPreviewPath = firstParam.properties.some(
          (p) => p.key?.name === 'previewItemPath' || p.argument?.name === 'previewItemPath'
        );
        if (!hasPreviewPath) {
          const prop = b.property('init', b.identifier('previewItemPath'), b.identifier('previewItemPath'));
          prop.shorthand = true;
          firstParam.properties.push(prop);
          changed = true;
        }
        const hasIndex = firstParam.properties.some(
          (p) => p.key?.name === 'index' || p.argument?.name === 'index'
        );
        if (!hasIndex) {
          const prop = b.property('init', b.identifier('index'), b.identifier('index'));
          prop.shorthand = true;
          firstParam.properties.push(prop);
          changed = true;
        }

        if (isTs && firstParam.typeAnnotation?.typeAnnotation) {
          const typeAnn = firstParam.typeAnnotation.typeAnnotation;
          if (typeAnn.type === 'TSTypeReference' && typeAnn.typeName?.name) {
            updateTsInterface(ast, typeAnn.typeName.name);
          }
        }
      } else if (firstParam.type === 'Identifier') {
        const paramName = firstParam.name;
        if (isTs && firstParam.typeAnnotation?.typeAnnotation) {
          const typeAnn = firstParam.typeAnnotation.typeAnnotation;
          if (typeAnn.type === 'TSTypeReference' && typeAnn.typeName?.name) {
            updateTsInterface(ast, typeAnn.typeName.name);
          }
        }
        recast.types.visit(fnNode.body || fnNode, {
          visitVariableDeclarator(vPath) {
            if (vPath.node.id?.type === 'ObjectPattern' && vPath.node.init?.name === paramName) {
              const propsList = vPath.node.id.properties;
              if (!propsList.some((p) => p.key?.name === 'previewItemPath')) {
                const prop = b.property('init', b.identifier('previewItemPath'), b.identifier('previewItemPath'));
                prop.shorthand = true;
                propsList.push(prop);
                changed = true;
              }
              if (!propsList.some((p) => p.key?.name === 'index')) {
                const prop = b.property('init', b.identifier('index'), b.identifier('index'));
                prop.shorthand = true;
                propsList.push(prop);
                changed = true;
              }
            }
            this.traverse(vPath);
          },
        });
      }
    }
    return changed;
  }

  recast.types.visit(ast, {
    visitFunctionDeclaration(pathNode) {
      if (pathNode.node.id?.name === componentName) {
        if (instrumentFunctionProps(pathNode.node, isTypeScript)) instrumented = true;
      }
      this.traverse(pathNode);
    },
    visitVariableDeclarator(pathNode) {
      if (pathNode.node.id?.name === componentName) {
        const init = pathNode.node.init;
        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          if (instrumentFunctionProps(init, isTypeScript)) instrumented = true;
        }
      }
      this.traverse(pathNode);
    },
    visitExportDefaultDeclaration(pathNode) {
      const decl = pathNode.node.declaration;
      if (decl && (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionExpression')) {
        const fnName = decl.id?.name;
        if (!fnName || fnName === componentName) {
          if (instrumentFunctionProps(decl, isTypeScript)) instrumented = true;
        }
      }
      this.traverse(pathNode);
    },
  });

  let rootElement = null;
  recast.types.visit(ast, {
    visitReturnStatement(pathNode) {
      if (!rootElement && pathNode.node.argument) {
        let arg = pathNode.node.argument;
        if (arg.type === 'ParenthesizedExpression') arg = arg.expression;
        if (arg.type === 'JSXElement') {
          rootElement = arg;
        }
      }
      this.traverse(pathNode);
    },
  });

  if (rootElement) {
    if (!hasJsxAttribute(rootElement, 'data-preview-item-path')) {
      if (listPath) {
        rootElement.openingElement.attributes.push(
          jsxTemplatePathAttr('data-preview-item-path', listPath, 'index')
        );
      } else {
        rootElement.openingElement.attributes.push(
          b.jsxAttribute(
            b.jsxIdentifier('data-preview-item-path'),
            b.jsxExpressionContainer(b.identifier('previewItemPath'))
          )
        );
      }
      instrumented = true;
    }
  }

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const tagName = getJsxName(node);

      const srcAttr = findJsxAttribute(node, 'src');
      if (srcAttr && (tagName === 'img' || tagName === 'Image') && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const rawCode = recast.print(srcAttr.value).code;
        if (/image|photo|avatar|thumb|img|src/i.test(rawCode)) {
          const imgField = (transform.itemFields || []).find((f) => f.type === 'image' || /image|photo/i.test(f.key))?.key || 'image';
          if (listPath) {
            node.openingElement.attributes.push(
              jsxTemplatePathAttr('data-preview-field-path', listPath, 'index', `.${imgField}`)
            );
          } else {
            node.openingElement.attributes.push(
              b.jsxAttribute(
                b.jsxIdentifier('data-preview-field-path'),
                b.jsxExpressionContainer(
                  b.templateLiteral(
                    [
                      b.templateElement({ raw: '', cooked: '' }, false),
                      b.templateElement({ raw: `.${imgField}`, cooked: `.${imgField}` }, true),
                    ],
                    [b.identifier('previewItemPath')]
                  )
                )
              )
            );
          }
          instrumented = true;
        }
      }

      for (const child of node.children || []) {
        if (child.type === 'JSXExpressionContainer') {
          const exprCode = recast.print(child.expression).code;
          if (!hasJsxAttribute(node, 'data-preview-field-path')) {
            if (/name|title|heading/i.test(exprCode)) {
              const nameField = (transform.itemFields || []).find((f) => /name|title|heading/i.test(f.key))?.key || 'name';
              if (listPath) {
                node.openingElement.attributes.push(
                  jsxTemplatePathAttr('data-preview-field-path', listPath, 'index', `.${nameField}`)
                );
              } else {
                node.openingElement.attributes.push(
                  b.jsxAttribute(
                    b.jsxIdentifier('data-preview-field-path'),
                    b.jsxExpressionContainer(
                      b.templateLiteral(
                        [
                          b.templateElement({ raw: '', cooked: '' }, false),
                          b.templateElement({ raw: `.${nameField}`, cooked: `.${nameField}` }, true),
                        ],
                        [b.identifier('previewItemPath')]
                      )
                    )
                  )
                );
              }
              instrumented = true;
              break;
            } else if (/price|cost|amount/i.test(exprCode)) {
              const priceField = (transform.itemFields || []).find((f) => /price|cost/i.test(f.key))?.key || 'price';
              if (listPath) {
                node.openingElement.attributes.push(
                  jsxTemplatePathAttr('data-preview-field-path', listPath, 'index', `.${priceField}`)
                );
              } else {
                node.openingElement.attributes.push(
                  b.jsxAttribute(
                    b.jsxIdentifier('data-preview-field-path'),
                    b.jsxExpressionContainer(
                      b.templateLiteral(
                        [
                          b.templateElement({ raw: '', cooked: '' }, false),
                          b.templateElement({ raw: `.${priceField}`, cooked: `.${priceField}` }, true),
                        ],
                        [b.identifier('previewItemPath')]
                      )
                    )
                  )
                );
              }
              instrumented = true;
              break;
            } else if (/description|desc|subtitle/i.test(exprCode)) {
              const descField = (transform.itemFields || []).find((f) => /desc/i.test(f.key))?.key || 'description';
              if (listPath) {
                node.openingElement.attributes.push(
                  jsxTemplatePathAttr('data-preview-field-path', listPath, 'index', `.${descField}`)
                );
              } else {
                node.openingElement.attributes.push(
                  b.jsxAttribute(
                    b.jsxIdentifier('data-preview-field-path'),
                    b.jsxExpressionContainer(
                      b.templateLiteral(
                        [
                          b.templateElement({ raw: '', cooked: '' }, false),
                          b.templateElement({ raw: `.${descField}`, cooked: `.${descField}` }, true),
                        ],
                        [b.identifier('previewItemPath')]
                      )
                    )
                  )
                );
              }
              instrumented = true;
              break;
            }
          }
        }
      }
      this.traverse(pathNode);
    },
  });

  return instrumented;
}

function instrumentReusableComponent(ast, transform, isTypeScript = false) {
  const componentName = transform.componentName;
  const propTransforms = transform.propTransforms || {};
  const propNames = Object.keys(propTransforms);
  if (!propNames.length) return false;

  let instrumented = false;

  function updateTsInterface(rootAst, interfaceName) {
    recast.types.visit(rootAst, {
      visitTSInterfaceDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName) {
          const body = pathNode.node.body?.body || [];
          if (!body.some((m) => m.key?.name === 'previewPath')) {
            const sig = b.tsPropertySignature(b.identifier('previewPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig.optional = true;
            body.push(sig);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
      visitTSTypeAliasDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName && pathNode.node.typeAnnotation?.type === 'TSTypeLiteral') {
          const members = pathNode.node.typeAnnotation.members || [];
          if (!members.some((m) => m.key?.name === 'previewPath')) {
            const sig = b.tsPropertySignature(b.identifier('previewPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig.optional = true;
            members.push(sig);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
    });
  }

  function instrumentFunctionProps(fnNode, isTs) {
    let changed = false;
    let params = fnNode.params || [];
    if (!params.length) {
      fnNode.params = [
        b.objectPattern([
          b.property('init', b.identifier('previewPath'), b.identifier('previewPath')),
        ]),
      ];
      changed = true;
    } else {
      const firstParam = params[0];
      if (firstParam.type === 'ObjectPattern') {
        const hasPreviewPath = firstParam.properties.some(
          (p) => p.key?.name === 'previewPath' || p.argument?.name === 'previewPath'
        );
        if (!hasPreviewPath) {
          const prop = b.property('init', b.identifier('previewPath'), b.identifier('previewPath'));
          prop.shorthand = true;
          firstParam.properties.push(prop);
          changed = true;
        }
        if (isTs && firstParam.typeAnnotation?.typeAnnotation) {
          const typeAnn = firstParam.typeAnnotation.typeAnnotation;
          if (typeAnn.type === 'TSTypeReference' && typeAnn.typeName?.name) {
            updateTsInterface(ast, typeAnn.typeName.name);
          }
        }
      } else if (firstParam.type === 'Identifier') {
        const paramName = firstParam.name;
        if (isTs && firstParam.typeAnnotation?.typeAnnotation) {
          const typeAnn = firstParam.typeAnnotation.typeAnnotation;
          if (typeAnn.type === 'TSTypeReference' && typeAnn.typeName?.name) {
            updateTsInterface(ast, typeAnn.typeName.name);
          }
        }
        recast.types.visit(fnNode.body || fnNode, {
          visitVariableDeclarator(vPath) {
            if (vPath.node.id?.type === 'ObjectPattern' && vPath.node.init?.name === paramName) {
              const propsList = vPath.node.id.properties;
              if (!propsList.some((p) => p.key?.name === 'previewPath')) {
                const prop = b.property('init', b.identifier('previewPath'), b.identifier('previewPath'));
                prop.shorthand = true;
                propsList.push(prop);
                changed = true;
              }
            }
            this.traverse(vPath);
          },
        });
      }
    }
    return changed;
  }

  recast.types.visit(ast, {
    visitFunctionDeclaration(pathNode) {
      if (!componentName || pathNode.node.id?.name === componentName) {
        if (instrumentFunctionProps(pathNode.node, isTypeScript)) instrumented = true;
      }
      this.traverse(pathNode);
    },
    visitVariableDeclarator(pathNode) {
      if (pathNode.node.id?.name === componentName) {
        const init = pathNode.node.init;
        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          if (instrumentFunctionProps(init, isTypeScript)) instrumented = true;
        }
      }
      this.traverse(pathNode);
    },
    visitExportDefaultDeclaration(pathNode) {
      const decl = pathNode.node.declaration;
      if (decl && (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionExpression')) {
        const fnName = decl.id?.name;
        if (!fnName || fnName === componentName) {
          if (instrumentFunctionProps(decl, isTypeScript)) instrumented = true;
        }
      }
      this.traverse(pathNode);
    },
  });

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      for (const child of node.children || []) {
        if (child.type === 'JSXExpressionContainer') {
          const expr = child.expression;
          let propMatch = null;
          if (expr && expr.type === 'Identifier' && propNames.includes(expr.name)) {
            propMatch = expr.name;
          } else if (expr && expr.type === 'LogicalExpression' && expr.left?.name && propNames.includes(expr.left.name)) {
            propMatch = expr.left.name;
          }
          if (propMatch && !hasJsxAttribute(node, 'data-preview-field-path')) {
            const previewAttr = b.jsxAttribute(
              b.jsxIdentifier('data-preview-field-path'),
              b.jsxExpressionContainer(
                b.conditionalExpression(
                  b.identifier('previewPath'),
                  b.templateLiteral(
                    [
                      b.templateElement({ raw: '', cooked: '' }, false),
                      b.templateElement({ raw: `.${propMatch}`, cooked: `.${propMatch}` }, true),
                    ],
                    [b.identifier('previewPath')]
                  ),
                  b.identifier('undefined')
                )
              )
            );
            node.openingElement.attributes.push(previewAttr);
            instrumented = true;
            break;
          }
        }
      }
      this.traverse(pathNode);
    },
  });

  return instrumented;
}

/** The nearest JSX element that wraps the map expression. */
function findListContainer(mapCallPath) {
  let current = mapCallPath.parent;
  while (current) {
    const node = current.node || current.value;
    if (node?.type === 'JSXElement') return node;
    current = current.parentPath || current.parent;
  }
  return null;
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

function bindArrayDeclaration(ast, mapCallPath, listPath, isClient = false, mergeDefaultRefs = false, isTypeScript = false) {
  const arrayName = mapCallPath.node.callee.object?.name;
  if (!arrayName) return false;
  let bound = false;

  recast.types.visit(ast, {
    visitVariableDeclarator(pathNode) {
      const node = pathNode.node;
      if (bound || node.id?.type !== 'Identifier' || node.id.name !== arrayName) {
        this.traverse(pathNode);
        return;
      }
      if (node.init?.type !== 'ArrayExpression') {
        this.traverse(pathNode);
        return;
      }

      if (isClient && isModuleLevel(pathNode)) {
        const defaultName = 'DEFAULT_' + arrayName;
        node.id.name = defaultName;
        const fnPath = findEnclosingFunction(mapCallPath);
        if (fnPath && fnPath.node.body?.type === 'BlockStatement') {
          const body = fnPath.node.body.body;
          const already = body.some((stmt) => recast.print(stmt).code.includes(`const ${arrayName} =`));
          if (!already) {
            const localId = b.identifier(arrayName);
            if (isTypeScript) {
              localId.typeAnnotation = b.tsTypeAnnotation(b.tsArrayType(b.tsAnyKeyword()));
            }
            const localDecl = b.variableDeclaration('const', [
              b.variableDeclarator(
                localId,
                mergeDefaultRefs
                  ? mergeDefaultItemRefsBinding(listPath.split('.'), defaultName)
                  : siteDataListBinding(listPath.split('.'), b.identifier(defaultName))
              ),
            ]);
            const hookIdx = body.findIndex((stmt) => recast.print(stmt).code.includes('useSiteData'));
            if (hookIdx >= 0) {
              body.splice(hookIdx + 1, 0, localDecl);
            } else {
              body.unshift(localDecl);
            }
          }
        }
        bound = true;
        return false;
      }

      if (isTypeScript && node.id?.type === 'Identifier' && !node.id.typeAnnotation) {
        node.id.typeAnnotation = b.tsTypeAnnotation(b.tsArrayType(b.tsAnyKeyword()));
      }
      node.init = siteDataListBinding(listPath.split('.'), node.init);
      bound = true;
      return false;
    },
  });

  if (!bound) {
    recast.types.visit(ast, {
      visitImportDeclaration(pathNode) {
        if (bound) return false;
        const node = pathNode.node;
        const spec = (node.specifiers || []).find(
          (s) => (s.local?.name || s.imported?.name) === arrayName
        );
        if (!spec) {
          this.traverse(pathNode);
          return;
        }

        const defaultName = 'DEFAULT_' + arrayName;
        if (spec.type === 'ImportSpecifier') {
          spec.local = b.identifier(defaultName);
        } else if (spec.type === 'ImportDefaultSpecifier') {
          spec.local = b.identifier(defaultName);
        }

        const fnPath = findEnclosingFunction(mapCallPath);
        if (fnPath && fnPath.node.body?.type === 'BlockStatement') {
          const body = fnPath.node.body.body;
          const already = body.some(
            (stmt) =>
              recast.print(stmt).code.includes(`const ${arrayName} =`) ||
              recast.print(stmt).code.includes(`const ${arrayName}:`)
          );
          if (!already) {
            const localId = b.identifier(arrayName);
            if (isTypeScript) {
              localId.typeAnnotation = b.tsTypeAnnotation(b.tsArrayType(b.tsAnyKeyword()));
            }
            const localDecl = b.variableDeclaration('const', [
              b.variableDeclarator(
                localId,
                mergeDefaultRefs
                  ? mergeDefaultItemRefsBinding(listPath.split('.'), defaultName)
                  : siteDataListBinding(listPath.split('.'), b.identifier(defaultName))
              ),
            ]);
            const hookIdx = body.findIndex((stmt) => recast.print(stmt).code.includes('useSiteData'));
            if (hookIdx >= 0) {
              body.splice(hookIdx + 1, 0, localDecl);
            } else {
              body.unshift(localDecl);
            }
          }
        }
        bound = true;
        return false;
      },
    });
  }

  return bound;
}

function mergeDefaultItemRefsBinding(pathParts, defaultName) {
  const listExpr = siteDataListBinding(pathParts, b.identifier(defaultName));
  return b.callExpression(
    b.memberExpression(listExpr, b.identifier('map'), false),
    [
      b.arrowFunctionExpression(
        [b.identifier('item'), b.identifier('index')],
        b.objectExpression([
          b.spreadElement(
            b.logicalExpression(
              '??',
              b.memberExpression(b.identifier(defaultName), b.identifier('index'), true),
              b.objectExpression([])
            )
          ),
          b.spreadElement(b.identifier('item')),
        ])
      ),
    ]
  );
}

function fileAlreadyUsesSiteDataHook(ast) {
  let found = false;
  recast.types.visit(ast, {
    visitCallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (callee && callee.type === 'Identifier' && callee.name === 'useSiteData') {
        found = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return found;
}

function resolveSiteDataRuntimeSpecifier(profile) {
  const root = profile && profile.root;
  if (!root) return '@deneb-ui/ui';
  const candidates = [
    ['src/lib/siteDataContext.tsx', '@/lib/siteDataContext'],
    ['src/lib/siteDataContext.ts', '@/lib/siteDataContext'],
    ['lib/siteDataContext.tsx', '@/lib/siteDataContext'],
    ['lib/siteDataContext.ts', '@/lib/siteDataContext'],
  ];
  const hasAt = Object.keys(profile.aliasMap || {}).some((k) => k === '@/*' || k.startsWith('@/'));
  for (const [relative, alias] of candidates) {
    if (!fs.existsSync(path.join(root, relative))) continue;
    if (hasAt) return alias;
    const fromAbs = path.join(root, 'src/components/placeholder.tsx');
    const toAbs = path.join(root, relative.replace(/\.tsx?$/, ''));
    let relSpec = path.relative(path.dirname(fromAbs), toAbs).replace(/\\/g, '/');
    if (!relSpec.startsWith('.')) relSpec = './' + relSpec;
    return relSpec;
  }
  return '@deneb-ui/ui';
}

function functionReferencesSiteData(fn) {
  if (!fn || !fn.body) return false;
  let found = false;
  recast.types.visit(fn.body, {
    visitIdentifier(pathNode) {
      if (pathNode.node.name === 'siteData') {
        found = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return found;
}

function injectSiteDataHook(ast) {
  let injected = false;
  let anyFunctionReferencedSiteData = false;
  let alreadyHasUseSiteData = false;

  recast.types.visit(ast, {
    visitCallExpression(pathNode) {
      if (pathNode.node.callee && pathNode.node.callee.name === 'useSiteData') {
        alreadyHasUseSiteData = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });

  function injectIntoFunction(fn) {
    if (!fn || !fn.body || fn.body.type !== 'BlockStatement') return false;
    const body = fn.body.body;
    const already = body.some((stmt) => recast.print(stmt).code.includes('useSiteData'));
    if (already) return false;
    const hook = b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier('siteData'),
        b.callExpression(b.identifier('useSiteData'), [])
      ),
    ]);
    body.unshift(hook);
    alreadyHasUseSiteData = true;
    return true;
  }

  // Pass 1: Inject useSiteData() into EVERY component function that references siteData
  recast.types.visit(ast, {
    visitFunctionDeclaration(pathNode) {
      if (functionReferencesSiteData(pathNode.node)) {
        anyFunctionReferencedSiteData = true;
        if (injectIntoFunction(pathNode.node)) injected = true;
      }
      this.traverse(pathNode);
    },
    visitFunctionExpression(pathNode) {
      if (functionReferencesSiteData(pathNode.node)) {
        anyFunctionReferencedSiteData = true;
        if (injectIntoFunction(pathNode.node)) injected = true;
      }
      this.traverse(pathNode);
    },
    visitArrowFunctionExpression(pathNode) {
      if (functionReferencesSiteData(pathNode.node)) {
        anyFunctionReferencedSiteData = true;
        if (injectIntoFunction(pathNode.node)) injected = true;
      }
      this.traverse(pathNode);
    },
  });

  // Pass 2: If no component references siteData yet (e.g. before subsequent AST edits),
  // ensure the primary component receives useSiteData()
  if (!injected && !anyFunctionReferencedSiteData && !alreadyHasUseSiteData) {
    recast.types.visit(ast, {
      visitExportDefaultDeclaration(pathNode) {
        if (injected) return false;
        const decl = pathNode.node.declaration;
        if (decl && (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionExpression')) {
          injected = injectIntoFunction(decl);
        }
        this.traverse(pathNode);
      },
      visitFunctionDeclaration(pathNode) {
        if (injected) return false;
        const name = pathNode.node.id && pathNode.node.id.name;
        if (name && /^[A-Z]/.test(name)) {
          injected = injectIntoFunction(pathNode.node);
          return false;
        }
        this.traverse(pathNode);
      },
      visitVariableDeclarator(pathNode) {
        if (injected) return false;
        const id = pathNode.node.id;
        const init = pathNode.node.init;
        if (id && id.type === 'Identifier' && /^[A-Z]/.test(id.name) && init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          injected = injectIntoFunction(init);
          return false;
        }
        this.traverse(pathNode);
      },
    });
  }

  if (!injected && !anyFunctionReferencedSiteData && !alreadyHasUseSiteData) {
    recast.types.visit(ast, {
      visitFunctionDeclaration(pathNode) {
        if (injected) return false;
        injected = injectIntoFunction(pathNode.node);
        return false;
      },
    });
  }

  return injected;
}

function resolveSiteDataSpecifier(profile, fromRelativeFile) {
  const aliases = (profile && profile.aliasMap) || {};
  const hasAt = Object.keys(aliases).some((k) => k === '@/*' || k.startsWith('@/'));
  const hasSrc = Boolean(profile && profile.hasSrc);
  const siteDataRel = hasSrc ? 'src/data/site-data.json' : 'data/site-data.json';
  if (hasAt && hasSrc) return '@/data/site-data.json';

  const root = profile && profile.root ? profile.root : process.cwd();
  const fromAbs = path.join(root, fromRelativeFile || 'page.tsx');
  const toAbs = path.join(root, siteDataRel);
  let relSpec = path.relative(path.dirname(fromAbs), toAbs).replace(/\\/g, '/');
  if (!relSpec.startsWith('.')) relSpec = './' + relSpec;
  return relSpec;
}

function applyFilePlan(filePlan, profile) {
  if (!filePlan.originalCode || !filePlan.transformations.length) {
    return { code: filePlan.originalCode, changed: false };
  }

  const ast = parseSource(filePlan.originalCode, filePlan.file);
  let isClient = hasDirective(ast, 'use client') || hasClientDirective(ast) || /['"]use client['"]/.test(filePlan.originalCode.slice(0, 400));
  const hasMetadata = hasMetadataExport(ast);
  let applied = 0;
  const failures = [];

  const supported = new Set([
    'split-action-contract',
    'form-submit-action',
    'extract-url',
    'extract-image',
    'extract-picture',
    'extract-alt',
    'extract-placeholder',
    'extract-text',
    'extract-prop',
    'wrap-text-span',
    'collection-conversion',
    'style-bind',
    'extract-tailwind-bg',
    'instrument-child-card',
    'bind-button-with-icon',
    'bind-highlighted-heading',
    'prop-flow-callsite',
    'instrument-reusable-component',
  ]);

  const isTypeScript = Boolean(filePlan.file && /\.(tsx|ts)$/.test(filePlan.file));

  // Collections run first: they rewrite the array declaration and add an index
  // parameter, and later per-element edits must observe that shape.
  const ordered = [...filePlan.transformations].sort(
    (left, right) =>
      Number(right.operation === 'collection-conversion') -
      Number(left.operation === 'collection-conversion')
  );

  for (const transform of ordered) {
    if (transform.decision === 'skip') continue;
    if (!supported.has(transform.operation)) continue;

    if (transform.operation === 'instrument-child-card') {
      try {
        if (instrumentChildCardComponent(ast, transform, isTypeScript)) applied++;
      } catch (err) {
        failures.push({ loc: transform.loc, reason: err.message });
      }
      continue;
    }

    if (transform.operation === 'instrument-reusable-component') {
      try {
        if (instrumentReusableComponent(ast, transform, isTypeScript)) applied++;
      } catch (err) {
        failures.push({ loc: transform.loc, reason: err.message });
      }
      continue;
    }

    if (transform.operation === 'collection-conversion') {
      try {
        if (applyCollectionTransform(ast, transform, isClient, isTypeScript)) applied++;
        else failures.push({ loc: transform.loc, reason: 'collection-not-bindable' });
      } catch (err) {
        failures.push({ loc: transform.loc, reason: err.message });
      }
      continue;
    }

    const pathNode = findElementByLoc(ast, transform.loc, transform.componentName || transform.tag);
    if (!pathNode) {
      failures.push({ loc: transform.loc, reason: 'node-not-found' });
      continue;
    }
    try {
      applyTransformToElement(pathNode, transform);
      applied++;
    } catch (err) {
      failures.push({ loc: transform.loc, reason: err.message });
    }
  }

  if (applied === 0) {
    return { code: filePlan.originalCode, changed: false, applied, failures };
  }

  if (!isClient && profile?.router === 'next-app' && !hasMetadata && canSafelyInjectClientDirective(ast, filePlan.file, profile)) {
    if (needsClientDirective(ast, filePlan.originalCode)) {
      ensureClientDirective(ast);
      isClient = true;
    }
  }

  const siteDataImport = resolveSiteDataSpecifier(profile, filePlan.file);
  if (isClient) {
    const runtimeSpecifier = resolveSiteDataRuntimeSpecifier(profile);
    injectSiteDataHook(ast);
    ensureImport(ast, runtimeSpecifier, ['useSiteData']);
  } else {
    ensureDefaultImport(ast, siteDataImport, 'siteData');
  }
  sanitizeDuplicateBindings(ast);

  // Sanitize any conflicting data-preview-static on elements with editable markers
  sanitizeContradictoryMarkers(ast);
  healBroadContainerMarkers(ast);
  healEmptyStateConditionals(ast);
  healHiddenPreviewMarkers(ast);
  healLegacyProductDetailLinks(ast);
  healSectionOverflowHidden(ast);
  healDecorativeOverlays(ast);

  // Page keys are stamped in a separate route-driven pass so App Router and
  // Pages Router projects are handled by the same logic.
  const code = printSource(ast, filePlan.originalCode);
  return { code, changed: true, applied, failures, usedClientHook: isClient };
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

const CANONICAL_SITE_DATA_CONTEXT = `'use client';

export {
  SiteDataProvider,
  useSiteData,
  contentText,
  contentObject,
  contentList,
  PREVIEW_DATA_MESSAGE,
  LEGACY_PREVIEW_DATA_MESSAGE,
  PREVIEW_READY_MESSAGE,
  LEGACY_PREVIEW_READY_MESSAGE,
  PREVIEW_FOCUS_MESSAGE,
  LEGACY_PREVIEW_FOCUS_MESSAGE,
  PREVIEW_FIELD_ATTRIBUTE,
} from '@deneb-ui/ui';

export type { SiteData, SiteDataProviderProps } from '@deneb-ui/ui';
`;

function rewriteRecursiveSiteDataContext(code) {
  const recursive =
    /export\s+function\s+SiteDataProvider\b/.test(code) &&
    /<(?:Base)?SiteDataProvider\b/.test(code);
  if (!recursive) return { code, updated: false };
  return { code: CANONICAL_SITE_DATA_CONTEXT, updated: true };
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

/**
 * Injects <ThemeStyles /> and <ThemeToggle /> into the layout JSX tree.
 * ThemeStyles applies light/dark variables and auto-contrast rules.
 * ThemeToggle provides an out-of-the-box floating theme switcher.
 */
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

/**
 * Injects <PlatformAdditionalPages /> into the layout JSX tree after <main>.
 * This component handles all additionalPages visual-editing markers correctly
 * so template developers never need to know the complex nesting rules.
 *
 * The injected pattern looks like:
 *   <main>{children}</main>
 *   <PlatformAdditionalPages />    ← injected (inside the SiteDataProvider/body)
 *
 * If PlatformAdditionalPages is already in the source, it's a no-op.
 */
function injectPlatformAdditionalPages(ast, providerImport) {
  if (!ast) return;
  // Already injected - skip
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

  // Inject after the first <main> element in any JSX tree
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
        // Build <PlatformAdditionalPages />
        const platformElement = b.jsxElement(
          b.jsxOpeningElement(
            b.jsxIdentifier('PlatformAdditionalPages'),
            [],
            true // self-closing
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

function ensureJsonModule(tsconfig) {
  if (!tsconfig || !tsconfig.compilerOptions) return { config: tsconfig, changed: false };
  if (tsconfig.compilerOptions.resolveJsonModule) return { config: tsconfig, changed: false };
  return {
    config: {
      ...tsconfig,
      compilerOptions: {
        ...tsconfig.compilerOptions,
        resolveJsonModule: true,
      },
    },
    changed: true,
  };
}

function sanitizeContradictoryMarkers(ast) {
  let cleaned = 0;
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const opening = pathNode.node.openingElement;
      if (!opening || !Array.isArray(opening.attributes)) {
        this.traverse(pathNode);
        return;
      }
      const attrs = opening.attributes;
      const hasStatic = attrs.some(
        (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'data-preview-static'
      );
      if (!hasStatic) {
        this.traverse(pathNode);
        return;
      }

      // 0. Broad container collision: broad content containers cannot carry data-preview-static
      const tag = getJsxName(pathNode.node);
      const lower = String(tag || '').toLowerCase();
      if (BROAD_CONTENT_CONTAINERS.has(tag) || BROAD_CONTENT_CONTAINERS.has(lower)) {
        opening.attributes = attrs.filter(
          (a) => !(a.type === 'JSXAttribute' && a.name && a.name.name === 'data-preview-static')
        );
        cleaned++;
        this.traverse(pathNode);
        return;
      }

      // 1. Direct collision: cannot share element with editable markers
      const hasDirectEditable = attrs.some(
        (a) => a.type === 'JSXAttribute' && a.name && (
          a.name.name === 'data-preview-field-path' ||
          a.name.name === 'data-preview-list-path' ||
          a.name.name === 'data-preview-item-path'
        )
      );

      // 2. Hierarchical collision: static element cannot enclose editable descendants
      let hasNestedEditable = false;
      if (!hasDirectEditable) {
        recast.types.visit(pathNode.node, {
          visitJSXElement(inner) {
            if (inner.node === pathNode.node) {
              this.traverse(inner);
              return;
            }
            const innerAttrs = inner.node.openingElement?.attributes || [];
            if (innerAttrs.some(
              (a) => a.type === 'JSXAttribute' && a.name && (
                a.name.name === 'data-preview-field-path' ||
                a.name.name === 'data-preview-list-path' ||
                a.name.name === 'data-preview-item-path'
              )
            )) {
              hasNestedEditable = true;
              return false;
            }
            this.traverse(inner);
          },
        });
      }

      if (hasDirectEditable || hasNestedEditable) {
        opening.attributes = attrs.filter(
          (a) => !(a.type === 'JSXAttribute' && a.name && a.name.name === 'data-preview-static')
        );
        cleaned++;
      }
      this.traverse(pathNode);
    },
  });
  return cleaned;
}

function sanitizeContradictoryMarkersInSource(code, relativeFile) {
  if (!code.includes('data-preview-static') && !code.includes('data-preview-field-path') && !code.includes('data-preview-list-path') && !code.includes('data-preview-item-path') && !code.includes('overflow-hidden') && !code.includes('hidden')) {
    return { code, updated: false };
  }
  let ast;
  try {
    ast = parseSource(code, relativeFile);
  } catch {
    return { code, updated: false };
  }
  const cleaned = sanitizeContradictoryMarkers(ast);
  const healedBroad = healBroadContainerMarkers(ast);
  const healedEmpty = healEmptyStateConditionals(ast);
  const healedHidden = healHiddenPreviewMarkers(ast);
  const healedOverflow = healSectionOverflowHidden(ast);
  const healedOverlay = healDecorativeOverlays(ast);
  if (cleaned === 0 && healedBroad === 0 && healedEmpty === 0 && healedHidden === 0 && healedOverflow === 0 && healedOverlay === 0) return { code, updated: false };
  return { code: printSource(ast, code), updated: true, count: cleaned + healedBroad + healedEmpty + healedHidden + healedOverflow + healedOverlay };
}

function healBroadContainerMarkers(ast) {
  let healed = 0;
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const tag = getJsxName(node);
      const lower = String(tag || '').toLowerCase();
      if (!BROAD_CONTENT_CONTAINERS.has(tag) && !BROAD_CONTENT_CONTAINERS.has(lower)) {
        this.traverse(pathNode);
        return;
      }
      const fieldAttr = findJsxAttribute(node, 'data-preview-field-path');
      if (!fieldAttr) {
        this.traverse(pathNode);
        return;
      }

      const fieldValue = fieldAttr.value;
      node.openingElement.attributes = (node.openingElement.attributes || []).filter(
        (attr) =>
          !(
            attr.type === 'JSXAttribute' &&
            attr.name &&
            (attr.name.name === 'data-preview-field-path' ||
              attr.name.name === 'data-preview-style-target' ||
              attr.name.name === 'data-preview-style-type')
          )
      );

      const leaf = findFirstLeafChild(node);
      if (leaf && !hasJsxAttribute(leaf, 'data-preview-field-path')) {
        leaf.openingElement.attributes.push(
          b.jsxAttribute(b.jsxIdentifier('data-preview-field-path'), fieldValue)
        );
        healed++;
      } else {
        const span = b.jsxElement(
          b.jsxOpeningElement(
            b.jsxIdentifier('span'),
            [b.jsxAttribute(b.jsxIdentifier('data-preview-field-path'), fieldValue)],
            false
          ),
          b.jsxClosingElement(b.jsxIdentifier('span')),
          node.children || [],
          false
        );
        node.children = [span];
        healed++;
      }
      this.traverse(pathNode);
    },
  });
  return healed;
}

function findFirstLeafChild(node) {
  const leafTags = new Set(['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'img', 'button', 'a', 'strong', 'em', 'small']);
  for (const child of node.children || []) {
    if (child && child.type === 'JSXElement') {
      const name = getJsxName(child);
      if (leafTags.has(name) || leafTags.has(String(name).toLowerCase())) return child;
      const nested = findFirstLeafChild(child);
      if (nested) return nested;
    }
  }
  return null;
}

function isUnsafeToStripCondition(leftExpr, rightExpr, pathNode) {
  if (!leftExpr || !rightExpr) return true;

  // 1. Collect all identifiers used on the left-hand side
  const leftIdentifiers = new Set();
  recast.types.visit(leftExpr, {
    visitIdentifier(idPath) {
      leftIdentifiers.add(idPath.node.name);
      return false;
    },
  });

  if (leftIdentifiers.size === 0) return true;

  // 2. State & modal variable keywords (e.g., selectedDish, lightboxIndex, isOpen, activeTab)
  const stateKeywordRegex = /(?:open|active|selected|current|expanded|visible|show|modal|dialog|lightbox|drawer|loading|tab|filter|step|index)/i;
  for (const id of leftIdentifiers) {
    if (stateKeywordRegex.test(id)) {
      return true; // NEVER strip modal/state/selection guards
    }
  }

  // 3. Null / undefined / equality / comparison checks
  let hasComparisonOrNullCheck = false;
  recast.types.visit(leftExpr, {
    visitBinaryExpression(bPath) {
      const op = bPath.node.operator;
      if (['!==', '!=', '===', '==', '>', '<', '>=', '<='].includes(op)) {
        hasComparisonOrNullCheck = true;
      }
      this.traverse(bPath);
    },
    visitUnaryExpression(uPath) {
      if (uPath.node.operator === '!') {
        hasComparisonOrNullCheck = true;
      }
      this.traverse(uPath);
    },
  });
  if (hasComparisonOrNullCheck) return true;

  // 4. Check if ANY identifier in leftExpr is referenced inside rightExpr
  let rightReferencesLeftId = false;
  recast.types.visit(rightExpr, {
    visitIdentifier(idPath) {
      if (leftIdentifiers.has(idPath.node.name)) {
        rightReferencesLeftId = true;
        return false;
      }
      this.traverse(idPath);
    },
  });
  if (rightReferencesLeftId) return true;

  // 5. Check if rightExpr or any of its ancestors is an interactive modal / dialog / overlay / AnimatePresence
  let curr = pathNode;
  while (curr && curr.parent) {
    const parentNode = curr.parent.node;
    if (parentNode && parentNode.type === 'JSXElement') {
      const parentTag = getJsxName(parentNode);
      if (/^(?:AnimatePresence|Dialog|Modal|Lightbox|Drawer|Popup|Sheet|Portal)$/i.test(parentTag)) {
        return true;
      }
    }
    curr = curr.parent;
  }

  let isModalOrOverlay = false;
  recast.types.visit(rightExpr, {
    visitJSXElement(elPath) {
      const node = elPath.node;
      const tag = getJsxName(node);
      if (/^(?:AnimatePresence|Dialog|Modal|Lightbox|Drawer|Popup|Sheet|Portal)$/i.test(tag)) {
        isModalOrOverlay = true;
        return false;
      }
      const classAttr = findJsxAttribute(node, 'className') || findJsxAttribute(node, 'class');
      if (classAttr && classAttr.value) {
        const val = classAttr.value.value || '';
        if (typeof val === 'string' && (/fixed\s+inset-0/i.test(val) || /z-(?:50|\[50\]|40)/i.test(val) || /backdrop-blur/i.test(val))) {
          isModalOrOverlay = true;
          return false;
        }
      }
      const roleAttr = findJsxAttribute(node, 'role');
      if (roleAttr && roleAttr.value && /^(?:dialog|alertdialog)$/i.test(String(roleAttr.value.value || ''))) {
        isModalOrOverlay = true;
        return false;
      }
      this.traverse(elPath);
    },
  });
  if (isModalOrOverlay) return true;

  // 6. Only allow stripping if leftExpr is purely a direct siteData content member chain
  const leftCode = recast.print(leftExpr).code;
  const isDirectContentCheck = /siteData(?:\?\.|\.)content(?:\?\.|\.)/i.test(leftCode);
  if (!isDirectContentCheck) return true;

  return false;
}

function healEmptyStateConditionals(ast) {
  let healed = 0;

  function jsxHasPreviewMarker(node) {
    if (!node) return false;
    if (node.type === 'JSXElement') {
      if (
        hasJsxAttribute(node, 'data-preview-field-path') ||
        hasJsxAttribute(node, 'data-preview-list-path') ||
        hasJsxAttribute(node, 'data-preview-item-path')
      ) {
        return true;
      }
      return (node.children || []).some((child) => jsxHasPreviewMarker(child));
    }
    if (node.type === 'JSXFragment') {
      return (node.children || []).some((child) => jsxHasPreviewMarker(child));
    }
    if (node.type === 'ParenthesizedExpression') return jsxHasPreviewMarker(node.expression);
    return false;
  }

  recast.types.visit(ast, {
    visitLogicalExpression(pathNode) {
      const expr = pathNode.node;
      if (expr.operator === '&&' && jsxHasPreviewMarker(expr.right)) {
        if (!isUnsafeToStripCondition(expr.left, expr.right, pathNode)) {
          pathNode.replace(expr.right);
          healed++;
          return false;
        }
      }
      this.traverse(pathNode);
    },
    visitJSXExpressionContainer(pathNode) {
      const expr = pathNode.node.expression;
      if (!expr) {
        this.traverse(pathNode);
        return;
      }
      if (expr.type === 'LogicalExpression' && expr.operator === '&&' && jsxHasPreviewMarker(expr.right)) {
        if (!isUnsafeToStripCondition(expr.left, expr.right, pathNode)) {
          pathNode.node.expression = expr.right;
          healed++;
          return false;
        }
      }
      if (
        expr.type === 'ConditionalExpression' &&
        jsxHasPreviewMarker(expr.consequent) &&
        (isNullish(expr.alternate) || isNullish(expr.consequent))
      ) {
        if (!isUnsafeToStripCondition(expr.test, expr.consequent, pathNode)) {
          pathNode.node.expression = jsxHasPreviewMarker(expr.consequent) && !isNullish(expr.consequent)
            ? expr.consequent
            : expr.alternate;
          healed++;
          return false;
        }
      }
      this.traverse(pathNode);
    },
  });
  return healed;
}

function isNullish(node) {
  if (!node) return true;
  if (node.type === 'NullLiteral') return true;
  if (node.type === 'Literal' && (node.value === null || node.value === false || node.value === undefined)) return true;
  if (node.type === 'BooleanLiteral' && node.value === false) return true;
  if (node.type === 'Identifier' && (node.name === 'undefined' || node.name === 'null')) return true;
  return false;
}

function healHiddenPreviewMarkers(ast) {
  let healed = 0;
  recast.types.visit(ast, {
    visitJSXOpeningElement(pathNode) {
      const attrs = pathNode.node.attributes || [];
      const hasEditable = attrs.some(
        (attr) =>
          attr.type === 'JSXAttribute' &&
          attr.name &&
          (attr.name.name === 'data-preview-field-path' ||
            attr.name.name === 'data-preview-list-path' ||
            attr.name.name === 'data-preview-item-path')
      );
      if (!hasEditable) {
        this.traverse(pathNode);
        return;
      }
      const classAttr = attrs.find((attr) => attr.type === 'JSXAttribute' && attr.name && (attr.name.name === 'className' || attr.name.name === 'class'));
      let classText = '';
      if (classAttr && classAttr.value) {
        if (classAttr.value.type === 'StringLiteral' || classAttr.value.type === 'Literal') classText = String(classAttr.value.value || '');
        else if (classAttr.value.type === 'JSXExpressionContainer' && classAttr.value.expression) {
          const expr = classAttr.value.expression;
          if (expr.type === 'StringLiteral' || expr.type === 'Literal') classText = String(expr.value || '');
          if (expr.type === 'TemplateLiteral') classText = (expr.quasis || []).map((q) => q.value.cooked || q.value.raw || '').join(' ');
        }
      }
      const isHidden =
        attrs.some((attr) => attr.type === 'JSXAttribute' && attr.name && (
          attr.name.name === 'hidden' ||
          (attr.name.name === 'aria-hidden' && /true/.test(recast.print(attr).code))
        )) ||
        /(?<![\w-])hidden(?![a-zA-Z0-9_-])/.test(classText) ||
        attrs.some((attr) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'style' && /(?:display\s*:\s*['"]none['"]|visibility\s*:\s*['"]hidden['"])/.test(recast.print(attr).code));

      if (isHidden) {
        pathNode.node.attributes = attrs.filter(
          (attr) =>
            !(
              attr.type === 'JSXAttribute' &&
              attr.name &&
              (attr.name.name === 'data-preview-field-path' ||
                attr.name.name === 'data-preview-list-path' ||
                attr.name.name === 'data-preview-item-path' ||
                attr.name.name === 'data-preview-style-target' ||
                attr.name.name === 'data-preview-style-type')
            )
        );
        healed++;
      }
      this.traverse(pathNode);
    },
  });
  return healed;
}

function healLegacyProductDetailLinks(ast) {
  let healed = 0;
  let needsImport = false;

  recast.types.visit(ast, {
    visitJSXAttribute(pathNode) {
      const attr = pathNode.node;
      if (attr.name && attr.name.name === 'href' && attr.value) {
        if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression) {
          const expr = attr.value.expression;
          if (expr.type === 'TemplateLiteral') {
            const quasis = expr.quasis || [];
            if (quasis.length >= 1 && typeof quasis[0].value.raw === 'string' && quasis[0].value.raw.startsWith('/products/')) {
              const arg = expr.expressions && expr.expressions[0];
              if (arg) {
                attr.value.expression = b.callExpression(
                  b.identifier('platformProductDetailHref'),
                  [arg]
                );
                healed++;
                needsImport = true;
              }
            }
          } else if (
            expr.type === 'BinaryExpression' &&
            expr.operator === '+' &&
            expr.left &&
            (expr.left.value === '/products/' || expr.left.value === '/products')
          ) {
            attr.value.expression = b.callExpression(
              b.identifier('platformProductDetailHref'),
              [expr.right]
            );
            healed++;
            needsImport = true;
          }
        }
      }
      this.traverse(pathNode);
    },
  });

  if (needsImport) {
    ensureImport(ast, '@deneb-ui/ui', ['platformProductDetailHref']);
  }
  return healed;
}

function healSectionOverflowHidden(ast) {
  let healed = 0;
  recast.types.visit(ast, {
    visitJSXOpeningElement(pathNode) {
      const node = pathNode.node;
      const tag = getJsxName(node);
      const lower = String(tag || '').toLowerCase();
      const isContainer = lower === 'section' || lower === 'div' || lower === 'main' || lower === 'article';
      if (!isContainer) {
        this.traverse(pathNode);
        return;
      }
      const classAttr = (node.attributes || []).find(
        (a) => a.type === 'JSXAttribute' && a.name && (a.name.name === 'className' || a.name.name === 'class')
      );
      if (!classAttr || !classAttr.value) {
        this.traverse(pathNode);
        return;
      }
      let modified = false;
      if (classAttr.value.type === 'StringLiteral' || classAttr.value.type === 'Literal') {
        const val = String(classAttr.value.value || '');
        if (/\boverflow-hidden\b/.test(val)) {
          classAttr.value.value = val.replace(/\boverflow-hidden\b/g, 'overflow-clip');
          modified = true;
        }
      } else if (classAttr.value.type === 'JSXExpressionContainer') {
        const expr = classAttr.value.expression;
        if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) {
          const val = String(expr.value || '');
          if (/\boverflow-hidden\b/.test(val)) {
            expr.value = val.replace(/\boverflow-hidden\b/g, 'overflow-clip');
            modified = true;
          }
        } else if (expr && expr.type === 'TemplateLiteral') {
          for (const quasi of expr.quasis || []) {
            if (quasi.value && /\boverflow-hidden\b/.test(quasi.value.raw || '')) {
              quasi.value.raw = (quasi.value.raw || '').replace(/\boverflow-hidden\b/g, 'overflow-clip');
              if (quasi.value.cooked) {
                quasi.value.cooked = (quasi.value.cooked || '').replace(/\boverflow-hidden\b/g, 'overflow-clip');
              }
              modified = true;
            }
          }
        }
      }
      if (modified) healed++;
      this.traverse(pathNode);
    },
  });
  return healed;
}

function healDecorativeOverlays(ast) {
  let healed = 0;
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const tag = getJsxName(node);
      const lower = String(tag || '').toLowerCase();
      if (lower !== 'div' && lower !== 'span') {
        this.traverse(pathNode);
        return;
      }
      const hasRealChildren = (node.children || []).some(
        (c) => c.type === 'JSXElement' || (c.type === 'JSXText' && c.value.trim().length > 0)
      );
      if (hasRealChildren) {
        this.traverse(pathNode);
        return;
      }
      const classAttr = (node.openingElement.attributes || []).find(
        (a) => a.type === 'JSXAttribute' && a.name && (a.name.name === 'className' || a.name.name === 'class')
      );
      if (!classAttr || !classAttr.value) {
        this.traverse(pathNode);
        return;
      }
      let modified = false;
      const overlayPattern = /\b(?:bg-gradient-|bg-black\/|bg-white\/|bg-slate-\d+\/|backdrop-blur)/;
      const isAbsolute = /\babsolute\b/;
      const hasPointerEvents = /\bpointer-events-(?:none|auto)\b/;

      if (classAttr.value.type === 'StringLiteral' || classAttr.value.type === 'Literal') {
        const val = String(classAttr.value.value || '');
        if (isAbsolute.test(val) && overlayPattern.test(val) && !hasPointerEvents.test(val)) {
          classAttr.value.value = `${val} pointer-events-none`;
          modified = true;
        }
      } else if (classAttr.value.type === 'JSXExpressionContainer') {
        const expr = classAttr.value.expression;
        if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) {
          const val = String(expr.value || '');
          if (isAbsolute.test(val) && overlayPattern.test(val) && !hasPointerEvents.test(val)) {
            expr.value = `${val} pointer-events-none`;
            modified = true;
          }
        } else if (expr && expr.type === 'TemplateLiteral') {
          const fullText = (expr.quasis || []).map((q) => q.value?.raw || '').join(' ');
          if (isAbsolute.test(fullText) && overlayPattern.test(fullText) && !hasPointerEvents.test(fullText)) {
            const lastQuasi = expr.quasis[expr.quasis.length - 1];
            if (lastQuasi && lastQuasi.value) {
              lastQuasi.value.raw = `${lastQuasi.value.raw} pointer-events-none`;
              if (lastQuasi.value.cooked) {
                lastQuasi.value.cooked = `${lastQuasi.value.cooked} pointer-events-none`;
              }
              modified = true;
            }
          }
        }
      }
      if (modified) healed++;
      this.traverse(pathNode);
    },
  });
  return healed;
}

function healMissingSiteDataHooks(code, filePath = 'file.tsx') {
  if (!code.includes('siteData')) return code;
  try {
    const ast = parseSource(code, filePath);
    const injected = injectSiteDataHook(ast);
    if (injected) {
      ensureImport(ast, '@deneb-ui/ui', ['useSiteData']);
      return printSource(ast, code);
    }
  } catch {}
  return code;
}

function healUnguardedModalConditionals(ast) {
  let healed = 0;
  const stateVariables = [];
  recast.types.visit(ast, {
    visitVariableDeclarator(pathNode) {
      const node = pathNode.node;
      if (node.id && node.id.type === 'ArrayPattern') {
        const first = node.id.elements[0];
        if (first && first.type === 'Identifier') {
          stateVariables.push(first.name);
        }
      }
      this.traverse(pathNode);
    },
  });

  if (stateVariables.length === 0) return 0;

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const tag = getJsxName(pathNode.node);
      if (tag === 'AnimatePresence') {
        for (const child of pathNode.node.children || []) {
          if (child.type === 'JSXExpressionContainer') {
            let inner = child.expression;
            if (inner && inner.type === 'ParenthesizedExpression') {
              inner = inner.expression;
            }
            if (inner && (inner.type === 'JSXElement' || inner.type === 'JSXFragment')) {
              const innerIds = new Set();
              recast.types.visit(inner, {
                visitIdentifier(idPath) {
                  innerIds.add(idPath.node.name);
                  return false;
                },
              });

              const matchingVar = stateVariables.find((sv) => innerIds.has(sv));
              if (matchingVar) {
                let guardExpr;
                if (/index/i.test(matchingVar)) {
                  guardExpr = b.binaryExpression('!==', b.identifier(matchingVar), b.nullLiteral());
                } else {
                  guardExpr = b.identifier(matchingVar);
                }
                child.expression = b.logicalExpression('&&', guardExpr, inner);
                healed++;
              }
            }
          }
        }
      }
      this.traverse(pathNode);
    },
  });

  return healed;
}

function healUnguardedModalConditionalsInSource(code, filePath = 'file.tsx') {
  if (!code.includes('AnimatePresence') && !code.includes('fixed inset-0')) return { code, updated: false };
  try {
    const ast = parseSource(code, filePath);
    const healed = healUnguardedModalConditionals(ast);
    if (healed > 0) {
      return { code: printSource(ast, code), updated: true, count: healed };
    }
  } catch {}
  return { code, updated: false };
}

module.exports = {
  applyFilePlan,
  applyCollectionTransform,
  instrumentLayoutSource,
  instrumentPageKey,
  resolveSiteDataSpecifier,
  resolveSiteDataRuntimeSpecifier,
  rewriteRecursiveSiteDataContext,
  ensureJsonModule,
  inferPageKey,
  sanitizeContradictoryMarkers,
  sanitizeContradictoryMarkersInSource,
  healBroadContainerMarkers,
  healEmptyStateConditionals,
  healHiddenPreviewMarkers,
  healSectionOverflowHidden,
  healDecorativeOverlays,
  healLegacyProductDetailLinks,
  healMissingSiteDataHooks,
  healUnguardedModalConditionals,
  healUnguardedModalConditionalsInSource,
  injectSiteDataHook,
  instrumentChildCardComponent,
};


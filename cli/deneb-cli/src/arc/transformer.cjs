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
  jsxStyleAttrs,
  ensureStyleAttrs,
  b,
} = require('./ast.cjs');
const { toPosix } = require('./fs-utils.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('./fivora-contract.cjs');

function findElementByLoc(ast, loc) {
  let found = null;
  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      if (locKey(pathNode.node) === loc) {
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

    if (!hasJsxAttribute(node, 'data-preview-static')) {
      node.openingElement.attributes.push(
        b.jsxAttribute(b.jsxIdentifier('data-preview-static'), b.stringLiteral('action-link'))
      );
    }
    if (hasJsxAttribute(node, 'data-preview-field-path')) {
      node.openingElement.attributes = node.openingElement.attributes.filter(
        (attr) => !(attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'data-preview-field-path')
      );
    }
    splitActionChildren(node, transform.labelField, transform.labelFallback || '');
    wrapHiddenUrlSibling(pathNode, transform.urlField, transform.fallback);
    return;
  }
  if (transform.operation === 'extract-url') {
    replaceAttrValue(node, 'href', siteDataBinding(transform.field.split('.'), transform.fallback, 'url'));
    ensurePreviewPath(node, transform.field);
    return;
  }
  if (transform.operation === 'extract-image') {
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
    if (transform.styleKind === 'grid' || transform.styleKind === 'card') return;
    ensureStyleAttrs(node, transform.stylePath, transform.styleKind || 'text');
  }
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

/**
 * Converts a literal-array `.map()` render into a Fivora list contract.
 *
 * The developer's array declaration becomes site-data backed with the original
 * literal as fallback, so `{item.title}` keeps working untouched. Markers are
 * emitted as JSX template literals (`items[${index}].title`) so added and
 * reordered items stay editable, which is what strict mode requires.
 */
function applyCollectionTransform(ast, transform, isClient = false) {
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
    indexName = callback.params.some((p) => p.name === 'index') ? 'denebIndex' : 'index';
    callback.params.push(b.identifier(indexName));
  }

  const itemRoot = findElementByLoc(ast, transform.loc);
  if (!itemRoot) return false;

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

  markItemFields(callback, { listPath, binding, indexName });

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

  return bindArrayDeclaration(ast, mapCall, listPath, isClient);
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
            inner.traverse(inner);
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
        node.openingElement.attributes.push(
          jsxTemplatePathAttr('data-preview-field-path', listPath, indexName, `.${property}`)
        );
      }

      this.traverse(pathNode);
    },
  });
}

function itemMemberName(expr, binding) {
  if (!expr || expr.type !== 'MemberExpression' || expr.computed) return null;
  if (expr.object?.type !== 'Identifier' || expr.object.name !== binding) return null;
  return expr.property?.name || null;
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

function bindArrayDeclaration(ast, mapCallPath, listPath, isClient = false) {
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
            const localDecl = b.variableDeclaration('const', [
              b.variableDeclarator(
                b.identifier(arrayName),
                siteDataListBinding(listPath.split('.'), b.identifier(defaultName))
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

      node.init = siteDataListBinding(listPath.split('.'), node.init);
      bound = true;
      return false;
    },
  });

  return bound;
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

function injectSiteDataHook(ast) {
  const program = ast.program || ast;
  let injected = false;

  function injectIntoFunction(fn) {
    if (!fn || !fn.body || fn.body.type !== 'BlockStatement') return false;
    const body = fn.body.body;
    const already = body.some((stmt) => recast.print(stmt).code.includes('useSiteData'));
    if (already) return true;
    const hook = b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier('siteData'),
        b.callExpression(b.identifier('useSiteData'), [])
      ),
    ]);
    body.unshift(hook);
    return true;
  }

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

  if (!injected) {
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
  const aliases = profile.aliasMap || {};
  const hasAt = Object.keys(aliases).some((k) => k === '@/*' || k.startsWith('@/'));
  const siteDataRel = profile.hasSrc ? 'src/data/site-data.json' : 'data/site-data.json';
  if (hasAt && profile.hasSrc) return '@/data/site-data.json';

  const fromAbs = path.join(profile.root, fromRelativeFile);
  const toAbs = path.join(profile.root, siteDataRel);
  let relSpec = path.relative(path.dirname(fromAbs), toAbs).replace(/\\/g, '/');
  if (!relSpec.startsWith('.')) relSpec = './' + relSpec;
  return relSpec;
}

function applyFilePlan(filePlan, profile) {
  if (!filePlan.originalCode || !filePlan.transformations.length) {
    return { code: filePlan.originalCode, changed: false };
  }

  const ast = parseSource(filePlan.originalCode, filePlan.file);
  const isClient = hasDirective(ast, 'use client') || /['"]use client['"]/.test(filePlan.originalCode.slice(0, 400));
  let applied = 0;
  const failures = [];

  const supported = new Set([
    'split-action-contract',
    'extract-url',
    'extract-image',
    'extract-alt',
    'extract-placeholder',
    'extract-text',
    'wrap-text-span',
    'collection-conversion',
    'style-bind',
  ]);

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

    if (transform.operation === 'collection-conversion') {
      try {
        if (applyCollectionTransform(ast, transform, isClient)) applied++;
        else failures.push({ loc: transform.loc, reason: 'collection-not-bindable' });
      } catch (err) {
        failures.push({ loc: transform.loc, reason: err.message });
      }
      continue;
    }

    const pathNode = findElementByLoc(ast, transform.loc);
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

  const siteDataImport = resolveSiteDataSpecifier(profile, filePlan.file);
  if (isClient) {
    const runtimeSpecifier = resolveSiteDataRuntimeSpecifier(profile);
    if (!fileAlreadyUsesSiteDataHook(ast)) {
      injectSiteDataHook(ast);
    }
    ensureImport(ast, runtimeSpecifier, ['useSiteData']);
  } else {
    ensureDefaultImport(ast, siteDataImport, 'siteData');
  }
  sanitizeDuplicateBindings(ast);

  // Sanitize any conflicting data-preview-static on elements with editable markers
  sanitizeContradictoryMarkers(ast);

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

  const hasProvider = /SiteDataProvider|DenebDataProvider/.test(code);
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
  sanitizeDuplicateBindings(ast);
  const next = printSource(ast, code);
  return { code: next, updated: next !== code };
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
    visitJSXOpeningElement(pathNode) {
      const attrs = pathNode.node.attributes || [];
      const hasEditable = attrs.some(
        (a) => a.type === 'JSXAttribute' && a.name && (
          a.name.name === 'data-preview-field-path' ||
          a.name.name === 'data-preview-list-path' ||
          a.name.name === 'data-preview-item-path'
        )
      );
      const hasStatic = attrs.some(
        (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'data-preview-static'
      );
      if (hasEditable && hasStatic) {
        pathNode.node.attributes = attrs.filter(
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
  if (!code.includes('data-preview-static')) return { code, updated: false };
  if (!code.includes('data-preview-field-path') && !code.includes('data-preview-list-path') && !code.includes('data-preview-item-path')) {
    return { code, updated: false };
  }
  let ast;
  try {
    ast = parseSource(code, relativeFile);
  } catch {
    return { code, updated: false };
  }
  const count = sanitizeContradictoryMarkers(ast);
  if (count === 0) return { code, updated: false };
  return { code: printSource(ast, code), updated: true, count };
}

module.exports = {
  applyFilePlan,
  instrumentLayoutSource,
  instrumentPageKey,
  resolveSiteDataSpecifier,
  resolveSiteDataRuntimeSpecifier,
  rewriteRecursiveSiteDataContext,
  ensureJsonModule,
  inferPageKey,
  sanitizeContradictoryMarkers,
  sanitizeContradictoryMarkersInSource,
};

'use strict';

const recast = require('recast');
const {
  locKey,
  getJsxName,
  hasJsxAttribute,
  jsxTemplatePathAttr,
  siteDataListBinding,
  extractItemMemberName,
  unwrapExpr,
  b,
} = require('../../ast.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('../../fivora-contract.cjs');
const { findElementByLoc, isModuleLevel, findEnclosingFunction } = require('../transform-context.cjs');

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

function findListContainer(mapCallPath) {
  let current = mapCallPath.parent;
  while (current) {
    const node = current.node || current.value;
    if (node?.type === 'JSXElement') return node;
    current = current.parentPath || current.parent;
  }
  return null;
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

function applyCollectionTransform(ast, transform, isClient = false, isTypeScript = false) {
  const listPath = transform.listField;
  const binding = transform.itemParam;
  if (!listPath || !binding) return false;

  const mapCall = findMapCall(ast, transform.loc);
  if (!mapCall) return false;

  const callback = (mapCall.node.arguments || [])[0];
  if (!callback) return false;

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

module.exports = {
  applyCollectionTransform,
  buildCompositeKeyAttribute,
  findMapCall,
  markItemFields,
  wrapItemFieldInSpan,
  markComponentRefItemsStatic,
  itemMemberName,
  isDirectItemExpr,
  markPrimitiveItemFields,
  wrapPrimitiveItemFieldInSpan,
  findListContainer,
  bindArrayDeclaration,
  mergeDefaultItemRefsBinding,
};

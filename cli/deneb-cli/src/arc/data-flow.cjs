'use strict';

const { unwrapExpr } = require('./ast.cjs');

/**
 * Array pipeline methods commonly used before .map()
 */
const ARRAY_TRANSFORM_METHODS = new Set([
  'filter',
  'slice',
  'sort',
  'concat',
  'reverse',
  'flatMap',
  'take',
  'splice',
]);

/**
 * Unrolls a chained array expression to its root data source identifier.
 * e.g.:
 *   products.slice(0, 4) -> 'products'
 *   products.filter(p => p.featured).slice(0, 4) -> 'products'
 *   Object.values(products) -> 'products'
 *   [...featured, ...newItems] -> ['featured', 'newItems']
 */
function unrollCollectionSource(exprNode, aliasMap = new Map()) {
  if (!exprNode) return null;
  let curr = unwrapExpr(exprNode);

  // Direct identifier: products
  if (curr.type === 'Identifier') {
    const name = curr.name;
    if (aliasMap.has(name)) {
      return aliasMap.get(name);
    }
    return { rootName: name, chain: [], kind: 'identifier' };
  }

  // Method call: products.slice(0, 4) or products.filter(...).slice(...)
  if (curr.type === 'CallExpression') {
    const callee = curr.callee;

    // Object.values(products) or Object.entries(products)
    if (
      callee?.type === 'MemberExpression' &&
      callee.object?.type === 'Identifier' &&
      callee.object.name === 'Object' &&
      callee.property?.type === 'Identifier' &&
      (callee.property.name === 'values' || callee.property.name === 'entries')
    ) {
      const arg = curr.arguments?.[0];
      if (arg?.type === 'Identifier') {
        const root = unrollCollectionSource(arg, aliasMap);
        return {
          rootName: root?.rootName || arg.name,
          chain: ['Object.' + callee.property.name, ...(root?.chain || [])],
          kind: 'object-values',
        };
      }
    }

    // array.method(...)
    if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
      const methodName = callee.property.name;
      if (ARRAY_TRANSFORM_METHODS.has(methodName) || methodName === 'map') {
        const sub = unrollCollectionSource(callee.object, aliasMap);
        if (sub) {
          return {
            rootName: sub.rootName,
            chain: [methodName, ...sub.chain],
            kind: 'pipeline',
          };
        }
      }
    }
  }

  // Array spread literal: [...featured, ...newItems]
  if (curr.type === 'ArrayExpression') {
    const roots = [];
    for (const el of curr.elements || []) {
      if (el?.type === 'SpreadElement' && el.argument?.type === 'Identifier') {
        const sub = unrollCollectionSource(el.argument, aliasMap);
        roots.push(sub?.rootName || el.argument.name);
      } else if (el?.type === 'Identifier') {
        const sub = unrollCollectionSource(el, aliasMap);
        roots.push(sub?.rootName || el.name);
      }
    }
    if (roots.length > 0) {
      return {
        rootName: roots[0],
        additionalRoots: roots.slice(1),
        chain: ['spread-merge'],
        kind: 'spread',
      };
    }
  }

  return null;
}

/**
 * Collects variable aliases inside an AST that point to arrays.
 * e.g. `const featuredProducts = products.slice(0, 4);`
 */
function collectVariableAliases(ast) {
  const aliases = new Map();
  if (!ast) return aliases;

  const recast = require('recast');
  recast.types.visit(ast, {
    visitVariableDeclarator(pathNode) {
      const node = pathNode.node;
      if (node.id?.type === 'Identifier' && node.init) {
        const varName = node.id.name;
        const resolved = unrollCollectionSource(node.init, aliases);
        if (resolved && (resolved.rootName || resolved.rootIdentifier)) {
          aliases.set(varName, {
            ...resolved,
            rootIdentifier: resolved.rootIdentifier || resolved.rootName,
            transformMethod: resolved.chain?.[0] || 'slice',
          });
        }
      }
      this.traverse(pathNode);
    },
  });

  return aliases;
}

module.exports = {
  ARRAY_TRANSFORM_METHODS,
  unrollCollectionSource,
  unrollCollectionPipelines: (ast) => {
    const pipelines = [];
    const recast = require('recast');
    recast.types.visit(ast, {
      visitCallExpression(pathNode) {
        if (pathNode.node.callee?.property?.name === 'map') {
          const res = unrollCollectionSource(pathNode.node.callee.object);
          if (res && res.chain && res.chain.length > 0) {
            pipelines.push({
              rootIdentifier: res.rootName || res.rootIdentifier,
              pipelineChain: [...res.chain].reverse(),
            });
          }
        }
        this.traverse(pathNode);
      },
    });
    return pipelines;
  },
  collectVariableAliases,
  resolveVariableAliases: collectVariableAliases,
};

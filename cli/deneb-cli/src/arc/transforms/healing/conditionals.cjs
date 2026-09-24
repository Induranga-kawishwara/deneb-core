'use strict';

const recast = require('recast');
const {
  parseSource,
  printSource,
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  b,
} = require('../../ast.cjs');
const {
  sanitizeContradictoryMarkers,
  healBroadContainerMarkers,
  healHiddenPreviewMarkers,
  healSectionOverflowHidden,
  healDecorativeOverlays,
} = require('./sanitizer.cjs');

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

function isNullish(node) {
  if (!node) return true;
  if (node.type === 'NullLiteral') return true;
  if (node.type === 'Literal' && (node.value === null || node.value === false || node.value === undefined)) return true;
  if (node.type === 'BooleanLiteral' && node.value === false) return true;
  if (node.type === 'Identifier' && (node.name === 'undefined' || node.name === 'null')) return true;
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

module.exports = {
  isUnsafeToStripCondition,
  isNullish,
  healEmptyStateConditionals,
  healUnguardedModalConditionals,
  healUnguardedModalConditionalsInSource,
  sanitizeContradictoryMarkersInSource,
};

'use strict';

const recast = require('recast');
const {
  parseSource,
  printSource,
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  ensureImport,
  b,
} = require('../../ast.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('../../fivora-contract.cjs');
const { injectSiteDataHook } = require('../runtime/provider.cjs');

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

      const hasDirectEditable = attrs.some(
        (a) => a.type === 'JSXAttribute' && a.name && (
          a.name.name === 'data-preview-field-path' ||
          a.name.name === 'data-preview-list-path' ||
          a.name.name === 'data-preview-item-path'
        )
      );

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

module.exports = {
  sanitizeContradictoryMarkers,
  healBroadContainerMarkers,
  findFirstLeafChild,
  healHiddenPreviewMarkers,
  healLegacyProductDetailLinks,
  healSectionOverflowHidden,
  healDecorativeOverlays,
  healMissingSiteDataHooks,
};

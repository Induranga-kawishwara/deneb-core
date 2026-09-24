'use strict';

/**
 * Pass B of the ARC planner: residual bind-or-static closure.
 *
 * Confidence cannot rescue dynamic leftovers (c_sem = 0.15). After Pass A,
 * every remaining visible literal is either bound to a field or marked
 * data-preview-static with a reason. This pass ignores the 0.60 skip floor.
 */

const recast = require('recast');
const {
  parseSource,
  printSource,
  getJsxName,
  hasJsxAttribute,
  findJsxAttribute,
  collectJsxText,
  wrapTextInEditableSpan,
  jsxPreviewAttr,
  jsxStaticAttr,
  ensureStyleAttrs,
  siteDataBinding,
  b,
} = require('./ast.cjs');
const {
  SKIP_TAGS,
  HEADING_TAGS,
  TEXT_TAGS,
  ACTION_TAGS,
  IMAGE_TAGS,
  DECORATIVE_TAGS,
  isIconComponent,
} = require('./adapters.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('./fivora-contract.cjs');
const { inferSection, inferFieldName, buildFieldPath, classifyFieldType } = require('./field-paths.cjs');
const { isStaticSkipText } = require('./semantic.cjs');

const LEAF_TEXT_TAGS = new Set([
  ...HEADING_TAGS,
  ...TEXT_TAGS,
  'em', 'strong', 'small', 'b', 'i', 'u', 'code', 'time', 'cite', 'mark',
  'dt', 'dd', 'th', 'td', 'legend', 'caption',
]);

const CHROME_TEXT_RE = /^(×|x|✕|✖|\+|−|-|•|·|…|\.|…|\||\/|©|®|™|\d+)$/i;
const CART_CHROME_RE = /^(qty|quantity|subtotal|total|cart|checkout|remove|close|menu)$/i;

function attrLiteral(node, name) {
  const attr = findJsxAttribute(node, name);
  if (!attr || !attr.value) return '';
  if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') return String(attr.value.value || '');
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) return String(expr.value || '');
  }
  return '';
}

function hasEditableMarker(node) {
  return (
    hasJsxAttribute(node, 'data-preview-field-path') ||
    hasJsxAttribute(node, 'data-preview-list-path') ||
    hasJsxAttribute(node, 'data-preview-item-path') ||
    hasJsxAttribute(node, 'data-preview-static')
  );
}

function ancestorHasStatic(pathNode) {
  let current = pathNode.parent;
  while (current) {
    const node = current.node || current.value;
    if (node && node.type === 'JSXElement' && hasJsxAttribute(node, 'data-preview-static')) return true;
    current = current.parentPath || current.parent;
  }
  return false;
}

function inMapCallback(pathNode) {
  let current = pathNode.parent;
  while (current) {
    const node = current.node || current.value;
    if (
      node &&
      node.type === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'MemberExpression' &&
      node.callee.property &&
      node.callee.property.name === 'map'
    ) {
      return true;
    }
    current = current.parentPath || current.parent;
  }
  return false;
}

function isMeaningfulVisibleText(text, isLogoOrList = false) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  if (value.length < 2 && !isLogoOrList) return false;
  if (!/\p{L}/u.test(value)) return false;
  if (isStaticSkipText(value, isLogoOrList)) return false;
  if (CHROME_TEXT_RE.test(value)) return false;
  return true;
}

function isDecorativeCopy(text, tag, className) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return true;
  if (CHROME_TEXT_RE.test(value)) return true;
  if (CART_CHROME_RE.test(value) && /cart|drawer|qty|quantity/i.test(className || '')) return true;
  if (DECORATIVE_TAGS.has(tag) || tag === 'svg') return true;
  if (/\bsr-only\b|\bhidden\b/.test(className || '')) return true;
  return false;
}

function classifyResidual(node, text, tag) {
  const className = attrLiteral(node, 'className') || attrLiteral(node, 'class');
  const ariaHidden = attrLiteral(node, 'aria-hidden') === 'true' || hasJsxAttribute(node, 'hidden') || /(^|\s)hidden(\s|$)/.test(className);
  if (ariaHidden || DECORATIVE_TAGS.has(tag) || isIconComponent(tag, '')) {
    return { bind: false, reason: 'decorative-icon' };
  }
  if (isDecorativeCopy(text, tag, className)) {
    return { bind: false, reason: 'chrome' };
  }
  if (IMAGE_TAGS.has(tag) && attrLiteral(node, 'src')) {
    return { bind: true, kind: 'image', value: attrLiteral(node, 'src') };
  }
  const isExplicitLogo = /\b(site-logo|brand-logo|nav-logo|header-logo|monogram)\b/i.test(className);
  const ariaLabel = attrLiteral(node, 'aria-label');
  const isLogoContext =
    isExplicitLogo ||
    ((tag === 'a' || tag === 'Link' || tag === 'span') &&
      (attrLiteral(node, 'href') === '/' || /\b(logo|home)\b/i.test(ariaLabel)));
  const isListContext = tag === 'li' || /list-item|bullet/i.test(className);

  if (isMeaningfulVisibleText(text, isLogoContext || isListContext)) {
    return { bind: true, kind: 'text', value: text, isBrandLogo: isLogoContext };
  }
  if (text && text.trim()) {
    return { bind: false, reason: 'decorative-copy' };
  }
  return null;
}

function hasEditableDescendant(node) {
  if (!node || !Array.isArray(node.children)) return false;
  for (const child of node.children) {
    if (child.type === 'JSXElement') {
      if (hasEditableMarker(child.openingElement || child)) return true;
      if (hasEditableDescendant(child)) return true;
    }
  }
  return false;
}

function ensureStaticOnLeaf(node, reason) {
  const tag = getJsxName(node);
  if (BROAD_CONTENT_CONTAINERS.has(tag.toLowerCase()) || BROAD_CONTENT_CONTAINERS.has(tag)) {
    return false;
  }
  if (hasJsxAttribute(node, 'data-preview-static') || hasEditableMarker(node) || hasEditableDescendant(node)) return false;
  node.openingElement.attributes.push(jsxStaticAttr(reason || 'decorative'));
  return true;
}

function wrapFirstLiteralAsStatic(node, reason) {
  const nextChildren = [];
  let wrapped = false;
  for (const child of node.children || []) {
    if (!wrapped && child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
      const leading = child.value.match(/^\s*/)?.[0] || '';
      const trailing = child.value.match(/\s*$/)?.[0] || '';
      const text = child.value.trim();
      if (leading) nextChildren.push(b.jsxText(leading));
      nextChildren.push(
        b.jsxElement(
          b.jsxOpeningElement(b.jsxIdentifier('span'), [jsxStaticAttr(reason || 'decorative')], false),
          b.jsxClosingElement(b.jsxIdentifier('span')),
          [b.jsxText(text)],
          false
        )
      );
      if (trailing) nextChildren.push(b.jsxText(trailing));
      wrapped = true;
      continue;
    }
    nextChildren.push(child);
  }
  if (wrapped) node.children = nextChildren;
  return wrapped;
}

function applyResidualPass({ code, file, ownerScope, usedPaths, componentName, role, ir }) {
  if (!code || !code.includes('<')) {
    return { code, changed: false, fields: [], applied: 0 };
  }

  let ast;
  try {
    ast = parseSource(code, file);
  } catch {
    return { code, changed: false, fields: [], applied: 0 };
  }

  const fields = [];
  let applied = 0;
  const used = usedPaths instanceof Set ? usedPaths : new Set(usedPaths || []);

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const tag = getJsxName(node);
      const lower = tag.toLowerCase();

      if (!tag || SKIP_TAGS.has(tag) || tag === 'React.Fragment' || tag === 'Fragment') {
        this.traverse(pathNode);
        return;
      }

      if (hasEditableMarker(node) || ancestorHasStatic(pathNode)) {
        this.traverse(pathNode);
        return;
      }

      if (DECORATIVE_TAGS.has(tag) || isIconComponent(tag, '')) {
        if (ensureStaticOnLeaf(node, 'decorative-icon')) applied++;
        this.traverse(pathNode);
        return;
      }

      const text = collectJsxText(node);
      const srcAttr = findJsxAttribute(node, 'src');
      let src = attrLiteral(node, 'src');
      if (!src && srcAttr && srcAttr.value && srcAttr.value.type === 'JSXExpressionContainer') {
        const expr = srcAttr.value.expression;
        if (expr && expr.type === 'Identifier') {
          src = ir && typeof ir.getAssetImport === 'function' ? ir.getAssetImport(file, expr.name) : null;
        }
      }
      const placeholder = attrLiteral(node, 'placeholder');
      const alt = attrLiteral(node, 'alt');

      const decision = classifyResidual(node, text, tag);
      const insideMap = inMapCallback(pathNode);

      if (insideMap && decision && decision.bind && ACTION_TAGS.has(tag)) {
        // Repeated chrome inside a list stays static so we never couple parallel arrays.
        if (BROAD_CONTENT_CONTAINERS.has(lower)) {
          if (wrapFirstLiteralAsStatic(node, 'collection-chrome')) applied++;
        } else if (ensureStaticOnLeaf(node, 'collection-chrome')) {
          applied++;
        }
        this.traverse(pathNode);
        return;
      }

      if (IMAGE_TAGS.has(tag) && src && !src.startsWith('{') && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const section = inferSection({
          componentName,
          fileName: file,
          className: attrLiteral(node, 'className'),
          tag,
          role,
        });
        const field = buildFieldPath({
          scope: ownerScope || 'home',
          section,
          field: inferFieldName('image', tag, src, {}),
          used,
        });
        node.openingElement.attributes.push(jsxPreviewAttr(field));
        if (srcAttr) {
          srcAttr.value = b.jsxExpressionContainer(siteDataBinding(field.split('.'), src, 'image'));
        }
        fields.push({ path: field, type: 'image', value: src });
        applied++;
        this.traverse(pathNode);
        return;
      }

      if (placeholder && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const section = inferSection({ componentName, fileName: file, tag, role });
        const field = buildFieldPath({
          scope: ownerScope || 'home',
          section,
          field: inferFieldName('placeholder', tag, placeholder, {}),
          used,
        });
        node.openingElement.attributes.push(jsxPreviewAttr(field));
        const ph = findJsxAttribute(node, 'placeholder');
        if (ph) {
          ph.value = b.jsxExpressionContainer(siteDataBinding(field.split('.'), placeholder, 'text'));
        }
        fields.push({ path: field, type: 'text', value: placeholder });
        applied++;
      }

      if (alt && isMeaningfulVisibleText(alt) && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const section = inferSection({ componentName, fileName: file, tag, role });
        const field = buildFieldPath({
          scope: ownerScope || 'home',
          section,
          field: inferFieldName('alt', tag, alt, {}),
          used,
        });
        const altAttr = findJsxAttribute(node, 'alt');
        if (altAttr) {
          altAttr.value = b.jsxExpressionContainer(siteDataBinding(field.split('.'), alt, 'text'));
        }
        fields.push({ path: field, type: 'text', value: alt });
        applied++;
      }

      if (decision && decision.bind && decision.kind === 'text') {
        const isLogoText = Boolean(decision.isBrandLogo);
        const section = inferSection({
          componentName,
          fileName: file,
          className: attrLiteral(node, 'className'),
          tag,
          role,
        });
        const field = buildFieldPath({
          scope: (isLogoText && (role === 'navigation' || /header|footer|nav/i.test(file))) ? 'common' : (ownerScope || 'home'),
          section,
          field: inferFieldName('text', tag, text, { tag, isBrandLogo: isLogoText }),
          used,
        });
        const fieldType = classifyFieldType('text', text);

        if (BROAD_CONTENT_CONTAINERS.has(lower) || BROAD_CONTENT_CONTAINERS.has(tag)) {
          const nextChildren = [];
          let wrapped = false;
          for (const child of node.children || []) {
            if (!wrapped && child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
              const leading = child.value.match(/^\s*/)?.[0] || '';
              const trailing = child.value.match(/\s*$/)?.[0] || '';
              if (leading) nextChildren.push(b.jsxText(leading));
              nextChildren.push(wrapTextInEditableSpan(field, text, fieldType));
              if (trailing) nextChildren.push(b.jsxText(trailing));
              wrapped = true;
              continue;
            }
            nextChildren.push(child);
          }
          if (wrapped) {
            node.children = nextChildren;
            fields.push({ path: field, type: fieldType, value: text });
            applied++;
          }
        } else if (LEAF_TEXT_TAGS.has(tag) || HEADING_TAGS.has(tag) || tag === 'button' || tag === 'Button') {
          if (ACTION_TAGS.has(tag) && (hasJsxAttribute(node, 'href') || tag === 'a' || tag === 'Link')) {
            const nextChildren = [];
            let wrapped = false;
            for (const child of node.children || []) {
              if (!wrapped && child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
                const leading = child.value.match(/^\s*/)?.[0] || '';
                const trailing = child.value.match(/\s*$/)?.[0] || '';
                if (leading) nextChildren.push(b.jsxText(leading));
                nextChildren.push(wrapTextInEditableSpan(field, text, fieldType));
                if (trailing) nextChildren.push(b.jsxText(trailing));
                wrapped = true;
                continue;
              }
              nextChildren.push(child);
            }
            if (wrapped) {
              node.children = nextChildren;
              fields.push({ path: field, type: fieldType, value: text });
              applied++;
            }
          } else {
            node.openingElement.attributes.push(jsxPreviewAttr(field));
            ensureStyleAttrs(node, field, tag === 'button' || tag === 'Button' ? 'button' : 'text');
            const nextChildren = [];
            let replaced = false;
            for (const child of node.children || []) {
              if (!replaced && child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
                nextChildren.push(b.jsxExpressionContainer(siteDataBinding(field.split('.'), text, fieldType)));
                replaced = true;
              } else {
                nextChildren.push(child);
              }
            }
            if (replaced) node.children = nextChildren;
            fields.push({ path: field, type: fieldType, value: text });
            applied++;
          }
        } else {
          const nextChildren = [];
          let wrapped = false;
          for (const child of node.children || []) {
            if (!wrapped && child.type === 'JSXText' && child.value.replace(/\s+/g, '').length) {
              const leading = child.value.match(/^\s*/)?.[0] || '';
              const trailing = child.value.match(/\s*$/)?.[0] || '';
              if (leading) nextChildren.push(b.jsxText(leading));
              nextChildren.push(wrapTextInEditableSpan(field, text.trim(), fieldType));
              if (trailing) nextChildren.push(b.jsxText(trailing));
              wrapped = true;
              continue;
            }
            nextChildren.push(child);
          }
          if (wrapped) {
            node.children = nextChildren;
            fields.push({ path: field, type: fieldType, value: text.trim() });
            applied++;
          } else if (!BROAD_CONTENT_CONTAINERS.has(lower)) {
            if (ensureStaticOnLeaf(node, 'non-leaf-copy')) applied++;
          } else if (wrapFirstLiteralAsStatic(node, 'container-copy')) {
            applied++;
          }
        }
        this.traverse(pathNode);
        return;
      }

      if (decision && !decision.bind && text) {
        if (BROAD_CONTENT_CONTAINERS.has(lower)) {
          if (wrapFirstLiteralAsStatic(node, decision.reason || 'decorative')) applied++;
        } else if (ensureStaticOnLeaf(node, decision.reason || 'decorative')) {
          applied++;
        }
      }

      this.traverse(pathNode);
    },
  });

  if (applied === 0) {
    return { code, changed: false, fields: [], applied: 0 };
  }

  let finalCode = printSource(ast, code);
  if (finalCode.includes('siteData')) {
    try {
      const { healMissingSiteDataHooks } = require('./transformer.cjs');
      finalCode = healMissingSiteDataHooks(finalCode, file);
    } catch {}
  }

  return {
    code: finalCode,
    changed: true,
    fields,
    applied,
  };
}

const RESIDUAL_REASONS = {
  STATIC_INTENTIONAL: 'STATIC_INTENTIONAL',
  STATIC_DECORATIVE: 'STATIC_DECORATIVE',
  PLATFORM_CONTROLLED: 'PLATFORM_CONTROLLED',
  RUNTIME_DATA: 'RUNTIME_DATA',
  UNSUPPORTED_SAFE: 'UNSUPPORTED_SAFE',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
};

function normalizeResidualReason(rawReason) {
  if (!rawReason) return RESIDUAL_REASONS.STATIC_DECORATIVE;
  const lower = String(rawReason).toLowerCase();
  if (lower.includes('fail') || lower.includes('error')) return RESIDUAL_REASONS.CONVERSION_FAILED;
  if (lower.includes('platform') || lower.includes('control')) return RESIDUAL_REASONS.PLATFORM_CONTROLLED;
  if (lower.includes('runtime') || lower.includes('session') || lower.includes('cart')) return RESIDUAL_REASONS.RUNTIME_DATA;
  if (lower.includes('intentional') || lower.includes('brand')) return RESIDUAL_REASONS.STATIC_INTENTIONAL;
  if (lower.includes('unsupported') || lower.includes('complex')) return RESIDUAL_REASONS.UNSUPPORTED_SAFE;
  return RESIDUAL_REASONS.STATIC_DECORATIVE;
}

module.exports = {
  applyResidualPass,
  isMeaningfulVisibleText,
  RESIDUAL_REASONS,
  normalizeResidualReason,
};

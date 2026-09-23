'use strict';

const { getJsxName, collectJsxText, findJsxAttribute } = require('./ast.cjs');
const { isIconComponent, DECORATIVE_TAGS, HEADING_TAGS, ACTION_TAGS } = require('./adapters.cjs');

const INLINE_FORMAT_TAGS = new Set([
  'span', 'strong', 'em', 'b', 'i', 'u', 'code', 'mark', 'small', 'sub', 'sup',
]);

function getAttributeString(node, attrName) {
  const attr = findJsxAttribute(node, attrName);
  if (!attr || !attr.value) return '';
  if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') {
    return String(attr.value.value || '');
  }
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) {
      return String(expr.value || '');
    }
  }
  return '';
}

/**
 * Analyzes the children of a JSX element into structured fragments.
 * Identifies:
 * - raw text literals
 * - inline formatted elements (span, strong, em, etc.)
 * - decorative icon components
 * - nested links or buttons
 * - dynamic expression containers
 */
function analyzeElementFragments(elementNode) {
  if (!elementNode || elementNode.type !== 'JSXElement') {
    return {
      fragments: [],
      hasIcons: false,
      hasInlineFormatting: false,
      hasDynamicExpressions: false,
      isCompoundText: false,
      isButtonWithIcon: false,
      isHighlightedHeading: false,
      pureTextFragments: [],
      combinedText: '',
    };
  }

  const tag = getJsxName(elementNode);
  const children = elementNode.children || [];
  const fragments = [];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child.type === 'JSXText') {
      const raw = child.value;
      const trimmed = raw.replace(/\s+/g, ' ').trim();
      if (trimmed.length > 0) {
        fragments.push({
          type: 'raw-text',
          raw,
          text: trimmed,
          nodeIndex: i,
          node: child,
        });
      }
      continue;
    }

    if (child.type === 'JSXElement') {
      const childTag = getJsxName(child);
      const childClassName = getAttributeString(child, 'className') || getAttributeString(child, 'class');

      if (isIconComponent(childTag, '') || DECORATIVE_TAGS.has(childTag)) {
        fragments.push({
          type: 'icon',
          tag: childTag,
          nodeIndex: i,
          node: child,
        });
        continue;
      }

      if (INLINE_FORMAT_TAGS.has(childTag.toLowerCase())) {
        const innerText = collectJsxText(child).trim();
        fragments.push({
          type: 'inline-format',
          tag: childTag,
          className: childClassName,
          text: innerText,
          nodeIndex: i,
          node: child,
        });
        continue;
      }

      if (childTag === 'a' || childTag === 'Link') {
        const href = getAttributeString(child, 'href');
        const linkText = collectJsxText(child).trim();
        fragments.push({
          type: 'link',
          tag: childTag,
          href,
          text: linkText,
          nodeIndex: i,
          node: child,
        });
        continue;
      }

      // Other nested element
      fragments.push({
        type: 'element',
        tag: childTag,
        className: childClassName,
        text: collectJsxText(child).trim(),
        nodeIndex: i,
        node: child,
      });
      continue;
    }

    if (child.type === 'JSXExpressionContainer') {
      fragments.push({
        type: 'dynamic-expr',
        nodeIndex: i,
        node: child,
      });
      continue;
    }
  }

  const hasIcons = fragments.some((f) => f.type === 'icon');
  const hasInlineFormatting = fragments.some((f) => f.type === 'inline-format');
  const hasDynamicExpressions = fragments.some((f) => f.type === 'dynamic-expr');
  const pureTextFragments = fragments.filter((f) => f.type === 'raw-text' || f.type === 'inline-format');
  const combinedText = pureTextFragments.map((f) => f.text).join(' ').replace(/\s+/g, ' ').trim();

  const isButtonWithIcon =
    ACTION_TAGS.has(tag) &&
    hasIcons &&
    pureTextFragments.length >= 1 &&
    !hasDynamicExpressions;

  const isHighlightedHeading =
    HEADING_TAGS.has(tag) &&
    hasInlineFormatting &&
    pureTextFragments.length >= 2 &&
    !hasDynamicExpressions;

  const isCompoundText =
    (hasInlineFormatting || (hasIcons && pureTextFragments.length > 0)) &&
    pureTextFragments.length > 0;

  return {
    tag,
    fragments,
    hasIcons,
    hasInlineFormatting,
    hasDynamicExpressions,
    isCompoundText,
    isButtonWithIcon,
    isHighlightedHeading,
    pureTextFragments,
    combinedText,
  };
}

module.exports = {
  INLINE_FORMAT_TAGS,
  analyzeElementFragments,
};

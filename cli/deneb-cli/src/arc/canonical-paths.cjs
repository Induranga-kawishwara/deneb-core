'use strict';

const recast = require('recast');
const b = recast.types.builders;

/**
 * Canonical Path Abstraction for Deneb ARC.
 * Prevents subtle path drift between runtime siteData getters and visual DOM markers.
 */
class CanonicalFieldRef {
  constructor(canonicalPath) {
    if (!canonicalPath || typeof canonicalPath !== 'string') {
      throw new Error(`Invalid canonical path: ${canonicalPath}`);
    }
    this.path = canonicalPath;
    this.parts = canonicalPath.split('.').filter(Boolean);
    this.scope = this.parts[0] || 'home';
    this.section = this.parts.length > 2 ? this.parts[1] : null;
    this.fieldName = this.parts[this.parts.length - 1];
  }

  /**
   * Builds the optional chaining AST expression:
   * siteData?.content?.home?.section?.field
   */
  toGetterAst() {
    let expr = b.identifier('siteData');
    const allParts = ['content', ...this.parts];
    for (const part of allParts) {
      expr = b.optionalMemberExpression(expr, b.identifier(part), false, true);
    }
    return expr;
  }

  /**
   * Builds the fallback expression:
   * siteData?.content?.home?.section?.field ?? fallback
   */
  toBindingAst(fallbackValue = '') {
    const getter = this.toGetterAst();
    let fallbackAst;
    if (typeof fallbackValue === 'number') {
      fallbackAst = b.literal(fallbackValue);
    } else if (typeof fallbackValue === 'boolean') {
      fallbackAst = b.literal(fallbackValue);
    } else {
      fallbackAst = b.stringLiteral(String(fallbackValue));
    }
    return b.logicalExpression('??', getter, fallbackAst);
  }

  /**
   * Builds the JSX attribute AST:
   * data-preview-field-path="home.section.field"
   */
  toPreviewAttrAst() {
    return b.jsxAttribute(
      b.jsxIdentifier('data-preview-field-path'),
      b.stringLiteral(this.path)
    );
  }

  /**
   * Generates a nested item path for sub-collections:
   * e.g. parentPath="home.categories[0]", childProp="products", childIndex="2"
   * -> "home.categories[0].products[2]"
   */
  static buildNestedItemPath(parentItemPath, childProp, childIndexExpr = 'index') {
    return `${parentItemPath}.${childProp}[\${${childIndexExpr}}]`;
  }
}

function isValidCanonicalPath(canonicalPath) {
  if (typeof canonicalPath !== 'string' || !canonicalPath.trim()) return false;
  return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+|\[\d+\]|\[\$\{[^}]+\}\])*$/.test(canonicalPath);
}

function validatePathAlignment(getterCode, previewAttrCode) {
  const normalizedGetter = String(getterCode || '').replace(/\?\./g, '.');
  const getterMatch = normalizedGetter.match(/siteData\.content\.([a-zA-Z0-9_.]+)/);
  const attrMatch = String(previewAttrCode || '').match(/data-preview-field-path=["'`{]([a-zA-Z0-9_.]+)/);
  if (!getterMatch || !attrMatch) return false;
  return getterMatch[1] === attrMatch[1];
}

function fieldRef(canonicalPath) {
  return new CanonicalFieldRef(canonicalPath);
}

module.exports = {
  CanonicalFieldRef,
  fieldRef,
  isValidCanonicalPath,
  validatePathAlignment,
};

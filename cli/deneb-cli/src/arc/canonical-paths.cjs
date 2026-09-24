'use strict';

const recast = require('recast');
const b = recast.types.builders;

/**
 * Deneb ARC v3 — Canonical Path Engine
 * Single Source of Truth for runtime siteData accessors, visual DOM markers,
 * schema generation, and diagnostics identity.
 */
class CanonicalFieldRef {
  /**
   * @param {string} canonicalPath - e.g. "home.hero.title" or "home.categories[0].name"
   * @param {object} [options]
   * @param {object} [options.provenance] - Origin tracking (file, loc, component, kind)
   * @param {boolean} [options.isCollection] - Whether path is an array collection
   */
  constructor(canonicalPath, options = {}) {
    if (!canonicalPath || typeof canonicalPath !== 'string') {
      throw new Error(`Invalid canonical path: ${canonicalPath}`);
    }
    const cleanPath = canonicalPath.trim().replace(/^\.+|\.+$/g, '');
    if (!cleanPath) {
      throw new Error(`Empty canonical path after normalization: ${canonicalPath}`);
    }

    this.path = cleanPath;
    this.canonicalPath = cleanPath;
    this.provenance = options.provenance || {};

    // Segment split while preserving bracket indices
    this.parts = cleanPath.split('.').filter(Boolean);
    const firstPart = this.parts[0] || 'home';
    this.scope = firstPart.replace(/\[.*$/, '');
    this.section = this.parts.length > 2 ? this.parts[1].replace(/\[.*$/, '') : null;
    this.fieldName = (this.parts[this.parts.length - 1] || '').replace(/\[.*$/, '');

    this.previewPath = cleanPath;
    this.previewMarker = `data-preview-field-path="${cleanPath}"`;
    this.runtimePath = `siteData.content.${cleanPath}`;
    this.manifestSchemaPath = cleanPath;
    this.diagnosticsId = `field:${cleanPath}`;
    this.isCollection = Boolean(options.isCollection || /\[\d+\]|\[\$\{[^}]+\}\]/.test(cleanPath));

    // Construct readable runtime accessor string
    const accessorSegments = ['siteData', 'content', ...this.parts];
    this.runtimeAccessor = accessorSegments
      .map((seg, i) => {
        if (i === 0) return seg;
        if (/^([a-zA-Z0-9_-]+)\[(\d+|\$\{[^}]+\})\]$/.test(seg)) {
          const match = seg.match(/^([a-zA-Z0-9_-]+)\[(\d+|\$\{[^}]+\})\]$/);
          return `?.${match[1]}?.[${match[2]}]`;
        }
        return `?.${seg}`;
      })
      .join('');
  }

  /**
   * Builds optional chaining AST expression:
   * siteData?.content?.home?.hero?.title
   */
  toGetterAst() {
    let expr = b.identifier('siteData');
    const allParts = ['content', ...this.parts];
    for (const part of allParts) {
      const arrayMatch = part.match(/^([a-zA-Z0-9_-]+)\[(\d+)\]$/);
      if (arrayMatch) {
        const propName = arrayMatch[1];
        const idx = parseInt(arrayMatch[2], 10);
        expr = b.optionalMemberExpression(expr, b.identifier(propName), false, true);
        expr = b.optionalMemberExpression(expr, b.numericLiteral(idx), true, true);
      } else {
        expr = b.optionalMemberExpression(expr, b.identifier(part), false, true);
      }
    }
    return expr;
  }

  /**
   * Builds fallback expression:
   * siteData?.content?.home?.hero?.title ?? fallback
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
   * Builds JSX attribute AST:
   * data-preview-field-path="home.hero.title"
   */
  toPreviewAttrAst() {
    return b.jsxAttribute(
      b.jsxIdentifier('data-preview-field-path'),
      b.stringLiteral(this.path)
    );
  }

  /**
   * Builds JSX attribute AST for style binding targets:
   * data-preview-style-target="home.hero.title"
   */
  toPreviewStyleTargetAst() {
    return b.jsxAttribute(
      b.jsxIdentifier('data-preview-style-target'),
      b.stringLiteral(this.path)
    );
  }

  /**
   * Generates assignment code for runtime or testing mutations:
   * siteData.content.home.hero.title = value;
   */
  toSetterCode(valueExpr = 'value') {
    return `siteData.content.${this.path} = ${valueExpr};`;
  }

  /**
   * Derives a child item reference for collections:
   * e.g. "home.categories" -> "home.categories[0]"
   */
  toCollectionItem(index) {
    const itemPath = `${this.path}[${index}]`;
    return new CanonicalFieldRef(itemPath, {
      provenance: { ...this.provenance, parentPath: this.path, index },
    });
  }

  /**
   * Derives a nested collection child reference:
   * e.g. "home.categories[0]" -> "home.categories[0].products[2]"
   */
  toCollectionChild(childProp, childIndexExpr) {
    const childPath = childIndexExpr !== undefined
      ? `${this.path}.${childProp}[${childIndexExpr}]`
      : `${this.path}.${childProp}`;
    return new CanonicalFieldRef(childPath, {
      provenance: { ...this.provenance, parentPath: this.path, childProp },
    });
  }

  /**
   * Validates canonical path syntax and structure
   */
  validate() {
    if (!isValidCanonicalPath(this.path)) {
      return {
        valid: false,
        error: `Syntax violation in canonical path "${this.path}"`,
      };
    }
    if (!this.scope) {
      return {
        valid: false,
        error: `Missing root scope in canonical path "${this.path}"`,
      };
    }
    return { valid: true };
  }

  /**
   * Static helper for nested collection template literals:
   * e.g. parentPath="home.categories[0]", childProp="products", childIndexExpr="index"
   * -> "home.categories[0].products[${index}]"
   */
  static buildNestedItemPath(parentItemPath, childProp, childIndexExpr = 'index') {
    return `${parentItemPath}.${childProp}[\${${childIndexExpr}}]`;
  }
}

function isValidCanonicalPath(canonicalPath) {
  if (typeof canonicalPath !== 'string' || !canonicalPath.trim()) return false;
  return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+|\[\d+\]|\[\$\{[^}]+\}\])*$/.test(canonicalPath.trim());
}

function validatePathAlignment(getterCode, previewAttrCode) {
  const normalizedGetter = String(getterCode || '').replace(/\?\./g, '.');
  const getterMatch = normalizedGetter.match(/siteData\.content\.([a-zA-Z0-9_.[\]]+)/);
  const attrMatch = String(previewAttrCode || '').match(/data-preview-field-path=["'`{]([a-zA-Z0-9_.[\]]+)/);
  if (!getterMatch || !attrMatch) return false;
  return getterMatch[1] === attrMatch[1];
}

/**
 * Primary factory function for CanonicalFieldRef
 * Single source of truth across compiler, transformer, and runtime validator.
 */
function canonicalField(rawPath, options) {
  return new CanonicalFieldRef(rawPath, options);
}

/**
 * Backward-compatible alias
 */
function fieldRef(canonicalPath, options) {
  return canonicalField(canonicalPath, options);
}

module.exports = {
  CanonicalFieldRef,
  canonicalField,
  fieldRef,
  isValidCanonicalPath,
  validatePathAlignment,
};

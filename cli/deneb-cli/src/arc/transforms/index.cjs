'use strict';

const {
  parseSource,
  printSource,
  hasDirective,
  ensureImport,
  ensureDefaultImport,
  sanitizeDuplicateBindings,
} = require('../ast.cjs');
const {
  hasMetadataExport,
  hasClientDirective,
  needsClientDirective,
  canSafelyInjectClientDirective,
  ensureClientDirective,
} = require('../rsc-boundary.cjs');

// Context & primitives
const { findElementByLoc } = require('./transform-context.cjs');
const { applyTransformToElement } = require('./element-transform.cjs');
const { instrumentChildCardComponent } = require('./components/child-card.cjs');
const { instrumentReusableComponent } = require('./components/reusable-component.cjs');
const { applyCollectionTransform } = require('./collections/list.cjs');
const { instrumentPageKey, inferPageKey } = require('./routing/page-key.cjs');
const { instrumentLayoutSource } = require('./routing/shared-layout.cjs');
const {
  resolveSiteDataSpecifier,
  resolveSiteDataRuntimeSpecifier,
  rewriteRecursiveSiteDataContext,
  ensureJsonModule,
  injectSiteDataHook,
} = require('./runtime/provider.cjs');
const {
  sanitizeContradictoryMarkers,
  healBroadContainerMarkers,
  healHiddenPreviewMarkers,
  healLegacyProductDetailLinks,
  healSectionOverflowHidden,
  healDecorativeOverlays,
  healMissingSiteDataHooks,
} = require('./healing/sanitizer.cjs');
const {
  healEmptyStateConditionals,
  healUnguardedModalConditionals,
  healUnguardedModalConditionalsInSource,
  sanitizeContradictoryMarkersInSource,
} = require('./healing/conditionals.cjs');

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

  const code = printSource(ast, filePlan.originalCode);
  return { code, changed: true, applied, failures, usedClientHook: isClient };
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
  instrumentReusableComponent,
};

'use strict';

const TEXT_OPS = new Set(['extract-text', 'wrap-text-span']);
const BUTTON_TAGS = new Set(['button', 'Button', 'CTAButton']);

function inferStyleKind(transform) {
  if (transform.operation === 'collection-conversion') return 'grid';
  if (transform.operation === 'form-submit-action') return 'button';
  if (transform.operation === 'split-action-contract') return 'text';
  if (BUTTON_TAGS.has(transform.tag) && transform.operation === 'extract-text') return 'button';
  if (TEXT_OPS.has(transform.operation)) return 'text';
  return null;
}

function stylePathFor(transform, kind) {
  if (kind === 'grid' && transform.listField) return `${transform.listField}.grid`;
  if (kind === 'card' && transform.listField) return `${transform.listField}[*].card`;
  if (transform.operation === 'split-action-contract' || transform.operation === 'form-submit-action') return transform.labelField;
  return transform.field || transform.labelField || null;
}

/**
 * Adds explainable style-bind operations next to content transforms so
 * developers see why Fivora can restyle a node without CSS rewrites.
 */
function appendStyleBindTransforms(filePlans) {
  for (const file of filePlans || []) {
    const extra = [];
    for (const transform of file.transformations || []) {
      if (transform.operation === 'style-bind') continue;
      if (transform.operation === 'wrap-text-span') continue;
      if (transform.operation === 'collection-conversion' && transform.listField) {
        extra.push(makeStyleBind(transform, `${transform.listField}.grid`, 'grid'));
        extra.push(makeStyleBind(transform, `${transform.listField}[*].card`, 'card'));
        continue;
      }
      const kind = inferStyleKind(transform);
      const stylePath = stylePathFor(transform, kind);
      if (!kind || !stylePath) continue;
      extra.push(makeStyleBind(transform, stylePath, kind));
    }
    file.transformations = [...(file.transformations || []), ...extra];
  }
}

function makeStyleBind(transform, stylePath, kind) {
  return {
    loc: transform.loc,
    operation: 'style-bind',
    tag: transform.tag,
    file: transform.file,
    confidence: Math.min(0.99, (transform.confidence || 0.9) - 0.02),
    decision: transform.decision === 'skip' ? 'skip' : 'auto',
    reason: `Bind Fivora style contract (${kind}) without rewriting CSS`,
    field: transform.field,
    stylePath,
    styleKind: kind,
    fingerprint: transform.fingerprint,
    recipeId: transform.recipeId || null,
    explain: {
      detected: `${transform.tag} style-${kind}`,
      why: 'Fivora visual editor patches --deneb-* CSS variables via FIVORA_PREVIEW_STYLE_PATCH',
      recipe: transform.recipeId || null,
      confidence: transform.confidence,
    },
  };
}

module.exports = {
  appendStyleBindTransforms,
  inferStyleKind,
  stylePathFor,
};

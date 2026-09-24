'use strict';

const { CONFIDENCE } = require('./version.cjs');
const { inferSection, inferFieldName, buildFieldPath, classifyFieldType, uniquePath } = require('./field-paths.cjs');
const { classifyHref } = require('./adapters.cjs');
const { loadFingerprintBoost } = require('./learning.cjs');
const { appendStyleBindTransforms } = require('./style-candidates.cjs');
const { classifyDataCandidate, isEditableClassification } = require('./data-classification.cjs');

function recipeBoost(candidate, recipe) {
  if (!recipe) return 0;
  let boost = 0;
  if (recipe.actionRules?.splitActionAndLabel && (candidate.operation === 'split-action-contract' || candidate.operation === 'form-submit-action')) boost += 0.03;
  const keywords = recipe.signatures?.keywords || [];
  const hay = `${candidate.tag} ${candidate.value || ''} ${candidate.label || ''} ${candidate.file || ''}`.toLowerCase();
  if (keywords.some((kw) => hay.includes(String(kw).toLowerCase()))) boost += 0.02;
  return Math.min(boost, 0.08);
}

function decideThreshold(confidence, candidate) {
  if (candidate.skip) return 'skip';
  if (confidence >= CONFIDENCE.AUTO) return 'auto';
  if (confidence >= CONFIDENCE.VALIDATE) return 'validate';
  return 'skip';
}

function planTransformations({ profile, analyses, recipe, ir }) {
  const usedPaths = new Set();
  const filePlans = [];
  const skipped = [];
  const explanations = [];

  for (const analysis of analyses) {
    const transformations = [];
    for (const candidate of analysis.candidates || []) {
      const fingerprintHint = loadFingerprintBoost(candidate.fingerprint);
      if (fingerprintHint.skip) {
        skipped.push({
          file: candidate.file,
          loc: candidate.loc,
          reason: 'fingerprint-deprecated',
          confidence: candidate.confidence || 0,
          kind: candidate.kind,
        });
        continue;
      }
      const confidence = Math.min(
        0.99,
        (candidate.confidence || 0) + recipeBoost(candidate, recipe) + (fingerprintHint.boost || 0),
      );
      const dataClass = classifyDataCandidate(candidate, {
        file: candidate.file,
        componentName: candidate.componentName,
        tag: candidate.tag,
      });

      let decision = decideThreshold(confidence, candidate);
      if (!isEditableClassification(dataClass.classification)) {
        decision = 'skip';
        candidate.reason = candidate.reason || `non-editable-${dataClass.classification.toLowerCase()}`;
      }

      const section = inferSection({
        componentName: candidate.componentName,
        fileName: candidate.file,
        className: candidate.className,
        parentName: candidate.parentName,
        tag: candidate.tag,
        role: candidate.role,
      });

      let scope = candidate.ownerScope || 'home';
      if (candidate.extra && ['instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin', 'pinterest'].includes(candidate.extra.action || candidate.extra.platform)) {
        scope = 'common';
      }
      if (section === 'header' || section === 'footer' || section === 'navigation' || section === 'announcement') {
        scope = 'common';
      }

      const extra = { ...(candidate.extra || {}) };
      if (candidate.operation === 'split-action-contract' || candidate.operation === 'form-submit-action') {
        extra.action = extra.action || (candidate.operation === 'form-submit-action' ? 'form-submit' : classifyHref(candidate.value));
        extra.paired = true;
      }

      let transform = {
        loc: candidate.loc,
        operation: candidate.operation || candidate.kind,
        tag: candidate.tag,
        file: candidate.file,
        confidence,
        decision,
        reason: candidate.reason,
        recipeId: recipe?.name || recipe?.id || null,
        fingerprint: candidate.fingerprint,
        fallback: candidate.value,
        labelFallback: candidate.label,
        fieldType: classifyFieldType(candidate.kind, candidate.value || candidate.label),
        dataClassification: dataClass.classification,
        section,
        scope,
        explain: {
          detected: `${candidate.tag} ${candidate.kind}`,
          why: candidate.reason,
          classification: dataClass.classification,
          recipe: recipe?.name || null,
          confidence,
          fingerprintBoost: fingerprintHint.boost || 0,
          fingerprintState: fingerprintHint.state || null,
        },
      };

      if (decision === 'skip' || candidate.skip || candidate.kind === 'already-editable' || candidate.kind === 'decoration') {
        skipped.push({
          file: candidate.file,
          loc: candidate.loc,
          reason: candidate.reason || 'low-confidence',
          confidence,
          kind: candidate.kind,
          classification: dataClass.classification,
        });
        continue;
      }

      if (candidate.operation === 'split-action-contract' || candidate.operation === 'form-submit-action') {
        const urlName = inferFieldName('url', candidate.tag, candidate.label, extra);
        const labelName = inferFieldName('label', candidate.tag, candidate.label, { ...extra, paired: true });
        const actionSection = sectionForAction(scope, section, extra);
        transform.urlField = buildFieldPath({ scope, section: actionSection, field: urlName, used: usedPaths });
        const sibling = transform.urlField.split('.');
        sibling[sibling.length - 1] = labelName;
        transform.labelField = uniquePath(usedPaths, sibling.join('.'));
        transform.fieldType = 'url';
        transform.labelFieldType = 'text';
        if (candidate.operation === 'form-submit-action') {
          transform.formContext = true;
        }
      } else if (candidate.operation === 'extract-url') {
        transform.field = buildFieldPath({
          scope,
          section: sectionForAction(scope, section, extra),
          field: inferFieldName('url', candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
        transform.fieldType = 'url';
      } else if (candidate.operation === 'extract-image') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('image', candidate.tag, extra.alt, extra),
          used: usedPaths,
        });
        transform.fieldType = 'image';
      } else if (candidate.operation === 'extract-alt') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('alt', candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
        transform.fieldType = 'text';
      } else if (candidate.operation === 'wrap-text-span') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('text', candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
        transform.fieldType = 'text';
      } else if (candidate.operation === 'extract-placeholder') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('placeholder', candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
      } else if (candidate.operation === 'extract-prop') {
        const propName = extra.propName || 'text';
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName(propName, candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
        transform.propName = propName;
        transform.fieldType = classifyFieldType('text', candidate.value);
      } else if (candidate.operation === 'bind-button-with-icon') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('label', candidate.tag, candidate.value, { ...extra, cta: true }),
          used: usedPaths,
        });
        transform.fieldType = 'text';
      } else if (candidate.operation === 'bind-highlighted-heading') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('title', candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
        transform.fieldType = 'text';
        transform.fragments = extra.fragments || [];
      } else if (candidate.operation === 'prop-flow-callsite') {
        const propTransforms = {};
        const prefix = section ? `${scope}.${section}` : scope;
        for (const [propName, propVal] of Object.entries(extra.literalProps || {})) {
          const field = buildFieldPath({
            scope,
            section,
            field: inferFieldName(propName, candidate.tag, propVal, extra),
            used: usedPaths,
          });
          propTransforms[propName] = {
            field,
            fallback: propVal,
            type: classifyFieldType('text', propVal, propName),
          };
        }
        transform.propTransforms = propTransforms;
        transform.targetComponent = extra.componentName;
        transform.targetFile = extra.componentFile;
        transform.previewPath = prefix;
      } else if (candidate.operation === 'extract-tailwind-bg') {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName('backgroundImage', candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
        transform.fieldType = 'image';
        transform.rawClass = extra.rawClass;
        transform.bgUrl = extra.bgUrl;
      } else if (candidate.operation === 'collection-conversion') {
        // A collection is named after the developer's own array variable so the
        // merchant sees "products", not "items2".
        transform.listField = uniquePath(usedPaths, `${scope}.${extra.binding || 'items'}`);
        transform.field = undefined;
        transform.fieldType = 'list';
        transform.itemFields = (extra.itemFields || []).map((field) => ({
          key: field.key,
          type:
            field.role === 'image'
              ? 'image'
              : field.role === 'url'
                ? 'url'
                : field.role === 'number'
                  ? 'number'
                  : field.role === 'textarea'
                    ? 'textarea'
                    : 'text',
        }));
        transform.items = Array.isArray(candidate.value)
          ? candidate.value.map((item) => (item && typeof item === 'object' && 'value' in item ? item.value : item))
          : [];
        transform.itemParam = extra.itemParam;
        transform.childComponentName = extra.childComponentName || null;
        if (!transform.itemFields.length && extra.objectItems && candidate.value?.length > 0) {
          const sample = candidate.value[0]?.value || {};
          transform.itemFields = Object.keys(sample)
            .filter((k) => typeof sample[k] === 'string' || typeof sample[k] === 'number')
            .map((k) => ({
              key: k,
              type: typeof sample[k] === 'number' ? 'number' : /image|photo|avatar/i.test(k) ? 'image' : /url|link/i.test(k) ? 'url' : 'text',
            }));
        }
        transform.hasComponentRef = Boolean(extra.hasComponentRef);
        if (!transform.itemFields.length || !extra.objectItems) transform.decision = 'skip';
      } else {
        transform.field = buildFieldPath({
          scope,
          section,
          field: inferFieldName(candidate.kind, extra.tag || candidate.tag, candidate.value, extra),
          used: usedPaths,
        });
      }

      if (transform.decision === 'skip') {
        skipped.push({
          file: candidate.file,
          loc: candidate.loc,
          reason: 'collection-not-safe',
          confidence,
          kind: candidate.kind,
        });
        continue;
      }

      transformations.push(transform);
      explanations.push(transform.explain);
    }

    filePlans.push({
      file: analysis.relativeFile,
      alreadyEditable: analysis.alreadyEditable,
      parseError: analysis.reason === 'parse-error' ? analysis.error : null,
      skippedFile: analysis.skipped,
      skipReason: analysis.skipped ? analysis.reason : null,
      transformations,
      originalCode: analysis.code,
      designSnapshot: analysis.designSnapshot,
    });
  }

  // Connect collection loops to child component definitions
  for (const fp of filePlans) {
    for (const t of fp.transformations) {
      if (t.operation === 'collection-conversion' && t.childComponentName) {
        const compMeta = (profile.components || []).find((c) => c.name === t.childComponentName);
        const compFile = compMeta?.file || (ir && typeof ir.getComponent === 'function' && ir.getComponent(t.childComponentName)?.file);
        if (compFile) {
          const targetPlan = filePlans.find((p) => p.file === compFile);
          if (targetPlan) {
            const already = targetPlan.transformations.some(
              (x) => x.operation === 'instrument-child-card' && x.componentName === t.childComponentName
            );
            if (!already) {
              targetPlan.transformations.push({
                operation: 'instrument-child-card',
                componentName: t.childComponentName,
                listField: t.listField,
                itemFields: t.itemFields,
                file: compFile,
                decision: 'auto',
                confidence: 0.95,
              });
            }
          }
        }
      }
    }
  }

  // Connect reusable component callsites to component definitions
  for (const fp of filePlans) {
    for (const t of fp.transformations) {
      if (t.operation === 'prop-flow-callsite' && t.targetComponent && t.targetFile) {
        const targetPlan = filePlans.find((p) => p.file === t.targetFile);
        if (targetPlan) {
          const already = targetPlan.transformations.some(
            (x) => x.operation === 'instrument-reusable-component' && x.componentName === t.targetComponent
          );
          if (!already) {
            targetPlan.transformations.push({
              operation: 'instrument-reusable-component',
              componentName: t.targetComponent,
              previewPath: t.previewPath,
              propTransforms: t.propTransforms,
              file: t.targetFile,
              decision: 'auto',
              confidence: 0.95,
            });
          }
        }
      }
    }
  }

  appendStyleBindTransforms(filePlans);

  return {
    files: filePlans,
    skipped,
    explanations,
    usedPaths: [...usedPaths],
    stats: summarizePlan(filePlans, skipped),
  };
}

function sectionForAction(scope, section, extra) {
  if (scope === 'common' && (extra.social || ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin'].includes(extra.action))) {
    return 'footer';
  }
  if (['whatsapp', 'phone', 'email', 'directions', 'location', 'form-submit'].includes(extra.action)) {
    return section || 'contact';
  }
  if (extra.action === 'shop') {
    return section || 'shop';
  }
  return section;
}

function summarizePlan(filePlans, skipped) {
  const planned = filePlans.reduce((n, f) => n + f.transformations.length, 0);
  const auto = filePlans.reduce((n, f) => n + f.transformations.filter((t) => t.decision === 'auto').length, 0);
  const validate = filePlans.reduce((n, f) => n + f.transformations.filter((t) => t.decision === 'validate').length, 0);
  const filesAffected = filePlans.filter((f) => f.transformations.length > 0).length;
  const styleBinds = filePlans.reduce(
    (n, f) => n + f.transformations.filter((t) => t.operation === 'style-bind').length,
    0,
  );
  return {
    planned,
    auto,
    validate,
    skipped: skipped.length,
    filesAffected,
    styleBinds,
  };
}

module.exports = {
  planTransformations,
  decideThreshold,
};

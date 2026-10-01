'use strict';

const fs = require('fs');
const path = require('path');
const { parseSource } = require('./ast.cjs');
const { collectDesignSnapshot } = require('./semantic.cjs');
const { getDeep } = require('./manifest.cjs');
const { walkFiles, isJsxFile, rel } = require('./fs-utils.cjs');
const { enumerateContentPaths, isControlOnly, wildcardPath } = require('./fivora-contract.cjs');

function validateAstFiles(files) {
  const results = [];
  for (const file of files) {
    try {
      parseSource(fs.readFileSync(file.abs, 'utf8'), file.rel);
      results.push({ file: file.rel, passed: true });
    } catch (err) {
      results.push({ file: file.rel, passed: false, error: err.message });
    }
  }
  return results;
}

function extractFieldPathsFromCode(code) {
  return [
    ...code.matchAll(/data-preview-field-path=["']([^"']+)["']/g),
  ].map((m) => m[1]);
}

function validateContracts(projectDir, siteData, manifest) {
  const files = walkFiles(projectDir, { include: (_p, name) => isJsxFile(name) });
  const fieldPaths = [];
  let actionCollisions = 0;
  let staticAncestorCollisions = 0;
  let duplicateMarkers = 0;
  const seen = new Map();
  const orphans = [];
  const missingSchema = [];

  for (const abs of files) {
    const code = fs.readFileSync(abs, 'utf8');
    const relative = rel(projectDir, abs);
    const paths = extractFieldPathsFromCode(code);
    for (const fieldPath of paths) {
      fieldPaths.push(fieldPath);
      const prev = seen.get(fieldPath) || 0;
      seen.set(fieldPath, prev + 1);
      if (siteData?.content && getDeep(siteData.content, fieldPath) === undefined) {
        orphans.push({ fieldPath, file: relative });
      }
      if (manifest && !isFieldInEditorSchema(manifest, fieldPath) && !isControlOnly(fieldPath, manifest.visualEditing?.controlOnlyPaths)) {
        missingSchema.push({ fieldPath, file: relative });
      }
    }

    const collisions = code.matchAll(/<a\s+[^>]*data-preview-field-path="[^"]*(?:Url|Link|Action)"[^>]*>([^<>{}\n]+)<\/a>/gi);
    for (const ac of collisions) {
      if (String(ac[1] || '').trim().length > 1) actionCollisions++;
    }

    if (code.includes('data-preview-static') && code.includes('data-preview-field-path')) {
      const blocks = code.matchAll(/<([a-zA-Z0-9_-]+)(\s+[^>]*data-preview-static[^>]*)>([\s\S]*?)<\/\1>/g);
      for (const sb of blocks) {
        if (sb[3].includes('data-preview-field-path')) staticAncestorCollisions++;
      }
    }
  }

  for (const [, count] of seen) {
    if (count > 40) duplicateMarkers++;
  }

  return {
    fieldPaths: [...new Set(fieldPaths)],
    actionCollisions,
    staticAncestorCollisions,
    duplicateMarkers,
    orphans,
    missingSchema,
    contractPassed: actionCollisions === 0 && staticAncestorCollisions === 0,
  };
}

function isFieldInEditorSchema(manifest, fieldPath) {
  if (!manifest?.editorSchema?.sections) return false;
  const cleanPath = String(fieldPath)
    .replace(/\[(?:\d+|\*|[a-zA-Z0-9_]+)\]/g, '.[*]')
    .replace(/\.\.+/g, '.');
  const parts = cleanPath.split('.').filter(Boolean);
  const rawSectionId = parts[0];
  const sectionId = rawSectionId ? rawSectionId.replace(/\[\*\]/g, '') : '';

  const section = (manifest.editorSchema?.sections || []).find(
    (s) => s.id === sectionId || s.path === sectionId || s.id === rawSectionId
  );
  if (!section) return false;
  const fieldParts = parts.slice(1);
  if (fieldParts.length === 0) return true;

  function check(fields, remainingParts) {
    if (!Array.isArray(fields) || remainingParts.length === 0) return false;
    const current = remainingParts[0];
    const rest = remainingParts.slice(1);

    if (current === '[*]') {
      if (rest.length === 0) return true;
      return check(fields, rest);
    }

    for (const f of fields) {
      if (f.key === current) {
        if (rest.length === 0) return true;
        const subFields = f.fields || f.itemFields;
        if (subFields) {
          if (rest[0] === '[*]') {
            if (rest.length === 1) return true;
            if (check(subFields, rest.slice(1))) return true;
          }
          if (check(subFields, rest)) return true;
        }
      }
      if (f.key === remainingParts.join('.')) return true;
    }
    return false;
  }

  return check(section.fields || section.itemFields, fieldParts);
}

function designPreservationScore(filePlans, afterFiles) {
  let total = 0;
  let matched = 0;
  const details = [];
  for (const plan of filePlans) {
    if (!plan.designSnapshot || !afterFiles[plan.file]) continue;
    let afterSnap;
    try {
      afterSnap = collectDesignSnapshot(afterFiles[plan.file]);
    } catch {
      continue;
    }
    const beforeC = plan.designSnapshot.classNames || [];
    const afterC = afterSnap.classNames || [];
    const beforeS = plan.designSnapshot.styles || [];
    const afterS = afterSnap.styles || [];
    total += beforeC.length + beforeS.length;
    const classEqual = beforeC.length === afterC.length && beforeC.every((c, i) => c === afterC[i]);
    const styleEqual = beforeS.length === afterS.length && beforeS.every((s, i) => s === afterS[i]);
    matched += (classEqual ? beforeC.length : countOverlap(beforeC, afterC)) + (styleEqual ? beforeS.length : countOverlap(beforeS, afterS));
    if (!classEqual || !styleEqual) {
      details.push({ file: plan.file, classEqual, styleEqual });
    }
  }
  if (total === 0) return { score: 100, details, total: 0 };
  return { score: Math.round((matched / total) * 1000) / 10, details, total, matched };
}

function countOverlap(a, b) {
  const bag = new Map();
  for (const item of b) bag.set(item, (bag.get(item) || 0) + 1);
  let n = 0;
  for (const item of a) {
    const left = bag.get(item) || 0;
    if (left > 0) {
      n++;
      bag.set(item, left - 1);
    }
  }
  return n;
}

function coverageMetrics({
  analyses,
  plan,
  appliedCount,
  skippedDynamic,
  alreadyEditable,
  content,
  controlOnlyPaths,
  pathCoverage,
  uncoveredVisibleText,
}) {
  const detected = analyses.reduce((n, a) => n + (a.candidates || []).filter((c) => c.kind !== 'decoration' && c.kind !== 'already-editable').length, 0);
  const skippedLow = plan.skipped.filter((s) => s.reason === 'low-confidence' || (s.confidence || 0) < 0.6).length;
  const transformed = appliedCount;
  const transformCoverage = detected === 0 ? 100 : Math.round((transformed / detected) * 1000) / 10;

  const inventory = content ? enumerateContentPaths(content) : { concreteFields: new Set() };
  const fieldMarkers = pathCoverage?.fieldMarkers || new Set();
  const covers = (markerSet, path) =>
    markerSet.has(path) || [...markerSet].some((marker) => wildcardPath(marker) === wildcardPath(path));

  let visualRequired = 0;
  let visualCovered = 0;
  for (const path of inventory.concreteFields) {
    if (isControlOnly(path, controlOnlyPaths || [])) continue;
    visualRequired += 1;
    if (covers(fieldMarkers, path)) visualCovered += 1;
  }
  const uncovered = Array.isArray(uncoveredVisibleText) ? uncoveredVisibleText.length : Number(uncoveredVisibleText) || 0;
  let visualCoverage = 100;
  if (visualRequired === 0) {
    visualCoverage = uncovered === 0 ? 100 : Math.max(0, Math.round((1 / (1 + uncovered)) * 1000) / 10);
  } else {
    visualCoverage = Math.round((visualCovered / visualRequired) * 1000) / 10;
    if (uncovered > 0) {
      visualCoverage = Math.min(visualCoverage, Math.round((visualCovered / (visualRequired + uncovered)) * 1000) / 10);
    }
  }

  return {
    detectedEditableCandidates: detected,
    safelyTransformed: transformed,
    alreadyEditable,
    skippedDynamic,
    skippedLowConfidence: skippedLow,
    transformCoverage: Math.min(100, transformCoverage),
    visualCovered,
    visualRequired,
    uncoveredVisibleText: uncovered,
    visualCoverage: Math.min(100, visualCoverage),
    editableCoverage: Math.min(100, visualCoverage),
  };
}

function idempotencyCheck(firstCode, secondCode) {
  return firstCode === secondCode;
}

module.exports = {
  validateAstFiles,
  validateContracts,
  designPreservationScore,
  coverageMetrics,
  isFieldInEditorSchema,
  extractFieldPathsFromCode,
  idempotencyCheck,
};

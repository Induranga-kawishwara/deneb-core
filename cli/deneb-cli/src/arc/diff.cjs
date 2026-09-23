'use strict';

const fs = require('fs');
const path = require('path');
const { scanProject } = require('./scanner.cjs');
const { buildProjectIR } = require('./ir-builder.cjs');
const { analyzeFile } = require('./semantic.cjs');
const { planTransformations } = require('./planner.cjs');
const { applyFilePlan } = require('./transformer.cjs');

/**
 * Computes a unified diff string between original and transformed code.
 */
function createUnifiedDiff(filename, oldCode, newCode) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const diffLines = [];

  diffLines.push(`--- a/${filename}`);
  diffLines.push(`+++ b/${filename}`);

  let additions = 0;
  let deletions = 0;

  // Simple chunk comparison for clear visual inspection
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      continue;
    }

    if (oldLine !== undefined && (newLine === undefined || oldLine.trim() !== newLine.trim())) {
      diffLines.push(`- ${oldLine}`);
      deletions++;
    }
    if (newLine !== undefined && (oldLine === undefined || oldLine.trim() !== newLine.trim())) {
      diffLines.push(`+ ${newLine}`);
      additions++;
    }
  }

  return {
    filename,
    diff: diffLines.join('\n'),
    additions,
    deletions,
  };
}

/**
 * Simulates ARC conversion and generates unified diffs for all modified files.
 * Zero files are written to disk.
 *
 * @param {string} targetDirInput - Target project directory.
 * @param {object} options - Options including profile overrides.
 * @returns {Array} Array of file diff objects.
 */
function generateArcDiff(targetDirInput = '.', options = {}) {
  const projectDir = path.resolve(targetDirInput);
  const profile = scanProject(projectDir);
  const ir = buildProjectIR(projectDir, profile);

  const analyses = (profile.jsxFiles || []).map((relativeFile) => {
    const absPath = path.join(projectDir, relativeFile);
    if (!fs.existsSync(absPath)) return null;
    const code = fs.readFileSync(absPath, 'utf8');
    return analyzeFile({
      code,
      relativeFile,
      profile,
      ir,
    });
  }).filter(Boolean);

  const plan = planTransformations({
    profile,
    analyses,
    ir,
  });

  const fileDiffs = [];

  for (const filePlan of plan.files || []) {
    if (!filePlan.transformations?.length || filePlan.skippedFile) continue;
    let result;
    try {
      result = applyFilePlan(filePlan, profile);
    } catch {
      continue;
    }

    if (result && result.changed && result.code !== filePlan.originalCode) {
      const fileDiff = createUnifiedDiff(filePlan.file, filePlan.originalCode, result.code);
      fileDiffs.push(fileDiff);
    }
  }

  return fileDiffs;
}

/**
 * Pretty-prints file diffs to stdout.
 */
function printDiff(fileDiffs) {
  console.log(`\n\x1b[1m\x1b[36mDENEB ARC DIFF\x1b[0m \x1b[90m— Simulated Transformation Diff\x1b[0m`);
  if (!fileDiffs.length) {
    console.log(`\x1b[32m✔ No changes planned or all files already editable.\x1b[0m\n`);
    return;
  }

  for (const fd of fileDiffs) {
    console.log(`\n\x1b[1m\x1b[34mDiff: ${fd.filename}\x1b[0m \x1b[90m(+${fd.additions} -${fd.deletions})\x1b[0m`);
    const lines = fd.diff.split('\n');
    for (const line of lines) {
      if (line.startsWith('---') || line.startsWith('+++')) {
        console.log(`\x1b[1m${line}\x1b[0m`);
      } else if (line.startsWith('+')) {
        console.log(`\x1b[32m${line}\x1b[0m`);
      } else if (line.startsWith('-')) {
        console.log(`\x1b[31m${line}\x1b[0m`);
      } else {
        console.log(`\x1b[90m${line}\x1b[0m`);
      }
    }
  }
  console.log('');
}

module.exports = {
  createUnifiedDiff,
  generateArcDiff,
  printDiff,
};

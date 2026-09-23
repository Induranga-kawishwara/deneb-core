'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeFile } = require('./semantic.cjs');
const { scanProject } = require('./scanner.cjs');
const { buildProjectIR } = require('./ir-builder.cjs');

/**
 * Explains how Deneb ARC analyzes and intends to refactor a specific component file.
 *
 * @param {string} fileInput - Path to the file to explain.
 * @param {object} options - Options including root project directory and json format flag.
 * @returns {object} Analysis explanation summary.
 */
function explainFile(fileInput, options = {}) {
  const absPath = path.resolve(options.root || '.', fileInput);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${fileInput} (resolved to ${absPath})`);
  }

  const code = fs.readFileSync(absPath, 'utf8');
  const projectDir = options.root ? path.resolve(options.root) : path.dirname(absPath);
  const relativeFile = path.relative(projectDir, absPath).replace(/\\/g, '/');

  let profile = options.profile;
  let ir = options.ir;
  if (!profile) {
    try {
      profile = scanProject(projectDir);
      ir = buildProjectIR(projectDir, profile);
    } catch {
      profile = { framework: 'nextjs', root: projectDir };
      ir = null;
    }
  }

  const analysis = analyzeFile({
    code,
    relativeFile,
    profile,
    ir,
  });

  const candidates = analysis.candidates || [];
  const editable = candidates.filter((c) => !c.skip);
  const skipped = candidates.filter((c) => c.skip);

  const explanation = {
    file: relativeFile,
    absolutePath: absPath,
    isTypeScript: /\.(tsx|ts)$/.test(relativeFile),
    alreadyEditable: analysis.alreadyEditable,
    importsCount: Object.keys(analysis.imports || {}).length,
    imports: analysis.imports || {},
    totalCandidates: candidates.length,
    editableCount: editable.length,
    skippedCount: skipped.length,
    editableElements: editable.map((c) => ({
      tag: c.tag,
      kind: c.kind,
      operation: c.operation,
      loc: c.loc,
      value: c.value,
      confidence: c.confidence,
      reason: c.reason,
      proposedField: c.field || `home.${c.kind || 'field'}`,
    })),
    skippedElements: skipped.map((c) => ({
      tag: c.tag,
      kind: c.kind,
      loc: c.loc,
      reason: c.reason,
      confidence: c.confidence,
    })),
  };

  return explanation;
}

/**
 * Pretty-prints the explanation to stdout.
 */
function printExplanation(explanation) {
  console.log(`\n\x1b[1m\x1b[36mDENEB ARC EXPLAIN\x1b[0m \x1b[90m— Component Analysis\x1b[0m`);
  console.log(`\x1b[1mFile:\x1b[0m ${explanation.file}`);
  console.log(`\x1b[90mFormat: ${explanation.isTypeScript ? 'TypeScript (TSX)' : 'JavaScript (JSX)'} | Editable: ${explanation.alreadyEditable ? 'Yes' : 'Pending'}\x1b[0m\n`);

  console.log(`\x1b[1mDiscovered Elements (${explanation.totalCandidates} total, ${explanation.editableCount} editable):\x1b[0m`);
  for (const el of explanation.editableElements) {
    const kindTag = `\x1b[32m[${el.kind.toUpperCase()}]\x1b[0m`;
    const locTag = `\x1b[90m(${el.loc})\x1b[0m`;
    const val = typeof el.value === 'string' ? `"${el.value.slice(0, 40)}${el.value.length > 40 ? '...' : ''}"` : '';
    console.log(`  ${kindTag} <${el.tag}> ${locTag} ${val}`);
    console.log(`    \x1b[90m↳ Proposed path:\x1b[0m \x1b[33m${el.proposedField}\x1b[0m \x1b[90m(confidence: ${Math.round((el.confidence || 0.8) * 100)}%)\x1b[0m`);
  }

  if (explanation.skippedElements.length > 0) {
    console.log(`\n\x1b[1mPreserved / Skipped Elements (${explanation.skippedElements.length}):\x1b[0m`);
    for (const el of explanation.skippedElements.slice(0, 10)) {
      console.log(`  \x1b[90m[PRESERVED] <${el.tag}> (${el.loc}) — reason: ${el.reason}\x1b[0m`);
    }
    if (explanation.skippedElements.length > 10) {
      console.log(`  \x1b[90m... and ${explanation.skippedElements.length - 10} more\x1b[0m`);
    }
  }
  console.log('');
}

module.exports = {
  explainFile,
  printExplanation,
};

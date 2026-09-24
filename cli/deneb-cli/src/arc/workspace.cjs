'use strict';

const fs = require('fs');
const path = require('path');
const { walkFiles, isIgnoredDirName, isSecretFile, copyFilePreserve, writeJson, rel } = require('./fs-utils.cjs');

/**
 * Creates isolated run directory structure:
 * .deneb/
 *   runs/
 *     <runId>/
 *       source-snapshot/
 *       workspace/
 *       reports/
 *       transformed/
 *       runtime-results.json
 */
function createRunWorkspace(projectDir, runId) {
  const runsRoot = path.join(projectDir, '.deneb', 'runs', runId);
  const snapshotDir = path.join(runsRoot, 'source-snapshot');
  const workspaceDir = path.join(runsRoot, 'workspace');
  const reportsDir = path.join(runsRoot, 'reports');
  const transformedDir = path.join(runsRoot, 'transformed');

  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(transformedDir, { recursive: true });

  return {
    runsRoot,
    snapshotDir,
    workspaceDir,
    reportsDir,
    transformedDir,
  };
}

/**
 * Copies source project files into workspace sandbox, avoiding ignored directories.
 * Links node_modules via junction/symlink so compilation and runtime dependencies resolve.
 */
function copyProjectToWorkspace(projectDir, workspaceDir, snapshotDir = null) {
  const copiedFiles = [];
  const entries = fs.readdirSync(projectDir, { withFileTypes: true });

  for (const entry of entries) {
    if (isIgnoredDirName(entry.name) || isSecretFile(entry.name)) {
      continue;
    }
    const srcPath = path.join(projectDir, entry.name);
    const destPath = path.join(workspaceDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, (f) => !isIgnoredDirName(path.basename(f)));
    } else if (entry.isFile()) {
      copyFilePreserve(srcPath, destPath);
      copiedFiles.push(entry.name);
    }
  }

  // Also snapshot all source files if snapshotDir is provided
  if (snapshotDir) {
    const allSources = walkFiles(projectDir, { include: () => true });
    for (const file of allSources) {
      const relative = rel(projectDir, file);
      const snapDest = path.join(snapshotDir, relative);
      copyFilePreserve(file, snapDest);
    }
  }

  // Handle node_modules linking if present in source project
  const srcNodeModules = path.join(projectDir, 'node_modules');
  const destNodeModules = path.join(workspaceDir, 'node_modules');
  if (fs.existsSync(srcNodeModules) && !fs.existsSync(destNodeModules)) {
    try {
      const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
      fs.symlinkSync(srcNodeModules, destNodeModules, symlinkType);
    } catch {
      // If symlink/junction fails (e.g. cross-device or permission), continue without node_modules
    }
  }

  return copiedFiles;
}

function copyDirRecursive(srcDir, destDir, filter = () => true) {
  if (!fs.existsSync(srcDir) || !filter(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const items = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const item of items) {
    if (isIgnoredDirName(item.name)) continue;
    const srcItem = path.join(srcDir, item.name);
    const destItem = path.join(destDir, item.name);
    if (!filter(srcItem)) continue;
    if (item.isDirectory()) {
      copyDirRecursive(srcItem, destItem, filter);
    } else if (item.isFile()) {
      copyFilePreserve(srcItem, destItem);
    }
  }
}

/**
 * Commits transformed files from workspace back to developer's project.
 */
function commitWorkspaceToProject(workspaceDir, projectDir, changedRelativeFiles = []) {
  const committed = [];
  const filesToCommit = changedRelativeFiles.length > 0
    ? changedRelativeFiles
    : walkFiles(workspaceDir, { include: () => true }).map((f) => rel(workspaceDir, f));

  for (const relative of filesToCommit) {
    const srcFile = path.join(workspaceDir, relative);
    const destFile = path.join(projectDir, relative);
    if (fs.existsSync(srcFile)) {
      copyFilePreserve(srcFile, destFile);
      committed.push(relative);
    }
  }
  return committed;
}

/**
 * Destroys the staging workspace directory safely.
 */
function cleanupWorkspace(workspaceDir) {
  if (!workspaceDir || !fs.existsSync(workspaceDir)) return;
  try {
    // Unlink node_modules junction first if present
    const nodeModulesLink = path.join(workspaceDir, 'node_modules');
    if (fs.existsSync(nodeModulesLink)) {
      try {
        const stat = fs.lstatSync(nodeModulesLink);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(nodeModulesLink);
        }
      } catch {
        // ignore
      }
    }
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Saves execution report and diagnostics into .deneb/runs/<runId>/reports/
 */
function saveRunArtifacts(runDirs, data = {}) {
  const { reportsDir, runsRoot, transformedDir, workspaceDir } = runDirs;

  if (data.report) {
    writeJson(path.join(reportsDir, 'conversion-report.json'), data.report);
  }
  if (data.runtimeResults) {
    writeJson(path.join(runsRoot, 'runtime-results.json'), data.runtimeResults);
    writeJson(path.join(reportsDir, 'runtime-results.json'), data.runtimeResults);
  }
  if (data.failureReasons) {
    writeJson(path.join(reportsDir, 'rollback-reason.json'), {
      timestamp: new Date().toISOString(),
      reasons: data.failureReasons,
    });
  }

  // Snapshot transformed files to transformed/
  if (workspaceDir && fs.existsSync(workspaceDir)) {
    const files = walkFiles(workspaceDir, { include: () => true });
    for (const f of files) {
      const relPath = rel(workspaceDir, f);
      copyFilePreserve(f, path.join(transformedDir, relPath));
    }
  }
}

/**
 * Generates structured explanation when conversion is blocked.
 */
function formatFailureExplanation(validation, reasons = []) {
  const lines = [
    '────────────────────────────────────────────────────────────',
    '  DENEB CONVERSION BLOCKED — ZERO FILES MODIFIED',
    '────────────────────────────────────────────────────────────',
    'The template did not pass the 100% Fivora Success Contract.',
    'Your original project files have been kept completely intact.',
    '',
    'Blocking issues detected:',
  ];

  if (reasons.length > 0) {
    for (let i = 0; i < reasons.length; i++) {
      lines.push(`  ${i + 1}. ${reasons[i]}`);
    }
  }

  if (validation?.fivoraContractErrors?.length) {
    lines.push('');
    lines.push('Fivora Contract Violations:');
    for (const err of validation.fivoraContractErrors.slice(0, 10)) {
      lines.push(`    - ${err}`);
    }
    if (validation.fivoraContractErrors.length > 10) {
      lines.push(`    ... and ${validation.fivoraContractErrors.length - 10} more`);
    }
  }

  if (validation?.uncoveredVisibleText > 0) {
    lines.push('');
    lines.push(`Uncovered Visible Text: ${validation.uncoveredVisibleText} node(s) without visual markers.`);
  }

  if (validation?.designPreservation < 98 && validation?.designPreservation > 0) {
    lines.push('');
    lines.push(`Design Preservation: ${validation.designPreservation}% (Minimum required: 98%).`);
  }

  lines.push('');
  lines.push('Run "deneb explain <file>" or inspect ".deneb/runs/<runId>/reports/conversion-report.json"');
  lines.push('────────────────────────────────────────────────────────────');

  return lines.join('\n');
}

module.exports = {
  createRunWorkspace,
  copyProjectToWorkspace,
  commitWorkspaceToProject,
  cleanupWorkspace,
  saveRunArtifacts,
  formatFailureExplanation,
};

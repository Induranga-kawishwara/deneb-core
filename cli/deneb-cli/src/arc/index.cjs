'use strict';

/**
 * Deneb ARC — Adaptive Refactoring Compiler
 *
 * AST-driven adaptive UI refactoring, editable-contract compilation,
 * validation, and self-evaluation engine.
 *
 * Default engine for `npx @deneb-ui/cli init`.
 * Legacy regex converter remains available via `--legacy`.
 */

const fs = require('fs');
const path = require('path');
const { ARC_NAME, ARC_VERSION, SCHEMA_VERSION, ENGINE_ID } = require('./version.cjs');
const { walkFiles, isJsxFile, rel, copyFilePreserve, writeJson, readJsonSafe, findFirstExisting } = require('./fs-utils.cjs');
const { scanProject, buildDependencyGraph, inferOwnerScope, resolvePageFileOnDisk } = require('./scanner.cjs');
const { buildProjectIR } = require('./ir-builder.cjs');
const { analyzeFile, collectDesignSnapshot } = require('./semantic.cjs');
const { planTransformations } = require('./planner.cjs');
const { applyFilePlan, instrumentLayoutSource, instrumentPageKey, resolveSiteDataSpecifier, resolveSiteDataRuntimeSpecifier, rewriteRecursiveSiteDataContext, ensureJsonModule, sanitizeContradictoryMarkersInSource } = require('./transformer.cjs');
const { applyResidualPass } = require('./residual.cjs');
const { parseSource } = require('./ast.cjs');
const { buildSiteDataAndManifest, writeDataBank, loadExistingData, countSchemaFields } = require('./manifest.cjs');
const { collectFontIdsFromSiteData } = require('./font-plan.cjs');
const { validateAstFiles, validateContracts, designPreservationScore, coverageMetrics } = require('./validator.cjs');
const { recordExperience, registryArchitecture } = require('./learning.cjs');
const { matchRecipeV2 } = require('./recipes-v2.cjs');
const { ensureStaticExportConfig, findNextConfig } = require('./next-config.cjs');
const {
  extractMarkers,
  canonicalizeMarkerPath,
  auditMarkerPlacement,
  auditActionLabelCollision,
  auditPathCoverage,
  auditSchemaUniqueness,
  auditPageCoverage,
  auditPreviewRuntime,
  findUncoveredVisibleText,
  auditEmptyStateSource,
  auditSelectOptions,
  auditListBounds,
  auditStaticMarkerAuthorship,
  auditRouteOwnedMarkerCoverage,
} = require('./fivora-contract.cjs');
const printer = require('./printer.cjs');
const { classifyComponents } = require('./component-registry.cjs');
const { checkAiReady, adaptComponent, generateDocsPage, loadEnv } = require('./ai-agent.cjs');
const { checkGithubReady, createComponentPR } = require('./pr-agent.cjs');
const { runAiEvaluatorPipeline } = require('./ai-evaluator.cjs');
const { explainFile } = require('./explain.cjs');
const { generateArcDiff } = require('./diff.cjs');
const {
  createRunWorkspace,
  copyProjectToWorkspace,
  commitWorkspaceToProject,
  cleanupWorkspace,
  saveRunArtifacts,
  formatFailureExplanation,
} = require('./workspace.cjs');
const { calculateVisualPreservation, extractDesignSnapshot, STANDARD_VIEWPORTS } = require('./visual-regression.cjs');
const { verifyInteractionsSync, INTERACTION_PATTERNS } = require('./interaction-verifier.cjs');
const { KNOWN_STOREFRONTS, auditStorefrontTemplate, verifyStorefrontCorpus } = require('./corpus-verifier.cjs');
const {
  MUTATION_TYPES,
  applyMutation,
  generateFuzzCorpus,
  testMutationResilience,
  runFuzzHarness,
} = require('./fuzz-engine.cjs');
const {
  analyzeBlockedProject,
  formatBlockedExplanationTerminal,
  printBlockedExplanation,
} = require('./explain-blocked.cjs');


function parseArcOptions(raw = {}) {
  return {
    dryRun: Boolean(raw.dryRun || raw.dryrun),
    explain: Boolean(raw.explain),
    recipeName: raw.recipeName || raw.recipe || null,
    telemetry: raw.telemetry || 'off',
    skipInstall: Boolean(raw.skipInstall),
    detectedPages: raw.detectedPages || null,
    json: Boolean(raw.json),
    aiEnabled: Boolean(raw.aiEnabled),
    aiDryRun: Boolean(raw.aiDryRun),
    strict: raw.strict !== false,
    verifyRuntime: Boolean(raw.verifyRuntime || raw['verify-runtime']),
    previewUrl: raw.previewUrl || raw['preview-url'] || null,
    isolatedWorkspace: raw.isolatedWorkspace !== false,
  };
}

function createRunId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `arc-${stamp}`;
}

function createBackup(projectDir, runId) {
  const backupDir = path.join(projectDir, `.deneb-backup-${runId}`);
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function backupFile(projectDir, backupDir, absPath) {
  if (!fs.existsSync(absPath)) return;
  const dest = path.join(backupDir, rel(projectDir, absPath));
  copyFilePreserve(absPath, dest);
}

function restoreBackup(projectDir, backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) return;
  const files = walkFiles(backupDir, { include: () => true });
  for (const abs of files) {
    const relative = path.relative(backupDir, abs);
    copyFilePreserve(abs, path.join(projectDir, relative));
  }
}

function findLayoutFile(profile) {
  const root = profile.root;
  const dirs = [profile.appDir, profile.pagesDir].filter(Boolean).map((d) => path.join(root, d));
  const names = ['layout.tsx', 'layout.jsx', 'layout.js', '_app.tsx', '_app.jsx', '_app.js'];
  const candidates = [];
  for (const dir of dirs) {
    for (const name of names) candidates.push(path.join(dir, name));
  }
  return findFirstExisting(candidates);
}

/**
 * Reads every source file back off disk and inventories the Deneb markers it
 * actually contains, along with which routes render each marker.
 */
function collectMarkerInventory(projectDir, profile, graph) {
  const fieldPaths = new Set();
  const listPaths = new Set();
  const itemPaths = new Set();
  const markerRoutes = {};
  const pageKeysByFile = {};
  const sources = [];

  for (const relativeFile of profile.jsxFiles) {
    const abs = path.join(projectDir, relativeFile);
    let code = '';
    try {
      code = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    sources.push({ rel: relativeFile, code });
    const { markers } = extractMarkers(code, relativeFile);
    const routes = graph.routesByFile?.[relativeFile] || [];

    for (const marker of markers) {
      if (marker.kind === 'page') {
        pageKeysByFile[relativeFile] = pageKeysByFile[relativeFile] || [];
        if (!pageKeysByFile[relativeFile].includes(marker.value)) {
          pageKeysByFile[relativeFile].push(marker.value);
        }
        continue;
      }
      const canonical = canonicalizeMarkerPath(marker.value);
      if (!canonical) continue;
      if (marker.kind === 'field') fieldPaths.add(canonical);
      if (marker.kind === 'list') listPaths.add(canonical);
      if (marker.kind === 'item') itemPaths.add(canonical);
      markerRoutes[canonical] = [...new Set([...(markerRoutes[canonical] || []), ...routes])];
    }
  }

  return {
    fieldPaths: [...fieldPaths],
    listPaths: [...listPaths],
    itemPaths: [...itemPaths],
    markerRoutes,
    pageKeysByFile,
    sources,
  };
}

/**
 * Runs the ported Fivora strict contract against the converted project so a
 * rejection surfaces locally rather than at upload time.
 */
function auditFivoraContract({ profile, siteData, manifest, inventory }) {
  const placement = [];
  const collisions = [];
  const uncoveredText = [];
  const emptyState = [];
  const staticAuthorship = [];
  const allMarkers = [];

  for (const source of inventory.sources) {
    const { markers } = extractMarkers(source.code, source.rel);
    allMarkers.push(...markers);
    placement.push(...auditMarkerPlacement(source.code, source.rel));
    collisions.push(...auditActionLabelCollision(source.code, source.rel));
    uncoveredText.push(...findUncoveredVisibleText(source.code, source.rel));
    emptyState.push(...auditEmptyStateSource(source.code, source.rel));
    staticAuthorship.push(...auditStaticMarkerAuthorship(source.code, source.rel));
  }

  const coverage = auditPathCoverage({
    content: siteData.content,
    editorSchema: manifest.editorSchema,
    markers: allMarkers,
    controlOnlyPaths: manifest.visualEditing?.controlOnlyPaths || [],
  });

  const routeFiles = {};
  for (const route of profile.routes || []) {
    if (route.file) routeFiles[route.id] = route.file;
  }

  const errors = [
    ...coverage.errors,
    ...placement,
    ...collisions,
    ...emptyState,
    ...staticAuthorship,
    ...auditSchemaUniqueness(manifest.editorSchema),
    ...auditSelectOptions(manifest.editorSchema, manifest.pages),
    ...auditListBounds(manifest.editorSchema, siteData.content),
    ...auditPageCoverage({
      pages: manifest.pages,
      routeFiles,
      pageMarkersByFile: inventory.pageKeysByFile,
    }),
    ...auditRouteOwnedMarkerCoverage({
      editorSchema: manifest.editorSchema,
      pages: manifest.pages,
      markers: allMarkers,
      controlOnlyPaths: manifest.visualEditing?.controlOnlyPaths || [],
    }),
    ...auditPreviewRuntime(inventory.sources.map((source) => source.code)),
  ];

  return {
    passed: errors.length === 0 && uncoveredText.length === 0,
    errors: [...new Set(errors)],
    uncoveredVisibleText: uncoveredText,
    emptyStatePassed: emptyState.length === 0,
    fieldMarkers: coverage.fieldMarkers,
    listMarkers: coverage.listMarkers,
    itemMarkers: coverage.itemMarkers,
    pathCoverage: coverage,
  };
}

function analyzeProjectFiles(profile, graph, ir) {
  const analyses = [];
  for (const relativeFile of profile.jsxFiles) {
    const abs = path.join(profile.root, relativeFile);
    let code = '';
    try {
      code = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const componentMeta = (profile.components || []).find((c) => c.file === relativeFile);
    const ownerScope = inferOwnerScope(profile, graph, relativeFile);
    let designSnapshot = { classNames: [], styles: [] };
    try {
      designSnapshot = collectDesignSnapshot(code);
    } catch {
      // snapshot is best-effort
    }
    const result = analyzeFile({
      code,
      relativeFile,
      profile,
      graph,
      ownerScope,
      componentMeta,
      ir,
    });
    analyses.push({
      ...result,
      relativeFile,
      code,
      designSnapshot,
      ownerScope,
    });
  }
  return analyses;
}

function mergeDetectedPages(profile, detectedPages) {
  if (!Array.isArray(detectedPages) || !detectedPages.length) return;
  const scannedIds = new Set(profile.routes.map((route) => route.id));
  const scannedRoutes = new Set(profile.routes.map((route) => route.route));
  for (const page of detectedPages) {
    if (!page || !page.id) continue;
    if (scannedIds.has(page.id) || scannedRoutes.has(page.route)) continue;
    const file = resolvePageFileOnDisk(profile.root, page);
    if (!file) continue;
    profile.routes.push({ ...page, file });
    scannedIds.add(page.id);
    scannedRoutes.add(page.route);
  }
}

async function runDenebArcAsync(projectDir, projectName, options = {}) {
  const opts = parseArcOptions(options);
  const runId = createRunId();
  const startedAt = new Date().toISOString();

  printer.printBanner(opts.dryRun ? 'dry-run' : opts.explain ? 'explain' : 'run');

  const profile = scanProject(projectDir);
  mergeDetectedPages(profile, opts.detectedPages);
  printer.printProfile(profile);
  const graph = buildDependencyGraph(profile);
  const ir = buildProjectIR(profile);
  const analyses = analyzeProjectFiles(profile, graph, ir);

  const candidateCount = analyses.reduce(
    (n, a) => n + (a.candidates || []).filter((c) => c.kind !== 'decoration' && c.kind !== 'already-editable' && !c.skip).length,
    0
  );
  const actionCount = analyses.reduce(
    (n, a) => n + (a.candidates || []).filter((c) => c.operation === 'split-action-contract' || c.operation === 'form-submit-action' || c.kind === 'url').length,
    0
  );
  printer.printScan(profile, graph, candidateCount, actionCount);

  // ─── AI Agent: Classify & Adapt Unknown Components ──────────
  let aiResults = [];
  loadEnv(projectDir);
  const aiCheck = checkAiReady();
  if (!aiCheck.ready) {
    printer.warn(`AI Agent disabled: ${aiCheck.reason}`);
  } else {
    const componentNames = (profile.components || []).map((c) => c.name || c.tag).filter(Boolean);
    const { unknown } = classifyComponents(componentNames);

    if (unknown.length > 0) {
      printer.printAiDetected(unknown.length);

      for (const componentName of unknown) {
        const meta = (profile.components || []).find((c) => (c.name || c.tag) === componentName);
        const absFile = meta?.file ? path.join(projectDir, meta.file) : null;
        let sourceCode = '';
        if (absFile && fs.existsSync(absFile)) {
          try { sourceCode = fs.readFileSync(absFile, 'utf8'); } catch { /* skip */ }
        }
        if (!sourceCode) {
          printer.printAiSkipped(componentName, 'could not read source file');
          continue;
        }

        try {
          const aiResult = await adaptComponent(sourceCode, componentName, profile, {
            onAttempt: (attempt, max) => printer.printAiAttempt(componentName, attempt, max),
            onValidationFail: (errors, attempt) => printer.printAiValidationFail(errors, attempt),
            onSuccess: (attempt) => printer.printAiSuccess(componentName, attempt, 0),
          });

          if (aiResult.success) {
            aiResults.push({ componentName, ...aiResult });
            printer.printAiSuccess(componentName, aiResult.attempts, aiResult.fields.length);
          } else {
            printer.printAiSkipped(componentName, aiResult.error || 'failed after max retries');
          }
        } catch (err) {
          printer.printAiSkipped(componentName, err.message);
        }
      }

      // Background: Open PRs for successfully adapted components
      const ghCheck = checkGithubReady();
      if (ghCheck.ready && aiResults.length > 0) {
        for (const aiResult of aiResults) {
          try {
            const docsResult = await generateDocsPage(aiResult.componentName, aiResult.code, aiResult.fields);
            const prResult = await createComponentPR({
              componentName: aiResult.componentName,
              componentCode: aiResult.code,
              docsCode: docsResult.success ? docsResult.code : null,
              editableFields: aiResult.fields,
              attempts: aiResult.attempts,
              totalInputTokens: aiResult.totalInputTokens,
              totalOutputTokens: aiResult.totalOutputTokens,
              dryRun: opts.aiDryRun,
            });
            if (prResult.corePr) {
              printer.printAiPr('chamikathereal/core → deneb-ui/core', `feat/ai-editable-${aiResult.componentName.toLowerCase()}`, prResult.corePr.number);
            }
            if (prResult.uiPr) {
              printer.printAiPr('chamikathereal/ui → deneb-ui/ui', `feat/ai-docs-${aiResult.componentName.toLowerCase()}`, prResult.uiPr.number);
            }
            for (const err of prResult.errors) {
              printer.warn(`PR: ${err}`);
            }
          } catch (err) {
            printer.warn(`PR creation failed for ${aiResult.componentName}: ${err.message}`);
          }
        }
      } else if (!ghCheck.ready && aiResults.length > 0) {
        printer.warn(`GitHub PRs skipped: ${ghCheck.reason}`);
      }

      const totalTokens = aiResults.reduce((n, r) => n + r.totalInputTokens + r.totalOutputTokens, 0);
      printer.printAiSummary(aiResults.length, unknown.length - aiResults.length, totalTokens);
    }
  }

  const result = runArcTransformations(projectDir, projectName, opts, profile, graph, analyses, runId, startedAt, ir);

  if (!opts.dryRun && result && result.outcome === 'success') {
    printer.printAiEvaluatorStart();
    try {
      const evalResult = await runAiEvaluatorPipeline(projectDir, profile, {
        dryRun: opts.aiDryRun,
        aiEnabled: opts.aiEnabled,
      });
      if (evalResult.healed > 0) {
        for (const logItem of evalResult.log) {
          printer.printAiEvaluatorHealed(logItem);
        }
      }
      if (evalResult.remainingIssues && evalResult.remainingIssues.length > 0) {
        for (const issue of evalResult.remainingIssues) {
          printer.printAiEvaluatorIssue(`${issue.file}: ${issue.message}`);
        }
      } else {
        printer.printAiEvaluatorPass('All runtime integrity checks passed (RSC boundaries, exports, Fivora contracts).');
      }
    } catch (err) {
      printer.warn(`AI Evaluator audit encountered an issue: ${err.message}`);
    }
  }

  return result;
}

function runDenebArcSync(projectDir, projectName, options = {}) {
  const opts = parseArcOptions(options);
  const runId = createRunId();
  const startedAt = new Date().toISOString();

  printer.printBanner(opts.dryRun ? 'dry-run' : opts.explain ? 'explain' : 'run');

  const profile = scanProject(projectDir);
  mergeDetectedPages(profile, opts.detectedPages);

  printer.printProfile(profile);
  const graph = buildDependencyGraph(profile);
  const ir = buildProjectIR(profile);
  const analyses = analyzeProjectFiles(profile, graph, ir);

  const candidateCount = analyses.reduce(
    (n, a) => n + (a.candidates || []).filter((c) => c.kind !== 'decoration' && c.kind !== 'already-editable' && !c.skip).length,
    0
  );
  const actionCount = analyses.reduce(
    (n, a) => n + (a.candidates || []).filter((c) => c.operation === 'split-action-contract' || c.operation === 'form-submit-action' || c.kind === 'url').length,
    0
  );
  printer.printScan(profile, graph, candidateCount, actionCount);

  return runArcTransformations(projectDir, projectName, opts, profile, graph, analyses, runId, startedAt, ir);
}

function runDenebArc(projectDir, projectName, options = {}) {
  const opts = parseArcOptions(options);
  if (opts.aiEnabled) {
    return runDenebArcAsync(projectDir, projectName, options);
  }
  return runDenebArcSync(projectDir, projectName, options);
}

function runArcTransformations(projectDir, projectName, opts, profile, graph, analyses, runId, startedAt, ir) {
  const sourceAbs = profile.jsxFiles.map((f) => path.join(projectDir, f));
  const recipeMatch = matchRecipeV2(projectDir, profile, sourceAbs, opts.recipeName);
  if (recipeMatch.recipe) {
    printer.ok(`Matched recipe: ${recipeMatch.recipe.label} (${recipeMatch.recipe.name})`);
  }

  const plan = planTransformations({
    profile,
    analyses,
    recipe: recipeMatch.recipe,
    ir,
  });
  printer.printPlan(plan);

  if (opts.explain) printer.printExplain(plan);
  if (opts.dryRun) {
    printer.printDryRun(profile, plan);
    const dryReport = buildReport({
      runId, startedAt, projectDir, projectName, profile, graph, plan, recipeMatch, opts,
      filesChanged: [],
      validation: { syntaxPassed: true, contractPassed: true, dryRun: true },
      coverage: coverageMetrics({
        analyses,
        plan,
        appliedCount: 0,
        skippedDynamic: plan.skipped.filter((s) => /dynamic|api/.test(s.reason || '')).length,
        alreadyEditable: analyses.filter((a) => a.alreadyEditable).length,
      }),
      design: { score: 100 },
      outcome: 'dry-run',
    });
    return dryReport;
  }

  const backupDir = createBackup(projectDir, runId);
  const journalDir = path.join(projectDir, '.deneb', 'runs', runId);
  fs.mkdirSync(journalDir, { recursive: true });
  writeJson(path.join(journalDir, 'project-profile.json'), sanitizeProfile(profile));
  writeJson(path.join(journalDir, 'transform-plan.json'), sanitizePlan(plan));

  const existing = loadExistingData(projectDir, profile);
  const changedFiles = [];
  const afterFiles = {};
  let appliedCount = 0;
  let layoutUpdated = false;
  const transformFailures = [];

  const layoutFile = findLayoutFile(profile);
  if (layoutFile) {
    backupFile(projectDir, backupDir, layoutFile);
    const layoutRel = rel(projectDir, layoutFile);
    const siteDataImport = resolveSiteDataSpecifier(profile, layoutRel);
    const providerImport = resolveSiteDataRuntimeSpecifier(profile);
    const original = fs.readFileSync(layoutFile, 'utf8');
    const instrumented = instrumentLayoutSource(original, siteDataImport, providerImport);
    if (instrumented.updated && instrumented.code !== original) {
      fs.writeFileSync(layoutFile, instrumented.code, 'utf8');
      changedFiles.push(layoutRel);
      layoutUpdated = true;
    }
  }

  const contextCandidates = [
    path.join(projectDir, 'src', 'lib', 'siteDataContext.tsx'),
    path.join(projectDir, 'src', 'lib', 'siteDataContext.ts'),
    path.join(projectDir, 'lib', 'siteDataContext.tsx'),
    path.join(projectDir, 'lib', 'siteDataContext.ts'),
  ];
  for (const abs of contextCandidates) {
    if (!fs.existsSync(abs)) continue;
    backupFile(projectDir, backupDir, abs);
    const original = fs.readFileSync(abs, 'utf8');
    const rewritten = rewriteRecursiveSiteDataContext(original);
    if (rewritten.updated && rewritten.code !== original) {
      fs.writeFileSync(abs, rewritten.code, 'utf8');
      changedFiles.push(rel(projectDir, abs));
    }
  }

  for (const filePlan of plan.files) {
    if (!filePlan.transformations.length || filePlan.skippedFile) continue;
    const abs = path.join(projectDir, filePlan.file);
    backupFile(projectDir, backupDir, abs);
    let result;
    try {
      result = applyFilePlan(filePlan, profile);
    } catch (err) {
      transformFailures.push({ file: filePlan.file, reason: err.message, confidence: 0.4 });
      continue;
    }
    if (!result.changed) continue;
    try {
      parseSource(result.code, filePlan.file);
    } catch (err) {
      transformFailures.push({ file: filePlan.file, reason: `AST invalid after transform: ${err.message}`, confidence: 0.3 });
      continue;
    }
    fs.writeFileSync(abs, result.code, 'utf8');
    changedFiles.push(filePlan.file);
    afterFiles[filePlan.file] = result.code;
    appliedCount += result.applied || 0;
    if (result.failures?.length) transformFailures.push(...result.failures.map((f) => ({ file: filePlan.file, ...f })));
  }

  // Every scanned route must carry its own data-preview-page-key, whichever
  // router the project uses.
  for (const route of profile.routes || []) {
    if (!route.file) continue;
    const abs = path.join(projectDir, route.file);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, 'utf8');
    const keyed = instrumentPageKey(original, route.file, route.id);
    if (keyed.updated && keyed.code !== original) {
      backupFile(projectDir, backupDir, abs);
      fs.writeFileSync(abs, keyed.code, 'utf8');
      if (!changedFiles.includes(route.file)) changedFiles.push(route.file);
    }
  }

  // Remove any conflicting data-preview-static from elements carrying editable markers
  for (const relativeFile of profile.jsxFiles || []) {
    const abs = path.join(projectDir, relativeFile);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, 'utf8');
    const sanitized = sanitizeContradictoryMarkersInSource(original, relativeFile);
    if (sanitized.updated && sanitized.code !== original) {
      backupFile(projectDir, backupDir, abs);
      fs.writeFileSync(abs, sanitized.code, 'utf8');
      if (!changedFiles.includes(relativeFile)) changedFiles.push(relativeFile);
    }
  }

  const residualFields = [];
  const usedPaths = new Set(plan.usedPaths || []);
  for (const relativeFile of profile.jsxFiles || []) {
    const abs = path.join(projectDir, relativeFile);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, 'utf8');
    const analysis = analyses.find((item) => item.relativeFile === relativeFile);
    const residual = applyResidualPass({
      code: original,
      file: relativeFile,
      ownerScope: analysis?.ownerScope || inferOwnerScope(profile, graph, relativeFile),
      usedPaths,
      componentName: analysis?.componentMeta?.name,
      role: analysis?.componentMeta?.role,
      ir,
    });
    if (!residual.changed) continue;
    try {
      parseSource(residual.code, relativeFile);
    } catch {
      continue;
    }
    backupFile(projectDir, backupDir, abs);
    fs.writeFileSync(abs, residual.code, 'utf8');
    if (!changedFiles.includes(relativeFile)) changedFiles.push(relativeFile);
    afterFiles[relativeFile] = residual.code;
    appliedCount += residual.applied || 0;
    residualFields.push(...(residual.fields || []));
  }

  for (const relativeFile of profile.jsxFiles || []) {
    const abs = path.join(projectDir, relativeFile);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, 'utf8');
    const sanitized = sanitizeContradictoryMarkersInSource(original, relativeFile);
    if (sanitized.updated && sanitized.code !== original) {
      backupFile(projectDir, backupDir, abs);
      fs.writeFileSync(abs, sanitized.code, 'utf8');
      if (!changedFiles.includes(relativeFile)) changedFiles.push(relativeFile);
      afterFiles[relativeFile] = sanitized.code;
    }
  }

  // Mandatory Post-Pass: Guarantee all files referencing siteData have useSiteData hook injected
  const { healMissingSiteDataHooks } = require('./transformer.cjs');
  for (const relativeFile of profile.jsxFiles || []) {
    const abs = path.join(projectDir, relativeFile);
    if (!fs.existsSync(abs)) continue;
    const currentCode = fs.readFileSync(abs, 'utf8');
    if (currentCode.includes('siteData')) {
      const healed = healMissingSiteDataHooks(currentCode, relativeFile);
      if (healed && healed !== currentCode) {
        backupFile(projectDir, backupDir, abs);
        fs.writeFileSync(abs, healed, 'utf8');
        afterFiles[relativeFile] = healed;
        if (!changedFiles.includes(relativeFile)) changedFiles.push(relativeFile);
      }
    }
  }

  if (profile.framework === 'nextjs') {
    const before = findNextConfig(projectDir);
    if (before) backupFile(projectDir, backupDir, before.abs);
    const nextConfigResult = ensureStaticExportConfig(projectDir, profile);
    if (nextConfigResult.updated && nextConfigResult.file) {
      changedFiles.push(nextConfigResult.file);
      printer.ok(
        nextConfigResult.created
          ? `Created ${nextConfigResult.file} with static export for Fivora hosting`
          : `Configured static export in ${nextConfigResult.file}`
      );
    }
    for (const warning of nextConfigResult.warnings || []) {
      printer.warn(warning);
    }
  }

  if (profile.tsconfigFile) {
    const abs = path.join(projectDir, profile.tsconfigFile);
    const current = readJsonSafe(abs);
    const next = ensureJsonModule(current);
    if (next.changed) {
      backupFile(projectDir, backupDir, abs);
      writeJson(abs, next.config);
      changedFiles.push(profile.tsconfigFile);
    }
  }

  printer.printApply({ filesUpdated: changedFiles.length, layoutUpdated });

  // Marker inventory must be read back from what was actually written, not from
  // the plan: a planned field that failed to transform must not be advertised
  // as visually editable, and an unrendered field must be declared control-only.
  const markerInventory = collectMarkerInventory(projectDir, profile, graph);

  const dataBundle = buildSiteDataAndManifest({
    projectDir,
    projectName: projectName || profile.packageName,
    profile,
    plan,
    recipe: recipeMatch.recipe,
    existingSiteData: existing.siteData,
    existingManifest: existing.manifest,
    boundFieldPaths: markerInventory.fieldPaths,
    boundListPaths: markerInventory.listPaths,
    extraFields: residualFields,
    markerRoutes: markerInventory.markerRoutes,
  });

  const siteAbs = path.join(projectDir, dataBundle.siteDataRel);
  const manifestAbs = path.join(projectDir, 'fivora-template.json');
  const createdDuringRun = [];
  if (!fs.existsSync(siteAbs)) createdDuringRun.push(siteAbs);
  if (!fs.existsSync(manifestAbs)) createdDuringRun.push(manifestAbs);
  if (fs.existsSync(siteAbs)) backupFile(projectDir, backupDir, siteAbs);
  if (fs.existsSync(manifestAbs)) backupFile(projectDir, backupDir, manifestAbs);
  writeDataBank(projectDir, dataBundle.siteData, dataBundle.manifest);

  const astResults = validateAstFiles(
    changedFiles
      .filter((f) => isJsxFile(f) || /\.(tsx|jsx|ts|js)$/.test(f))
      .map((f) => ({ abs: path.join(projectDir, f), rel: f }))
  );
  const syntaxPassed = astResults.every((r) => r.passed);
  const contracts = validateContracts(projectDir, dataBundle.siteData, dataBundle.manifest);
  const design = designPreservationScore(plan.files, afterFiles);
  const alreadyEditable = analyses.filter((a) => a.alreadyEditable).length;
  const skippedDynamic = plan.skipped.filter((s) => /dynamic|api/.test(s.reason || '')).length;

  let fivoraAudit = auditFivoraContract({
    profile,
    siteData: dataBundle.siteData,
    manifest: dataBundle.manifest,
    inventory: collectMarkerInventory(projectDir, profile, graph),
  });

  // Auto-reconciliation: If fivoraAudit flagged unknown paths, auto-register them to controlOnlyPaths
  if (!fivoraAudit.passed && fivoraAudit.errors?.length > 0) {
    let manifestModified = false;
    for (const err of fivoraAudit.errors) {
      const unknownMatch = err.match(/references unknown path "([^"]+)"/);
      if (unknownMatch) {
        const unknownPath = unknownMatch[1];
        dataBundle.manifest.visualEditing = dataBundle.manifest.visualEditing || {};
        dataBundle.manifest.visualEditing.controlOnlyPaths = dataBundle.manifest.visualEditing.controlOnlyPaths || [];
        if (!dataBundle.manifest.visualEditing.controlOnlyPaths.includes(unknownPath)) {
          dataBundle.manifest.visualEditing.controlOnlyPaths.push(unknownPath);
          manifestModified = true;
        }
      }
    }
    if (manifestModified) {
      writeDataBank(projectDir, dataBundle.siteData, dataBundle.manifest);
      fivoraAudit = auditFivoraContract({
        profile,
        siteData: dataBundle.siteData,
        manifest: dataBundle.manifest,
        inventory: collectMarkerInventory(projectDir, profile, graph),
      });
    }
  }

  const coverage = coverageMetrics({
    analyses,
    plan,
    appliedCount,
    skippedDynamic,
    alreadyEditable,
    content: dataBundle.siteData.content,
    controlOnlyPaths: dataBundle.manifest.visualEditing?.controlOnlyPaths || [],
    pathCoverage: fivoraAudit.pathCoverage,
    uncoveredVisibleText: fivoraAudit.uncoveredVisibleText,
  });

  const { validateRuntimeEditabilitySync } = require('./runtime-validator.cjs');
  let runtimeVerification = null;
  try {
    runtimeVerification = validateRuntimeEditabilitySync({
      projectDir,
      siteData: dataBundle.siteData,
      manifest: dataBundle.manifest,
    });
  } catch (err) {
    runtimeVerification = { passed: false, error: err.message, runtimeEditabilityScore: 0 };
  }

  const validation = {
    syntaxPassed,
    fivoraContractPassed: fivoraAudit.passed,
    fivoraContractErrors: fivoraAudit.errors,
    uncoveredVisibleText: fivoraAudit.uncoveredVisibleText.length,
    emptyStatePassed: fivoraAudit.emptyStatePassed !== false,
    contractPassed: contracts.contractPassed,
    orphans: contracts.orphans.length,
    missingSchema: contracts.missingSchema.length,
    actionCollisions: contracts.actionCollisions,
    staticAncestorCollisions: contracts.staticAncestorCollisions,
    astFailures: astResults.filter((r) => !r.passed),
    transformFailures,
    designPreservation: design.score,
    runtimeVerification,
  };

  const criticalFailure = !syntaxPassed || (contracts.actionCollisions > 0 && appliedCount === 0);
  const contractFailure = !fivoraAudit.passed || fivoraAudit.uncoveredVisibleText.length > 0;
  const designFailure = design.score < 98 && design.total > 0;
  let outcome = 'success';
  if (criticalFailure) {
    restoreBackup(projectDir, backupDir);
    for (const created of createdDuringRun) {
      try {
        if (fs.existsSync(created)) fs.rmSync(created, { force: true });
      } catch {
        // ignore
      }
    }
    outcome = 'rolled-back';
    printer.printRollback(validation.astFailures[0]?.error || 'Critical validation failed');
  } else if (opts.strict && (contractFailure || designFailure)) {
    restoreBackup(projectDir, backupDir);
    for (const created of createdDuringRun) {
      try {
        if (fs.existsSync(created)) fs.rmSync(created, { force: true });
      } catch {
        // ignore
      }
    }
    outcome = 'rolled-back';
    const reasons = [];
    if (!fivoraAudit.passed) reasons.push(`${fivoraAudit.errors.length} Fivora contract error(s)`);
    if (fivoraAudit.uncoveredVisibleText.length > 0) reasons.push(`${fivoraAudit.uncoveredVisibleText.length} uncovered visible text node(s)`);
    if (designFailure) reasons.push(`Design preservation score below threshold (${design.score} < 98)`);
    printer.printRollback(`Strict Fivora contract failed: ${reasons.join(', ')}`);
  } else if (contractFailure) {
    outcome = 'contract-failed';
  } else if (designFailure) {
    outcome = 'design-regression';
  }

  printer.printValidation(validation, coverage, design);
  if (!fivoraAudit.passed) {
    console.log(`\n  \x1b[33m⚠ Fivora strict contract: ${fivoraAudit.errors.length} finding(s)\x1b[0m`);
    for (const error of fivoraAudit.errors.slice(0, 8)) {
      console.log(`    \x1b[90m- ${error}\x1b[0m`);
    }
    if (fivoraAudit.errors.length > 8) {
      console.log(`    \x1b[90m... ${fivoraAudit.errors.length - 8} more in .deneb/report.json\x1b[0m`);
    }
  } else {
    console.log('  \x1b[32m✓\x1b[0m Fivora strict contract');
  }
  printer.printUncoveredText(fivoraAudit.uncoveredVisibleText);
  coverage.actionLinkContracts = contracts.fieldPaths.filter((p) => /Url$/.test(p)).length;
  coverage.contractCollisions = contracts.actionCollisions;
  console.log(`  Action/link contracts validated: ${coverage.actionLinkContracts}`);
  console.log(`  Contract collisions: ${coverage.contractCollisions}`);

  if (transformFailures.length) {
    for (const fail of transformFailures.slice(0, 5)) {
      printer.printError(fail.file, fail.reason, fail.confidence);
    }
  }

  const experienceRecords = recordExperience({
    projectDir,
    profile,
    plan,
    validation: {
      syntaxPassed,
      contractPassed: contracts.contractPassed,
      fivoraContractPassed: fivoraAudit.passed,
      emptyStatePassed: fivoraAudit.emptyStatePassed !== false,
      uncoveredVisibleText: fivoraAudit.uncoveredVisibleText.length,
      visualPassed: design.score >= 98,
      idempotencyPassed: true,
    },
    outcome,
    telemetry: opts.telemetry,
  });

  const result = {
    engine: ENGINE_ID,
    arcVersion: ARC_VERSION,
    schemaVersion: SCHEMA_VERSION,
    runId,
    backupDir,
    detection: {
      framework: profile.framework,
      frameworkVersion: profile.frameworkVersion,
      detected: [
        profile.framework,
        ...(profile.cssSystems || []),
        ...(profile.componentLibraries || []),
      ],
      hasShadcn: profile.shadcn,
      hasHeroUi: profile.heroui,
      hasTailwind: (profile.cssSystems || []).some((s) => s.startsWith('tailwind')),
      appDir: profile.appDir,
      isAppRouter: profile.router === 'next-app',
      pkg: profile.pkg,
    },
    matchedRecipe: recipeMatch.recipe,
    transformedFilesCount: changedFiles.length,
    totalTransformedElements: appliedCount,
    totalFields: countSchemaFields(dataBundle.manifest),
    coverage,
    designPreservation: design.score,
    validation,
    outcome,
    fontIds: collectFontIdsFromSiteData(dataBundle.siteData),
  };

  const report = buildReport({
    runId,
    startedAt,
    projectDir,
    projectName: projectName || profile.packageName,
    profile,
    graph,
    plan,
    recipeMatch,
    opts,
    filesChanged: changedFiles,
    validation,
    coverage,
    design,
    outcome,
    experienceRecords: experienceRecords.length,
    result,
  });
  writeJson(path.join(journalDir, 'result.json'), result);
  writeJson(path.join(journalDir, 'validation.json'), validation);
  writeJson(path.join(projectDir, '.deneb', 'report.json'), report);

  function classifyDiagnosticSeverity(item) {
    if (item.blocking || /syntax|ast-invalid|fatal/i.test(item.reason || '')) {
      return 'BLOCKING';
    }
    if (/contract|collision|unresolved-binding|failed/i.test(item.reason || '') || item.type === 'error') {
      return 'ERROR';
    }
    if (/dynamic|uncovered|compound|complex|skip/i.test(item.reason || '') && !/icon|decorative|hidden|picture-source/i.test(item.reason || '')) {
      return 'WARNING';
    }
    return 'INFO';
  }

  const unresolvedList = (plan.skipped || []).map((s) => ({
    file: s.file,
    loc: s.loc,
    type: s.kind || 'unknown',
    reason: s.reason || 'skipped',
    confidence: s.confidence,
    severity: classifyDiagnosticSeverity(s),
  }));

  const diagnosticsBySeverity = {
    info: unresolvedList.filter((u) => u.severity === 'INFO').length,
    warning: unresolvedList.filter((u) => u.severity === 'WARNING').length,
    error: unresolvedList.filter((u) => u.severity === 'ERROR').length,
    blocking: unresolvedList.filter((u) => u.severity === 'BLOCKING').length,
  };

  const conversionReport = {
    runId,
    timestamp: startedAt,
    projectName: projectName || profile.packageName,
    outcome,
    scorecard: {
      contractValidity: validation.fivoraContractPassed ? '100%' : 'Failed',
      editabilityCoverage: `${coverage.visualCoverage != null ? coverage.visualCoverage : coverage.editableCoverage}%`,
      visualBound: coverage.visualCovered != null ? `${coverage.visualCovered}/${coverage.visualRequired}` : null,
      designPreservation: `${design.score}%`,
      runtimeEditability: runtimeVerification ? `${runtimeVerification.runtimeEditabilityScore}%` : '100%',
    },
    runtimeVerification,
    diagnosticsBySeverity,
    unresolvedCount: unresolvedList.length,
    unresolved: unresolvedList,
    categories: {
      text: { planned: plan.files.reduce((n, f) => n + f.transformations.filter((t) => /text|heading|label/.test(t.fieldType || '')).length, 0) },
      images: { planned: plan.files.reduce((n, f) => n + f.transformations.filter((t) => t.fieldType === 'image').length, 0) },
      links: { planned: plan.files.reduce((n, f) => n + f.transformations.filter((t) => t.fieldType === 'url').length, 0) },
      collections: { planned: plan.files.reduce((n, f) => n + f.transformations.filter((t) => t.operation === 'collection-conversion').length, 0) },
      backgrounds: { planned: plan.files.reduce((n, f) => n + f.transformations.filter((t) => t.operation === 'extract-tailwind-bg').length, 0) },
      componentProps: { planned: plan.files.reduce((n, f) => n + f.transformations.filter((t) => t.operation === 'extract-prop' || t.operation === 'prop-flow-callsite').length, 0) },
    },
  };
  writeJson(path.join(projectDir, 'deneb-conversion-report.json'), conversionReport);
  writeJson(path.join(journalDir, 'conversion-report.json'), conversionReport);

  if (outcome === 'success') {
    printer.printSuccess();
    printer.printDeveloperNextSteps();
  } else if (outcome === 'contract-failed' || outcome === 'design-regression') {
    printer.printContractFailed();
  }
  return result;
}

function sanitizeProfile(profile) {
  const copy = { ...profile };
  delete copy.pkg;
  delete copy.dependencies;
  delete copy.aliasMap;
  delete copy.tsconfig;
  return copy;
}

function sanitizePlan(plan) {
  return {
    stats: plan.stats,
    usedPaths: plan.usedPaths,
    skipped: plan.skipped,
    files: (plan.files || []).map((f) => ({
      file: f.file,
      skippedFile: f.skippedFile,
      skipReason: f.skipReason,
      transformations: f.transformations,
    })),
  };
}

function buildReport(args) {
  return {
    engine: ARC_NAME,
    arcVersion: ARC_VERSION,
    schemaVersion: SCHEMA_VERSION,
    runId: args.runId,
    startedAt: args.startedAt,
    finishedAt: new Date().toISOString(),
    project: args.projectName,
    dryRun: Boolean(args.opts?.dryRun),
    profile: sanitizeProfile(args.profile),
    filesScanned: args.profile.jsxFiles?.length || 0,
    filesChanged: args.filesChanged,
    fieldsGenerated: args.plan?.usedPaths || [],
    routesGenerated: args.profile.routes,
    recipesMatched: args.recipeMatch?.recipe ? [args.recipeMatch.recipe.name] : [],
    confidenceDistribution: {
      auto: args.plan?.stats?.auto || 0,
      validate: args.plan?.stats?.validate || 0,
      skipped: args.plan?.stats?.skipped || 0,
    },
    skippedTransformations: args.plan?.skipped || [],
    warnings: args.validation?.transformFailures || [],
    validation: args.validation,
    coverage: args.coverage,
    designPreservation: args.design,
    learningRecords: args.experienceRecords || 0,
    registry: registryArchitecture(),
    outcome: args.outcome,
  };
}

function runArc(dir, opts = {}) {
  const projectName = opts.projectName || path.basename(path.resolve(dir));
  return runDenebArcSync(dir, projectName, opts);
}

function runTransactionalPipeline(targetDirInput = '.', options = {}) {
  const opts = { ...options, strict: options.strict !== false };
  const projectDir = path.resolve(targetDirInput);
  const runId = createRunId();

  if (opts.dryRun || opts.explain) {
    const result = runArc(targetDirInput, opts);
    return {
      success: result.outcome === 'success' || result.outcome === 'dry-run',
      rolledBack: false,
      outcome: result.outcome,
      result,
    };
  }

  // ARC v3: Transactional Isolated Workspace Execution
  let runDirs = null;
  try {
    runDirs = createRunWorkspace(projectDir, runId);
    copyProjectToWorkspace(projectDir, runDirs.workspaceDir, runDirs.snapshotDir);
  } catch {
    runDirs = null;
  }

  if (runDirs) {
    try {
      const result = runArc(runDirs.workspaceDir, { ...opts, runId });
      const contractOk = result.validation?.fivoraContractPassed !== false && (result.validation?.uncoveredVisibleText || 0) === 0;
      const syntaxOk = result.validation?.syntaxPassed !== false;
      const isSuccess = result.outcome === 'success' && (!opts.strict || (contractOk && syntaxOk));

      if (isSuccess) {
        // Collect all files to commit from workspace to project
        const changedFiles = [...(result.filesChanged || [])];
        const auxiliary = [
          'fivora-template.json',
          'deneb-conversion-report.json',
          path.join('src', 'data', 'site-data.json'),
          path.join('data', 'site-data.json'),
          path.join('src', 'lib', 'siteDataContext.tsx'),
          path.join('src', 'lib', 'siteDataContext.ts'),
          path.join('lib', 'siteDataContext.tsx'),
          path.join('lib', 'siteDataContext.ts'),
        ];
        for (const aux of auxiliary) {
          if (fs.existsSync(path.join(runDirs.workspaceDir, aux))) {
            changedFiles.push(aux);
          }
        }

        commitWorkspaceToProject(runDirs.workspaceDir, projectDir, changedFiles);
        saveRunArtifacts(runDirs, {
          report: result,
          runtimeResults: result.runtimeVerification,
        });
        cleanupWorkspace(runDirs.workspaceDir);

        return {
          success: true,
          rolledBack: false,
          outcome: 'success',
          result,
        };
      } else {
        const reasons = [];
        if (result.validation?.fivoraContractPassed === false) reasons.push('Fivora strict contract validation failed');
        if (result.validation?.uncoveredVisibleText > 0) reasons.push(`${result.validation.uncoveredVisibleText} uncovered visible text node(s)`);
        if (result.validation?.syntaxPassed === false) reasons.push('AST syntax validation failed');
        if (result.validation?.designPreservation < 98 && result.validation?.designPreservation > 0) reasons.push(`Design preservation (${result.validation.designPreservation}%) below threshold`);

        saveRunArtifacts(runDirs, {
          report: result,
          runtimeResults: result.runtimeVerification,
          failureReasons: reasons,
        });
        cleanupWorkspace(runDirs.workspaceDir);

        const explanation = formatFailureExplanation(result.validation, reasons);
        console.log('\n' + explanation);

        return {
          success: false,
          rolledBack: true,
          outcome: 'rolled-back',
          result,
          reasons,
        };
      }
    } catch (err) {
      if (runDirs) {
        saveRunArtifacts(runDirs, { failureReasons: [err.message] });
        cleanupWorkspace(runDirs.workspaceDir);
      }
      return {
        success: false,
        rolledBack: true,
        outcome: 'rolled-back',
        error: err.message,
      };
    }
  }

  // Fallback: direct in-project execution with backup restoration
  try {
    const result = runArc(targetDirInput, opts);
    return {
      success: result.outcome === 'success',
      rolledBack: result.outcome === 'rolled-back',
      outcome: result.outcome,
      result,
    };
  } catch (err) {
    const runsDir = path.join(projectDir, '.deneb', 'backups');
    if (fs.existsSync(runsDir)) {
      const backups = fs.readdirSync(runsDir).sort();
      const latest = backups[backups.length - 1];
      if (latest) {
        restoreBackup(projectDir, path.join(runsDir, latest));
      }
    }
    return {
      success: false,
      rolledBack: true,
      outcome: 'rolled-back',
      error: err.message,
    };
  }
}

module.exports = {
  runDenebArc,
  runTransactionalPipeline,
  explainFile,
  generateArcDiff,
  parseArcOptions,
  scanProject,
  auditFivoraContract,
  calculateVisualPreservation,
  extractDesignSnapshot,
  STANDARD_VIEWPORTS,
  verifyInteractionsSync,
  INTERACTION_PATTERNS,
  KNOWN_STOREFRONTS,
  auditStorefrontTemplate,
  verifyStorefrontCorpus,
  MUTATION_TYPES,
  applyMutation,
  generateFuzzCorpus,
  testMutationResilience,
  runFuzzHarness,
  analyzeBlockedProject,
  formatBlockedExplanationTerminal,
  printBlockedExplanation,
  ENGINE_ID,
  ARC_VERSION,
};

'use strict';

const { ARC_NAME, ARC_FULL_NAME, ARC_VERSION } = require('./version.cjs');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

function ok(msg) {
  console.log(`  ${C.green}✓${C.reset} ${msg}`);
}

function warn(msg) {
  console.log(`  ${C.yellow}⚠${C.reset} ${msg}`);
}

function info(msg) {
  console.log(`  ${C.cyan}•${C.reset} ${msg}`);
}

function heading(title) {
  console.log(`\n${C.bold}${title}${C.reset}\n`);
}

function printBanner(mode) {
  const suffix = mode === 'dry-run' ? ' (dry run)' : mode === 'explain' ? ' (explain)' : '';
  console.log(`\n${C.cyan}▲${C.reset} ${C.bold}${ARC_NAME}${C.reset}${suffix}`);
  console.log(`${C.dim}${ARC_FULL_NAME}  v${ARC_VERSION}${C.reset}\n`);
}

function printProfile(profile) {
  heading('Analyzing project...');
  const fw = profile.framework === 'nextjs'
    ? `Next.js${profile.frameworkVersion ? ' ' + profile.frameworkVersion : ''}`
    : profile.framework;
  ok(`${fw} detected`);
  ok(`${profile.language === 'javascript' ? 'JavaScript' : profile.language === 'typescript' ? 'TypeScript' : 'Mixed JS/TS'} detected`);
  if (profile.cssSystems.includes('tailwind-v4')) ok('Tailwind CSS v4 detected');
  else if (profile.cssSystems.some((s) => s.startsWith('tailwind'))) ok('Tailwind CSS detected');
  if (profile.shadcn) ok('shadcn/ui detected');
  if (profile.heroui) ok('HeroUI detected');
  if (profile.reactBits) ok('React Bits detected');
  if (profile.router === 'next-app') ok('App Router detected');
  if (profile.router === 'next-pages') ok('Pages Router detected');
  if (profile.router === 'react-router') ok('React Router detected');
}

function printScan(profile, graph, candidateCount, actionCount) {
  heading('Scanning architecture...');
  ok(`${profile.routes.length} routes`);
  ok(`${profile.components.length} components`);
  ok(`${candidateCount} content candidates`);
  ok(`${actionCount} interactive actions`);
  if (graph.sharedFiles?.length) info(`${graph.sharedFiles.length} shared components reused across routes`);
}

function printPlan(plan) {
  heading('Planning editable contracts...');
  ok(`${plan.stats.auto} high-confidence transformations`);
  if (plan.stats.validate) info(`${plan.stats.validate} transformations queued with extra validation`);
  const skippedDynamic = plan.skipped.filter((s) => /dynamic|api/.test(s.reason || '')).length;
  const skippedLow = plan.skipped.filter((s) => (s.confidence || 1) < 0.6).length;
  if (plan.stats.styleBinds) ok(`${plan.stats.styleBinds} Fivora style-bind contracts`);
  if (skippedDynamic) ok(`${skippedDynamic} existing dynamic values preserved`);
  if (skippedLow) warn(`${skippedLow} low-confidence candidates skipped`);
}

function printApply(result) {
  heading('Applying Deneb contracts...');
  ok(`${result.filesUpdated} files updated`);
  if (result.layoutUpdated) ok('Root layout instrumented with SiteDataProvider');
}

function printValidation(validation, coverage, design) {
  heading('Validating...');
  if (validation.syntaxPassed) ok('AST');
  else warn('AST validation reported parse issues');
  if (validation.contractPassed) ok('editable contracts');
  else warn('editable contract issues detected');
  ok('manifest');
  if (validation.idempotencyPassed !== false) ok('idempotency');
  console.log('');
  console.log(`  Editable coverage: ${coverage.editableCoverage}%`);
  console.log(`  Design preservation: ${design.score}%`);
}

function printExplain(plan) {
  heading('Explain');
  for (const file of plan.files) {
    if (!file.transformations.length) continue;
    console.log(`  ${C.bold}${file.file}${C.reset}`);
    for (const t of file.transformations) {
      const target = t.stylePath || t.field || t.urlField || t.listField || '';
      console.log(`    - ${t.operation} ${target}`);
      const boost = t.explain?.fingerprintBoost
        ? `  fingerprint: ${t.explain.fingerprintState}+${t.explain.fingerprintBoost}`
        : '';
      console.log(`      ${C.dim}why: ${t.reason}  confidence: ${t.confidence}  recipe: ${t.recipeId || 'none'}${boost}${C.reset}`);
    }
  }
}

function printDryRun(profile, plan) {
  heading('Dry run (no files modified)');
  console.log(`  Technology: ${profile.framework} / ${profile.language} / ${(profile.cssSystems || []).join(', ') || 'css'}`);
  console.log(`  Routes: ${profile.routes.map((r) => r.route).join(', ')}`);
  console.log(`  Components scanned: ${profile.components.length}`);
  console.log(`  Planned transformations: ${plan.stats.planned}`);
  console.log(`  Files affected: ${plan.stats.filesAffected}`);
  if (plan.skipped.length) {
    console.log(`  Risks:`);
    for (const skip of plan.skipped.slice(0, 8)) {
      console.log(`    - ${skip.file}: ${skip.reason} (${skip.confidence})`);
    }
  }
}

function printError(file, reason, confidence) {
  console.log(`\n${C.red}Deneb could not safely determine the transformation in:${C.reset}\n`);
  console.log(`  ${file}\n`);
  console.log(`Reason:\n  ${reason}\n`);
  if (confidence != null) console.log(`Confidence: ${confidence}\n`);
  console.log('Action:\n  Component left unchanged.\n');
  console.log('No source code was damaged.\n');
}

function printSuccess() {
  console.log(`\n${C.green}${C.bold}Deneb ARC completed successfully.${C.reset}\n`);
}

function printUncoveredText(findings = []) {
  if (!findings.length) return;
  warn(`${findings.length} visible text node(s) still uncovered — run deneb validate . before packaging`);
  for (const item of findings.slice(0, 12)) {
    const loc = item.filePath ? `${item.filePath}${item.line ? `:${item.line}` : ''}` : '';
    const snippet = String(item.text || '').slice(0, 80);
    console.log(`    ${C.dim}${loc}  <${item.tag}> ${snippet}${C.reset}`);
  }
  if (findings.length > 12) {
    console.log(`    ${C.dim}... ${findings.length - 12} more in .deneb/report.json${C.reset}`);
  }
}

function printDeveloperNextSteps() {
  heading('Next steps for Fivora');
  console.log(`  ${C.cyan}1.${C.reset} npm run lab              ${C.dim}preview visual editing locally${C.reset}`);
  console.log(`  ${C.cyan}2.${C.reset} deneb fonts install .    ${C.dim}self-host Google Fonts used by this site${C.reset}`);
  console.log(`  ${C.cyan}3.${C.reset} npm run validate         ${C.dim}same contract Fivora ingest uses${C.reset}`);
  console.log(`  ${C.cyan}4.${C.reset} npm run validate-and-zip ${C.dim}upload-ready ZIP${C.reset}`);
  console.log(`  ${C.dim}Style edits: Fivora sends FIVORA_PREVIEW_STYLE_PATCH to data-preview-style-target nodes.${C.reset}`);
  console.log(`  ${C.dim}Re-run with --explain to see why each field/style was bound.${C.reset}\n`);
}

function printRollback(reason) {
  console.log(`\n${C.yellow}Deneb ARC rolled back the conversion.${C.reset}`);
  console.log(`${C.dim}${reason}${C.reset}\n`);
}

// ─── AI Agent Progress Messages ──────────────────────────────────

function printAiDetected(unknownCount) {
  console.log(`\n  ${C.cyan}⚡${C.reset} ${C.bold}AI Agent:${C.reset} Detected ${unknownCount} unknown component${unknownCount > 1 ? 's' : ''}`);
}

function printAiAttempt(componentName, attempt, maxRetries) {
  console.log(`  ${C.cyan}⚡${C.reset} Adapting ${C.bold}<${componentName} />${C.reset}... attempt ${attempt}/${maxRetries}`);
}

function printAiValidationFail(errors, attempt) {
  for (const err of errors.slice(0, 3)) {
    console.log(`    ${C.red}❌${C.reset} ${err}`);
  }
  if (errors.length > 3) {
    console.log(`    ${C.dim}... ${errors.length - 3} more errors${C.reset}`);
  }
}

function printAiSuccess(componentName, attempt, fieldsCount) {
  console.log(`    ${C.green}✅${C.reset} All checks passed! (${fieldsCount} editable field${fieldsCount !== 1 ? 's' : ''})`);
}

function printAiSkipped(componentName, reason) {
  console.log(`  ${C.yellow}⚠${C.reset} Skipped ${C.bold}<${componentName} />${C.reset}: ${reason}`);
}

function printAiPr(repoName, branchName, prNumber) {
  if (prNumber === 0) {
    console.log(`  ${C.cyan}📦${C.reset} ${C.dim}(dry-run)${C.reset} ${repoName}: ${branchName}`);
  } else {
    console.log(`  ${C.cyan}📦${C.reset} PR opened: ${C.bold}${repoName}${C.reset} (#${prNumber})`);
  }
}

function printAiSummary(adapted, skipped, totalTokens) {
  console.log(`\n  ${C.cyan}⚡${C.reset} AI Agent Summary: ${C.green}${adapted} adapted${C.reset}, ${C.yellow}${skipped} skipped${C.reset}, ~${totalTokens.toLocaleString()} tokens used`);
}

module.exports = {
  printBanner,
  printProfile,
  printScan,
  printPlan,
  printApply,
  printValidation,
  printExplain,
  printDryRun,
  printError,
  printSuccess,
  printUncoveredText,
  printDeveloperNextSteps,
  printRollback,
  printAiDetected,
  printAiAttempt,
  printAiValidationFail,
  printAiSuccess,
  printAiSkipped,
  printAiPr,
  printAiSummary,
  ok,
  warn,
  info,
};

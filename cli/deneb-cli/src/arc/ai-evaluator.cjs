'use strict';

/**
 * Deneb ARC — AI Evaluator & Self-Healing Engine
 *
 * Automatically audits the transformed project before finalizing `deneb init --ai`
 * to guarantee that:
 * 1. React Server Components (RSC) vs Client Component boundaries are strictly respected
 *    (preventing "Element type is invalid: expected string/function but got: undefined").
 * 2. Every imported component in page.tsx/layout.tsx is properly exported.
 * 3. Fivora strict leaf contracts are satisfied (no field-path on broad containers).
 * 4. Manifest routes correspond 1:1 with real page files on disk.
 * 5. Uses ChatGPT (OpenAI API) to evaluate, explain, and self-heal any edge cases.
 */

const fs = require('fs');
const path = require('path');
const { parseSource, printSource, getJsxName, b } = require('./ast.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('./fivora-contract.cjs');
const { callOpenAI, checkAiReady, loadEnv } = require('./ai-agent.cjs');
const { recordEvaluatorFix } = require('./learning.cjs');

/**
 * Audit runtime integrity of the transformed project.
 *
 * @param {string} projectDir - Root path of the project being transformed
 * @param {object} profile - Project profile from scanner.cjs
 * @returns {Array<{ type: string, file: string, message: string, severity: 'error' | 'warning', meta?: any }>}
 */
function auditRuntimeIntegrity(projectDir, profile) {
  const issues = [];

  // 1. Check RSC Provider Boundaries in layout.tsx
  const layoutFile = profile.appDir ? path.join(projectDir, 'src', 'app', 'layout.tsx') : null;
  const altLayout = profile.appDir ? path.join(projectDir, 'app', 'layout.tsx') : null;
  const targetLayout = (layoutFile && fs.existsSync(layoutFile)) ? layoutFile : ((altLayout && fs.existsSync(altLayout)) ? altLayout : null);

  if (targetLayout) {
    const layoutCode = fs.readFileSync(targetLayout, 'utf8');
    const isServerComponent = !/['"]use client['"]/.test(layoutCode.slice(0, 300));

    if (isServerComponent) {
      // Check if client-only SiteDataProvider or createContext is directly rendered in Server Component
      const hasSiteDataImport = /import\s+.*?\bSiteDataProvider\b.*?from\s+['"]@deneb-ui\/(?:ui|core)['"]/.test(layoutCode);
      const rendersSiteDataProvider = /<SiteDataProvider\b/.test(layoutCode);
      const hasProvidersWrapper = /<Providers\b/.test(layoutCode) || /from\s+['"]@\/components\/providers['"]/.test(layoutCode);

      if (rendersSiteDataProvider && hasProvidersWrapper) {
        issues.push({
          type: 'rsc-duplicate-provider',
          file: path.relative(projectDir, targetLayout).replace(/\\/g, '/'),
          absPath: targetLayout,
          message: 'Server layout renders <SiteDataProvider> inside <Providers>, causing undefined component in React Server Components.',
          severity: 'error',
          meta: { hasProvidersWrapper, hasSiteDataImport },
        });
      } else if (rendersSiteDataProvider && hasSiteDataImport) {
        issues.push({
          type: 'rsc-unwrapped-provider',
          file: path.relative(projectDir, targetLayout).replace(/\\/g, '/'),
          absPath: targetLayout,
          message: 'Server layout renders client-only <SiteDataProvider> without a "use client" boundary.',
          severity: 'error',
          meta: { hasProvidersWrapper, hasSiteDataImport },
        });
      }
    }
  }

  // 2. Check Component Export / Import Integrity in page.tsx
  const pageFiles = [
    path.join(projectDir, 'src', 'app', 'page.tsx'),
    path.join(projectDir, 'app', 'page.tsx'),
    path.join(projectDir, 'src', 'pages', 'index.tsx'),
    path.join(projectDir, 'pages', 'index.tsx'),
  ];
  const targetPage = pageFiles.find((p) => fs.existsSync(p));

  if (targetPage) {
    const pageCode = fs.readFileSync(targetPage, 'utf8');
    const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(pageCode)) !== null) {
      const clause = match[1].trim();
      const specifier = match[2].trim();

      if (!specifier.startsWith('@/') && !specifier.startsWith('.')) continue;

      let resolvedFile = null;
      if (specifier.startsWith('@/')) {
        const candidate = path.join(projectDir, 'src', specifier.slice(2));
        for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
          if (fs.existsSync(candidate + ext) && !fs.statSync(candidate + ext).isDirectory()) {
            resolvedFile = candidate + ext;
            break;
          }
        }
      } else {
        const candidate = path.resolve(path.dirname(targetPage), specifier);
        for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
          if (fs.existsSync(candidate + ext) && !fs.statSync(candidate + ext).isDirectory()) {
            resolvedFile = candidate + ext;
            break;
          }
        }
      }

      if (!resolvedFile || resolvedFile.endsWith('.json') || resolvedFile.endsWith('.css')) continue;

      const targetSrc = fs.readFileSync(resolvedFile, 'utf8');

      // Check named imports
      const namedMatch = clause.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const names = namedMatch[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]);
        for (const name of names) {
          if (!name || name === 'type') continue;
          const re = new RegExp(`\\bexport\\s+(?:const|function|class|interface|type)\\s+${name}\\b|\\bexport\\s*\\{[^}]*\\b${name}\\b`);
          if (!re.test(targetSrc)) {
            issues.push({
              type: 'missing-named-export',
              file: path.relative(projectDir, resolvedFile).replace(/\\/g, '/'),
              absPath: resolvedFile,
              message: `Component "${name}" imported in ${path.basename(targetPage)} is not exported from ${path.basename(resolvedFile)}.`,
              severity: 'error',
              meta: { componentName: name, importerFile: targetPage },
            });
          }
        }
      }

      // Check default imports
      const defaultMatch = clause.match(/^([A-Za-z0-9_$]+)(?:\s*,|\s*$)/);
      if (defaultMatch && !clause.includes('{')) {
        const defName = defaultMatch[1];
        if (defName !== 'type' && !/export\s+default\b/.test(targetSrc)) {
          issues.push({
            type: 'missing-default-export',
            file: path.relative(projectDir, resolvedFile).replace(/\\/g, '/'),
            absPath: resolvedFile,
            message: `File ${path.basename(resolvedFile)} lacks a default export for "${defName}".`,
            severity: 'error',
            meta: { componentName: defName, importerFile: targetPage },
          });
        }
      }
    }
  }

  // 3. Check for broad container markers across all component files
  for (const relFile of profile.jsxFiles || []) {
    const absPath = path.join(projectDir, relFile);
    if (!fs.existsSync(absPath)) continue;
    const src = fs.readFileSync(absPath, 'utf8');

    const broadRegex = /<(div|section|article|aside|header|footer|nav|main|form|ul|ol|table|thead|tbody|tr)\b([^>]*\bdata-preview-field-path\s*=[^>]*)/gi;
    let bMatch;
    while ((bMatch = broadRegex.exec(src)) !== null) {
      issues.push({
        type: 'broad-container-field-marker',
        file: relFile.replace(/\\/g, '/'),
        absPath,
        message: `data-preview-field-path cannot be placed on broad <${bMatch[1]}> in ${relFile}.`,
        severity: 'error',
        meta: { tag: bMatch[1], snippet: bMatch[0].slice(0, 80) },
      });
    }
  }

  // 4. Check manifest routes vs disk
  const manifestPath = path.join(projectDir, 'fivora-template.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      for (const p of manifest.pages || []) {
        if (!p || !p.route) continue;
        if (p.route === '/') continue;

        const cleanRoute = p.route.replace(/^\/+/, '');
        const exists =
          fs.existsSync(path.join(projectDir, 'src', 'app', cleanRoute, 'page.tsx')) ||
          fs.existsSync(path.join(projectDir, 'src', 'app', cleanRoute, 'page.jsx')) ||
          fs.existsSync(path.join(projectDir, 'app', cleanRoute, 'page.tsx')) ||
          fs.existsSync(path.join(projectDir, 'app', cleanRoute, 'page.jsx')) ||
          fs.existsSync(path.join(projectDir, 'src', 'pages', `${cleanRoute}.tsx`)) ||
          fs.existsSync(path.join(projectDir, 'src', 'pages', `${cleanRoute}.jsx`)) ||
          fs.existsSync(path.join(projectDir, 'pages', `${cleanRoute}.tsx`)) ||
          fs.existsSync(path.join(projectDir, 'pages', `${cleanRoute}.jsx`));

        if (!exists) {
          issues.push({
            type: 'orphan-manifest-route',
            file: 'fivora-template.json',
            absPath: manifestPath,
            message: `Manifest page "${p.id}" route "${p.route}" has no page file on disk.`,
            severity: 'error',
            meta: { pageId: p.id, route: p.route },
          });
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  return issues;
}

/**
 * Heals detected runtime integrity issues automatically.
 * Applies deterministic AST fixes for known patterns, and uses ChatGPT API for complex self-healing.
 *
 * @param {string} projectDir
 * @param {object} profile
 * @param {Array} issues
 * @param {object} options
 * @returns {Promise<{ healedCount: number, remainingCount: number, log: string[] }>}
 */
async function healRuntimeIntegrity(projectDir, profile, issues, options = {}) {
  let healedCount = 0;
  const log = [];

  for (const issue of issues) {
    // Healing Pattern 1: RSC Duplicate or Server-rendered SiteDataProvider in layout.tsx
    if (issue.type === 'rsc-duplicate-provider' && issue.absPath && fs.existsSync(issue.absPath)) {
      try {
        let code = fs.readFileSync(issue.absPath, 'utf8');

        // If <Providers> exists, unwrap the redundant <SiteDataProvider> from layout.tsx
        code = code.replace(
          /<SiteDataProvider\s+initialSiteData=\{[^}]+\}>([\s\S]*?)<\/SiteDataProvider>/g,
          '$1'
        );
        // Remove unused SiteDataProvider and initialSiteData imports
        code = code.replace(/import\s+.*?\bSiteDataProvider\b.*?from\s+['"]@deneb-ui\/(?:ui|core)['"];?\n?/g, '');
        code = code.replace(/import\s+initialSiteData\s+from\s+['"][^'"]+['"];?\n?/g, '');

        fs.writeFileSync(issue.absPath, code, 'utf8');
        healedCount++;
        recordEvaluatorFix({
          projectDir,
          issueType: issue.type,
          file: issue.file,
          action: 'remove-redundant-server-site-data-provider',
          success: true,
        });
        log.push(`Healed RSC boundary: removed redundant <SiteDataProvider> from server component ${issue.file}`);
      } catch (err) {
        log.push(`Failed to heal ${issue.file}: ${err.message}`);
      }
      continue;
    }

    // Healing Pattern 2: Broad container field path
    if (issue.type === 'broad-container-field-marker' && issue.absPath && fs.existsSync(issue.absPath)) {
      try {
        let code = fs.readFileSync(issue.absPath, 'utf8');
        // Replace <div ... data-preview-field-path="..."> with <span className="block..." ...>
        code = code.replace(
          /<div\b([^>]*\bdata-preview-field-path\s*=[^>]*)>([\s\S]*?)<\/div>/gi,
          (match, attrs, inner) => {
            let nextAttrs = attrs;
            if (/className\s*=\s*['"]/.test(nextAttrs)) {
              nextAttrs = nextAttrs.replace(/className\s*=\s*(['"])/, 'className=$1block ');
            } else {
              nextAttrs = ` className="block"${nextAttrs}`;
            }
            return `<span${nextAttrs}>${inner}</span>`;
          }
        );
        fs.writeFileSync(issue.absPath, code, 'utf8');
        healedCount++;
        recordEvaluatorFix({
          projectDir,
          issueType: issue.type,
          file: issue.file,
          action: 'convert-broad-container-to-inline-span',
          success: true,
        });
        log.push(`Healed broad container: converted <${issue.meta?.tag || 'div'}> to inline-block <span data-preview-field-path> in ${issue.file}`);
      } catch (err) {
        log.push(`Failed to heal broad container in ${issue.file}: ${err.message}`);
      }
      continue;
    }

    // Healing Pattern 3: Orphan manifest route
    if (issue.type === 'orphan-manifest-route' && issue.absPath && fs.existsSync(issue.absPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(issue.absPath, 'utf8'));
        if (Array.isArray(manifest.pages)) {
          manifest.pages = manifest.pages.filter((p) => p.id !== issue.meta?.pageId && p.route !== issue.meta?.route);
          fs.writeFileSync(issue.absPath, JSON.stringify(manifest, null, 2), 'utf8');
          healedCount++;
          recordEvaluatorFix({
            projectDir,
            issueType: issue.type,
            file: issue.file,
            action: 'prune-orphan-manifest-route',
            success: true,
          });
          log.push(`Healed manifest: pruned non-existent route "${issue.meta?.route}" (${issue.meta?.pageId})`);
        }
      } catch (err) {
        log.push(`Failed to heal manifest route: ${err.message}`);
      }
      continue;
    }

    // Healing Pattern 4: AI-Assisted Self-Healing for missing exports or complex issues
    if (issue.type.startsWith('missing-') && options.aiEnabled && issue.absPath && fs.existsSync(issue.absPath)) {
      loadEnv(projectDir);
      const aiReady = checkAiReady();
      if (aiReady.ready) {
        try {
          const fileSrc = fs.readFileSync(issue.absPath, 'utf8');
          const prompt = `You are a senior React/TypeScript engineer on the DENEB UI team.
Fix this export error in the file:
ERROR: ${issue.message}

FILE SOURCE:
\`\`\`tsx
${fileSrc}
\`\`\`

INSTRUCTIONS:
1. Ensure the component "${issue.meta?.componentName}" is properly exported with a named export \`export function ${issue.meta?.componentName}()\` or proper export syntax.
2. Preserve all existing JSX, props, logic, and styling.
3. Output ONLY the raw TypeScript (.tsx) code. No markdown fences, no explanations.`;

          const aiResult = await callOpenAI(prompt);
          if (aiResult && aiResult.content) {
            fs.writeFileSync(issue.absPath, aiResult.content, 'utf8');
            healedCount++;
            recordEvaluatorFix({
              projectDir,
              issueType: issue.type,
              file: issue.file,
              action: 'ai-generate-missing-export',
              success: true,
            });
            log.push(`AI healed export in ${issue.file}: added export for ${issue.meta?.componentName}`);
          }
        } catch (err) {
          log.push(`AI heal failed for ${issue.file}: ${err.message}`);
        }
      }
    }
  }

  // Re-audit after healing to calculate remaining issues
  const remaining = auditRuntimeIntegrity(projectDir, profile);
  return {
    healedCount,
    remainingCount: remaining.length,
    remainingIssues: remaining,
    log,
  };
}

/**
 * Complete evaluation pipeline called by `init --ai`.
 *
 * @param {string} projectDir - Project directory
 * @param {object} profile - Project profile
 * @param {object} [options] - Options (aiEnabled, etc.)
 * @returns {Promise<{ passed: boolean, issuesFound: number, healed: number, log: string[] }>}
 */
async function runAiEvaluatorPipeline(projectDir, profile, options = {}) {
  const initialIssues = auditRuntimeIntegrity(projectDir, profile);

  if (initialIssues.length === 0) {
    return {
      passed: true,
      issuesFound: 0,
      healed: 0,
      log: ['All runtime integrity checks passed cleanly.'],
    };
  }

  const healResult = await healRuntimeIntegrity(projectDir, profile, initialIssues, options);

  return {
    passed: healResult.remainingCount === 0,
    issuesFound: initialIssues.length,
    healed: healResult.healedCount,
    remainingIssues: healResult.remainingIssues,
    log: healResult.log,
  };
}

module.exports = {
  auditRuntimeIntegrity,
  healRuntimeIntegrity,
  runAiEvaluatorPipeline,
};

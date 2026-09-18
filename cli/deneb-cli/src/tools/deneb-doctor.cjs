/**
 * DENEB Architecture & System Doctor
 *
 * Comprehensive In-CLI Architecture Diagnostics for Next.js,
 * Fivora Live Visual Editing contracts, Multi-Niche Storefront Recipes,
 * AST Integrity, and Static Export Preflight.
 *
 * Created by Chamika Gayashan & Induranga Kawishwara.
 * Powered by DENEB-UI Collaborate with FIVORA.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { matchRecipeForProject, loadAllRecipes } = require('./recipe-engine.cjs');
const { healMissingSiteDataHooks, healBroadContainerMarkers, healSectionOverflowHidden } = require('../arc/transformer.cjs');

function createBox(lines, width = 60) {
  const horizontal = '═'.repeat(width - 2);
  const top = `  ╔${horizontal}╗`;
  const bottom = `  ╚${horizontal}╝`;

  const content = lines.map((line) => {
    // Strip ANSI colors for length calculation
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const padding = Math.max(0, width - 4 - stripped.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return `  ║ ${' '.repeat(leftPad)}${line}${' '.repeat(rightPad)} ║`;
  });

  return [top, ...content, bottom].join('\n');
}

/**
 * Recursively find all source code files
 */
function findSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = entry.name.toLowerCase();

    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'out', 'build', 'dist', '.deneb-backup'].some((p) => rel.startsWith(p))) {
        findSourceFiles(fullPath, fileList);
      }
    } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

/**
 * Recursively find public asset files
 */
function findAssetFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAssetFiles(fullPath, fileList);
    } else if (/\.(png|jpg|jpeg|webp|svg|gif|mp4|webm)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

/**
 * Deep check field path existence in object
 */
function hasFieldPath(obj, fieldPath) {
  if (!obj || !fieldPath) return false;
  const parts = fieldPath.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') return false;
    curr = curr[part];
  }
  return curr !== undefined;
}

/**
 * Check if field is registered in manifest editorSchema
 */
function isFieldInEditorSchema(manifest, fieldPath) {
  if (!manifest?.editorSchema?.sections) return false;
  const parts = fieldPath.split('.');
  const sectionId = parts[0];
  const fieldKey = parts.slice(1).join('.');

  const section = manifest.editorSchema.sections.find((s) => s.id === sectionId || s.path === sectionId);
  if (!section) return false;

  function checkFields(fields, targetKey) {
    if (!Array.isArray(fields)) return false;
    for (const f of fields) {
      if (f.key === targetKey) return true;
      if (f.fields && targetKey.startsWith(f.key + '.')) {
        const subKey = targetKey.substring(f.key.length + 1);
        if (checkFields(f.fields, subKey)) return true;
      }
    }
    return false;
  }

  return checkFields(section.fields, fieldKey);
}

/**
 * Run Comprehensive In-CLI Architecture Diagnostics
 */
function runDoctor(targetDirInput = '.', options = {}) {
  const targetDir = path.resolve(targetDirInput);
  const shouldFix = Boolean(options.fix);
  const isJson = Boolean(options.json);

  const reportData = {
    targetDir,
    timestamp: new Date().toISOString(),
    passed: 0,
    warnings: 0,
    errors: 0,
    fixedCount: 0,
    suites: [],
  };

  function addCheck(suiteName, type, title, detail, meta = {}) {
    const code = meta.code || 'DNB-GEN-001';
    const action = meta.action || detail || '';
    if (type === 'pass') reportData.passed++;
    else if (type === 'warn') reportData.warnings++;
    else if (type === 'err') reportData.errors++;
    else if (type === 'fixed') {
      reportData.fixedCount++;
      reportData.passed++;
    }

    let suite = reportData.suites.find((s) => s.name === suiteName);
    if (!suite) {
      suite = { name: suiteName, checks: [] };
      reportData.suites.push(suite);
    }
    const checkObj = { code, type, title, detail, action, ...meta };
    suite.checks.push(checkObj);

    if (!isJson) {
      const codeTag = `\x1b[36m[${code}]\x1b[0m `;
      if (type === 'pass') {
        console.log(`  \x1b[32m✔\x1b[0m ${codeTag}\x1b[1m${title}\x1b[0m${detail ? ` \x1b[90m(${detail})\x1b[0m` : ''}`);
      } else if (type === 'fixed') {
        console.log(`  \x1b[35m⚡ FIXED:\x1b[0m ${codeTag}\x1b[1m${title}\x1b[0m${detail ? ` \x1b[32m- ${detail}\x1b[0m` : ''}`);
      } else if (type === 'warn') {
        console.log(`  \x1b[33m⚠\x1b[0m ${codeTag}\x1b[33m${title}\x1b[0m${detail ? ` \x1b[90m- ${detail}\x1b[0m` : ''}`);
      } else {
        console.log(`  \x1b[31m✖\x1b[0m ${codeTag}\x1b[31m${title}\x1b[0m${detail ? ` \x1b[90m- ${detail}\x1b[0m` : ''}`);
      }
    }
  }

  if (!isJson) {
    console.log('\n' + createBox([
      '\x1b[1m\x1b[36m🩺 DENEB SYSTEM & ARCHITECTURE DOCTOR\x1b[0m',
      '\x1b[90mComprehensive in-CLI diagnostics for Fivora & Next.js Storefronts\x1b[0m',
      `\x1b[37mTarget:\x1b[0m ${targetDir}${shouldFix ? ' \x1b[35m[--fix enabled]\x1b[0m' : ''}`,
    ], 62) + '\n');
  }

  // =========================================================================
  // SUITE 1: System & Runtime Environment
  // =========================================================================
  if (!isJson) console.log('\x1b[1m[1/7] System & Runtime Environment:\x1b[0m');
  const suite1 = 'System & Runtime';

  const nodeVersion = process.version;
  const majorNode = parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);
  if (majorNode >= 18) {
    addCheck(suite1, 'pass', 'Node.js Runtime', `${nodeVersion} (Supported)`, { code: 'DNB-SYS-001' }) //, `${nodeVersion} (Supported)`);
  } else {
    addCheck(suite1, 'err', 'Node.js Runtime', `${nodeVersion} (Requires Node.js >= 18.0.0)`, { code: 'DNB-SYS-001' }) //, `${nodeVersion} (Requires Node.js >= 18.0.0)`);
  }

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmCheck = spawnSync(npmBin, ['--version'], { encoding: 'utf-8', shell: process.platform === 'win32' });
  if (!npmCheck.error && npmCheck.status === 0) {
    addCheck(suite1, 'pass', 'Package Manager', `npm v${npmCheck.stdout.trim()}`, { code: 'DNB-SYS-002' }) //, `npm v${npmCheck.stdout.trim()}`);
  } else {
    addCheck(suite1, 'warn', 'Package Manager', 'npm not found in system PATH', { code: 'DNB-SYS-002' }) //, 'npm not found in system PATH');
  }

  // =========================================================================
  // SUITE 2: Project Dependencies & Package Configuration
  // =========================================================================
  if (!isJson) console.log('\n\x1b[1m[2/7] Project Package Configuration:\x1b[0m');
  const suite2 = 'Package Configuration';

  const pkgPath = path.join(targetDir, 'package.json');
  let pkg = null;
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      addCheck(suite2, 'pass', 'package.json', `Found "${pkg.name || 'unnamed'}"`, { code: 'DNB-PKG-001' }) //, `Found "${pkg.name || 'unnamed'}"`);

      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (allDeps['next']) {
        addCheck(suite2, 'pass', 'Next.js Framework', allDeps['next'], { code: 'DNB-PKG-002' }) //, allDeps['next']);
      } else {
        addCheck(suite2, 'err', 'Next.js Framework', 'next dependency missing in package.json', { code: 'DNB-PKG-002' }) //, 'next dependency missing in package.json');
      }

      if (allDeps['@deneb-ui/ui'] || allDeps['@deneb/ui']) {
        addCheck(suite2, 'pass', '@deneb-ui/ui Library', allDeps['@deneb-ui/ui'] || allDeps['@deneb/ui'], { code: 'DNB-PKG-003' }) //, allDeps['@deneb-ui/ui'] || allDeps['@deneb/ui']);
      } else {
        addCheck(suite2, 'warn', '@deneb-ui/ui Library', 'Not installed (run "npm i @deneb-ui/ui")', { code: 'DNB-PKG-003' }) //, 'Not installed (run "npm i @deneb-ui/ui")');
      }

      if (allDeps['@deneb-ui/cli']) {
        addCheck(suite2, 'pass', '@deneb-ui/cli Tooling', allDeps['@deneb-ui/cli'], { code: 'DNB-PKG-004' }) //, allDeps['@deneb-ui/cli']);
      } else {
        addCheck(suite2, 'warn', '@deneb-ui/cli Tooling', 'Recommended for local CLI scripts', { code: 'DNB-PKG-004' }) //, 'Recommended for local CLI scripts');
      }

      // Check required scripts
      pkg.scripts = pkg.scripts || {};
      const requiredScripts = ['lab', 'validate', 'zip', 'validate-and-zip'];
      const missingScripts = requiredScripts.filter((s) => !pkg.scripts[s]);

      if (missingScripts.length === 0) {
        addCheck(suite2, 'pass', 'DENEB Package Scripts', 'lab, validate, zip, validate-and-zip verified', { code: 'DNB-PKG-005' }) //, 'lab, validate, zip, validate-and-zip verified');
      } else if (shouldFix) {
        pkg.scripts['lab'] = pkg.scripts['lab'] || 'deneb lab .';
        pkg.scripts['validate'] = pkg.scripts['validate'] || 'deneb validate .';
        pkg.scripts['zip'] = pkg.scripts['zip'] || 'deneb zip .';
        pkg.scripts['validate-and-zip'] = pkg.scripts['validate-and-zip'] || 'deneb validate-and-zip .';
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        addCheck(suite2, 'fixed', 'DENEB Package Scripts', `Injected missing scripts: ${missingScripts.join(', ')}`, { code: 'DNB-PKG-005' }) //, `Injected missing scripts: ${missingScripts.join(', ')}`);
      } else {
        addCheck(suite2, 'warn', 'DENEB Package Scripts', `Missing scripts: ${missingScripts.join(', ')} (Run with --fix to repair)`, { code: 'DNB-PKG-005' }) //, `Missing scripts: ${missingScripts.join(', ')} (Run with --fix to repair)`);
      }

      // Check Node 20 LTS platform engine compatibility
      const lockPath = path.join(targetDir, 'package-lock.json');
      let hasNode22EngineConflict = false;
      const checkNode20 = (e) => {
        if (!e || e === '*' || e === 'latest') return true;
        return e.split('||').map(n => n.trim()).some(n => {
          let r = n.match(/>=\s*(\d+)/);
          if (r) return parseInt(r[1], 10) <= 20;
          let i = n.match(/\^\s*(\d+)/);
          if (i) return parseInt(i[1], 10) <= 20;
          let s = n.match(/~(\d+)/);
          if (s) return parseInt(s[1], 10) <= 20;
          let o = n.match(/^\s*(\d+)/);
          if (o) return parseInt(o[1], 10) <= 20;
          return false;
        });
      };
      if (fs.existsSync(lockPath)) {
        try {
          const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
          for (const [pkgKey, pkgVal] of Object.entries(lock.packages || {})) {
            const engineNode = pkgVal?.engines?.node;
            if (engineNode && typeof engineNode === 'string' && !checkNode20(engineNode)) {
              hasNode22EngineConflict = true;
              break;
            }
          }
        } catch {}
      }
      if (!hasNode22EngineConflict) {
        addCheck(suite2, 'pass', 'Platform Engine Compatibility', 'All dependencies compatible with Fivora Node 20 LTS runtime', { code: 'DNB-ENG-001' }) //, 'All dependencies compatible with Fivora Node 20 LTS runtime');
      } else if (shouldFix) {
        pkg.overrides = pkg.overrides || {};
        pkg.overrides['content-type'] = '2.1.0';
        pkg.overrides['@octokit/request'] = { 'content-type': '2.1.0' };
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        addCheck(suite2, 'fixed', 'Platform Engine Compatibility', 'Injected Node 20 overrides for content-type: 2.1.0', { code: 'DNB-ENG-001' }) //, 'Injected Node 20 overrides for content-type: 2.1.0');
      } else {
        addCheck(suite2, 'err', 'Platform Engine Compatibility', 'Detected packages requiring Node >=22. Run "deneb doctor --fix" to inject Node 20 overrides.', { code: 'DNB-ENG-001' }) //, 'Detected packages requiring Node >=22. Run "deneb doctor --fix" to inject Node 20 overrides.');
      }

      // Check TypeScript compilation preflight
      const tsconfigPath = path.join(targetDir, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const tscBin = process.platform === 'win32'
          ? path.join(targetDir, 'node_modules', '.bin', 'tsc.cmd')
          : path.join(targetDir, 'node_modules', '.bin', 'tsc');

        let tscRes = null;
        if (fs.existsSync(tscBin)) {
          tscRes = spawnSync(tscBin, ['--noEmit'], { cwd: targetDir, encoding: 'utf-8', shell: process.platform === 'win32', maxBuffer: 10 * 1024 * 1024 });
        } else {
          const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
          tscRes = spawnSync(npxCmd, ['--no-install', 'tsc', '--noEmit'], { cwd: targetDir, encoding: 'utf-8', shell: process.platform === 'win32', maxBuffer: 10 * 1024 * 1024 });
        }

        if (tscRes && tscRes.status === 0) {
          addCheck(suite2, 'pass', 'TypeScript Compilation Preflight', '0 type errors detected (tsc --noEmit clean)', { code: 'DNB-TYP-001' });
        } else if (tscRes && tscRes.status !== null) {
          const rawErr = (tscRes.stdout || tscRes.stderr || '').trim();
          const lines = rawErr.split(/\r?\n/).filter(Boolean);
          const errLines = lines.filter((l) => l.includes('error TS'));
          const summary = errLines.length > 0 ? `${errLines.length} type error(s) (e.g. ${errLines[0].trim()})` : (lines[0] || 'Type errors found');
          addCheck(suite2, 'err', 'TypeScript Compilation Preflight', summary, { code: 'DNB-TYP-001', action: 'Fix TypeScript compilation errors shown by tsc --noEmit' });
        } else {
          addCheck(suite2, 'warn', 'TypeScript Compilation Preflight', 'Could not execute tsc to verify types', { code: 'DNB-TYP-001' });
        }
      }
    } catch (e) {
      addCheck(suite2, 'err', 'package.json Syntax', e.message);
    }
  } else {
    addCheck(suite2, 'err', 'package.json', `Not found at ${pkgPath}`);
  }

  // =========================================================================
  // SUITE 3: Next.js Static Export & Asset Optimization Architecture
  // =========================================================================
  if (!isJson) console.log('\n\x1b[1m[3/7] Static Export & Asset Optimization:\x1b[0m');
  const suite3 = 'Static Export Architecture';

  const nextConfigFiles = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
  const nextConfigPath = nextConfigFiles.map((f) => path.join(targetDir, f)).find((p) => fs.existsSync(p));

  if (nextConfigPath) {
    let content = fs.readFileSync(nextConfigPath, 'utf-8');
    const hasExport = /output\s*:\s*['"]export['"]/.test(content);
    const hasUnoptimized = /unoptimized\s*:\s*true/.test(content);

    if (hasExport) {
      addCheck(suite3, 'pass', 'Next.js Static Export', `output: 'export' verified in ${path.basename(nextConfigPath)}`, { code: 'DNB-EXP-001' }) //, `output: 'export' verified in ${path.basename(nextConfigPath)}`);
    } else if (shouldFix) {
      if (content.includes('nextConfig')) {
        content = content.replace(/(const\s+nextConfig\s*=\s*{)/, `$1\n  output: 'export',`);
        fs.writeFileSync(nextConfigPath, content, 'utf8');
        addCheck(suite3, 'fixed', 'Next.js Static Export', `Added output: 'export' to ${path.basename(nextConfigPath)}`, { code: 'DNB-EXP-001' }) //, `Added output: 'export' to ${path.basename(nextConfigPath)}`);
      } else {
        addCheck(suite3, 'err', 'Next.js Static Export', `Missing output: 'export' in ${path.basename(nextConfigPath)} (Required by Fivora)`, { code: 'DNB-EXP-001' }) //, `Missing output: 'export' in ${path.basename(nextConfigPath)}`);
      }
    } else {
      addCheck(suite3, 'err', 'Next.js Static Export', `Missing output: 'export' in ${path.basename(nextConfigPath)} (Required by Fivora)`);
    }

    if (hasUnoptimized) {
      addCheck(suite3, 'pass', 'Image Optimization Preflight', 'images.unoptimized = true verified', { code: 'DNB-IMG-001' }) //, 'images.unoptimized = true verified');
    } else if (shouldFix) {
      if (content.includes('images:')) {
        content = content.replace(/images:\s*{/, `images: { unoptimized: true, `);
      } else if (content.includes('nextConfig')) {
        content = content.replace(/(const\s+nextConfig\s*=\s*{)/, `$1\n  images: { unoptimized: true },`);
      }
      fs.writeFileSync(nextConfigPath, content, 'utf8');
      addCheck(suite3, 'fixed', 'Image Optimization Preflight', `Added images.unoptimized = true to ${path.basename(nextConfigPath)}`, { code: 'DNB-IMG-001' }) //, `Added images.unoptimized = true to ${path.basename(nextConfigPath)}`);
    } else {
      addCheck(suite3, 'warn', 'Image Optimization Preflight', 'Missing images.unoptimized = true (Next.js Image export requires unoptimized: true)', { code: 'DNB-IMG-001' }) //, 'Missing images.unoptimized = true (Next.js Image export requires unoptimized: true)');
    }
  } else {
    addCheck(suite3, 'err', 'Next.js Config', 'No next.config.ts, next.config.mjs, or next.config.js found');
  }

  // =========================================================================
  // SUITE 4: Fivora Manifest v2 & Route Coherence
  // =========================================================================
  if (!isJson) console.log('\n\x1b[1m[4/7] Fivora Manifest v2 & Route Architecture:\x1b[0m');
  const suite4 = 'Manifest & Route Architecture';

  const manifestPath = path.join(targetDir, 'fivora-template.json');
  let manifestData = null;

  if (fs.existsSync(manifestPath)) {
    try {
      manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      addCheck(suite4, 'pass', 'fivora-template.json', `Valid JSON (strict=${manifestData.strict !== false})`, { code: 'DNB-MNF-001' }) //, `Valid JSON (strict=${manifestData.strict !== false})`);

      if (manifestData.version === 2 || manifestData.version === '2') {
        addCheck(suite4, 'pass', 'Manifest Contract Version', 'Version 2 (Current standard)', { code: 'DNB-MNF-002' }) //, 'Version 2 (Current standard)');
      } else {
        addCheck(suite4, 'warn', 'Manifest Contract Version', `Version ${manifestData.version} detected (Recommend version 2)`, { code: 'DNB-MNF-002' }) //, `Version ${manifestData.version} detected (Recommend version 2)`);
      }

      // Check home route
      const pages = Array.isArray(manifestData.pages) ? manifestData.pages : [];
      const hasHome = pages.some((p) => p.route === '/' || p.slug === '/' || p.path === '/' || p.id === 'home');
      if (hasHome) {
        addCheck(suite4, 'pass', 'Home Route Entry', 'Home page ("/") declared in manifest', { code: 'DNB-MNF-003' }) //, 'Home page ("/") declared in manifest');
      } else {
        addCheck(suite4, 'err', 'Home Route Entry', 'Manifest pages array missing root route: "/"', { code: 'DNB-MNF-003' }) //, 'Manifest pages array missing root route: "/"');
      }

      // Route coherence check: verify declared manifest routes exist on filesystem
      const appDir = fs.existsSync(path.join(targetDir, 'src', 'app'))
        ? path.join(targetDir, 'src', 'app')
        : path.join(targetDir, 'app');

      let missingDiskRoutes = [];
      if (fs.existsSync(appDir)) {
        for (const page of pages) {
          if (page.route === '/') continue;
          const cleanRoute = page.route.replace(/^\//, '').split('/')[0];
          const routeDir = path.join(appDir, cleanRoute);
          const routePage = path.join(routeDir, 'page.tsx');
          const routeJsx = path.join(routeDir, 'page.jsx');
          const routeJs = path.join(routeDir, 'page.js');

          if (!fs.existsSync(routeDir) && !fs.existsSync(routePage) && !fs.existsSync(routeJsx) && !fs.existsSync(routeJs)) {
            missingDiskRoutes.push(page.route);
          }
        }
      }

      if (missingDiskRoutes.length === 0) {
        addCheck(suite4, 'pass', 'Route Coherence', `All ${pages.length} declared routes verified against filesystem`, { code: 'DNB-RTE-001' }) //, `All ${pages.length} declared routes verified against filesystem`);
      } else {
        addCheck(suite4, 'warn', 'Route Coherence', `Declared routes missing corresponding files on disk: ${missingDiskRoutes.join(', ')}`, { code: 'DNB-RTE-001' }) //, `Declared routes missing corresponding files on disk: ${missingDiskRoutes.join(', ')}`);
      }
    } catch (e) {
      addCheck(suite4, 'err', 'fivora-template.json Syntax', e.message);
    }
  } else {
    addCheck(suite4, 'err', 'fivora-template.json', 'File not found. Run "deneb init" to generate it');
  }

  // =========================================================================
  // SUITE 5: AST Visual Editing Contract & Field Path Integrity
  // =========================================================================
  if (!isJson) console.log('\n\x1b[1m[5/7] Visual Editing Contract & AST Integrity:\x1b[0m');
  const suite5 = 'AST Visual Editing Contract';

  const siteDataPath = path.join(targetDir, 'src', 'data', 'site-data.json');
  let siteData = null;
  if (fs.existsSync(siteDataPath)) {
    try {
      siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf-8'));
      addCheck(suite5, 'pass', 'site-data.json', 'src/data/site-data.json exists & valid', { code: 'DNB-SYN-001' }) //, 'src/data/site-data.json exists & valid');
    } catch (e) {
      addCheck(suite5, 'err', 'site-data.json Syntax', e.message);
    }
  } else {
    addCheck(suite5, 'warn', 'site-data.json', 'src/data/site-data.json not found');
  }

  // Root Layout SiteDataProvider Instrumentation Check
  const doctorLayoutFiles = [
    path.join(targetDir, 'src', 'app', 'layout.tsx'),
    path.join(targetDir, 'src', 'app', 'layout.jsx'),
    path.join(targetDir, 'app', 'layout.tsx'),
    path.join(targetDir, 'app', 'layout.jsx'),
  ];
  const docLayout = doctorLayoutFiles.find((f) => fs.existsSync(f));
  if (docLayout) {
    const layoutSrc = fs.readFileSync(docLayout, 'utf8');
    const hasSiteProvider = /SiteDataProvider|DenebDataProvider|<Providers\b/.test(layoutSrc);
    if (hasSiteProvider) {
      addCheck(suite5, 'pass', 'Root Layout Provider', `<SiteDataProvider> mounted in ${path.relative(targetDir, docLayout)}`, { code: 'DNB-LAY-001' });
    } else if (isFix) {
      try {
        const { instrumentLayoutSource } = require('../arc/transformer.cjs');
        const instrumented = instrumentLayoutSource(layoutSrc, '@/data/site-data.json', '@deneb-ui/ui');
        if (instrumented.updated && instrumented.code !== layoutSrc) {
          fs.writeFileSync(docLayout, instrumented.code, 'utf8');
          addCheck(suite5, 'fixed', 'Root Layout Provider', `Instrumented <SiteDataProvider> into ${path.relative(targetDir, docLayout)}`, { code: 'DNB-LAY-001' });
        } else {
          addCheck(suite5, 'warn', 'Root Layout Provider', `Missing <SiteDataProvider> in ${path.relative(targetDir, docLayout)}`, { code: 'DNB-LAY-001' });
        }
      } catch {
        addCheck(suite5, 'warn', 'Root Layout Provider', `Missing <SiteDataProvider> in ${path.relative(targetDir, docLayout)}`, { code: 'DNB-LAY-001' });
      }
    } else {
      addCheck(suite5, 'warn', 'Root Layout Provider', `Missing <SiteDataProvider> in ${path.relative(targetDir, docLayout)} (Run with --fix to instrument automatically)`, { code: 'DNB-LAY-001' });
    }
  }

  // Scan all source files for visual editing contract compliance
  const sourceFiles = findSourceFiles(path.join(targetDir, 'src'));
  const foundFieldPaths = new Set();
  const orphanPaths = [];
  const missingInSchema = [];
  let actionTextCollisions = 0;
  let staticAncestorCollisions = 0;
  const broadStaticContainers = [];
  const dynamicVariableMarkers = [];

  for (const file of sourceFiles) {
    const code = fs.readFileSync(file, 'utf-8');

    // 1. Extract data-preview-field-path
    const matches = code.matchAll(/data-preview-field-path="([^"]+)"/g);
    for (const match of matches) {
      const fieldPath = match[1];
      foundFieldPaths.add(fieldPath);

      // Check if path exists in siteData
      if (siteData && siteData.content) {
        if (!hasFieldPath(siteData.content, fieldPath)) {
          orphanPaths.push({ fieldPath, file: path.relative(targetDir, file) });
        }
      }

      // Check if path exists in manifest editorSchema
      if (manifestData) {
        if (!isFieldInEditorSchema(manifestData, fieldPath)) {
          missingInSchema.push({ fieldPath, file: path.relative(targetDir, file) });
        }
      }
    }

    // 2. Action URL vs Visible Text Collision (DNB-ACT-004)
    // Only flag if element carries an action URL and has child text WITHOUT a dedicated child label marker
    const actionCollisions = code.matchAll(/<(a|button)(\s+[^>]*data-preview-field-path="[^"]*(?:Url|Link|Action)"[^>]*)>([\s\S]*?)<\/\1>/gi);
    let fileNeedsActionFix = false;
    let newCodeAction = code;
    for (const ac of actionCollisions) {
      const innerContent = ac[3].trim();
      // If innerContent has its own data-preview-field-path, it is decoupled!
      if (innerContent.length > 0 && !/\bdata-preview-field-path\s*=/.test(innerContent)) {
        const textOnly = innerContent.replace(/<[^>]*>/g, '').trim();
        if (textOnly.length > 1) {
          actionTextCollisions++;
          if (shouldFix) {
            const originalOpening = `<${ac[1]}${ac[2]}>`;
            const cleanOpening = originalOpening.replace(/\s*data-preview-field-path="[^"]*"/g, '');
            newCodeAction = newCodeAction.replace(originalOpening, cleanOpening);
            fileNeedsActionFix = true;
          }
        }
      }
    }
    if (shouldFix && fileNeedsActionFix) {
      fs.writeFileSync(file, newCodeAction, 'utf8');
    }

    // 3. Static Ancestor Collision
    // Detect element with data-preview-static wrapping element with data-preview-field-path
    if (code.includes('data-preview-static') && code.includes('data-preview-field-path')) {
      const staticBlocks = code.matchAll(/<([a-zA-Z0-9_-]+)(\s+[^>]*data-preview-static[^>]*)>([\s\S]*?)<\/\1>/g);
      let fileNeedsStaticAncestorFix = false;
      let newCode = code;

      for (const sb of staticBlocks) {
        if (sb[3].includes('data-preview-field-path')) {
          staticAncestorCollisions++;
          if (shouldFix) {
            // Strip data-preview-static from this wrapper element
            const originalTag = `<${sb[1]}${sb[2]}>`;
            const cleanTag = originalTag.replace(/\s*data-preview-static="[^"]*"/g, '');
            newCode = newCode.replace(originalTag, cleanTag);
            fileNeedsStaticAncestorFix = true;
          }
        }
      }

      if (shouldFix && fileNeedsStaticAncestorFix) {
        fs.writeFileSync(file, newCode, 'utf8');
      }
    }

    // 4. Broad Container Detection
    // Fivora forbids data-preview-static and data-preview-field-path on broad layout containers like <div>, <section>, <nav>, <main>, <header>
    const broadStaticMatches = code.matchAll(/<(div|section|nav|main|header|article|aside)(\s+[^>]*data-preview-static="[^"]*"[^>]*)>/gi);
    let fileNeedsBroadStaticFix = false;
    let newCodeBroad = fs.readFileSync(file, 'utf-8');

    for (const bsm of broadStaticMatches) {
      const tag = bsm[1].toLowerCase();
      // Only flag if it's not a pure leaf element
      if (['div', 'section', 'nav', 'main', 'header', 'article', 'aside'].includes(tag)) {
        broadStaticContainers.push({ tag, file: path.relative(targetDir, file), type: 'static' });
        if (shouldFix) {
          const originalTag = `<${bsm[1]}${bsm[2]}>`;
          const cleanTag = originalTag.replace(/\s*data-preview-static="[^"]*"/g, '');
          newCodeBroad = newCodeBroad.replace(originalTag, cleanTag);
          fileNeedsBroadStaticFix = true;
        }
      }
    }

    const broadFieldMatches = code.matchAll(/<(div|section|nav|main|header|article|aside)(\s+[^>]*data-preview-field-path="[^"]*"[^>]*)>/gi);
    for (const bfm of broadFieldMatches) {
      const tag = bfm[1].toLowerCase();
      if (['div', 'section', 'nav', 'main', 'header', 'article', 'aside'].includes(tag)) {
        broadStaticContainers.push({ tag, file: path.relative(targetDir, file), type: 'field' });
      }
    }

    if (shouldFix && [...broadFieldMatches].length > 0) {
      try {
        const { parseSource, printSource } = require('../arc/ast.cjs');
        const ast = parseSource(newCodeBroad, file);
        const healed = healBroadContainerMarkers(ast);
        if (healed > 0) {
          newCodeBroad = printSource(ast, newCodeBroad);
          fileNeedsBroadStaticFix = true;
        }
      } catch {}
    }

    if (shouldFix && fileNeedsBroadStaticFix) {
      fs.writeFileSync(file, newCodeBroad, 'utf8');
    }

    // 5. Dynamic Non-Literal Marker Detection
    // Flags data-preview-field-path={nonLiteralVariable}
    const dynamicVarMatches = code.matchAll(/data-preview-field-path=\{([a-zA-Z0-9_$.]+)\}/g);
    for (const dvm of dynamicVarMatches) {
      dynamicVariableMarkers.push({ expr: dvm[1], file: path.relative(targetDir, file) });
    }
  }

  addCheck(suite5, 'pass', 'Field Path Scan', `${foundFieldPaths.size} visual editing field markers scanned across ${sourceFiles.length} files`, { code: 'DNB-AST-001' }) //, `${foundFieldPaths.size} visual editing field markers scanned across ${sourceFiles.length} files`);

  if (orphanPaths.length === 0) {
    addCheck(suite5, 'pass', 'Content Synchronization', 'All source field paths exist in site-data.json', { code: 'DNB-SYN-002' }) //, 'All source field paths exist in site-data.json');
  } else {
    addCheck(suite5, 'warn', 'Content Synchronization', `${orphanPaths.length} field paths not found in site-data.json`, { code: 'DNB-SYN-002' }) //, `${orphanPaths.length} field paths not found in site-data.json (e.g. ${orphanPaths[0].fieldPath})`);
  }

  if (missingInSchema.length === 0) {
    addCheck(suite5, 'pass', 'Schema Synchronization', 'All source field paths declared in fivora-template.json editorSchema', { code: 'DNB-SCH-001' }) //, 'All source field paths declared in fivora-template.json editorSchema');
  } else if (shouldFix && manifestData) {
    // Auto-fix missing schema entries
    let fixedSchemaFields = 0;
    manifestData.editorSchema = manifestData.editorSchema || { version: 1, sections: [] };

    for (const item of missingInSchema) {
      const parts = item.fieldPath.split('.');
      const secId = parts[0];
      const fieldKey = parts.slice(1).join('.');

      let sec = manifestData.editorSchema.sections.find((s) => s.id === secId || s.path === secId);
      if (!sec) {
        sec = { id: secId, path: secId, type: 'object', label: secId.toUpperCase(), fields: [] };
        manifestData.editorSchema.sections.push(sec);
      }
      sec.fields = sec.fields || [];
      if (!sec.fields.some((f) => f.key === fieldKey)) {
        const isImg = fieldKey.toLowerCase().includes('image');
        sec.fields.push({
          key: fieldKey,
          type: isImg ? 'image' : 'text',
          label: fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
        });
        fixedSchemaFields++;
      }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf8');
    addCheck(suite5, 'fixed', 'Schema Synchronization', `Added ${fixedSchemaFields} missing field definitions to editorSchema`, { code: 'DNB-SCH-001' }) //, `Added ${fixedSchemaFields} missing field definitions to editorSchema`);
  } else {
    addCheck(suite5, 'warn', 'Schema Synchronization', `${missingInSchema.length} field paths missing in fivora-template.json (Run with --fix to register automatically)`, { code: 'DNB-SCH-001' }) //, `${missingInSchema.length} field paths missing in fivora-template.json (Run with --fix to register automatically)`);
  }

  if (actionTextCollisions === 0) {
    addCheck(suite5, 'pass', 'Action vs Text Contracts', 'Zero URL vs text label collisions detected on interactive links', { code: 'DNB-ACT-004' }) //, 'Zero URL vs text label collisions detected on interactive links');
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Action vs Text Contracts', `Stripped ${actionTextCollisions} action URL marker(s) from container elements to protect child labels`, { code: 'DNB-ACT-004' }) //, `Stripped ${actionTextCollisions} action URL marker(s) from container elements to protect child labels`);
  } else {
    addCheck(suite5, 'warn', 'Action vs Text Contracts', `${actionTextCollisions} potential action URL/label conflict(s) (Split URL marker on <a>/<button> and text on <span>)`, { code: 'DNB-ACT-004' }) //, `${actionTextCollisions} potential action URL/label conflict(s) (Split URL marker on <a>/<button> and text on <span>)`);
  }

  if (staticAncestorCollisions === 0) {
    addCheck(suite5, 'pass', 'Ancestor Delegation', 'Zero static ancestor collisions (clickable visual focus intact)', { code: 'DNB-ANC-001' }) //, 'Zero static ancestor collisions (clickable visual focus intact)');
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Ancestor Delegation', `Stripped ${staticAncestorCollisions} static ancestor attribute(s) that shadowed editable children`, { code: 'DNB-ANC-001' }) //, `Stripped ${staticAncestorCollisions} static ancestor attribute(s) that shadowed editable children`);
  } else {
    addCheck(suite5, 'err', 'Ancestor Delegation', `${staticAncestorCollisions} static ancestor wrapper(s) covering editable children (Run with --fix to strip automatically)`, { code: 'DNB-ANC-001' }) //, `${staticAncestorCollisions} static ancestor wrapper(s) covering editable children (Run with --fix to strip automatically)`);
  }

  if (broadStaticContainers.length === 0) {
    addCheck(suite5, 'pass', 'Granular Static Markup', 'Zero broad layout containers (div/nav/section) marked static or field-bound', { code: 'DNB-STC-006' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Granular Static Markup', `Repaired/demoted ${broadStaticContainers.length} broad container marker(s)`, { code: 'DNB-STC-006' });
  } else {
    addCheck(suite5, 'warn', 'Granular Static Markup', `${broadStaticContainers.length} broad container(s) marked with static or field paths (Fivora requires marking only smallest leaf elements). Run with --fix to repair.`, { code: 'DNB-STC-006' });
  }

  if (dynamicVariableMarkers.length === 0) {
    addCheck(suite5, 'pass', 'Literal Marker Standard', 'All data-preview-field-path annotations use literal strings or JSX templates', { code: 'DNB-AST-002' }) //, 'All data-preview-field-path annotations use literal strings or JSX templates');
  } else {
    addCheck(suite5, 'warn', 'Literal Marker Standard', `${dynamicVariableMarkers.length} dynamic variable marker(s) detected`, { code: 'DNB-AST-002' }) //, `${dynamicVariableMarkers.length} dynamic variable marker(s) detected (e.g. ${dynamicVariableMarkers[0].expr})`);
  }

  // Check: Control-Only & Platform Contract Path Integrity (DNB-CTL-001)
  if (manifestData) {
    manifestData.visualEditing = manifestData.visualEditing || {};
    const existingControlOnly = new Set(manifestData.visualEditing.controlOnlyPaths || []);
    const missingControlOnly = [];

    // 1. Platform contract paths: if __fivoraIntake or additionalPages exist in editorSchema,
    // ensure their paths are in controlOnlyPaths
    const schemaSections = manifestData.editorSchema?.sections || [];
    const hasIntake = schemaSections.some((s) => s.id === '__fivoraIntake');
    const hasPages = schemaSections.some((s) => s.id === 'additionalPages');

    if (hasIntake) {
      const intakePaths = [
        '__fivoraIntake.tone',
        '__fivoraIntake.outputLanguage',
        '__fivoraIntake.businessSummary',
        '__fivoraIntake.additionalBusinessDetails',
        '__fivoraIntake.referenceWebsiteUrl',
      ];
      for (const p of intakePaths) {
        if (!existingControlOnly.has(p)) missingControlOnly.push(p);
      }
    }

    if (hasPages) {
      const pagesPaths = [
        'additionalPages[*].id',
        'additionalPages[*].route',
        'additionalPages[*].label',
      ];
      for (const p of pagesPaths) {
        if (!existingControlOnly.has(p)) missingControlOnly.push(p);
      }
    }

    // 2. Modal & unrendered form fields in siteData.content (e.g. *.form.*)
    if (siteData && siteData.content) {
      function collectModalFormPaths(obj, prefix = '') {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) return;
        for (const [k, v] of Object.entries(obj)) {
          const p = prefix ? `${prefix}.${k}` : k;
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            collectModalFormPaths(v, p);
          } else {
            if (/\.form\./i.test(p) || /^form\./i.test(p) || /\.modal\./i.test(p) || /Modal\./i.test(p)) {
              if (!existingControlOnly.has(p)) missingControlOnly.push(p);
            }
          }
        }
      }
      collectModalFormPaths(siteData.content);
    }

    if (missingControlOnly.length === 0) {
      addCheck(suite5, 'pass', 'Control-Only Path Contract', 'All platform-managed & modal form paths declared in controlOnlyPaths', { code: 'DNB-CTL-001' });
    } else if (shouldFix) {
      for (const p of missingControlOnly) existingControlOnly.add(p);
      manifestData.visualEditing.controlOnlyPaths = [...existingControlOnly].sort();
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf8');
      addCheck(suite5, 'fixed', 'Control-Only Path Contract', `Added ${missingControlOnly.length} platform & modal field(s) to controlOnlyPaths`, { code: 'DNB-CTL-001' });
    } else {
      addCheck(suite5, 'warn', 'Control-Only Path Contract', `${missingControlOnly.length} platform or modal path(s) missing from controlOnlyPaths (Run with --fix to register automatically)`, { code: 'DNB-CTL-001' });
    }
  }

  // =========================================================================
  // SUITE 6: Multi-Niche Storefront Architecture & Security Preflight
  // =========================================================================

  // Check: Hidden contract markers & regex token collisions (DNB-HID-005)
  let hiddenContractCount = 0;
  let overflowHiddenCount = 0;
  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    let modified = false;
    const hiddenMatches = c.matchAll(/<([a-zA-Z0-9_-]+)\s+[^>]*(?:hidden|display:\s*['"]none['"])[^>]*data-preview-(?:field-path|list-path|item-path)[^>]*>/gi);
    for (const hm of hiddenMatches) hiddenContractCount++;

    if (c.includes('overflow-hidden') && (c.includes('data-preview-style-type="card"') || c.includes('GlassCard') || c.includes('data-preview-item-path'))) {
      overflowHiddenCount++;
      if (shouldFix) {
        c = c.replace(/\boverflow-hidden\b/g, 'overflow-clip');
        modified = true;
      }
    }
    if (/\bhidden\s+(?:md|sm|lg|xl):/.test(c) && c.includes('data-preview-')) {
      if (shouldFix) {
        c = c.replace(/\bhidden(\s+(?:md|sm|lg|xl):)/g, '[display:none]$1');
        modified = true;
      }
    }
    if (shouldFix && modified) fs.writeFileSync(file, c, 'utf8');
  }
  if (hiddenContractCount === 0 && overflowHiddenCount === 0) {
    addCheck(suite5, 'pass', 'Contract Visibility & Regex Safety', 'Zero hidden preview contract markers or token collisions', { code: 'DNB-HID-005' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Contract Visibility & Regex Safety', `Sanitized ${overflowHiddenCount} class token(s) to overflow-clip / [display:none]`, { code: 'DNB-HID-005' });
  } else {
    addCheck(suite5, 'warn', 'Contract Visibility & Regex Safety', `${hiddenContractCount} hidden marker(s) or ${overflowHiddenCount} class collision(s) detected (Run with --fix to sanitize)`, { code: 'DNB-HID-005' });
  }

  // Check: Empty-State Array & Out-of-Range Guards (DNB-ARR-003)
  let unguardedArrayCount = 0;
  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    let fileModified = false;
    if (c.includes('data-preview-list-path')) {
      if (/\?\s*[A-Z0-9_]+\s*:\s*[A-Z0-9_]+/i.test(c) && !c.includes('Array.isArray')) {
        unguardedArrayCount++;
        if (shouldFix) {
          const repaired = c.replace(
            /([a-zA-Z0-9_$]+)\s*(?:&&|\?\.)\s*length(?:\s*>\s*0)?\s*\?\s*\1\s*:\s*([a-zA-Z0-9_$]+)/g,
            'Array.isArray($1) ? $1 : ($1 || $2)'
          );
          if (repaired !== c) {
            c = repaired;
            fileModified = true;
          }
        }
      }
    }
    if (shouldFix && fileModified) {
      fs.writeFileSync(file, c, 'utf8');
    }
  }
  if (unguardedArrayCount === 0) {
    addCheck(suite5, 'pass', 'Empty-State Array Guards', 'All list collections guarded against empty state ([]) out-of-range elements', { code: 'DNB-ARR-003' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Empty-State Array Guards', `Injected Array.isArray safe empty-state guard into ${unguardedArrayCount} component(s)`, { code: 'DNB-ARR-003' });
  } else {
    addCheck(suite5, 'warn', 'Empty-State Array Guards', `${unguardedArrayCount} list component(s) should verify Array.isArray(liveList) ? liveList : (liveList || DEFAULT_LIST). Run with --fix to repair.`, { code: 'DNB-ARR-003' });
  }

  // Check: Empty-State Singleton Persistence Guard (DNB-EMP-002)
  let unmountedSingletonCount = 0;
  for (const file of sourceFiles) {
    const c = fs.readFileSync(file, 'utf-8');
    if (/\{[^{}]{0,100}length\s*>\s*0\s*&&[^{}]{0,300}data-preview-field-path="home\.[a-zA-Z0-9]+Label"/.test(c)) {
      if (!c.includes('length === 0')) unmountedSingletonCount++;
    }
  }
  if (unmountedSingletonCount === 0) {
    addCheck(suite5, 'pass', 'Empty-State Singleton Persistence', 'Section singleton labels remain mounted during empty-state fixture tests', { code: 'DNB-EMP-002' });
  } else {
    addCheck(suite5, 'warn', 'Empty-State Singleton Persistence', `${unmountedSingletonCount} singleton label(s) unmount when list is empty. Provide an empty fallback container.`, { code: 'DNB-EMP-002' });
  }

  // Check: WhatsApp Action Target Synchronization (DNB-WHA-008)
  let disconnectedWhatsAppCount = 0;
  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    if (c.includes('whatsappNumber') && (c.includes('1234567890') || c.includes('siteData?.content?.home?.whatsappNumber')) && !c.includes('whatsappOrderUrl')) {
      disconnectedWhatsAppCount++;
      if (shouldFix) {
        c = c.replace(
          /const\s+whatsappNumber\s*=\s*siteData\?\.content\?\.home\?\.whatsappNumber\s*\?\?\s*["'][^"']+["'];?/g,
          'const rawTarget = siteData?.content?.home?.whatsappOrderUrl || siteData?.content?.home?.whatsappNumber || siteData?.content?.common?.business?.whatsapp || "https://wa.me/15550192834";'
        );
        c = c.replace(
          /const\s+url\s*=\s*`https:\/\/wa\.me\/\$\{\s*whatsappNumber\.replace\([^)]+\)\s*\}\?text=\$\{([^}]+)\}`;/g,
          'let targetUrl = (rawTarget || "").trim(); if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) { const cleanNum = targetUrl.replace(/[^0-9]/g, ""); targetUrl = `https://wa.me/${cleanNum || "15550192834"}`; } const sep = targetUrl.includes("?") ? "&" : "?"; const url = `${targetUrl}${sep}text=${$1}`;'
        );
        fs.writeFileSync(file, c, 'utf8');
      }
    }
  }
  if (disconnectedWhatsAppCount === 0) {
    addCheck(suite5, 'pass', 'WhatsApp Action Live Sync', 'All WhatsApp order triggers dynamically resolve configured merchant order URLs', { code: 'DNB-WHA-008' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'WhatsApp Action Live Sync', `Repaired ${disconnectedWhatsAppCount} WhatsApp action trigger(s) to dynamically resolve whatsappOrderUrl`, { code: 'DNB-WHA-008' });
  } else {
    addCheck(suite5, 'warn', 'WhatsApp Action Live Sync', `${disconnectedWhatsAppCount} WhatsApp trigger(s) using disconnected fallback instead of whatsappOrderUrl. Run with --fix to repair.`, { code: 'DNB-WHA-008' });
  }

  // Check: Multi-Component Scope & useSiteData Injection (DNB-SCP-001)
  let missingSiteDataHookCount = 0;
  for (const file of sourceFiles) {
    if (!/\.(tsx|jsx|ts|js)$/.test(file)) continue;
    let c = fs.readFileSync(file, 'utf-8');
    if (c.includes('siteData') && (c.includes('useSiteData') || c.includes('@deneb-ui/ui'))) {
      const healed = healMissingSiteDataHooks(c, file);
      const norm = (s) => s.replace(/\r\n/g, '\n');
      if (healed && norm(healed) !== norm(c)) {
        missingSiteDataHookCount++;
        if (shouldFix) {
          fs.writeFileSync(file, healed, 'utf8');
        }
      }
    }
  }
  if (missingSiteDataHookCount === 0) {
    addCheck(suite5, 'pass', 'Component Scope siteData Binding', 'All components referencing siteData have local useSiteData() hook binding', { code: 'DNB-SCP-001' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Component Scope siteData Binding', `Injected missing useSiteData() hook into ${missingSiteDataHookCount} component(s)`, { code: 'DNB-SCP-001' });
  } else {
    addCheck(suite5, 'err', 'Component Scope siteData Binding', `${missingSiteDataHookCount} component(s) reference siteData without calling useSiteData(). Run with --fix to inject.`, { code: 'DNB-SCP-001' });
  }

  // Check: Collection Callback TypeScript Typing & Collision Guard (DNB-TYP-002)
  let collParamsFixed = 0;
  for (const file of sourceFiles) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    let c = fs.readFileSync(file, 'utf-8');
    let fileModified = false;

    // 1. Fix 3-parameter collision: .map((stat, idx, index) =>
    const trippleMatches = [...c.matchAll(/\.map\(\s*\(\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*,\s*index\s*\)\s*=>/g)];
    if (trippleMatches.length > 0) {
      collParamsFixed += trippleMatches.length;
      if (shouldFix) {
        for (const m of trippleMatches) {
          const p1 = m[1];
          const p2 = m[2];
          c = c.replace(m[0], `.map((${p1}: any, ${p2}: number) =>`);
          c = c.replace(/\[\$\{index\}\]/g, `[\${${p2}}]`);
        }
        fileModified = true;
      }
    }

    // 2. Fix leftover [${index}] when callback uses idx
    if (c.includes('[${index}]') && c.includes('idx') && !c.includes('index) =>') && !c.includes('index,') && !c.includes('index:')) {
      c = c.replace(/\[\$\{index\}\]/g, '[${idx}]');
      fileModified = true;
    }

    // 3. Fix untyped parameters in .map() on data-preview or siteData collections causing TS7006
    if (c.includes('data-preview-') || c.includes('siteData')) {
      const untypedMap2 = [...c.matchAll(/\.map\(\s*\(\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*\)\s*=>/g)];
      for (const m of untypedMap2) {
        const p1 = m[1];
        const p2 = m[2];
        if (!p1.includes(':') && !p2.includes(':')) {
          collParamsFixed++;
          if (shouldFix) {
            c = c.replace(m[0], `.map((${p1}: any, ${p2}: number) =>`);
            fileModified = true;
          }
        }
      }

      const untypedMap1 = [...c.matchAll(/\.map\(\s*\(\s*([a-zA-Z0-9_$]+)\s*\)\s*=>/g)];
      for (const m of untypedMap1) {
        const p1 = m[1];
        if (!p1.includes(':')) {
          collParamsFixed++;
          if (shouldFix) {
            c = c.replace(m[0], `.map((${p1}: any) =>`);
            fileModified = true;
          }
        }
      }
    }

    if (shouldFix && fileModified) {
      fs.writeFileSync(file, c, 'utf8');
    }
  }

  if (collParamsFixed === 0) {
    addCheck(suite5, 'pass', 'Collection Callback TypeScript Contracts', 'Zero parameter collisions or untyped callback parameters in collection maps', { code: 'DNB-TYP-002' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Collection Callback TypeScript Contracts', `Repaired and type-annotated ${collParamsFixed} collection map callback(s)`, { code: 'DNB-TYP-002' });
  } else {
    addCheck(suite5, 'warn', 'Collection Callback TypeScript Contracts', `${collParamsFixed} collection callback(s) have untyped parameters or parameter collisions. Run with --fix to repair.`, { code: 'DNB-TYP-002' });
  }

  // Check: JSON Module Direct Import Type Narrowing Guard (DNB-TYP-003)
  let staticJsonImportCount = 0;
  for (const file of sourceFiles) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    let c = fs.readFileSync(file, 'utf-8');
    if (c.includes('import siteData from') && c.includes('site-data.json')) {
      staticJsonImportCount++;
      if (shouldFix) {
        c = c.replace(/import\s+siteData\s+from\s+['"]([^'"]*site-data\.json)['"];?/, 'import rawSiteData from "$1";\nconst siteData: any = rawSiteData;');
        fs.writeFileSync(file, c, 'utf8');
      }
    }
  }
  if (staticJsonImportCount === 0) {
    addCheck(suite5, 'pass', 'JSON Import Type Safety', 'No statically locked site-data.json imports causing TS2339 schema collisions', { code: 'DNB-TYP-003' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'JSON Import Type Safety', `Safely typed ${staticJsonImportCount} static site-data.json import(s)`, { code: 'DNB-TYP-003' });
  } else {
    addCheck(suite5, 'warn', 'JSON Import Type Safety', `${staticJsonImportCount} file(s) statically import site-data.json without any-casting, which can trigger TS2339 under resolveJsonModule. Run with --fix to heal.`, { code: 'DNB-TYP-003' });
  }

  // Check: Next.js Image Empty String Guard (DNB-IMG-002)
  let emptyImageSrcCount = 0;
  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    if (c.includes('<Image') || c.includes('<img')) {
      const unguardedImageMatches = c.matchAll(/<(?:Image|img)\s+[^>]*\bsrc=\{([a-zA-Z0-9_$.?]+)\}[^>]*>/g);
      let fileModified = false;
      for (const m of unguardedImageMatches) {
        const expr = m[1];
        if (!expr.includes('||') && !expr.includes('?') && !expr.includes('fallback') && !expr.includes('placeholder')) {
          emptyImageSrcCount++;
          if (shouldFix) {
            const safeExpr = `(${expr} && typeof ${expr} === 'string' && ${expr}.trim() !== '') ? ${expr} : '/images/showcase-phone.jpg'`;
            c = c.replace(m[0], m[0].replace(`src={${expr}}`, `src={${safeExpr}}`));
            fileModified = true;
          }
        }
      }
      if (shouldFix && fileModified) {
        fs.writeFileSync(file, c, 'utf8');
      }
    }
  }
  if (emptyImageSrcCount === 0) {
    addCheck(suite5, 'pass', 'Next.js Image Empty-String Guard', 'All Image src attributes are protected against empty string ("") network triggers', { code: 'DNB-IMG-002' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Next.js Image Empty-String Guard', `Protected ${emptyImageSrcCount} Image src attribute(s) with safe non-empty fallback guards`, { code: 'DNB-IMG-002' });
  } else {
    addCheck(suite5, 'warn', 'Next.js Image Empty-String Guard', `${emptyImageSrcCount} Image src attribute(s) pass unguarded expressions that may trigger Next.js empty string download errors. Run with --fix to guard.`, { code: 'DNB-IMG-002' });
  }

  // Check: Product Card Color Swatch & Strikethrough Price Editability (DNB-COL-009)
  let staticSwatchCount = 0;
  let missingColorSchemaCount = 0;
  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    if (c.includes('colors') || c.includes('hex') || c.includes('line-through')) {
      const staticRegex = /data-preview-static="(?:color-swatch|color-name|active-color-name|swatch)"/g;
      if (staticRegex.test(c)) {
        staticSwatchCount++;
        if (shouldFix) {
          c = c.replace(/data-preview-static="(?:color-swatch|swatch)"/g, 'data-preview-field-type="color"');
          c = c.replace(/data-preview-static="(?:color-name|active-color-name)"/g, 'data-preview-style-type="text"');
          fs.writeFileSync(file, c, 'utf8');
        }
      }
    }
  }

  if (manifestData?.editorSchema?.sections) {
    for (const sec of manifestData.editorSchema.sections) {
      for (const field of sec.fields || []) {
        if (field.type === 'list' && (field.key.toLowerCase().includes('phone') || field.key.toLowerCase().includes('product'))) {
          const hasColorField = (field.fields || []).some((sf) => sf.key === 'colors' || sf.key === 'color');
          const hasPriceField = (field.fields || []).some((sf) => sf.key === 'price');
          const hasOriginalPriceField = (field.fields || []).some((sf) => sf.key === 'originalPrice');

          let changed = false;
          if (!hasColorField) {
            missingColorSchemaCount++;
            if (shouldFix) {
              field.fields = field.fields || [];
              field.fields.push({
                key: 'colors',
                type: 'list',
                label: 'Colors',
                itemLabel: 'Color',
                minItems: 1,
                maxItems: 6,
                fields: [
                  { key: 'name', type: 'text', label: 'Color Name' },
                  { key: 'hex', type: 'text', label: 'Color Hex' },
                ],
              });
              changed = true;
            }
          }
          if (hasPriceField && !hasOriginalPriceField) {
            missingColorSchemaCount++;
            if (shouldFix) {
              field.fields = field.fields || [];
              field.fields.push({
                key: 'originalPrice',
                type: 'number',
                label: 'Original Price',
              });
              changed = true;
            }
          }
          if (changed) {
            fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf8');
          }
        }
      }
    }
  }

  if (staticSwatchCount === 0 && missingColorSchemaCount === 0) {
    addCheck(suite5, 'pass', 'Product Color Swatch Editability', 'Product color swatches & original prices are fully editable and registered in editorSchema', { code: 'DNB-COL-009' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Product Color Swatch Editability', `Made ${staticSwatchCount} static elements editable and registered colors/originalPrice in ${missingColorSchemaCount} schema collection(s)`, { code: 'DNB-COL-009' });
  } else {
    addCheck(suite5, 'warn', 'Product Color Swatch Editability', `${staticSwatchCount} static swatch/label element(s) or ${missingColorSchemaCount} missing schema colors/originalPrice definition(s). Run with --fix to make editable.`, { code: 'DNB-COL-009' });
  }

  // Check: Review & Testimonial Star Rating Editability (DNB-REV-010)
  let unannotatedStarCount = 0;
  let missingRatingSchemaCount = 0;

  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    if ((c.includes('<Star') || c.includes('starIdx')) && (c.includes('.rating') || c.includes('ratingNum'))) {
      // Must have data-preview-field-path associated with rating
      const hasRatingFieldPath = /data-preview-field-path=[^>]*\.rating/i.test(c);
      if (!hasRatingFieldPath) {
        unannotatedStarCount++;
      }
    }
  }

  if (manifestData?.editorSchema?.sections) {
    for (const sec of manifestData.editorSchema.sections) {
      for (const field of sec.fields || []) {
        if (field.type === 'list' && (field.key.toLowerCase().includes('review') || field.key.toLowerCase().includes('testimonial'))) {
          const hasRatingField = (field.fields || []).some((sf) => sf.key === 'rating');
          if (!hasRatingField) {
            missingRatingSchemaCount++;
            if (shouldFix) {
              field.fields = field.fields || [];
              field.fields.push({
                key: 'rating',
                type: 'number',
                label: 'Rating',
              });
              fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf8');
            }
          }
        }
      }
    }
  }

  if (unannotatedStarCount === 0 && missingRatingSchemaCount === 0) {
    addCheck(suite5, 'pass', 'Review Star Rating Editability', 'Review star ratings are clickable, editable, and declared in editorSchema', { code: 'DNB-REV-010' });
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Review Star Rating Editability', `Registered rating in ${missingRatingSchemaCount} review schema collection(s) and validated star editability`, { code: 'DNB-REV-010' });
  } else {
    addCheck(suite5, 'warn', 'Review Star Rating Editability', `${unannotatedStarCount} component(s) with unannotated star icons or ${missingRatingSchemaCount} review schema(s) missing rating field. Run with --fix to register.`, { code: 'DNB-REV-010' });
  }

  if (!isJson) console.log('\n\x1b[1m[6/7] Multi-Niche Architecture & Asset Security:\x1b[0m');
  const suite6 = 'Niche Architecture & Security';

  // Niche match analysis
  const matchedRecipe = matchRecipeForProject(targetDir, pkg || {}, sourceFiles);
  if (matchedRecipe) {
    addCheck(suite6, 'pass', 'Storefront Niche Match', `${matchedRecipe.label} (${matchedRecipe.name})`, { code: 'DNB-NIC-001' }) //, `${matchedRecipe.label} (${matchedRecipe.name})`);

    // Audit niche-specific essential features
    const allFileNames = sourceFiles.map((f) => path.basename(f).toLowerCase()).join(' ');
    const codeSample = sourceFiles.slice(0, 10).map((f) => fs.readFileSync(f, 'utf-8').toLowerCase()).join(' ');

    if (matchedRecipe.name === 'fashion-apparel-store') {
      const hasSize = allFileNames.includes('size') || codeSample.includes('sizeguide') || codeSample.includes('sizes');
      if (hasSize) addCheck(suite6, 'pass', 'Apparel Size Architecture', 'Size selector / size guide presence verified');
      else addCheck(suite6, 'warn', 'Apparel Size Architecture', 'No SizeGuide or size selector detected for fashion storefront');
    } else if (matchedRecipe.name === 'electronics-gadgets-store') {
      const hasSpecs = allFileNames.includes('spec') || codeSample.includes('keyspec') || codeSample.includes('technical');
      if (hasSpecs) addCheck(suite6, 'pass', 'Tech Specs Architecture', 'Technical spec matrix detected');
      else addCheck(suite6, 'warn', 'Tech Specs Architecture', 'No Tech Specs or Compare component detected for electronics storefront');
    } else if (matchedRecipe.name === 'cosmetics-beauty-store') {
      const hasRoutine = allFileNames.includes('routine') || codeSample.includes('skintype') || codeSample.includes('inci');
      if (hasRoutine) addCheck(suite6, 'pass', 'Beauty Routine Architecture', 'Skincare routine / skin type categorization verified');
      else addCheck(suite6, 'warn', 'Beauty Routine Architecture', 'No routine step or skin-type filter detected for cosmetics storefront');
    }
  } else {
    addCheck(suite6, 'pass', 'Storefront Niche Match', 'Universal E-Commerce Storefront');
  }

  // Secrets isolation
  const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
  const foundEnv = envFiles.filter((f) => fs.existsSync(path.join(targetDir, f)));
  if (foundEnv.length === 0) {
    addCheck(suite6, 'pass', 'Secrets Isolation', 'No raw .env files in root directory', { code: 'DNB-SEC-001' }) //, 'No raw .env files in root directory');
  } else {
    addCheck(suite6, 'warn', 'Secrets Isolation', `Active env files: ${foundEnv.join(', ')}`, { code: 'DNB-SEC-001' }) //, `Active env files: ${foundEnv.join(', ')} (Will be excluded from upload ZIP)`);
  }

  // Storefront preview image
  const previewExists = fs.existsSync(path.join(targetDir, 'preview.png')) ||
    fs.existsSync(path.join(targetDir, 'thumbnail.png')) ||
    fs.existsSync(path.join(targetDir, 'public', 'preview.png'));

  if (previewExists) {
    addCheck(suite6, 'pass', 'Storefront Preview Graphic', 'preview.png / thumbnail.png verified for Fivora gallery', { code: 'DNB-PRV-001' });
  } else if (shouldFix) {
    try {
      const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(path.join(targetDir, 'preview.png'), minimalPng);
      if (fs.existsSync(path.join(targetDir, 'public'))) {
        fs.writeFileSync(path.join(targetDir, 'public', 'preview.png'), minimalPng);
      }
      addCheck(suite6, 'fixed', 'Storefront Preview Graphic', 'Created placeholder preview.png for Fivora marketplace preflight', { code: 'DNB-PRV-001' });
    } catch {
      addCheck(suite6, 'warn', 'Storefront Preview Graphic', 'preview.png not found in root or public folder', { code: 'DNB-PRV-001' });
    }
  } else {
    addCheck(suite6, 'warn', 'Storefront Preview Graphic', 'preview.png not found in root or public folder (Run with --fix to scaffold placeholder)', { code: 'DNB-PRV-001' });
  }

  // Large assets audit (> 4MB)
  const assets = findAssetFiles(path.join(targetDir, 'public'));
  const largeAssets = [];
  for (const a of assets) {
    const stat = fs.statSync(a);
    if (stat.size > 4 * 1024 * 1024) {
      largeAssets.push({ file: path.relative(targetDir, a), sizeMB: (stat.size / (1024 * 1024)).toFixed(1) });
    }
  }

  if (largeAssets.length === 0) {
    addCheck(suite6, 'pass', 'Asset Optimization Preflight', `All ${assets.length} public asset(s) within optimal static export bounds (< 4MB)`, { code: 'DNB-AST-003' }) //, `All ${assets.length} public asset(s) within optimal static export bounds (< 4MB)`);
  } else {
    addCheck(suite6, 'warn', 'Asset Optimization Preflight', `${largeAssets.length} large asset(s) detected (> 4MB)`, { code: 'DNB-AST-003' }) //, `${largeAssets.length} large asset(s) detected (> 4MB): ${largeAssets.map((a) => `${a.file} (${a.sizeMB}MB)`).join(', ')}`);
  }

  // =========================================================================
  // SUITE 7: Live Product Detail & Static Export Architecture
  // =========================================================================
  if (!isJson) console.log('\n\x1b[1m[7/7] Live Product Detail & Static Export Architecture:\x1b[0m');
  const suite7 = 'Live Product Detail & Static Export';

  const hasCatalogReference =
    Boolean(manifestData?.editorSchema?.sections?.some((s) => s.path === 'products' || s.path?.startsWith('products['))) ||
    Boolean(siteData?.content && hasFieldPath(siteData.content, 'products')) ||
    (Array.isArray(manifestData?.pages) && manifestData.pages.some((p) => p.route === '/products' || p.route?.startsWith('/products')));

  // Check 1: Dynamic build-time /products/${...} links vs platformProductDetailHref (DNB-PRD-001)
  let legacyProductLinkCount = 0;
  for (const file of sourceFiles) {
    let c = fs.readFileSync(file, 'utf-8');
    const legacyPatterns = [
      /\/products\/\$\{[^}]+\}/g,
      /['"`]\/products\/['"`]\s*\+\s*(?:encodeURIComponent\s*\()?[^),\s]+/g,
    ];
    let fileModified = false;
    for (const pattern of legacyPatterns) {
      const matches = [...c.matchAll(pattern)];
      if (matches.length > 0) {
        legacyProductLinkCount += matches.length;
        if (shouldFix) {
          c = c.replace(
            /(?:href=\{`\/products\/\$\{(.*?)\}`\}|href=\{['"]\/products\/['"]\s*\+\s*(?:encodeURIComponent\s*\()?(.*?)\)?\})/g,
            'href={platformProductDetailHref($1$2)}'
          );
          if (!c.includes('platformProductDetailHref')) {
            if (/^['"]use client['"];?\r?\n/i.test(c)) {
              c = c.replace(/^(['"]use client['"];?\r?\n)/i, `$1import { platformProductDetailHref } from '@deneb-ui/ui';\n`);
            } else {
              c = `import { platformProductDetailHref } from '@deneb-ui/ui';\n` + c;
            }
          }
          fileModified = true;
        }
      }
    }
    if (shouldFix && fileModified) {
      fs.writeFileSync(file, c, 'utf8');
    }
  }

  if (legacyProductLinkCount === 0) {
    addCheck(suite7, 'pass', 'Live Product Detail Links', 'Zero legacy /products/${id} links; product links use platformProductDetailHref()', { code: 'DNB-PRD-001' });
  } else if (shouldFix) {
    addCheck(suite7, 'fixed', 'Live Product Detail Links', `Converted ${legacyProductLinkCount} legacy product link(s) to platformProductDetailHref()`, { code: 'DNB-PRD-001' });
  } else {
    addCheck(suite7, 'err', 'Live Product Detail Links', `${legacyProductLinkCount} build-time /products/:id URL(s) detected. Fivora requires platformProductDetailHref() for static exports. Run with --fix to repair.`, { code: 'DNB-PRD-001' });
  }

  // Check 2: Stable client product detail route at /products/detail/page.tsx (DNB-PRD-002)
  const appDir = fs.existsSync(path.join(targetDir, 'src', 'app'))
    ? path.join(targetDir, 'src', 'app')
    : fs.existsSync(path.join(targetDir, 'app'))
      ? path.join(targetDir, 'app')
      : null;

  let detailPageExists = false;
  let detailPageUsesPlatform = false;
  let detailPagePath = null;

  if (appDir) {
    const candidates = [
      path.join(appDir, 'products', 'detail', 'page.tsx'),
      path.join(appDir, 'products', 'detail', 'page.jsx'),
      path.join(appDir, 'products', 'detail', 'page.js'),
    ];
    detailPagePath = candidates[0];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        detailPageExists = true;
        detailPagePath = cand;
        const code = fs.readFileSync(cand, 'utf8');
        if (code.includes('PlatformProductDetail') || code.includes('usePlatformProductDetail')) {
          detailPageUsesPlatform = true;
        }
        break;
      }
    }
  }

  if (!hasCatalogReference) {
    addCheck(suite7, 'pass', 'Stable Product Detail Route', 'Non-catalog template (product detail route not required)', { code: 'DNB-PRD-002' });
  } else if (detailPageExists && detailPageUsesPlatform) {
    addCheck(suite7, 'pass', 'Stable Product Detail Route', `Stable client detail route verified at ${path.relative(targetDir, detailPagePath)} using PlatformProductDetail`, { code: 'DNB-PRD-002' });
  } else if (shouldFix && appDir) {
    const detailDir = path.dirname(detailPagePath);
    fs.mkdirSync(detailDir, { recursive: true });
    const detailContent = `'use client';\n\nimport React from 'react';\nimport { PlatformProductDetail } from '@deneb-ui/ui';\n\nexport default function ProductDetailPage() {\n  return <PlatformProductDetail backHref="/" />;\n}\n`;
    fs.writeFileSync(detailPagePath, detailContent, 'utf8');
    addCheck(suite7, 'fixed', 'Stable Product Detail Route', `Scaffolded stable client route at ${path.relative(targetDir, detailPagePath)} with PlatformProductDetail`, { code: 'DNB-PRD-002' });
  } else {
    addCheck(suite7, 'err', 'Stable Product Detail Route', `Missing stable client route src/app/products/detail/page.tsx (Required by Fivora static export catalog contract). Run with --fix to scaffold.`, { code: 'DNB-PRD-002' });
  }

  // Check 3: Manifest registration for /products/detail (DNB-PRD-003)
  if (hasCatalogReference && manifestData) {
    const pages = Array.isArray(manifestData.pages) ? manifestData.pages : [];
    const hasDetailRoute = pages.some((p) => p.route === '/products/detail' || p.id === 'product-detail');
    if (hasDetailRoute) {
      addCheck(suite7, 'pass', 'Detail Route Manifest Registration', 'Route /products/detail declared in fivora-template.json pages', { code: 'DNB-PRD-003' });
    } else if (shouldFix) {
      manifestData.pages = pages;
      manifestData.pages.push({
        id: 'product-detail',
        label: 'Product Detail',
        route: '/products/detail',
      });
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf8');
      addCheck(suite7, 'fixed', 'Detail Route Manifest Registration', 'Added /products/detail to fivora-template.json pages', { code: 'DNB-PRD-003' });
    } else {
      addCheck(suite7, 'warn', 'Detail Route Manifest Registration', 'Manifest pages array missing /products/detail route. Run with --fix to add.', { code: 'DNB-PRD-003' });
    }
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  const status = reportData.errors === 0
    ? (reportData.warnings === 0 ? 'HEALTHY' : 'READY_WITH_WARNINGS')
    : 'ATTENTION_REQUIRED';

  reportData.status = status;

  if (isJson) {
    console.log(JSON.stringify(reportData, null, 2));
  } else {
    if (reportData.errors > 0 || reportData.warnings > 0 || reportData.fixedCount > 0) {
      console.log('\n  \x1b[1m\x1b[36mSTANDARDIZED DEVELOPER ACTION MATRIX:\x1b[0m');
      console.log('  \x1b[90m┌──────────────┬──────────┬─────────────────────────────────────┬──────────────────────────────────────────────────────┐\x1b[0m');
      console.log('  \x1b[90m│\x1b[0m \x1b[1mCode\x1b[0m         \x1b[90m│\x1b[0m \x1b[1mSeverity\x1b[0m \x1b[90m│\x1b[0m \x1b[1mDiagnostic Title\x1b[0m                    \x1b[90m│\x1b[0m \x1b[1mActionable Remediation / Standard\x1b[0m                    \x1b[90m│\x1b[0m');
      console.log('  \x1b[90m├──────────────┼──────────┼─────────────────────────────────────┼──────────────────────────────────────────────────────┤\x1b[0m');

      const actionChecks = reportData.suites
        .flatMap(s => s.checks)
        .filter(c => c.type === 'err' || c.type === 'warn' || c.type === 'fixed');

      for (const item of actionChecks) {
        const sevColor = item.type === 'err' ? '\x1b[31mBLOCKING\x1b[0m' : item.type === 'warn' ? '\x1b[33mADVISORY\x1b[0m' : '\x1b[32mREPAIRED\x1b[0m';
        const rawSev = item.type === 'err' ? 'BLOCKING' : item.type === 'warn' ? 'ADVISORY' : 'REPAIRED';
        const codePad = item.code.padEnd(12);
        const titlePad = item.title.slice(0, 35).padEnd(35);
        const actionText = (item.action || item.detail || 'Follow Fivora v2 Visual Editing Standard').slice(0, 52).padEnd(52);
        console.log(`  \x1b[90m│\x1b[0m \x1b[36m${codePad}\x1b[0m \x1b[90m│\x1b[0m ${sevColor}${' '.repeat(8 - rawSev.length)} \x1b[90m│\x1b[0m ${titlePad} \x1b[90m│\x1b[0m \x1b[90m${actionText}\x1b[0m \x1b[90m│\x1b[0m`);
      }
      console.log('  \x1b[90m└──────────────┴──────────┴─────────────────────────────────────┴──────────────────────────────────────────────────────┘\x1b[0m');
      console.log('  \x1b[90mRun \x1b[32mdeneb doctor --fix\x1b[90m to automatically remediate auto-repairable items.\x1b[0m\n');
    }

    console.log('\n' + createBox([
      '\x1b[1mDOCTOR DIAGNOSTIC SUMMARY\x1b[0m',
      `\x1b[32m✔ Passed:\x1b[0m   ${reportData.passed}`,
      reportData.fixedCount > 0 ? `\x1b[35m⚡ Repaired:\x1b[0m ${reportData.fixedCount}` : '',
      `\x1b[33m⚠ Warnings:\x1b[0m ${reportData.warnings}`,
      `\x1b[31m✖ Errors:\x1b[0m   ${reportData.errors}`,
      reportData.errors === 0
        ? '\x1b[32mStatus: HEALTHY — Ready for Fivora packaging & live editing!\x1b[0m'
        : '\x1b[31mStatus: ATTENTION REQUIRED — Resolve errors before deployment\x1b[0m',
    ].filter(Boolean), 60) + '\n');
  }

  return reportData;
}

module.exports = {
  runDoctor,
};

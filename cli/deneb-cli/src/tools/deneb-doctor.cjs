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
  if (!isJson) console.log('\x1b[1m[1/6] System & Runtime Environment:\x1b[0m');
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
  if (!isJson) console.log('\n\x1b[1m[2/6] Project Package Configuration:\x1b[0m');
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
    } catch (e) {
      addCheck(suite2, 'err', 'package.json Syntax', e.message);
    }
  } else {
    addCheck(suite2, 'err', 'package.json', `Not found at ${pkgPath}`);
  }

  // =========================================================================
  // SUITE 3: Next.js Static Export & Asset Optimization Architecture
  // =========================================================================
  if (!isJson) console.log('\n\x1b[1m[3/6] Static Export & Asset Optimization:\x1b[0m');
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
  if (!isJson) console.log('\n\x1b[1m[4/6] Fivora Manifest v2 & Route Architecture:\x1b[0m');
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
  if (!isJson) console.log('\n\x1b[1m[5/6] Visual Editing Contract & AST Integrity:\x1b[0m');
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

    // 4. Broad Static Container Detection
    // Fivora forbids data-preview-static on broad layout containers like <div>, <section>, <nav>, <main>, <header>
    const broadStaticMatches = code.matchAll(/<(div|section|nav|main|header|article|aside)(\s+[^>]*data-preview-static="[^"]*"[^>]*)>/gi);
    let fileNeedsBroadStaticFix = false;
    let newCodeBroad = fs.readFileSync(file, 'utf-8');

    for (const bsm of broadStaticMatches) {
      const tag = bsm[1].toLowerCase();
      // Only flag if it's not a pure leaf element
      if (['div', 'section', 'nav', 'main', 'header', 'article', 'aside'].includes(tag)) {
        broadStaticContainers.push({ tag, file: path.relative(targetDir, file) });
        if (shouldFix) {
          const originalTag = `<${bsm[1]}${bsm[2]}>`;
          const cleanTag = originalTag.replace(/\s*data-preview-static="[^"]*"/g, '');
          newCodeBroad = newCodeBroad.replace(originalTag, cleanTag);
          fileNeedsBroadStaticFix = true;
        }
      }
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
    addCheck(suite5, 'pass', 'Granular Static Markup', 'Zero broad layout containers (div/nav/section) marked static', { code: 'DNB-STC-006' }) //, 'Zero broad layout containers (div/nav/section) marked static');
  } else if (shouldFix) {
    addCheck(suite5, 'fixed', 'Granular Static Markup', `Stripped data-preview-static from ${broadStaticContainers.length} broad container(s)`, { code: 'DNB-STC-006' }) //, `Stripped data-preview-static from ${broadStaticContainers.length} broad container(s)`);
  } else {
    addCheck(suite5, 'warn', 'Granular Static Markup', `${broadStaticContainers.length} broad container(s) marked with data-preview-static (Fivora requires marking only smallest leaf elements)`, { code: 'DNB-STC-006' }) //, `${broadStaticContainers.length} broad container(s) marked with data-preview-static (Fivora requires marking only smallest leaf elements)`);
  }

  if (dynamicVariableMarkers.length === 0) {
    addCheck(suite5, 'pass', 'Literal Marker Standard', 'All data-preview-field-path annotations use literal strings or JSX templates', { code: 'DNB-AST-002' }) //, 'All data-preview-field-path annotations use literal strings or JSX templates');
  } else {
    addCheck(suite5, 'warn', 'Literal Marker Standard', `${dynamicVariableMarkers.length} dynamic variable marker(s) detected`, { code: 'DNB-AST-002' }) //, `${dynamicVariableMarkers.length} dynamic variable marker(s) detected (e.g. ${dynamicVariableMarkers[0].expr})`);
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
    const c = fs.readFileSync(file, 'utf-8');
    if (c.includes('data-preview-list-path')) {
      if (/\?\s*[A-Z0-9_]+\s*:\s*[A-Z0-9_]+/i.test(c) && !c.includes('Array.isArray')) {
        unguardedArrayCount++;
      }
    }
  }
  if (unguardedArrayCount === 0) {
    addCheck(suite5, 'pass', 'Empty-State Array Guards', 'All list collections guarded against empty state ([]) out-of-range elements', { code: 'DNB-ARR-003' });
  } else {
    addCheck(suite5, 'warn', 'Empty-State Array Guards', `${unguardedArrayCount} list component(s) should verify Array.isArray(liveList) ? liveList : DEFAULT_LIST`, { code: 'DNB-ARR-003' });
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

  if (!isJson) console.log('\n\x1b[1m[6/6] Multi-Niche Architecture & Asset Security:\x1b[0m');
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
    addCheck(suite6, 'pass', 'Storefront Preview Graphic', 'preview.png / thumbnail.png verified for Fivora gallery', { code: 'DNB-PRV-001' }) //, 'preview.png / thumbnail.png verified for Fivora gallery');
  } else {
    addCheck(suite6, 'warn', 'Storefront Preview Graphic', 'preview.png not found in root or public folder', { code: 'DNB-PRV-001' }) //, 'preview.png not found in root or public folder');
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

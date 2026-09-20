'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'deneb-scaffold-'));
const bin = path.join(rootDir, 'packages', 'create-template', 'bin', 'index.js');

console.log(`Scaffolding smoke template into ${dest}`);
const result = spawnSync(process.execPath, [bin, dest, '--skip-install', '--theme=dual'], {
  cwd: rootDir,
  stdio: 'inherit',
});
if (result.status !== 0) {
  console.error('create-template exited with a non-zero status');
  process.exit(result.status || 1);
}

const layoutPath = path.join(dest, 'src', 'app', 'layout.tsx');
const fontsCssPath = path.join(dest, 'src', 'fonts', 'deneb-fonts.css');
const layout = fs.readFileSync(layoutPath, 'utf8');

const checks = [
  [fs.existsSync(fontsCssPath), `missing ${fontsCssPath}`],
  [layout.includes("import '../fonts/deneb-fonts.css'") || layout.includes('import "../fonts/deneb-fonts.css"'), 'layout must import ../fonts/deneb-fonts.css'],
  [!layout.includes("import './fonts/deneb-fonts.css'"), 'layout must not use the stale ./fonts import'],
  [layout.includes('suppressHydrationWarning'), 'layout must set suppressHydrationWarning on html/body'],
  [fs.existsSync(path.join(dest, 'fivora-template.json')), 'missing fivora-template.json'],
  [fs.existsSync(path.join(dest, 'src', 'data', 'site-data.json')), 'missing site-data.json'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error('Scaffold smoke test failed:\n- ' + failed.join('\n- '));
  process.exit(1);
}

console.log('✔ create-template scaffold smoke test passed');

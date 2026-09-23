'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '.npm',
  '.pnpm-store',
  '.vercel',
  '.output',
  '.deneb',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
  '__macosx',
]);

function isIgnoredDirName(name) {
  const lower = String(name || '').toLowerCase();
  if (IGNORE_DIRS.has(lower)) return true;
  if (lower.startsWith('.deneb-backup')) return true;
  return false;
}

function isSecretFile(filename) {
  const lower = String(filename || '').toLowerCase();
  return (
    lower.startsWith('.env') ||
    lower.endsWith('.pem') ||
    lower.endsWith('.key') ||
    lower === 'id_rsa' ||
    lower === 'credentials.json' ||
    lower === '.npmrc'
  );
}

function isSourceFile(filename) {
  return /\.(tsx|jsx|ts|js|mjs|cjs)$/.test(filename) && !filename.endsWith('.d.ts');
}

function isJsxFile(filename) {
  return /\.(tsx|jsx)$/.test(filename);
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function shortHash(value, length = 12) {
  return sha1(value).slice(0, length);
}

function walkFiles(dir, options = {}, acc = []) {
  if (!dir || !fs.existsSync(dir)) return acc;
  const include = options.include || (() => true);
  const follow = options.followDirectories !== false;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!follow || isIgnoredDirName(entry.name)) continue;
      walkFiles(fullPath, options, acc);
    } else if (entry.isFile()) {
      if (isSecretFile(entry.name)) continue;
      if (include(fullPath, entry.name)) acc.push(fullPath);
    }
  }
  return acc;
}

function detectPackageManager(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'bun.lock')) || fs.existsSync(path.join(projectDir, 'bun.lockb'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectDir, 'package-lock.json'))) return 'npm';
  return 'npm';
}

function findFirstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function rel(projectDir, filePath) {
  return path.relative(projectDir, filePath).replace(/\\/g, '/');
}

function homeDenebDir() {
  if (process.env.DENEB_HOME) {
    return path.resolve(process.env.DENEB_HOME);
  }
  return path.join(os.homedir(), '.deneb');
}

function copyFilePreserve(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function deepMerge(target, source) {
  if (!isPlainObject(source)) return target;
  const output = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else if (output[key] === undefined) {
      output[key] = value;
    }
  }
  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPosix(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

module.exports = {
  IGNORE_DIRS,
  isIgnoredDirName,
  isSecretFile,
  isSourceFile,
  isJsxFile,
  readJsonSafe,
  writeJson,
  sha1,
  shortHash,
  walkFiles,
  detectPackageManager,
  findFirstExisting,
  rel,
  homeDenebDir,
  copyFilePreserve,
  deepMerge,
  isPlainObject,
  toPosix,
};

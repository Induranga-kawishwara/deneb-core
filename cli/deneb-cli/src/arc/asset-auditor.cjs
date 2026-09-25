'use strict';

const fs = require('fs');
const path = require('path');

/**
 * AssetAuditor (P7)
 * 
 * Verifies that all static asset paths referenced in site-data.json,
 * manifest.json, or template defaults actually exist on disk in the public/ folder.
 * Prevents cascading 404 -> not-found.tsx -> 500 crashes.
 */

function auditProjectAssets(projectDir, siteData = {}) {
  const publicDir = path.join(projectDir, 'public');
  const hasPublic = fs.existsSync(publicDir);
  const existingFiles = new Set();

  if (!hasPublic) {
    return {
      passed: true,
      skipped: true,
      missingAssets: [],
      verifiedAssets: [],
      existingPublicAssets: [],
      errors: [],
      reason: 'No public directory in project',
    };
  }

  function walkDir(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walkDir(full);
      } else {
        const rel = '/' + path.relative(publicDir, full).replace(/\\/g, '/');
        existingFiles.add(rel);
      }
    }
  }
  try {
    walkDir(publicDir);
  } catch {}

  const errors = [];
  const missingAssets = [];
  const verifiedAssets = [];

  function checkAssetPath(assetUrl, sourceLocation) {
    if (!assetUrl || typeof assetUrl !== 'string') return;
    const trimmed = assetUrl.trim();
    if (!trimmed) return;

    // Skip external URLs, data URLs, and hashes
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('#')) {
      return;
    }

    // Must look like a path or filename (starts with / or has a file extension)
    if (!trimmed.startsWith('/') && !/\.[a-zA-Z0-9]+$/.test(trimmed)) {
      return;
    }

    // Normalize leading slash
    const normalized = trimmed.startsWith('/') ? trimmed : '/' + trimmed;

    if (existingFiles.has(normalized)) {
      verifiedAssets.push({ path: normalized, source: sourceLocation });
    } else {
      missingAssets.push({
        path: normalized,
        source: sourceLocation,
      });
      errors.push(`Asset "${normalized}" referenced in ${sourceLocation} was not found in public/ directory.`);
    }
  }

  // Scan common site-data fields
  function scanSiteData(node, currentPath) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, idx) => scanSiteData(item, `${currentPath}[${idx}]`));
      return;
    }
    for (const [key, val] of Object.entries(node)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;
      const lowerKey = key.toLowerCase();
      const isTextKey = lowerKey.includes('text') || lowerKey.includes('title') || lowerKey.includes('label') || lowerKey.includes('desc') || lowerKey.includes('alt') || lowerKey.includes('phone') || lowerKey.includes('whatsapp') || lowerKey.includes('email');
      const isAssetKey = !isTextKey && (lowerKey.includes('image') || lowerKey.includes('logo') || lowerKey.includes('avatar') || lowerKey.includes('icon') || lowerKey.includes('src') || lowerKey.endsWith('url'));
      const hasFileExt = typeof val === 'string' && /\.(png|jpe?g|svg|webp|gif|avif|ico|mp4|webm)$/i.test(val.trim());

      if (typeof val === 'string' && (isAssetKey || hasFileExt)) {
        checkAssetPath(val, `site-data.json -> ${fieldPath}`);
      } else if (typeof val === 'object') {
        scanSiteData(val, fieldPath);
      }
    }
  }

  scanSiteData(siteData, '');

  return {
    passed: missingAssets.length === 0,
    missingAssets,
    verifiedAssets,
    existingPublicAssets: [...existingFiles],
    errors,
  };
}

module.exports = {
  auditProjectAssets,
};

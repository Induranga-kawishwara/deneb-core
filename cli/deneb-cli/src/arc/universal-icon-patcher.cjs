'use strict';

const fs = require('fs');
const path = require('path');

// Helper to ensure nested object path exists
function setDeep(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  if (cur[pathArr[pathArr.length - 1]] === undefined) {
    cur[pathArr[pathArr.length - 1]] = value;
  }
}

function patchUniversalIcons(projectDir, dryRun = false, log = () => {}) {
  if (!projectDir || typeof projectDir !== 'string' || !fs.existsSync(projectDir)) {
    return;
  }

  const siteDataPath = path.join(projectDir, 'data', 'site-data.json');
  if (!fs.existsSync(siteDataPath)) {
    return;
  }

  let siteData;
  try {
    siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
  } catch {
    return;
  }

  if (!siteData.content) siteData.content = {};
  if (!siteData.content.common) siteData.content.common = {};

  setDeep(siteData.content, ['common', 'whatsapp', 'copyIcon'], 'copy');
  setDeep(siteData.content, ['common', 'whatsapp', 'icon'], 'message-circle');
  setDeep(siteData.content, ['common', 'search', 'searchIcon'], 'search');

  if (!dryRun) {
    try {
      fs.writeFileSync(siteDataPath, JSON.stringify(siteData, null, 2), 'utf8');
      log('[universal-icons] Registered common icon keys in site-data.json');
    } catch (err) {
      log('[universal-icons] Warning: failed to save site-data.json: ' + err.message);
    }
  }
}

module.exports = {
  patchUniversalIcons,
};

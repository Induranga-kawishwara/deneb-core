#!/usr/bin/env node
/**
 * merge-platform-contract.js
 * ──────────────────────────
 * Merges Fivora platform-controlled controlOnlyPaths into fivora-template.json
 * BEFORE every validate and build run.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The Fivora strict visual-editing contract requires every field in site-data.json
 * to have either a rendered data-preview-field-path marker OR appear in
 * controlOnlyPaths. Platform-managed fields (AI intake, system keys) must be
 * controlOnly but are NOT template-specific — they are the same for every template.
 *
 * Without this script:
 *   - Every template manually copy-pastes the same 25+ controlOnlyPaths entries
 *   - When Fivora adds a new __fivoraIntake field, EVERY template breaks
 *   - AI agents keep re-adding forbidden entries
 *
 * With this script:
 *   - fivora-template.json stays lean (only template-specific paths)
 *   - Update PLATFORM_PATHS here → all templates stay in sync
 *   - Zero manual maintenance per template
 *
 * USAGE: already wired into package.json:
 *   "validate": "node scripts/merge-platform-contract.js && fivora validate"
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ─── Platform-Controlled Paths ───────────────────────────────────────────────
// Fivora PLATFORM writes these to site-data.json. Templates NEVER render them
// as inline editable HTML — they are managed via the Fivora control panel.
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_PATHS = [
  // AI Intake — written by Website Agent during onboarding
  '__fivoraIntake.tone',
  '__fivoraIntake.outputLanguage',
  '__fivoraIntake.businessSummary',
  '__fivoraIntake.additionalBusinessDetails',
  '__fivoraIntake.referenceWebsiteUrl',
  // Additional Pages — platform manages routing, template renders label only
  'additionalPages[*].id',
  'additionalPages[*].route',
  // Common fields used as href/tel logic, not rendered text
  'common.currency',
  'common.whatsappNumber',
  'common.whatsapp',
  'common.email',
  'common.address',
  'common.contactNumber',
  'common.openingHours',
  'common.newsletterTitle',
  'common.newsletterDescription',
  // Contact fields used as action links (href attributes)
  'contact.contactNumber',
  'contact.googleMapLink',
  // Product system fields
  'products[*].id',
  'products[*].isAvailable',
  'products[*].measurement',
  'products[*].unit',
  // List item system keys
  'testimonials[*].id',
  'categories[*].slug',
  'services[*].id',
  'products[*].currency',
  'about.collageImages[*].id',
];

const manifestPath = path.resolve(__dirname, '..', 'fivora-template.json');
if (!fs.existsSync(manifestPath)) {
  console.error('merge-platform-contract: fivora-template.json not found at', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.visualEditing) manifest.visualEditing = {};

const siteDataPath = path.resolve(__dirname, '..', manifest.siteDataFile || 'src/data/site-data.json');
let siteData = {};
if (fs.existsSync(siteDataPath)) {
  try {
    siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
  } catch {}
}

function pathExistsInContent(content, p) {
  if (!content || typeof content !== 'object') return false;
  const segments = p.split('.');
  let current = [content];
  for (const seg of segments) {
    const isList = seg.endsWith('[*]');
    const key = isList ? seg.slice(0, -3) : seg;
    const next = [];
    for (const item of current) {
      if (!item || typeof item !== 'object') continue;
      const val = item[key];
      if (val === undefined) continue;
      if (isList) {
        if (Array.isArray(val)) {
          next.push(...val);
        }
      } else {
        next.push(val);
      }
    }
    if (next.length === 0) return false;
    current = next;
  }
  return true;
}

function pathExistsInSchema(schema, p) {
  if (!schema || !Array.isArray(schema.sections)) return false;
  const canonical = p.replace(/\[\d+\]/g, '[*]');

  function checkNode(node, currentPath) {
    if (currentPath === canonical) return true;
    if (node.type === 'object' && Array.isArray(node.fields)) {
      for (const field of node.fields) {
        if (checkNode(field, `${currentPath}.${field.key}`)) return true;
      }
    }
    if (node.type === 'list') {
      const itemPath = `${currentPath}[*]`;
      if (itemPath === canonical) return true;
      if (node.itemField && itemPath === canonical) return true;
      if (Array.isArray(node.fields)) {
        for (const field of node.fields) {
          if (checkNode(field, `${itemPath}.${field.key}`)) return true;
        }
      }
    }
    return false;
  }

  for (const section of schema.sections) {
    if (checkNode(section, section.path)) return true;
  }
  return false;
}

function isKnownPath(p) {
  return (
    pathExistsInContent(siteData.content, p) ||
    pathExistsInContent(siteData, p) ||
    pathExistsInSchema(manifest.editorSchema, p)
  );
}

const existing = Array.isArray(manifest.visualEditing.controlOnlyPaths)
  ? manifest.visualEditing.controlOnlyPaths.filter(isKnownPath)
  : [];

const relevantPlatformPaths = PLATFORM_PATHS.filter(isKnownPath);
const merged = [...new Set([...relevantPlatformPaths, ...existing])];
manifest.visualEditing.controlOnlyPaths = merged;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`merge-platform-contract: ${merged.length} platform paths retained`);



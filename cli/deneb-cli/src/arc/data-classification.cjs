'use strict';

const PLATFORM_CONTRACT = require('../platform/platform-contract.json');

/**
 * Deneb ARC v3 — Content vs. Runtime/Commerce Data Classification
 *
 * Enforces strict separation between merchant-editable marketing content
 * and protected runtime/commerce/platform data.
 */
const DATA_CLASSIFICATION = {
  CONTENT: 'CONTENT',
  COMMERCE_CONTENT: 'COMMERCE_CONTENT',
  PLATFORM_CONTROLLED: 'PLATFORM_CONTROLLED',
  RUNTIME_DATA: 'RUNTIME_DATA',
  COMPUTED_DATA: 'COMPUTED_DATA',
  DECORATIVE: 'DECORATIVE',
  INTERACTION_STATE: 'INTERACTION_STATE',
};

const PLATFORM_CONTROLLED_KEYS = new Set([
  'id', 'productid', 'orderid', 'userid', 'categoryid', 'slug', 'categoryslug',
  'currency', 'currencycode', 'isavailable', 'measurement', 'unit',
  'whatsappnumber', 'whatsapp', 'email', 'address', 'contactnumber',
  'openinghours', 'googlemaplink', 'token', 'authtoken', 'sessionid',
]);

const INTERACTION_STATE_PATTERNS = [
  /^(is)?open$/i,
  /^(is)?closed$/i,
  /^(is)?expanded$/i,
  /^(is)?active$/i,
  /^(is)?loading$/i,
  /^(is)?submitting$/i,
  /^(is)?hovered$/i,
  /^activeTab/i,
  /^selected(Index|Tab|Item)?/i,
  /^menuOpen/i,
  /^drawerOpen/i,
  /^modalOpen/i,
  /^isOpen/i,
];

const COMPUTED_PATTERNS = [
  /\.reduce\(/i,
  /\.filter\(/i,
  /formatPrice/i,
  /calculate/i,
  /\b(subtotal|taxAmount|shippingFee|grandTotal)\b/i,
  /\bprice\s*\*\s*qty\b/i,
  /\bitem(s)?\.length\b/i,
];

const RUNTIME_DATA_PATTERNS = [
  /\b(user|session|auth)\.(email|name|id|token)\b/i,
  /\border\.(id|total|status|items)\b/i,
  /\bcart\.(items|total|subtotal|count)\b/i,
  /\bparams\.[a-zA-Z0-9_]+\b/i,
  /\bsearchParams\.[a-zA-Z0-9_]+\b/i,
];

const DECORATIVE_LITERALS = new Set([
  '|', '/', '•', '-', '–', '—', '>', '<', '»', '«', '→', '←', '•', '...', '*', '•'
]);

function wildcardMatch(path, pattern) {
  const normPath = String(path).replace(/\[\d+\]/g, '[*]');
  return normPath === pattern;
}

function isPlatformControlledPath(path) {
  if (!path) return false;
  const controlled = PLATFORM_CONTRACT.platformControlledPaths || [];
  return controlled.some((pattern) => {
    if (pattern.includes('[*]')) return wildcardMatch(path, pattern);
    return path === pattern;
  });
}

/**
 * Classifies a candidate node or expression into one of the 7 strict data tiers.
 */
function classifyDataCandidate(candidate, context = {}) {
  const rawKey = String(
    candidate.propName ||
    candidate.field ||
    context.fieldPath ||
    candidate.extra?.propName ||
    candidate.extra?.key ||
    ''
  ).toLowerCase();

  const valueStr = String(candidate.value || candidate.label || '');
  const combinedContext = `${candidate.tag || ''} ${candidate.kind || ''} ${rawKey} ${valueStr}`.toLowerCase();

  // 1. Check Platform-Controlled (Fivora reserved invariants)
  if (
    isPlatformControlledPath(candidate.field || context.fieldPath) ||
    PLATFORM_CONTROLLED_KEYS.has(rawKey) ||
    /^(order\.id|product\.id|user\.id|category\.slug)$/i.test(rawKey)
  ) {
    return {
      classification: DATA_CLASSIFICATION.PLATFORM_CONTROLLED,
      editable: false,
      reason: 'Field is reserved by Fivora platform control contract',
      isPlatformControlled: true,
    };
  }

  // 2. Check Interaction State (UI toggles, modals, drawers)
  if (INTERACTION_STATE_PATTERNS.some((re) => re.test(rawKey) || re.test(valueStr))) {
    return {
      classification: DATA_CLASSIFICATION.INTERACTION_STATE,
      editable: false,
      reason: 'Interactive UI state must be preserved without CMS binding',
      isPlatformControlled: false,
    };
  }

  // 3. Check Computed Data
  if (COMPUTED_PATTERNS.some((re) => re.test(valueStr) || re.test(rawKey))) {
    return {
      classification: DATA_CLASSIFICATION.COMPUTED_DATA,
      editable: false,
      reason: 'Computed calculations must not be hardcoded or converted to static CMS data',
      isPlatformControlled: false,
    };
  }

  // 4. Check Runtime Business Data (user email, cart items, order total)
  if (RUNTIME_DATA_PATTERNS.some((re) => re.test(valueStr) || re.test(rawKey))) {
    return {
      classification: DATA_CLASSIFICATION.RUNTIME_DATA,
      editable: false,
      reason: 'Runtime session and cart state must remain dynamic',
      isPlatformControlled: false,
    };
  }

  // 5. Check Decorative chrome
  if (
    DECORATIVE_LITERALS.has(valueStr.trim()) ||
    candidate.kind === 'decoration' ||
    /divider|separator|breadcrumb-slash/i.test(combinedContext)
  ) {
    return {
      classification: DATA_CLASSIFICATION.DECORATIVE,
      editable: false,
      reason: 'Decorative chrome and glyph separators remain static',
      isPlatformControlled: false,
    };
  }

  // 6. Check Commerce Content
  if (/product(name|title|desc|image)?|category(name|title)?|catalog|collection/i.test(combinedContext)) {
    return {
      classification: DATA_CLASSIFICATION.COMMERCE_CONTENT,
      editable: true,
      reason: 'Commerce marketing content eligible for template binding',
      isPlatformControlled: false,
    };
  }

  // 7. General Marketing Content
  return {
    classification: DATA_CLASSIFICATION.CONTENT,
    editable: true,
    reason: 'Static marketing text and media bound to siteData',
    isPlatformControlled: false,
  };
}

function isEditableClassification(classification) {
  return classification === DATA_CLASSIFICATION.CONTENT || classification === DATA_CLASSIFICATION.COMMERCE_CONTENT;
}

module.exports = {
  DATA_CLASSIFICATION,
  classifyDataCandidate,
  isEditableClassification,
  isPlatformControlledPath,
};

'use strict';

const fs = require('fs');
const path = require('path');
const { writeJson, readJsonSafe, homeDenebDir, shortHash } = require('./fs-utils.cjs');
const { ARC_VERSION } = require('./version.cjs');

const RULE_STATES = ['observed', 'candidate', 'experimental', 'verified', 'stable', 'deprecated'];

function experiencePath(projectDir) {
  return path.join(projectDir, '.deneb', 'learning', 'experiences.json');
}

function localStorePath() {
  return path.join(homeDenebDir(), 'arc', 'experiences.json');
}

function fingerprintStorePath() {
  return path.join(homeDenebDir(), 'arc', 'fingerprints.json');
}

function loadJsonArray(filePath) {
  const data = readJsonSafe(filePath, []);
  return Array.isArray(data) ? data : [];
}

function appendExperience(storeFile, record) {
  const all = loadJsonArray(storeFile);
  all.push(record);
  writeJson(storeFile, all.slice(-500));
}

function recordExperience({ projectDir, profile, plan, validation, outcome, telemetry }) {
  if (telemetry && telemetry !== 'off') {
    // Network upload is intentionally unimplemented. Local persistence only.
  }
  const learningOutcome = honestOutcome(validation, outcome);
  const records = [];
  for (const file of plan.files || []) {
    for (const t of file.transformations || []) {
      records.push({
        engineVersion: ARC_VERSION,
        framework: profile.framework,
        frameworkVersion: profile.frameworkVersion,
        structuralFingerprint: t.fingerprint || shortHash(`${t.tag}:${t.operation}`),
        libraries: [...(profile.componentLibraries || []), ...(profile.animationLibraries || [])],
        transformationType: mapOperation(t.operation),
        recipeId: t.recipeId || null,
        confidenceBefore: t.confidence,
        validation: {
          syntaxPassed: Boolean(validation.syntaxPassed),
          typecheckPassed: validation.typecheckPassed,
          buildPassed: validation.buildPassed,
          contractPassed: Boolean(validation.contractPassed),
          fivoraContractPassed: Boolean(validation.fivoraContractPassed),
          emptyStatePassed: validation.emptyStatePassed !== false,
          visualPassed: validation.visualPassed,
          idempotencyPassed: validation.idempotencyPassed,
        },
        outcome: learningOutcome,
        anonymizedFeatures: {
          tag: t.tag,
          operation: t.operation,
          section: t.section,
          decision: t.decision,
        },
      });
    }
  }

  try {
    fs.mkdirSync(path.dirname(experiencePath(projectDir)), { recursive: true });
    const local = loadJsonArray(experiencePath(projectDir));
    writeJson(experiencePath(projectDir), [...local, ...records].slice(-400));
  } catch {
    // Project-local write is best-effort.
  }

  try {
    fs.mkdirSync(path.dirname(localStorePath()), { recursive: true });
    const global = loadJsonArray(localStorePath());
    writeJson(localStorePath(), [...global, ...records].slice(-800));
  } catch {
    // Home directory may be read-only in some CI sandboxes.
  }

  updateFingerprintStats(records);
  return records;
}

function honestOutcome(validation, outcome) {
  if (outcome === 'rolled-back') return 'rolled-back';
  const passed =
    validation &&
    validation.syntaxPassed !== false &&
    validation.contractPassed !== false &&
    validation.fivoraContractPassed !== false &&
    validation.emptyStatePassed !== false &&
    !(validation.uncoveredVisibleText > 0);
  if (!passed) return 'failure';
  if (outcome && outcome !== 'success' && outcome !== 'dry-run') return 'failure';
  return outcome === 'dry-run' ? 'dry-run' : 'success';
}

const BASELINE_VERIFIED_FINGERPRINTS = {
  'leaf-static-marker': { id: 'leaf-static-marker', state: 'verified', successfulApplications: 50, failedApplications: 0 },
  'composite-collection-key': { id: 'composite-collection-key', state: 'verified', successfulApplications: 50, failedApplications: 0 },
  'empty-state-array-guard': { id: 'empty-state-array-guard', state: 'verified', successfulApplications: 50, failedApplications: 0 },
  'action-label-split': { id: 'action-label-split', state: 'verified', successfulApplications: 50, failedApplications: 0 },
  'section-overflow-clip': { id: 'section-overflow-clip', state: 'verified', successfulApplications: 50, failedApplications: 0 },
};

function loadFingerprintBoost(fingerprint) {
  if (!fingerprint) {
    return { boost: 0, skip: false, state: null };
  }
  try {
    const store = readJsonSafe(fingerprintStorePath(), { fingerprints: {} }) || { fingerprints: {} };
    const entry = store.fingerprints?.[fingerprint] || BASELINE_VERIFIED_FINGERPRINTS[fingerprint];
    if (!entry) return { boost: 0, skip: false, state: null };
    if (entry.state === 'deprecated') {
      return { boost: 0, skip: true, state: 'deprecated' };
    }
    if (entry.state === 'verified') {
      return { boost: 0.08, skip: false, state: 'verified' };
    }
    if (entry.state === 'candidate') {
      return { boost: 0.03, skip: false, state: 'candidate' };
    }
    return { boost: 0, skip: false, state: entry.state || 'observed' };
  } catch {
    return { boost: 0, skip: false, state: null };
  }
}

function mapOperation(operation) {
  switch (operation) {
    case 'extract-text':
      return 'text-extraction';
    case 'extract-image':
    case 'extract-alt':
      return 'image-extraction';
    case 'extract-url':
      return 'url-extraction';
    case 'split-action-contract':
    case 'form-submit-action':
      return 'contract-split';
    case 'style-bind':
      return 'style-bind';
    case 'collection-conversion':
      return 'collection-conversion';
    default:
      return 'other';
  }
}

function updateFingerprintStats(records) {
  let store = readJsonSafe(fingerprintStorePath(), { fingerprints: {} });
  if (!store || typeof store !== 'object') store = { fingerprints: {} };
  store.fingerprints = store.fingerprints || {};
  for (const rec of records) {
    const id = rec.structuralFingerprint;
    if (!id) continue;
    const entry = store.fingerprints[id] || {
      id,
      state: 'observed',
      successfulApplications: 0,
      failedApplications: 0,
      libraries: rec.libraries,
    };
    if (rec.outcome === 'success') entry.successfulApplications++;
    if (rec.outcome === 'failure' || rec.outcome === 'rolled-back') entry.failedApplications++;
    entry.state = promoteState(entry);
    store.fingerprints[id] = entry;
  }
  try {
    writeJson(fingerprintStorePath(), store);
  } catch {
    // ignore
  }
}

function promoteState(entry) {
  const success = entry.successfulApplications || 0;
  const fail = entry.failedApplications || 0;
  if (fail >= 3 && fail > success) return 'deprecated';
  if (success >= 25 && fail === 0) return 'verified';
  if (success >= 5) return 'candidate';
  return entry.state && RULE_STATES.includes(entry.state) ? entry.state : 'observed';
}

function registryArchitecture() {
  return {
    enabled: false,
    defaultTelemetry: 'off',
    note: 'Global Pattern Registry is designed but not activated. Local JSON/SQLite-free stores are used until a deterministic corpus exists.',
    recommendedBackend: {
      database: 'PostgreSQL',
      optional: ['pgvector'],
      api: 'opt-in HTTPS registry',
      tables: [
        'engine_versions',
        'framework_profiles',
        'component_fingerprints',
        'transformation_patterns',
        'recipe_versions',
        'validation_results',
        'experience_records',
        'promotion_candidates',
        'known_failures',
      ],
    },
    privacy: {
      default: 'off',
      options: ['off', 'anonymous', 'enhanced'],
      neverUpload: ['.env', 'tokens', 'keys', 'customer content', 'full repositories'],
    },
  };
}

function redactSecrets(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/(api[_-]?key|token|secret|password|authorization)["']?\s*[:=]\s*["'][^"']+/gi, '$1=***')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '***REDACTED KEY***');
}

function recordEvaluatorFix({ projectDir, issueType, file, action, success = true }) {
  const record = {
    engineVersion: ARC_VERSION,
    type: 'evaluator-fix',
    timestamp: new Date().toISOString(),
    issueType,
    file,
    action,
    success: Boolean(success),
  };
  try {
    if (projectDir) {
      fs.mkdirSync(path.dirname(experiencePath(projectDir)), { recursive: true });
      const local = loadJsonArray(experiencePath(projectDir));
      writeJson(experiencePath(projectDir), [...local, record].slice(-400));
    }
  } catch {
    // ignore
  }
  try {
    fs.mkdirSync(path.dirname(localStorePath()), { recursive: true });
    const global = loadJsonArray(localStorePath());
    writeJson(localStorePath(), [...global, record].slice(-800));
  } catch {
    // ignore
  }
  return record;
}

module.exports = {
  recordExperience,
  recordEvaluatorFix,
  loadFingerprintBoost,
  registryArchitecture,
  redactSecrets,
  promoteState,
  honestOutcome,
  localStorePath,
  fingerprintStorePath,
  RULE_STATES,
};

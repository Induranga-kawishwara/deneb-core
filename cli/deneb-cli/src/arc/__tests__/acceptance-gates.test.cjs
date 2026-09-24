'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAcceptanceGates, ACCEPTANCE_GATES } = require('../acceptance-gates.cjs');

test('Acceptance Gates: all critical gates passing with >= 98% coverage yields CONVERSION_PASSED', () => {
  const result = evaluateAcceptanceGates({
    sourceAnalysis: { passed: true },
    astTransformation: { passed: true },
    typescriptValidation: { passed: true },
    buildSuccess: { passed: true },
    fivoraAudit: { passed: true },
    manifestValid: true,
    runtimeEditabilityScore: 99.2,
    collectionOpsPassed: true,
    imageEditingPassed: true,
    routeCoveragePassed: true,
    designPreservationScore: 99.0,
    controlOnlyValid: true,
    editabilityCoverage: 98.8,
  });

  assert.equal(result.passed, true);
  assert.equal(result.status, 'CONVERSION_PASSED');
  assert.equal(result.allCriticalPassed, true);
  assert.equal(Object.keys(result.gates).length, 12);
});

test('Acceptance Gates: critical gate failure yields CONVERSION_FAILED', () => {
  const result = evaluateAcceptanceGates({
    fivoraAudit: { passed: false }, // Critical gate failed
    runtimeEditabilityScore: 100,
    editabilityCoverage: 100,
  });

  assert.equal(result.passed, false);
  assert.equal(result.status, 'CONVERSION_FAILED');
  assert.equal(result.allCriticalPassed, false);
});

test('Acceptance Gates: sub-threshold coverage (< 98%) yields CONVERSION_INCOMPLETE', () => {
  const result = evaluateAcceptanceGates({
    sourceAnalysis: { passed: true },
    astTransformation: { passed: true },
    typescriptValidation: { passed: true },
    buildSuccess: { passed: true },
    fivoraAudit: { passed: true },
    manifestValid: true,
    runtimeEditabilityScore: 99.0,
    collectionOpsPassed: true,
    imageEditingPassed: true,
    routeCoveragePassed: true,
    designPreservationScore: 98.5,
    controlOnlyValid: true,
    editabilityCoverage: 95.5, // Sub-threshold
  });

  assert.equal(result.passed, false);
  assert.equal(result.status, 'CONVERSION_INCOMPLETE');
  assert.equal(result.allCriticalPassed, true);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ACCEPTANCE_GATES, evaluateAcceptanceGates } = require('../acceptance-gates.cjs');

test('fifteen-gates: evaluates all 15 gates and passes when all critical pass', () => {
  const allGateKeys = Object.keys(ACCEPTANCE_GATES);
  assert.equal(allGateKeys.length, 15, 'Must have exactly 15 acceptance gates');

  const evalResult = evaluateAcceptanceGates({
    sourceAnalysis: { passed: true },
    astTransformation: { passed: true },
    typescriptValidation: { passed: true },
    buildSuccess: { passed: true },
    fivoraAudit: { passed: true },
    manifestValid: true,
    runtimeEditabilityScore: 100,
    collectionOpsPassed: true,
    imageEditingPassed: true,
    routeCoveragePassed: true,
    designPreservationScore: 100,
    controlOnlyValid: true,
    assetIntegrityPassed: true,
    rscIntegrityPassed: true,
    consoleCleanlinessPassed: true,
    editabilityCoverage: 100,
  });

  assert.equal(evalResult.passed, true);
  assert.equal(evalResult.status, 'CONVERSION_PASSED');
  assert.equal(Object.keys(evalResult.gates).length, 15);
});

test('fifteen-gates: fails conversion if asset integrity or RSC integrity fails', () => {
  const failedAsset = evaluateAcceptanceGates({
    assetIntegrityPassed: false,
  });
  assert.equal(failedAsset.passed, false);
  assert.equal(failedAsset.status, 'CONVERSION_FAILED');

  const failedRsc = evaluateAcceptanceGates({
    rscIntegrityPassed: false,
  });
  assert.equal(failedRsc.passed, false);
  assert.equal(failedRsc.status, 'CONVERSION_FAILED');
});

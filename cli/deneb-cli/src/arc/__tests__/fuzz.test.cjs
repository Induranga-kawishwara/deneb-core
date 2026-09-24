'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MUTATION_TYPES,
  DEFAULT_SAMPLE_COMPONENT,
  applyMutation,
  generateFuzzCorpus,
  testMutationResilience,
  runFuzzHarness,
} = require('../fuzz-engine.cjs');

test('Fuzz Engine: applies individual AST mutations cleanly', () => {
  // 1. PROP_RENAME
  const renameResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'PROP_RENAME');
  assert.equal(renameResult.applied, true);
  assert.ok(renameResult.mutatedCode.includes('fuzzed_') || renameResult.mutatedCode !== DEFAULT_SAMPLE_COMPONENT);

  // 2. WRAP_FRAGMENT
  const fragmentResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'WRAP_FRAGMENT');
  assert.equal(fragmentResult.applied, true);
  assert.ok(fragmentResult.mutatedCode.includes('<>') && fragmentResult.mutatedCode.includes('</>'));

  // 3. WRAP_DIV
  const divResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'WRAP_DIV');
  assert.equal(divResult.applied, true);
  assert.ok(divResult.mutatedCode.includes('fuzzed-container-wrapper'));

  // 4. SPREAD_PROPS
  const spreadResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'SPREAD_PROPS');
  assert.equal(spreadResult.applied, true);
  assert.ok(spreadResult.mutatedCode.includes('...fuzzedProps'));

  // 5. CONDITIONAL_TERNARY
  const ternaryResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'CONDITIONAL_TERNARY');
  assert.equal(ternaryResult.applied, true);
  assert.ok(ternaryResult.mutatedCode.includes('isFuzzedConditionActive'));

  // 6. CONDITIONAL_LOGICAL
  const logicalResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'CONDITIONAL_LOGICAL');
  assert.equal(logicalResult.applied, true);
  assert.ok(logicalResult.mutatedCode.includes('showFuzzedContent &&'));

  // 7. INJECT_OPTIONAL_CHAIN
  const optionalResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'INJECT_OPTIONAL_CHAIN');
  assert.equal(optionalResult.applied, true);
  assert.ok(optionalResult.mutatedCode.includes('?.'));

  // 8. NEST_MEMBER_COLLECTION
  const nestResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'NEST_MEMBER_COLLECTION');
  assert.equal(nestResult.applied, true);
  assert.ok(nestResult.mutatedCode.includes('.map('));

  // 9. CORRUPT_SYNTAX
  const corruptResult = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'CORRUPT_SYNTAX');
  assert.equal(corruptResult.applied, true);
  assert.ok(corruptResult.mutatedCode.includes('MALFORMED_SYNTAX'));
});

test('Fuzz Engine: generateFuzzCorpus creates a full mutation suite', () => {
  const corpus = generateFuzzCorpus(DEFAULT_SAMPLE_COMPONENT);
  assert.equal(corpus.length, MUTATION_TYPES.length);

  for (const item of corpus) {
    assert.equal(item.applied, true);
    assert.notEqual(item.mutatedCode, DEFAULT_SAMPLE_COMPONENT);
    assert.ok(MUTATION_TYPES.includes(item.mutationType));
  }
});

test('Fuzz Engine: cleanly catches corrupt syntax without unhandled crash', () => {
  const corrupt = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'CORRUPT_SYNTAX');
  const result = testMutationResilience(corrupt.mutatedCode, 'CORRUPT_SYNTAX');

  assert.equal(result.crashed, false);
  assert.equal(result.resilient, true);
  assert.equal(result.status, 'PARSER_REJECTED_CLEANLY');
});

test('Fuzz Engine: verifies compiler resilience across structural mutations', () => {
  // Test spread props resilience
  const spread = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'SPREAD_PROPS');
  const spreadRes = testMutationResilience(spread.mutatedCode, 'SPREAD_PROPS');
  assert.equal(spreadRes.crashed, false);
  assert.equal(spreadRes.resilient, true);
  assert.equal(spreadRes.outputValidSyntax, true);

  // Test fragment wrapping resilience
  const frag = applyMutation(DEFAULT_SAMPLE_COMPONENT, 'WRAP_FRAGMENT');
  const fragRes = testMutationResilience(frag.mutatedCode, 'WRAP_FRAGMENT');
  assert.equal(fragRes.crashed, false);
  assert.equal(fragRes.resilient, true);
  assert.equal(fragRes.outputValidSyntax, true);
});

test('Fuzz Engine: runFuzzHarness executes end-to-end with 100% resilience score', () => {
  const report = runFuzzHarness(DEFAULT_SAMPLE_COMPONENT);

  assert.equal(report.totalMutations, MUTATION_TYPES.length);
  assert.equal(report.crashedCount, 0, 'Must have zero unhandled crashes');
  assert.equal(report.syntaxErrorsInOutput, 0, 'Must have zero syntax errors in output');
  assert.equal(report.resilienceScore, 100.0, 'Resilience score must be 100%');
  assert.equal(report.allResilient, true);
  assert.ok(report.results.length === MUTATION_TYPES.length);
});

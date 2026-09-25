'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TransformProof, ProofRegistry } = require('../transform-proof.cjs');

test('transform-proof: records valid proof object and verifies preconditions', () => {
  const proof = new TransformProof({
    type: 'TEXT_BIND',
    source: { file: 'Hero.tsx', loc: '42:6', tag: 'h1', originalText: 'Vanta Aero' },
    target: { path: 'home.hero.title', type: 'text', section: 'hero' },
    preconditions: ['client-safe', 'leaf-node', 'content-owned'],
    verification: { astParsed: true, contractValid: true, designPreserved: true },
  });

  assert.equal(proof.isVerified(), true);
  assert.equal(proof.type, 'TEXT_BIND');
  assert.equal(proof.target.path, 'home.hero.title');
  assert.equal(proof.preconditions.length, 3);
});

test('transform-proof: ProofRegistry enforces phase invariants against planned count', () => {
  const registry = new ProofRegistry();
  registry.record({
    type: 'TEXT_BIND',
    source: { file: 'Hero.tsx', loc: '10:2' },
    target: { path: 'home.hero.title', type: 'text' },
  });
  registry.record({
    type: 'ACTION_SPLIT',
    source: { file: 'Hero.tsx', loc: '15:2' },
    target: { path: 'home.hero.ctaLabel', type: 'text' },
  });

  // Test passed invariants
  const passCheck = registry.verifyPhaseInvariants({ plannedCount: 2, boundCount: 2, schemaPathCount: 2 });
  assert.equal(passCheck.passed, true);

  // Test violation when planned exceeds recorded proofs
  const failCheck = registry.verifyPhaseInvariants({ plannedCount: 3, boundCount: 2, schemaPathCount: 2 });
  assert.equal(failCheck.passed, false);
  assert.ok(failCheck.violations[0].includes('Phase Invariant Violation'));
});

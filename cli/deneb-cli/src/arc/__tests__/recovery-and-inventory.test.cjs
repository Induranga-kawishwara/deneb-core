'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { recoverCandidateConfidence } = require('../confidence-recovery.cjs');
const { buildEditabilityInventory } = require('../editability-inventory.cjs');

test('confidence-recovery: elevates low-confidence heading candidate from 0.45 to >= 0.65', () => {
  const candidate = {
    tag: 'h2',
    componentName: 'FeatureTitle',
    className: 'text-3xl font-bold tracking-tight text-white',
    value: 'Engineered for Performance and Comfort',
    confidence: 0.45,
  };

  const rec = recoverCandidateConfidence(candidate);
  assert.equal(rec.recovered, true);
  assert.ok(rec.confidence >= 0.65, `Expected >= 0.65, got ${rec.confidence}`);
  assert.ok(rec.reasons.includes('semantic-heading-tag'));
  assert.ok(rec.reasons.includes('tailwind-typography-token'));
});

test('confidence-recovery: elevates hero promotional badge from 0.40 to >= 0.60', () => {
  const candidate = {
    tag: 'span',
    componentName: 'PromoBadge',
    parentName: 'HeroSection',
    className: 'text-sm font-semibold uppercase',
    value: 'Limited Time Offer',
    confidence: 0.40,
  };

  const rec = recoverCandidateConfidence(candidate);
  assert.equal(rec.recovered, true);
  assert.ok(rec.confidence >= 0.60, `Expected >= 0.60, got ${rec.confidence}`);
  assert.ok(rec.reasons.includes('semantic-component-name'));
});

test('editability-inventory: builds accurate inventory and accounts for 100% of discovered candidates', () => {
  const candidates = [
    { loc: '1:1', tag: 'h1', kind: 'text', dataClassification: 'CONTENT_STATIC' },
    { loc: '2:1', tag: 'p', kind: 'text', dataClassification: 'CONTENT_STATIC' },
    { loc: '3:1', tag: 'img', kind: 'image', dataClassification: 'CONTENT_STATIC' },
    { loc: '4:1', tag: 'span', kind: 'text', dataClassification: 'PLATFORM_CONTROLLED' },
    { loc: '5:1', tag: 'span', kind: 'text', dataClassification: 'RUNTIME_COMPUTED' },
    { loc: '6:1', tag: 'div', kind: 'bg', dataClassification: 'STYLE_TOKEN' },
  ];

  const inventory = buildEditabilityInventory(candidates);
  assert.equal(inventory.totalDiscovered, 6);
  assert.equal(inventory.expectedEditableCount, 3);
  assert.equal(inventory.platformControlledCount, 1);
  assert.equal(inventory.runtimeDataCount, 1);
  assert.equal(inventory.decorativeCount, 1);

  // Invariant: sum of all tiers must exactly equal totalDiscovered
  const sumTiers =
    inventory.expectedEditableCount +
    inventory.platformControlledCount +
    inventory.runtimeDataCount +
    inventory.decorativeCount +
    inventory.interactionStateCount;
  assert.equal(sumTiers, inventory.totalDiscovered, 'No candidate lost invariant must hold');
});

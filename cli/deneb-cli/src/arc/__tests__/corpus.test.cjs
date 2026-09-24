'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  KNOWN_STOREFRONTS,
  resolveWorkspaceStorefrontsDir,
  auditStorefrontTemplate,
  verifyStorefrontCorpus,
} = require('../corpus-verifier.cjs');

test('Corpus Verifier: audits coffee storefront and verifies 100% pass across all 12 gates', () => {
  const baseDir = resolveWorkspaceStorefrontsDir();
  const coffeeDir = path.join(baseDir, 'coffee');

  const result = auditStorefrontTemplate(coffeeDir, { templateId: 'coffee', templateName: 'Coffee Shop' });
  assert.equal(result.validStructure, true);
  assert.equal(result.fivoraContract.passed, true);
  assert.equal(result.fivoraContract.violationCount, 0);
  assert.equal(result.runtimeEditability.passed, true);
  assert.equal(result.collectionOperations.passed, true);
  assert.equal(result.acceptanceGates.passed, true);
  assert.equal(result.acceptanceGates.status, 'CONVERSION_PASSED');
  assert.equal(result.passed, true);
});

test('Corpus Verifier: audits mobile-shop storefront and verifies 100% pass', () => {
  const baseDir = resolveWorkspaceStorefrontsDir();
  const mobileDir = path.join(baseDir, 'mobile-shop');

  const result = auditStorefrontTemplate(mobileDir, { templateId: 'mobile-shop', templateName: 'Mobile Shop' });
  assert.equal(result.validStructure, true);
  assert.equal(result.fivoraContract.passed, true);
  assert.equal(result.acceptanceGates.passed, true);
  assert.equal(result.passed, true);
});

test('Corpus Verifier: audits restaurant storefront and verifies 100% pass', () => {
  const baseDir = resolveWorkspaceStorefrontsDir();
  const restuDir = path.join(baseDir, 'restu-web');

  const result = auditStorefrontTemplate(restuDir, { templateId: 'restaurant', templateName: 'Restaurant' });
  assert.equal(result.validStructure, true);
  assert.equal(result.fivoraContract.passed, true);
  assert.equal(result.acceptanceGates.passed, true);
  assert.equal(result.passed, true);
});

test('Corpus Verifier: blocks conversions with contract violations and refuses false success', () => {
  const baseDir = resolveWorkspaceStorefrontsDir();
  const salonDir = path.join(baseDir, 'salon-web');

  const result = auditStorefrontTemplate(salonDir, { templateId: 'salon', templateName: 'Salon' });
  // Must correctly report failure because of unmapped before/after fields
  assert.equal(result.fivoraContract.passed, false);
  assert.ok(result.fivoraContract.violationCount > 0);
  assert.equal(result.acceptanceGates.status, 'CONVERSION_FAILED');
  assert.equal(result.passed, false);
});

test('Corpus Verifier: executes corpus verification across all known storefronts', () => {
  const report = verifyStorefrontCorpus();
  assert.equal(report.totalTemplates, 6);
  assert.ok(report.passedTemplates >= 3);
  assert.ok(report.results.length === 6);

  // Coffee, mobile-shop, and restaurant must be 100% green
  const coffee = report.results.find((r) => r.templateId === 'coffee');
  assert.ok(coffee && coffee.passed);

  const mobile = report.results.find((r) => r.templateId === 'mobile-shop');
  assert.ok(mobile && mobile.passed);

  const restu = report.results.find((r) => r.templateId === 'restaurant');
  assert.ok(restu && restu.passed);
});

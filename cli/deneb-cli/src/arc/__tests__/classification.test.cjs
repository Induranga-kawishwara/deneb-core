'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DATA_CLASSIFICATION,
  classifyDataCandidate,
  isEditableClassification,
  isPlatformControlledPath,
} = require('../data-classification.cjs');

test('Data Classification: correctly assigns all 7 data tiers', () => {
  // 1. CONTENT
  assert.equal(classifyDataCandidate({ tag: 'h1', kind: 'text', value: 'Fresh Roasted Beans' }).classification, DATA_CLASSIFICATION.CONTENT);

  // 2. COMMERCE_CONTENT
  assert.equal(classifyDataCandidate({ tag: 'h2', kind: 'text', value: 'Espresso Blend', propName: 'productTitle' }).classification, DATA_CLASSIFICATION.COMMERCE_CONTENT);

  // 3. PLATFORM_CONTROLLED
  assert.equal(classifyDataCandidate({ tag: 'span', kind: 'text', value: 'USD', field: 'common.currency' }).classification, DATA_CLASSIFICATION.PLATFORM_CONTROLLED);
  assert.equal(classifyDataCandidate({ tag: 'span', kind: 'text', value: 'prod-123', propName: 'productId' }).classification, DATA_CLASSIFICATION.PLATFORM_CONTROLLED);

  // 4. INTERACTION_STATE
  assert.equal(classifyDataCandidate({ tag: 'div', kind: 'text', propName: 'isOpen', value: 'true' }).classification, DATA_CLASSIFICATION.INTERACTION_STATE);
  assert.equal(classifyDataCandidate({ tag: 'div', kind: 'text', propName: 'activeTab', value: 'reviews' }).classification, DATA_CLASSIFICATION.INTERACTION_STATE);

  // 5. COMPUTED_DATA
  assert.equal(classifyDataCandidate({ tag: 'span', kind: 'text', value: 'formatPrice(item.price * qty)' }).classification, DATA_CLASSIFICATION.COMPUTED_DATA);

  // 6. RUNTIME_DATA
  assert.equal(classifyDataCandidate({ tag: 'span', kind: 'text', value: 'user.email' }).classification, DATA_CLASSIFICATION.RUNTIME_DATA);
  assert.equal(classifyDataCandidate({ tag: 'span', kind: 'text', value: 'cart.total' }).classification, DATA_CLASSIFICATION.RUNTIME_DATA);

  // 7. DECORATIVE
  assert.equal(classifyDataCandidate({ tag: 'span', kind: 'text', value: '•' }).classification, DATA_CLASSIFICATION.DECORATIVE);
});

test('Data Classification: recognizes editable vs non-editable classifications', () => {
  assert.equal(isEditableClassification(DATA_CLASSIFICATION.CONTENT), true);
  assert.equal(isEditableClassification(DATA_CLASSIFICATION.COMMERCE_CONTENT), true);

  assert.equal(isEditableClassification(DATA_CLASSIFICATION.PLATFORM_CONTROLLED), false);
  assert.equal(isEditableClassification(DATA_CLASSIFICATION.RUNTIME_DATA), false);
  assert.equal(isEditableClassification(DATA_CLASSIFICATION.COMPUTED_DATA), false);
  assert.equal(isEditableClassification(DATA_CLASSIFICATION.DECORATIVE), false);
  assert.equal(isEditableClassification(DATA_CLASSIFICATION.INTERACTION_STATE), false);
});

test('Data Classification: identifies platform controlled paths accurately', () => {
  assert.equal(isPlatformControlledPath('common.currency'), true);
  assert.equal(isPlatformControlledPath('products[0].id'), true);
  assert.equal(isPlatformControlledPath('categories[2].slug'), true);
  assert.equal(isPlatformControlledPath('home.hero.title'), false);
});

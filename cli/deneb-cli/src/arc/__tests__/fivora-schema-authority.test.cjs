'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PLATFORM_ALLOWED_TYPES,
  normalizeFieldType,
  CanonicalPathRegistry,
  sanitizeEditorSections,
} = require('../fivora-schema-authority.cjs');

test('fivora-schema-authority: coerces unsupported types to platform whitelist', () => {
  assert.equal(normalizeFieldType('currency'), 'text');
  assert.equal(normalizeFieldType('price'), 'text');
  assert.equal(normalizeFieldType('richText'), 'textarea');
  assert.equal(normalizeFieldType('phone'), 'tel');
  assert.equal(normalizeFieldType('link'), 'url');
  assert.equal(normalizeFieldType('unknown_custom_type'), 'text');

  // Allowed types remain untouched
  for (const t of PLATFORM_ALLOWED_TYPES) {
    assert.equal(normalizeFieldType(t), t);
  }
});

test('fivora-schema-authority: CanonicalPathRegistry tracks unique paths and detects duplicates', () => {
  const reg = new CanonicalPathRegistry();
  const res1 = reg.register('site.announcement.linkUrl', 'site_announcement', 'url');
  assert.equal(res1.registered, true);
  assert.equal(res1.isDuplicate, false);

  const res2 = reg.register('site.announcement.linkUrl', 'site', 'url');
  assert.equal(res2.registered, false);
  assert.equal(res2.isDuplicate, true);
  assert.equal(res2.owner, 'site_announcement');
});

test('fivora-schema-authority: sanitizeEditorSections strips duplicate paths and fixes unsupported types', () => {
  const sections = [
    {
      id: 'site_announcement',
      path: 'site.announcement',
      type: 'object',
      fields: [
        { key: 'linkUrl', type: 'url', label: 'Announcement Link' },
        { key: 'priceTag', type: 'currency', label: 'Discount Tag' },
      ],
    },
    {
      id: 'site',
      path: 'site',
      type: 'object',
      fields: [
        { key: 'announcement.linkUrl', type: 'url', label: 'Duplicate Announcement Link' },
        { key: 'brandTitle', type: 'text', label: 'Brand Title' },
      ],
    },
  ];

  const sanitized = sanitizeEditorSections(sections);
  assert.equal(sanitized.length, 2);

  // Section 1: priceTag coerced from currency to text
  const priceField = sanitized[0].fields.find((f) => f.key === 'priceTag');
  assert.equal(priceField.type, 'text');

  // Section 2: duplicate announcement.linkUrl removed
  const dupField = sanitized[1].fields.find((f) => f.key === 'announcement.linkUrl');
  assert.equal(dupField, undefined, 'Duplicate field path must be eliminated');

  // Non-duplicate brandTitle remains
  const brandField = sanitized[1].fields.find((f) => f.key === 'brandTitle');
  assert.ok(brandField);
  assert.equal(brandField.type, 'text');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalField, fieldRef, isValidCanonicalPath, validatePathAlignment } = require('../canonical-paths.cjs');

test('Canonical Field: builds canonical fields and extracts segments', () => {
  const field = canonicalField('home.hero.title');
  assert.equal(field.path, 'home.hero.title');
  assert.equal(field.scope, 'home');
  assert.equal(field.section, 'hero');
  assert.equal(field.fieldName, 'title');
  assert.equal(field.previewPath, 'home.hero.title');
  assert.equal(field.previewMarker, 'data-preview-field-path="home.hero.title"');
  assert.equal(field.runtimePath, 'siteData.content.home.hero.title');
  assert.equal(field.manifestSchemaPath, 'home.hero.title');
  assert.equal(field.diagnosticsId, 'field:home.hero.title');
  assert.equal(field.toSetterCode('val'), 'siteData.content.home.hero.title = val;');
  assert.equal(field.validate().valid, true);
});

test('Canonical Field: handles collection child derivations and paths', () => {
  const col = canonicalField('home.categories');
  const item = col.toCollectionItem(0);
  assert.equal(item.path, 'home.categories[0]');
  assert.equal(item.isCollection, true);

  const nestedChild = item.toCollectionChild('products', 1);
  assert.equal(nestedChild.path, 'home.categories[0].products[1]');
});

test('Canonical Field: generates recast AST for getter, fallback binding, and preview attributes', () => {
  const field = canonicalField('home.story.title');
  const getterAst = field.toGetterAst();
  assert.equal(getterAst.type, 'OptionalMemberExpression');

  const bindingAst = field.toBindingAst('Our Story');
  assert.equal(bindingAst.type, 'LogicalExpression');

  const attrAst = field.toPreviewAttrAst();
  assert.equal(attrAst.name.name, 'data-preview-field-path');
  assert.equal(attrAst.value.value, 'home.story.title');

  const styleAttrAst = field.toPreviewStyleTargetAst();
  assert.equal(styleAttrAst.name.name, 'data-preview-style-target');
});

test('Canonical Field: validates path syntax and getter-to-marker alignment', () => {
  assert.ok(isValidCanonicalPath('home.hero.title'));
  assert.ok(isValidCanonicalPath('common.header.logoText'));
  assert.ok(isValidCanonicalPath('home.categories[0].products[${index}].title'));
  assert.ok(!isValidCanonicalPath(''));
  assert.ok(!isValidCanonicalPath('invalid path with spaces'));

  assert.ok(validatePathAlignment('siteData?.content?.home?.hero?.title', 'data-preview-field-path="home.hero.title"'));
  assert.ok(!validatePathAlignment('siteData?.content?.about?.title', 'data-preview-field-path="home.hero.title"'));
});

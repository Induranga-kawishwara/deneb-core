'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSource, printSource } = require('../ast.cjs');
const { replaceTextChildren } = require('../transforms/primitives/text.cjs');
const { splitActionChildren } = require('../transforms/primitives/action.cjs');

test('composite-fragments: preserves dynamic runtime expression and wraps literal text in editable span', () => {
  const code = '<h1>Shop {category.name} Collection</h1>';
  const ast = parseSource(code, 'heading.tsx');
  const h1Node = ast.program.body[0].expression;

  replaceTextChildren(h1Node, 'shop.heading', 'Shop', 'text');
  const result = printSource(ast, code);

  // Dynamic expression must be preserved
  assert.match(result, /\{category\.name\}/);
  // Literal text must be wrapped in editable span with field-path
  assert.match(result, /data-preview-field-path="shop\.heading"/);
});

test('composite-fragments: replaces pure static text directly without extra spans', () => {
  const code = '<h1>Featured Products</h1>';
  const ast = parseSource(code, 'heading.tsx');
  const h1Node = ast.program.body[0].expression;

  replaceTextChildren(h1Node, 'home.featuredTitle', 'Featured Products', 'text');
  const result = printSource(ast, code);

  assert.match(result, /<h1>\{siteData\?\.content\?\.home\?\.featuredTitle \?\? "Featured Products"\}<\/h1>/);
});

test('composite-fragments: splitActionChildren wraps only text and leaves icon untouched', () => {
  const code = '<button><Icon className="w-4 h-4" /> Add to Cart</button>';
  const ast = parseSource(code, 'button.tsx');
  const btnNode = ast.program.body[0].expression;

  splitActionChildren(btnNode, 'product.addToCartLabel', 'Add to Cart');
  const result = printSource(ast, code);

  // Icon must remain untouched
  assert.match(result, /<Icon className="w-4 h-4" \/>/);
  // Outer button must NOT have data-preview-field-path
  assert.doesNotMatch(result, /<button[^>]*data-preview-field-path/);
  // Inner text must be in span
  assert.match(result, /<span[\s\S]*?data-preview-field-path="product\.addToCartLabel"/);
});

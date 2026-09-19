'use strict';

const recast = require('recast');
const babelParser = require('@babel/parser');
const t = recast.types.namedTypes;
const b = recast.types.builders;

let babelTsParser = null;
try {
  babelTsParser = require('recast/parsers/babel-ts');
} catch {
  babelTsParser = null;
}

const BABEL_PLUGIN_SETS = [
  ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'importAttributes'],
  ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'importAssertions'],
  ['jsx', 'typescript', 'classProperties'],
  ['jsx', 'typescript'],
  ['jsx'],
];

function parseWithBabel(code, filePath = 'file.tsx') {
  const isTs =
    /\.(tsx|ts|mts|cts)$/i.test(filePath) ||
    /(?:interface\s+[A-Za-z0-9_$]+|type\s+[A-Za-z0-9_$]+\s*=|:\s*(?:string|number|boolean|any|void|unknown|React\.)|as\s+[A-Za-z0-9_$]+)/.test(code);

  const pluginSets = isTs
    ? BABEL_PLUGIN_SETS.filter((set) => set.includes('typescript'))
    : BABEL_PLUGIN_SETS;

  let lastError = null;
  for (const plugins of pluginSets) {
    try {
      return babelParser.parse(code, {
        sourceType: 'unambiguous',
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        errorRecovery: true,
        tokens: true,
        plugins,
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Unable to parse source');
}

function parseSource(code, filePath = 'file.tsx') {
  const options = { sourceFileName: filePath };
  if (babelTsParser) {
    try {
      return recast.parse(code, { ...options, parser: babelTsParser });
    } catch {
      // Fall through to token-aware Babel parse.
    }
  }
  return recast.parse(code, {
    ...options,
    parser: {
      parse(source) {
        return parseWithBabel(source, filePath);
      },
    },
  });
}

function printSource(ast, originalCode) {
  let printed = recast.print(ast, {
    quote: 'double',
    wrapColumn: 120,
    reuseWhitespace: true,
  }).code;
  printed = printed.replace(/(['"]use client['"]);;/g, '$1;');
  printed = printed.replace(/(['"]use server['"]);;/g, '$1;');
  if (typeof originalCode === 'string' && originalCode.endsWith('\n') && !printed.endsWith('\n')) {
    printed += '\n';
  }
  return printed;
}

function locKey(node) {
  const loc = node && node.loc;
  if (!loc || !loc.start) return null;
  return `${loc.start.line}:${loc.start.column}:${loc.end ? loc.end.line : ''}:${loc.end ? loc.end.column : ''}`;
}

function getJsxName(node) {
  if (!node) return '';
  const opening = node.openingElement || node;
  const name = opening.name || node.name;
  return jsxNameToString(name);
}

function jsxNameToString(name) {
  if (!name) return '';
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    return `${jsxNameToString(name.object)}.${jsxNameToString(name.property)}`;
  }
  if (name.type === 'JSXNamespacedName') {
    return `${name.namespace.name}:${name.name.name}`;
  }
  if (name.type === 'Identifier') return name.name;
  return '';
}

function getJsxAttributes(node) {
  const opening = node.openingElement || node;
  return opening.attributes || [];
}

function findJsxAttribute(node, attrName) {
  return getJsxAttributes(node).find((attr) => {
    return attr && attr.type === 'JSXAttribute' && attr.name && attr.name.name === attrName;
  }) || null;
}

function getJsxAttributeLiteral(node, attrName) {
  const attr = findJsxAttribute(node, attrName);
  if (!attr || !attr.value) return null;
  if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') {
    return String(attr.value.value);
  }
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (!expr) return null;
    if (expr.type === 'StringLiteral' || expr.type === 'Literal') return String(expr.value);
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
      return expr.quasis.map((q) => q.value.cooked || q.value.raw || '').join('');
    }
  }
  return null;
}

function hasJsxAttribute(node, attrName) {
  return Boolean(findJsxAttribute(node, attrName));
}

function collectJsxText(node) {
  if (!node || !Array.isArray(node.children)) return '';
  const parts = [];
  for (const child of node.children) {
    if (!child) continue;
    if (child.type === 'JSXText') {
      parts.push(child.value);
    } else if (child.type === 'JSXExpressionContainer' && child.expression && (child.expression.type === 'StringLiteral' || child.expression.type === 'Literal')) {
      parts.push(String(child.expression.value));
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function isJsxTextHeavy(node) {
  if (!node || !Array.isArray(node.children)) return false;
  const meaningful = node.children.filter((child) => {
    if (!child) return false;
    if (child.type === 'JSXText') return child.value.replace(/\s+/g, '').length > 0;
    if (child.type === 'JSXExpressionContainer') {
      const expr = child.expression;
      return expr && (expr.type === 'StringLiteral' || expr.type === 'Literal' || expr.type === 'Identifier');
    }
    return false;
  });
  return meaningful.length > 0;
}

const VALID_IDENTIFIER_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function optionalMember(parts) {
  let expr = b.identifier(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    const part = String(parts[i]);
    if (VALID_IDENTIFIER_REGEX.test(part)) {
      expr = b.optionalMemberExpression(expr, b.identifier(part), false, true);
    } else {
      expr = b.optionalMemberExpression(expr, b.stringLiteral(part), true, true);
    }
  }
  return expr;
}

function siteDataBinding(pathParts, fallback, fieldType = 'string') {
  const chain = optionalMember(['siteData', 'content', ...pathParts]);
  let fallbackNode;
  if (fieldType === 'number' && fallback !== '' && !Number.isNaN(Number(fallback))) {
    fallbackNode = b.numericLiteral(Number(fallback));
  } else if (fieldType === 'boolean') {
    fallbackNode = b.booleanLiteral(Boolean(fallback));
  } else {
    fallbackNode = b.stringLiteral(String(fallback ?? ''));
  }
  return b.logicalExpression('??', chain, fallbackNode);
}

function jsxPreviewAttr(fieldPath) {
  return b.jsxAttribute(
    b.jsxIdentifier('data-preview-field-path'),
    b.stringLiteral(fieldPath)
  );
}

function jsxStaticAttr(reason) {
  return b.jsxAttribute(
    b.jsxIdentifier('data-preview-static'),
    b.stringLiteral(reason || 'decorative')
  );
}

/**
 * Binds a whole collection to site data while keeping the developer's literal
 * array as the fallback, so `{item.title}` inside the existing map picks up
 * merchant edits with no change to the render logic.
 */
function siteDataListBinding(pathParts, fallbackArrayNode) {
  return b.logicalExpression(
    '??',
    optionalMember(['siteData', 'content', ...pathParts]),
    fallbackArrayNode
  );
}

/**
 * Builds `attr={`prefix[${index}]suffix`}`. Fivora's marker parser accepts JSX
 * template literals, which is how repeated items stay editable after reorder.
 */
function jsxTemplatePathAttr(attrName, prefix, indexName, suffix = '') {
  return b.jsxAttribute(
    b.jsxIdentifier(attrName),
    b.jsxExpressionContainer(
      b.templateLiteral(
        [
          b.templateElement({ raw: `${prefix}[`, cooked: `${prefix}[` }, false),
          b.templateElement({ raw: `]${suffix}`, cooked: `]${suffix}` }, true),
        ],
        [b.identifier(indexName)]
      )
    )
  );
}

function unwrapExpr(node) {
  let curr = node;
  while (
    curr &&
    (curr.type === 'TSAsExpression' ||
      curr.type === 'TSTypeAssertion' ||
      curr.type === 'TypeCastExpression' ||
      curr.type === 'TSNonNullExpression' ||
      curr.type === 'ParenthesizedExpression')
  ) {
    curr = curr.expression;
  }
  return curr;
}

function extractItemMemberName(expr, binding) {
  if (!expr) return null;
  const unwrapped = unwrapExpr(expr);
  if (!unwrapped) return null;

  if (unwrapped.type === 'MemberExpression' && !unwrapped.computed) {
    if (
      (unwrapped.object?.type === 'Identifier' && unwrapped.object.name === binding) ||
      (unwrapped.object?.type === 'JSXIdentifier' && unwrapped.object.name === binding)
    ) {
      return unwrapped.property?.name || null;
    }
  }

  if (unwrapped.type === 'LogicalExpression' || unwrapped.type === 'BinaryExpression') {
    return extractItemMemberName(unwrapped.left, binding) || extractItemMemberName(unwrapped.right, binding);
  }

  if (unwrapped.type === 'ConditionalExpression') {
    return (
      extractItemMemberName(unwrapped.consequent, binding) ||
      extractItemMemberName(unwrapped.alternate, binding) ||
      extractItemMemberName(unwrapped.test, binding)
    );
  }

  return null;
}

function wrapTextInEditableSpan(fieldPath, fallback, fieldType) {
  return b.jsxElement(
    b.jsxOpeningElement(
      b.jsxIdentifier('span'),
      [jsxPreviewAttr(fieldPath), ...jsxStyleAttrs(fieldPath, 'text')],
      false
    ),
    b.jsxClosingElement(b.jsxIdentifier('span')),
    [b.jsxExpressionContainer(siteDataBinding(fieldPath.split('.'), fallback, fieldType))],
    false
  );
}

function jsxStyleAttrs(stylePath, kind) {
  if (!stylePath || !kind) return [];
  return [
    b.jsxAttribute(b.jsxIdentifier('data-preview-style-target'), b.stringLiteral(stylePath)),
    b.jsxAttribute(b.jsxIdentifier('data-preview-style-type'), b.stringLiteral(kind)),
  ];
}

function ensureStyleAttrs(node, stylePath, kind) {
  if (!node || !node.openingElement || !stylePath || !kind) return;
  if (hasJsxAttribute(node, 'data-preview-style-target')) return;
  node.openingElement.attributes.push(...jsxStyleAttrs(stylePath, kind));
}

function hasDirective(ast, value) {
  const program = ast.program || ast;
  const first = program.body && program.body[0];
  if (first && first.type === 'ExpressionStatement' && first.expression) {
    const expr = first.expression;
    if ((expr.type === 'StringLiteral' || expr.type === 'Literal') && expr.value === value) {
      return true;
    }
  }
  return false;
}

function localNameOfSpecifier(spec) {
  return spec?.local?.name || spec?.imported?.name || spec?.exported?.name || null;
}

function dedupeImportSpecifiers(ast) {
  const program = ast.program || ast;
  const seenLocals = new Set();
  for (const node of program.body || []) {
    if (node.type !== 'ImportDeclaration' || !Array.isArray(node.specifiers)) continue;
    node.specifiers = node.specifiers.filter((spec) => {
      const local = localNameOfSpecifier(spec);
      if (!local) return true;
      if (seenLocals.has(local)) return false;
      seenLocals.add(local);
      return true;
    });
  }
}

function preferLocalSiteDataImport(ast) {
  const program = ast.program || ast;
  const body = program.body || [];
  const localNames = new Set();
  for (const node of body) {
    if (node.type !== 'ImportDeclaration') continue;
    const src = node.source && node.source.value;
    if (typeof src !== 'string' || !/siteDataContext/.test(src)) continue;
    for (const spec of node.specifiers || []) {
      const local = localNameOfSpecifier(spec);
      if (local) localNames.add(local);
    }
  }
  if (localNames.size === 0) return;
  for (const node of body) {
    if (node.type !== 'ImportDeclaration') continue;
    const src = node.source && node.source.value;
    if (src !== '@deneb-ui/ui' && src !== 'deneb-ui' && src !== '@fivora/editable-components') continue;
    node.specifiers = (node.specifiers || []).filter((spec) => !localNames.has(localNameOfSpecifier(spec)));
  }
}

function dropImportedNameIfLocallyDeclared(ast) {
  const program = ast.program || ast;
  const declared = new Set();
  for (const node of program.body || []) {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
      declared.add(node.id.name);
    }
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration;
      if (decl.type === 'FunctionDeclaration' && decl.id && decl.id.name) {
        declared.add(decl.id.name);
      }
      if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations || []) {
          if (d.id && d.id.type === 'Identifier') declared.add(d.id.name);
        }
      }
    }
  }
  if (declared.size === 0) return;
  for (const node of program.body || []) {
    if (node.type !== 'ImportDeclaration') continue;
    node.specifiers = (node.specifiers || []).filter((spec) => !declared.has(localNameOfSpecifier(spec)));
  }
}

function rewriteImportedReexports(ast) {
  const program = ast.program || ast;
  const importSourceByLocal = new Map();
  for (const node of program.body || []) {
    if (node.type !== 'ImportDeclaration') continue;
    const src = node.source && node.source.value;
    for (const spec of node.specifiers || []) {
      const local = localNameOfSpecifier(spec);
      if (local && src) importSourceByLocal.set(local, src);
    }
  }

  const exportDecls = (program.body || []).filter(
    (node) => node.type === 'ExportNamedDeclaration' && !node.source && node.specifiers && node.specifiers.length
  );
  for (const node of exportDecls) {
    const groups = new Map();
    const keep = [];
    for (const spec of node.specifiers) {
      const local = spec.local?.name;
      const src = local && importSourceByLocal.get(local);
      if (!src) {
        keep.push(spec);
        continue;
      }
      if (!groups.has(src)) groups.set(src, []);
      groups.get(src).push(spec);
    }
    if (!groups.size) continue;
    node.specifiers = keep;
    let insertAt = program.body.indexOf(node) + 1;
    for (const [src, specs] of groups.entries()) {
      program.body.splice(insertAt, 0, b.exportNamedDeclaration(null, specs, b.stringLiteral(src)));
      insertAt++;
      for (const spec of specs) {
        const local = spec.local?.name;
        for (const imp of program.body) {
          if (imp.type !== 'ImportDeclaration') continue;
          if (!imp.specifiers) continue;
          imp.specifiers = imp.specifiers.filter((s) => localNameOfSpecifier(s) !== local);
        }
      }
    }
  }
}

function stripEmptyImportAndExportDecls(ast) {
  const program = ast.program || ast;
  program.body = (program.body || []).filter((node) => {
    if (node.type === 'ImportDeclaration') {
      return (node.specifiers || []).length > 0;
    }
    if (node.type === 'ExportNamedDeclaration' && !node.declaration && !node.source) {
      return (node.specifiers || []).length > 0;
    }
    return true;
  });
}

function sanitizeDuplicateBindings(ast) {
  dropImportedNameIfLocallyDeclared(ast);
  preferLocalSiteDataImport(ast);
  rewriteImportedReexports(ast);
  dedupeImportSpecifiers(ast);
  stripEmptyImportAndExportDecls(ast);
}

function ensureImport(ast, source, names) {
  const program = ast.program || ast;
  const body = program.body || [];

  const alreadyImported = new Set();
  for (const node of body) {
    if (node.type === 'ImportDeclaration' && Array.isArray(node.specifiers)) {
      for (const spec of node.specifiers) {
        const local = spec.local?.name || spec.imported?.name;
        if (local) alreadyImported.add(local);
      }
    }
    if (node.type === 'FunctionDeclaration' && node.id?.name) alreadyImported.add(node.id.name);
    if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name) {
      alreadyImported.add(node.declaration.id.name);
    }
  }

  const namesToImport = names.filter((name) => !alreadyImported.has(name));
  if (namesToImport.length === 0) return;

  const existing = body.find((node) => node.type === 'ImportDeclaration' && node.source && node.source.value === source);
  if (existing) {
    for (const name of namesToImport) {
      existing.specifiers.push(b.importSpecifier(b.identifier(name), b.identifier(name)));
    }
    return;
  }

  const specifiers = namesToImport.map((name) => b.importSpecifier(b.identifier(name), b.identifier(name)));
  const decl = b.importDeclaration(specifiers, b.stringLiteral(source));
  let insertAt = 0;
  if (body[0] && body[0].type === 'ExpressionStatement') insertAt = 1;
  body.splice(insertAt, 0, decl);
}

function ensureDefaultImport(ast, source, localName) {
  const program = ast.program || ast;
  const body = program.body || [];
  const existing = body.find((node) => node.type === 'ImportDeclaration' && node.source && node.source.value === source);
  if (existing) return;
  const decl = b.importDeclaration(
    [b.importDefaultSpecifier(b.identifier(localName))],
    b.stringLiteral(source)
  );
  let insertAt = 0;
  if (body[0] && body[0].type === 'ExpressionStatement') insertAt = 1;
  body.splice(insertAt, 0, decl);
}

function codeHasIdentifier(code, name) {
  return new RegExp(`\\b${name}\\b`).test(code);
}

module.exports = {
  parseSource,
  printSource,
  parseWithBabel,
  locKey,
  getJsxName,
  jsxNameToString,
  getJsxAttributes,
  findJsxAttribute,
  getJsxAttributeLiteral,
  hasJsxAttribute,
  collectJsxText,
  isJsxTextHeavy,
  optionalMember,
  siteDataBinding,
  siteDataListBinding,
  jsxPreviewAttr,
  jsxStyleAttrs,
  ensureStyleAttrs,
  jsxStaticAttr,
  jsxTemplatePathAttr,
  wrapTextInEditableSpan,
  unwrapExpr,
  extractItemMemberName,
  hasDirective,
  ensureImport,
  ensureDefaultImport,
  sanitizeDuplicateBindings,
  codeHasIdentifier,
  t,
  b,
  visit: recast.types.visit,
};

'use strict';

/**
 * Fivora hosts storefronts as static exports served from merchant sub-paths.
 * A converted project therefore needs `output: 'export'`, unoptimized images
 * and a NEXT_PUBLIC_SITE_BASE_PATH-driven basePath, or `deneb package` fails
 * its sandbox build. ARC configures this via AST so an existing config keeps
 * its plugins, comments and formatting.
 */

const fs = require('fs');
const path = require('path');
const recast = require('recast');
const { parseSource, printSource, b } = require('./ast.cjs');

const CONFIG_FILENAMES = [
  'next.config.ts',
  'next.config.mjs',
  'next.config.js',
  'next.config.cjs',
];

const BASE_PATH_ENV = 'NEXT_PUBLIC_SITE_BASE_PATH';

function findNextConfig(projectDir) {
  for (const name of CONFIG_FILENAMES) {
    const abs = path.join(projectDir, name);
    if (fs.existsSync(abs)) return { abs, name };
  }
  return null;
}

function createNextConfig(projectDir, isTypeScript) {
  const name = isTypeScript ? 'next.config.ts' : 'next.config.mjs';
  const abs = path.join(projectDir, name);
  const typed = isTypeScript
    ? `import type { NextConfig } from 'next';\n\n`
    : '';
  const annotation = isTypeScript ? ': NextConfig' : '';

  const code = `${typed}const basePath = (process.env.${BASE_PATH_ENV} ?? '').replace(/\\/$/, '');

const nextConfig${annotation} = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
`;

  fs.writeFileSync(abs, code, 'utf8');
  return { file: name, created: true, updated: true, warnings: [] };
}

/** Locates the object literal that describes the Next.js config. */
function findConfigObject(ast) {
  let found = null;

  recast.types.visit(ast, {
    visitExportDefaultDeclaration(pathNode) {
      const declaration = pathNode.node.declaration;
      if (declaration?.type === 'ObjectExpression') {
        found = declaration;
        return false;
      }
      this.traverse(pathNode);
    },
    visitAssignmentExpression(pathNode) {
      const node = pathNode.node;
      const left = recast.print(node.left).code;
      if (!found && /^module\.exports$/.test(left) && node.right?.type === 'ObjectExpression') {
        found = node.right;
        return false;
      }
      this.traverse(pathNode);
    },
  });

  if (found) return found;

  // `const nextConfig = {...}` possibly wrapped by a plugin on export.
  recast.types.visit(ast, {
    visitVariableDeclarator(pathNode) {
      const node = pathNode.node;
      if (
        !found &&
        node.id?.type === 'Identifier' &&
        /config/i.test(node.id.name) &&
        node.init?.type === 'ObjectExpression'
      ) {
        found = node.init;
        return false;
      }
      this.traverse(pathNode);
    },
  });

  return found;
}

function hasProperty(objectExpression, key) {
  return (objectExpression.properties || []).some(
    (property) =>
      (property.type === 'ObjectProperty' || property.type === 'Property') &&
      (property.key?.name === key || property.key?.value === key)
  );
}

function propertyValue(objectExpression, key) {
  const property = (objectExpression.properties || []).find(
    (candidate) =>
      (candidate.type === 'ObjectProperty' || candidate.type === 'Property') &&
      (candidate.key?.name === key || candidate.key?.value === key)
  );
  return property ? property.value : null;
}

function hasBasePathDeclaration(ast) {
  let declared = false;
  recast.types.visit(ast, {
    visitVariableDeclarator(pathNode) {
      if (pathNode.node.id?.type === 'Identifier' && pathNode.node.id.name === 'basePath') {
        declared = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return declared;
}

function insertBasePathDeclaration(ast) {
  const program = ast.program || ast;
  const declaration = b.variableDeclaration('const', [
    b.variableDeclarator(
      b.identifier('basePath'),
      b.logicalExpression(
        '||',
        b.memberExpression(
          b.memberExpression(b.identifier('process'), b.identifier('env')),
          b.identifier(BASE_PATH_ENV)
        ),
        b.stringLiteral('')
      )
    ),
  ]);

  const body = program.body || [];
  let insertAt = 0;
  for (let index = 0; index < body.length; index += 1) {
    const node = body[index];
    const isDirective =
      node.type === 'ExpressionStatement' &&
      (node.expression?.type === 'StringLiteral' || node.expression?.type === 'Literal');
    if (node.type === 'ImportDeclaration' || isDirective) insertAt = index + 1;
    else break;
  }
  body.splice(insertAt, 0, declaration);
}

/**
 * Adds the static-export settings a converted project needs, leaving any
 * setting the developer already chose untouched.
 */
function ensureStaticExportConfig(projectDir, profile) {
  const existing = findNextConfig(projectDir);
  if (!existing) {
    return createNextConfig(projectDir, profile?.language !== 'javascript');
  }

  const original = fs.readFileSync(existing.abs, 'utf8');
  let ast;
  try {
    ast = parseSource(original, existing.name);
  } catch (err) {
    return {
      file: existing.name,
      created: false,
      updated: false,
      warnings: [
        `${existing.name} could not be parsed (${err.message}). Add output: 'export', images.unoptimized and a ${BASE_PATH_ENV} basePath manually.`,
      ],
    };
  }

  const configObject = findConfigObject(ast);
  if (!configObject) {
    return {
      file: existing.name,
      created: false,
      updated: false,
      warnings: [
        `${existing.name} does not expose a plain config object, so ARC left it unchanged. Add output: 'export', images.unoptimized and a ${BASE_PATH_ENV} basePath manually.`,
      ],
    };
  }

  const warnings = [];
  let updated = false;

  if (!hasProperty(configObject, 'output')) {
    configObject.properties.push(
      b.objectProperty(b.identifier('output'), b.stringLiteral('export'))
    );
    updated = true;
  } else {
    const value = propertyValue(configObject, 'output');
    if (value?.value !== 'export') {
      warnings.push(
        `${existing.name} sets output: '${value?.value}'. Fivora requires output: 'export'; ARC left your value in place.`
      );
    }
  }

  if (!hasProperty(configObject, 'images')) {
    configObject.properties.push(
      b.objectProperty(
        b.identifier('images'),
        b.objectExpression([
          b.objectProperty(b.identifier('unoptimized'), b.booleanLiteral(true)),
        ])
      )
    );
    updated = true;
  } else {
    const images = propertyValue(configObject, 'images');
    if (images?.type === 'ObjectExpression' && !hasProperty(images, 'unoptimized')) {
      images.properties.push(
        b.objectProperty(b.identifier('unoptimized'), b.booleanLiteral(true))
      );
      updated = true;
    }
  }

  if (!hasProperty(configObject, 'basePath')) {
    if (!hasBasePathDeclaration(ast)) insertBasePathDeclaration(ast);
    configObject.properties.push(
      b.objectProperty(
        b.identifier('basePath'),
        b.logicalExpression('||', b.identifier('basePath'), b.identifier('undefined'))
      )
    );
    configObject.properties.push(
      b.objectProperty(
        b.identifier('assetPrefix'),
        b.conditionalExpression(
          b.identifier('basePath'),
          b.templateLiteral(
            [
              b.templateElement({ raw: '', cooked: '' }, false),
              b.templateElement({ raw: '/', cooked: '/' }, true),
            ],
            [b.identifier('basePath')]
          ),
          b.identifier('undefined')
        )
      )
    );
    updated = true;
  }

  if (!updated) {
    return { file: existing.name, created: false, updated: false, warnings };
  }

  const code = printSource(ast, original);
  fs.writeFileSync(existing.abs, code, 'utf8');
  return { file: existing.name, created: false, updated: true, warnings };
}

module.exports = {
  ensureStaticExportConfig,
  findNextConfig,
  BASE_PATH_ENV,
};

'use strict';

const fs = require('fs');
const path = require('path');
const recast = require('recast');
const {
  parseSource,
  locKey,
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  unwrapExpr,
} = require('./ast.cjs');
const { rel, toPosix, isJsxFile, isSourceFile } = require('./fs-utils.cjs');
const { resolveImportSpecifier } = require('./scanner.cjs');
const { unrollCollectionSource, collectVariableAliases } = require('./data-flow.cjs');

/**
 * Deneb ARC v2 — Project-Wide Intermediate Representation (IR) Builder
 *
 * Scans the entire project upfront to construct an application-level graph:
 * 1. Component Graph: Component declarations, export names, props shapes, interfaces, and member usages.
 * 2. Data Sources: Array declarations (inline or imported) and their sample object shapes.
 * 3. Collection Flow: Maps .map() iteration loops to their data source and child components.
 * 4. Asset Imports: Next.js static asset imports mapped to clean public URL paths.
 * 5. CSS Background Images: Discovers Tailwind arbitrary bg-[url(...)] and inline styles.
 */

function unwrapTypeCasts(node) {
  let curr = node;
  while (
    curr &&
    (curr.type === 'TSAsExpression' ||
      curr.type === 'TSTypeAssertion' ||
      curr.type === 'TypeCastExpression' ||
      curr.type === 'TSNonNullExpression')
  ) {
    curr = curr.expression;
  }
  return curr;
}

function objectLiteralToPlain(node) {
  if (!node || node.type !== 'ObjectExpression') return null;
  const out = {};
  for (const prop of node.properties || []) {
    if (prop.type !== 'ObjectProperty' && prop.type !== 'Property') continue;
    const key = prop.key && (prop.key.name || prop.key.value);
    if (!key || prop.computed) continue;
    const val = unwrapTypeCasts(prop.value);
    if (!val) continue;

    if (val.type === 'StringLiteral' || (val.type === 'Literal' && typeof val.value === 'string')) {
      out[key] = String(val.value);
    } else if (val.type === 'NumericLiteral' || (val.type === 'Literal' && typeof val.value === 'number')) {
      out[key] = val.value;
    } else if (val.type === 'BooleanLiteral' || (val.type === 'Literal' && typeof val.value === 'boolean')) {
      out[key] = val.value;
    } else if (val.type === 'ObjectExpression') {
      out[key] = objectLiteralToPlain(val);
    } else if (val.type === 'ArrayExpression') {
      out[key] = (val.elements || [])
        .map((el) => {
          const item = unwrapTypeCasts(el);
          if (item?.type === 'StringLiteral' || (item?.type === 'Literal' && typeof item.value === 'string')) {
            return String(item.value);
          }
          if (item?.type === 'ObjectExpression') {
            return objectLiteralToPlain(item);
          }
          return null;
        })
        .filter(Boolean);
    }
  }
  return out;
}

/**
 * Extracts public asset path if an import resolves inside the public/ folder.
 */
function resolvePublicAssetUrl(profile, fromFileAbs, specifier) {
  if (!specifier || !profile?.root) return null;
  const publicDir = path.join(profile.root, 'public');
  if (!fs.existsSync(publicDir)) return null;

  let resolved = null;
  if (specifier.startsWith('.')) {
    resolved = path.resolve(path.dirname(fromFileAbs), specifier);
  } else {
    for (const [alias, target] of Object.entries(profile.aliasMap || {})) {
      const aliasPrefix = alias.replace(/\*$/, '');
      const targetPrefix = String(target).replace(/\*$/, '');
      if (alias.includes('*') && specifier.startsWith(aliasPrefix)) {
        resolved = path.join(targetPrefix, specifier.slice(aliasPrefix.length));
        break;
      } else if (specifier === alias || specifier.startsWith(alias + '/')) {
        resolved = path.join(targetPrefix, specifier.slice(alias.length));
        break;
      }
    }
  }

  if (resolved) {
    const ext = path.extname(resolved).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.avif', '.gif', '.ico'].includes(ext);
    if (isImage && fs.existsSync(resolved)) {
      const relToPublic = path.relative(publicDir, resolved);
      if (!relToPublic.startsWith('..') && !path.isAbsolute(relToPublic)) {
        return '/' + relToPublic.replace(/\\/g, '/');
      }
    }
  }
  return null;
}

/**
 * Resolves local JSON or JS/TS mock data files from import specifiers.
 */
function resolveDataImport(profile, fromFileAbs, specifier) {
  if (!specifier || !profile?.root) return null;
  if (specifier.startsWith('.')) {
    const direct = path.resolve(path.dirname(fromFileAbs), specifier);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    for (const ext of ['.json', '.ts', '.js', '.tsx', '.jsx']) {
      if (fs.existsSync(direct + ext)) return direct + ext;
    }
  } else {
    for (const [alias, target] of Object.entries(profile.aliasMap || {})) {
      const aliasPrefix = alias.replace(/\*$/, '');
      const targetPrefix = String(target).replace(/\*$/, '');
      if (alias.includes('*') && specifier.startsWith(aliasPrefix)) {
        const remainder = specifier.slice(aliasPrefix.length);
        const candidate = path.join(targetPrefix, remainder);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
        for (const ext of ['.json', '.ts', '.js', '.tsx', '.jsx']) {
          if (fs.existsSync(candidate + ext)) return candidate + ext;
        }
      } else if (specifier === alias || specifier.startsWith(alias + '/')) {
        const remainder = specifier.slice(alias.length);
        const candidate = path.join(targetPrefix, remainder);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
        for (const ext of ['.json', '.ts', '.js', '.tsx', '.jsx']) {
          if (fs.existsSync(candidate + ext)) return candidate + ext;
        }
      }
    }
  }
  return null;
}

/**
 * Collects member accesses on a parameter identifier across a function body.
 * e.g. for parameter 'product', collects ['name', 'price', 'image'] from product.name, product.price
 */
function collectParamMemberAccesses(fnBodyNode, paramName) {
  const members = new Set();
  if (!fnBodyNode || !paramName) return members;

  recast.types.visit(fnBodyNode, {
    visitMemberExpression(pathNode) {
      const node = pathNode.node;
      if (
        node.object &&
        (node.object.type === 'Identifier' || node.object.type === 'JSXIdentifier') &&
        node.object.name === paramName &&
        node.property &&
        !node.computed
      ) {
        members.add(node.property.name || node.property.value);
      }
      this.traverse(pathNode);
    },
  });
  return members;
}

/**
 * Inspects a function's first parameter (the props argument) to extract its pattern.
 */
function extractPropsSignature(fnNode) {
  const params = fnNode.params || [];
  if (!params.length) return { kind: 'none', names: [], paramName: null, typeAnnotationName: null };

  const firstParam = params[0];
  let typeAnnotationName = null;
  if (firstParam.typeAnnotation && firstParam.typeAnnotation.typeAnnotation) {
    const typeNode = firstParam.typeAnnotation.typeAnnotation;
    if (typeNode.type === 'TSTypeReference' && typeNode.typeName) {
      typeAnnotationName = typeNode.typeName.name || null;
    }
  }

  if (firstParam.type === 'ObjectPattern') {
    const names = [];
    for (const prop of firstParam.properties || []) {
      if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
        const name = prop.key && (prop.key.name || prop.key.value);
        if (name) names.push(name);
      }
    }
    return { kind: 'destructured', names, paramName: null, typeAnnotationName };
  }

  if (firstParam.type === 'Identifier') {
    return { kind: 'identifier', names: [], paramName: firstParam.name, typeAnnotationName };
  }

  return { kind: 'unknown', names: [], paramName: null, typeAnnotationName };
}

/**
 * Builds the complete project-wide intermediate representation.
 */
function buildProjectIR(profile) {
  const projectDir = profile.root;
  const components = new Map(); // componentName -> component metadata
  const dataSources = new Map(); // arrayName -> array data
  const collections = []; // discovered collection loops
  const assetImports = new Map(); // file -> Map of identifier -> public URL
  const backgroundImages = []; // Tailwind or inline background image usages

  // Pass 1: Parse and harvest components, arrays, and asset imports from every file
  for (const relativeFile of profile.jsxFiles || []) {
    const absPath = path.join(projectDir, relativeFile);
    let code = '';
    try {
      code = fs.readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    let ast;
    try {
      ast = parseSource(code, relativeFile);
    } catch {
      continue;
    }

    const fileAssetImports = new Map();
    const fileImports = new Map(); // localIdentifier -> specifier

    // Inspect imports for Next.js static asset images and local dependencies
    recast.types.visit(ast, {
      visitImportDeclaration(pathNode) {
        const specifier = pathNode.node.source?.value;
        if (!specifier) return false;

        for (const spec of pathNode.node.specifiers || []) {
          const localName = spec.local?.name;
          if (!localName) continue;
          fileImports.set(localName, specifier);

          const publicAssetUrl = resolvePublicAssetUrl(profile, absPath, specifier);
          if (publicAssetUrl) {
            fileAssetImports.set(localName, publicAssetUrl);
          }

          // Check if import resolves to local JSON or JS/TS mock data file
          const dataFile = resolveDataImport(profile, absPath, specifier);
          if (dataFile && fs.existsSync(dataFile)) {
            const ext = path.extname(dataFile).toLowerCase();
            if (ext === '.json') {
              try {
                const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                if (Array.isArray(raw) && raw.length > 0) {
                  dataSources.set(localName, {
                    name: localName,
                    file: rel(projectDir, dataFile),
                    kind: 'imported-json',
                    items: raw,
                    fieldKeys: typeof raw[0] === 'object' && raw[0] !== null ? Object.keys(raw[0]) : [],
                  });
                } else if (raw && typeof raw === 'object') {
                  for (const [key, val] of Object.entries(raw)) {
                    if (Array.isArray(val) && val.length > 0) {
                      dataSources.set(key, {
                        name: key,
                        file: rel(projectDir, dataFile),
                        kind: 'imported-json',
                        items: val,
                        fieldKeys: typeof val[0] === 'object' && val[0] !== null ? Object.keys(val[0]) : [],
                      });
                    }
                  }
                }
              } catch {
                // ignore corrupt json
              }
            }
          }
        }
        return false;
      },
      visitVariableDeclarator(pathNode) {
        const node = pathNode.node;
        if (!node.id || node.id.type !== 'Identifier' || !node.init) return false;
        const init = unwrapTypeCasts(node.init);

        // Inline array declaration (mock data)
        if (init.type === 'ArrayExpression') {
          const items = [];
          for (const el of init.elements || []) {
            const inner = unwrapTypeCasts(el);
            if (inner?.type === 'ObjectExpression') {
              const plain = objectLiteralToPlain(inner);
              if (plain && Object.keys(plain).length > 0) items.push(plain);
            } else if (inner?.type === 'StringLiteral' || (inner?.type === 'Literal' && typeof inner.value === 'string')) {
              items.push(String(inner.value));
            }
          }
          if (items.length > 0) {
            dataSources.set(node.id.name, {
              name: node.id.name,
              file: relativeFile,
              kind: 'inline-array',
              items,
              fieldKeys: typeof items[0] === 'object' ? Object.keys(items[0]) : [],
            });
          }
        }
        this.traverse(pathNode);
      },
    });

    if (fileAssetImports.size > 0) {
      assetImports.set(relativeFile, fileAssetImports);
    }

    // Inspect component declarations
    recast.types.visit(ast, {
      visitFunctionDeclaration(pathNode) {
        registerComponentFromNode(pathNode.node, pathNode.node.id?.name, 'function', relativeFile, ast);
        this.traverse(pathNode);
      },
      visitVariableDeclarator(pathNode) {
        const node = pathNode.node;
        if (
          node.id?.type === 'Identifier' &&
          /^[A-Z]/.test(node.id.name) &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          registerComponentFromNode(node.init, node.id.name, 'arrow', relativeFile, ast);
        }
        this.traverse(pathNode);
      },
      visitExportDefaultDeclaration(pathNode) {
        const decl = pathNode.node.declaration;
        if (decl && (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionExpression')) {
          const name = decl.id?.name || inferComponentNameFromFile(relativeFile);
          registerComponentFromNode(decl, name, 'default-export', relativeFile, ast, true);
        }
        this.traverse(pathNode);
      },
      // Check for Tailwind arbitrary background images: className="... bg-[url('/img.jpg')] ..."
      visitJSXAttribute(pathNode) {
        const attr = pathNode.node;
        if (attr.name?.name === 'className' || attr.name?.name === 'class') {
          const classVal = attr.value?.value || (attr.value?.expression?.value);
          if (typeof classVal === 'string') {
            const bgMatch = classVal.match(/\bbg-\[url\(['"]?([^'"\)]+)['"]?\)\]/);
            if (bgMatch && bgMatch[1]) {
              backgroundImages.push({
                file: relativeFile,
                loc: locKey(pathNode.node),
                url: bgMatch[1],
                rawClass: classVal,
              });
            }
          }
        }
        this.traverse(pathNode);
      },
    });

    function registerComponentFromNode(fnNode, compName, kind, file, fileAst, isDefault = false) {
      if (!compName || !/^[A-Z]/.test(compName)) return;
      const propsSig = extractPropsSignature(fnNode);
      const memberAccesses = new Map();

      if (propsSig.kind === 'destructured') {
        for (const propName of propsSig.names) {
          const accessed = collectParamMemberAccesses(fnNode.body, propName);
          if (accessed.size > 0) memberAccesses.set(propName, [...accessed]);
        }
      } else if (propsSig.kind === 'identifier' && propsSig.paramName) {
        const accessed = collectParamMemberAccesses(fnNode.body, propsSig.paramName);
        if (accessed.size > 0) memberAccesses.set(propsSig.paramName, [...accessed]);
      }

      components.set(compName, {
        name: compName,
        file,
        kind,
        isDefault,
        propsSignature: propsSig,
        memberAccesses: Object.fromEntries(memberAccesses.entries()),
      });
    }
  }

  const componentUsages = [];

  // Pass 2: Connect .map() loops with their target components across files & collect component usages
  for (const relativeFile of profile.jsxFiles || []) {
    const absPath = path.join(projectDir, relativeFile);
    let code = '';
    try {
      code = fs.readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    let ast;
    try {
      ast = parseSource(code, relativeFile);
    } catch {
      continue;
    }

    const aliases = collectVariableAliases(ast);

    recast.types.visit(ast, {
      visitJSXElement(pathNode) {
        const elem = pathNode.node;
        const tagName = getJsxName(elem);
        if (/^[A-Z]/.test(tagName) && components.has(tagName)) {
          const passedLiteralProps = {};
          for (const attr of elem.openingElement?.attributes || []) {
            if (attr.type === 'JSXAttribute' && attr.name && attr.value) {
              const pName = attr.name.name;
              if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') {
                passedLiteralProps[pName] = attr.value.value;
              } else if (attr.value.type === 'JSXExpressionContainer') {
                const expr = attr.value.expression;
                if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) {
                  passedLiteralProps[pName] = expr.value;
                } else if (expr && (expr.type === 'NumericLiteral' || (expr.type === 'Literal' && typeof expr.value === 'number'))) {
                  passedLiteralProps[pName] = expr.value;
                }
              }
            }
          }
          if (Object.keys(passedLiteralProps).length > 0) {
            componentUsages.push({
              componentName: tagName,
              file: relativeFile,
              loc: locKey(elem),
              props: passedLiteralProps,
            });
          }
        }
        this.traverse(pathNode);
      },
      visitCallExpression(pathNode) {
        const node = pathNode.node;
        const callee = node.callee;
        if (
          callee?.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property?.name === 'map'
        ) {
          const unrolled = unrollCollectionSource(callee.object, aliases);
          const arrayName = unrolled?.rootName || (callee.object?.type === 'Identifier' ? callee.object.name : null);
          if (!arrayName) {
            this.traverse(pathNode);
            return;
          }
          const callback = (node.arguments || [])[0];
          if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')) {
            const params = callback.params || [];
            const itemParam = params[0]?.type === 'Identifier' ? params[0].name : null;
            const indexParam = params[1]?.type === 'Identifier' ? params[1].name : null;

            // Find returned JSX root element
            const rootElement = getCallbackRootElement(callback);
            if (rootElement) {
              const rootTagName = getJsxName(rootElement);
              const isChildCustomComponent = /^[A-Z]/.test(rootTagName) && components.has(rootTagName);
              const childComponent = isChildCustomComponent ? components.get(rootTagName) : null;

              // Check what props are passed to this child component
              let passedProps = {};
              let hasSpreadItem = false;
              if (rootElement.openingElement) {
                for (const attr of rootElement.openingElement.attributes || []) {
                  if (attr.type === 'JSXAttribute' && attr.name) {
                    const propName = attr.name.name;
                    const propVal = attr.value?.expression || attr.value;
                    if (propVal && (propVal.type === 'Identifier' || propVal.type === 'JSXIdentifier')) {
                      passedProps[propName] = propVal.name;
                    }
                  } else if (attr.type === 'JSXSpreadAttribute') {
                    const expr = attr.argument;
                    if (expr && (expr.type === 'Identifier' || expr.type === 'JSXIdentifier') && expr.name === itemParam) {
                      hasSpreadItem = true;
                    }
                  }
                }
              }

              collections.push({
                file: relativeFile,
                loc: locKey(node),
                rootLoc: locKey(rootElement),
                arrayName,
                itemParam,
                indexParam,
                rootTagName,
                isChildCustomComponent,
                childComponent,
                passedProps,
                hasSpreadItem,
                pipelineChain: unrolled?.chain || [],
                dataSource: dataSources.get(arrayName) || null,
              });
            }
          }
        }
        this.traverse(pathNode);
      },
    });
  }

  function getCallbackRootElement(callback) {
    if (!callback) return null;
    const body = callback.body;
    if (!body) return null;
    if (body.type === 'JSXElement') return body;
    if (body.type === 'ParenthesizedExpression') return getCallbackRootElement({ body: body.expression });
    if (body.type === 'BlockStatement') {
      for (const stmt of body.body || []) {
        if (stmt.type === 'ReturnStatement' && stmt.argument) {
          const arg = stmt.argument.type === 'ParenthesizedExpression' ? stmt.argument.expression : stmt.argument;
          if (arg?.type === 'JSXElement') return arg;
        }
      }
    }
    return null;
  }

  function inferComponentNameFromFile(filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    if (base === 'index' || base === 'page') {
      const parent = path.basename(path.dirname(filePath));
      return parent.charAt(0).toUpperCase() + parent.slice(1);
    }
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  return {
    components,
    dataSources,
    collections,
    assetImports,
    backgroundImages,
    componentUsages,
    getComponent(name) {
      return components.get(name) || null;
    },
    getDataSource(name) {
      return dataSources.get(name) || null;
    },
    getCollectionByLoc(loc) {
      return collections.find((c) => c.loc === loc || c.rootLoc === loc) || null;
    },
    getAssetImport(file, identifier) {
      return assetImports.get(file)?.get(identifier) || null;
    },
    getComponentUsages(name) {
      return componentUsages.filter((u) => u.componentName === name);
    },
  };
}

module.exports = {
  buildProjectIR,
  resolvePublicAssetUrl,
  objectLiteralToPlain,
};

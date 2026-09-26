const fs = require('fs');
const path = require('path');
const recast = require('recast');
const {
  parseSource,
  locKey,
  getJsxName,
  getJsxAttributeLiteral,
  hasJsxAttribute,
  collectJsxText,
  findJsxAttribute,
  unwrapExpr,
} = require('./ast.cjs');
const {
  activeAdapters,
  recognizeWithAdapters,
  resolveActionWithAdapters,
  isIconComponent,
  classifyHref,
  classifyActionIntent,
  isLikelyCtaClass,
  SKIP_TAGS,
  HEADING_TAGS,
  TEXT_TAGS,
  ACTION_TAGS,
  IMAGE_TAGS,
  FORM_INPUT_TAGS,
  FORM_CONTAINER_TAGS,
  DECORATIVE_TAGS,
} = require('./adapters.cjs');
const { shortHash } = require('./fs-utils.cjs');
const { resolveImportSpecifier } = require('./scanner.cjs');
const { resolvePublicAssetUrl } = require('./ir-builder.cjs');
const { analyzeElementFragments } = require('./text-fragment-analyzer.cjs');
const { BROAD_CONTENT_CONTAINERS } = require('./fivora-contract.cjs');
const { classifyFieldType } = require('./field-paths.cjs');

const TECHNICAL_TEXT_RE = /^(true|false|null|undefined|px|rem|em|auto|hidden|flex|grid|sr-only)$/i;
const ARIA_ONLY_RE = /^(aria-|data-state|data-slot|data-orientation)/;
const SKIP_ATTR_NAMES = new Set(['className', 'class', 'style', 'key', 'id', 'role', 'type', 'name', 'htmlFor', 'suppressHydrationWarning']);
const USER_FACING_PROP_NAMES = new Set([
  'title',
  'heading',
  'subheading',
  'subtitle',
  'label',
  'description',
  'caption',
  'badge',
  'buttonText',
  'ctaText',
  'helperText',
  'summary',
]);

const importedDataCache = new Map();

function resolveImportedBinding(specifier, identifierName, currentFileAbs, profile) {
  if (!specifier || !profile?.root || !currentFileAbs) return null;
  const resolved = resolveImportSpecifier(profile, currentFileAbs, specifier);
  if (!resolved || !fs.existsSync(resolved)) return null;
  if (importedDataCache.has(resolved)) {
    return importedDataCache.get(resolved).get(identifierName) || null;
  }
  try {
    const src = fs.readFileSync(resolved, 'utf8');
    const importedAst = parseSource(src, resolved);
    const importedBindings = collectStringBindings(importedAst);
    importedDataCache.set(resolved, importedBindings);
    return importedBindings.get(identifierName) || null;
  } catch {
    return null;
  }
}

function fingerprintCandidate(features) {
  return shortHash(JSON.stringify(features));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isStaticSkipText(text, isLogoContext = false) {
  const value = normalizeText(text);
  if (!value) return true;
  if (value.length < 2 && !isLogoContext) return true;
  if (TECHNICAL_TEXT_RE.test(value)) return true;
  if (/^[{}`\\]/.test(value)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(value)) return true;
  return false;
}

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

function collectStringBindings(ast) {
  const bindings = new Map();
  recast.types.visit(ast, {
    visitVariableDeclarator(pathNode) {
      const node = pathNode.node;
      if (node.id && node.id.type === 'Identifier' && node.init) {
        const init = unwrapTypeCasts(node.init);
        if (init.type === 'StringLiteral' || (init.type === 'Literal' && typeof init.value === 'string')) {
          bindings.set(node.id.name, String(init.value));
        }
        if (init.type === 'ArrayExpression') {
          const items = [];
          for (const el of init.elements || []) {
            if (!el) continue;
            const inner = unwrapTypeCasts(el);
            if (inner.type === 'StringLiteral' || (inner.type === 'Literal' && typeof inner.value === 'string')) {
              items.push({ type: 'string', value: String(inner.value) });
            } else if (inner.type === 'ObjectExpression') {
              const obj = objectLiteralToPlain(inner);
              if (obj && Object.keys(obj).length > 0) {
                items.push({ type: 'object', value: obj });
              }
            }
          }
          if (items.length > 0) {
            bindings.set(node.id.name, { kind: 'array', items });
          }
        }
        if (init.type === 'ObjectExpression') {
          const obj = objectLiteralToPlain(init);
          if (obj && Object.keys(obj).length > 0) {
            bindings.set(node.id.name, { kind: 'object', value: obj });
          }
        }
      }
      this.traverse(pathNode);
    },
  });
  return bindings;
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
    } else if (val.type === 'NullLiteral' || (val.type === 'Literal' && val.value === null)) {
      out[key] = null;
    } else if (val.type === 'TemplateLiteral' && (!val.expressions || val.expressions.length === 0)) {
      out[key] = val.quasis?.map((q) => q.value?.cooked || q.value?.raw || '').join('') || '';
    } else if (val.type === 'Identifier') {
      if (/^[A-Z]/.test(val.name)) {
        // Component references (e.g. icon: Truck) are not merchant content.
        // Skip this key only so primitive siblings (title, body) stay convertible.
        continue;
      }
      out[key] = val.name;
    } else if (val.type === 'UnaryExpression' && val.argument) {
      if (val.operator === '-' && (val.argument.type === 'NumericLiteral' || typeof val.argument.value === 'number')) {
        out[key] = -val.argument.value;
      } else if (val.operator === '!' && (val.argument.type === 'BooleanLiteral' || typeof val.argument.value === 'boolean')) {
        out[key] = !val.argument.value;
      }
    } else if (val.type === 'ArrayExpression') {
      const arr = [];
      for (const el of val.elements || []) {
        if (!el) continue;
        const inner = unwrapTypeCasts(el);
        if (!inner) continue;
        if (inner.type === 'StringLiteral' || (inner.type === 'Literal' && typeof inner.value === 'string')) {
          arr.push(String(inner.value));
        } else if (inner.type === 'NumericLiteral' || (inner.type === 'Literal' && typeof inner.value === 'number')) {
          arr.push(inner.value);
        } else if (inner.type === 'BooleanLiteral' || (inner.type === 'Literal' && typeof inner.value === 'boolean')) {
          arr.push(inner.value);
        } else if (inner.type === 'ObjectExpression') {
          const nestedObj = objectLiteralToPlain(inner);
          if (nestedObj) arr.push(nestedObj);
        } else if (inner.type === 'Identifier') {
          arr.push(inner.name);
        }
      }
      out[key] = arr;
    } else if (val.type === 'ObjectExpression') {
      const nestedObj = objectLiteralToPlain(val);
      if (nestedObj) out[key] = nestedObj;
    }
  }
  return out;
}

function collectImportMap(ast) {
  const map = {};
  recast.types.visit(ast, {
    visitImportDeclaration(pathNode) {
      const source = pathNode.node.source && pathNode.node.source.value;
      for (const spec of pathNode.node.specifiers || []) {
        const local = spec.local && spec.local.name;
        if (local) map[local] = source;
      }
      this.traverse(pathNode);
    },
  });
  return map;
}

function fileAlreadyEditable(code) {
  return code.includes('data-preview-field-path') || code.includes('useSiteData') || code.includes('SiteDataProvider');
}

function isDynamicExpression(expr, bindings) {
  if (!expr) return true;
  if (expr.type === 'JSXEmptyExpression') return false;
  if (expr.type === 'StringLiteral' || expr.type === 'Literal' || expr.type === 'NumericLiteral' || expr.type === 'BooleanLiteral') {
    return false;
  }
  if (expr.type === 'TemplateLiteral' && (!expr.expressions || expr.expressions.length === 0)) return false;
  if (expr.type === 'Identifier' && bindings.has(expr.name) && typeof bindings.get(expr.name) === 'string') {
    return false;
  }
  if (expr.type === 'Identifier' && bindings.has(expr.name) && bindings.get(expr.name)?.kind === 'array') {
    return false;
  }
  return true;
}

function getBindingVal(bindings, name) {
  if (!bindings) return undefined;
  if (typeof bindings.get === 'function') return bindings.get(name);
  return bindings[name];
}

function hasDynamicExpressionChild(node, bindings) {
  const children = node.children || [];
  for (const child of children) {
    if (!child) continue;
    if (child.type === 'JSXExpressionContainer') {
      const expr = child.expression;
      if (!expr) continue;
      if (expr.type === 'StringLiteral' || (expr.type === 'Literal' && typeof expr.value === 'string')) continue;
      if (expr.type === 'NumericLiteral' || (expr.type === 'Literal' && typeof expr.value === 'number')) continue;
      if (expr.type === 'TemplateLiteral' && (!expr.expressions || expr.expressions.length === 0)) continue;
      if (expr.type === 'Identifier' && typeof getBindingVal(bindings, expr.name) === 'string') continue;
      return true;
    }
  }
  return false;
}

function resolveChildText(node, bindings) {
  if (hasDynamicExpressionChild(node, bindings)) {
    return { text: '', dynamic: true, fromBinding: false };
  }

  const direct = collectJsxText(node);
  if (direct) return { text: direct, dynamic: false, fromBinding: false };

  const children = node.children || [];
  const texts = [];
  let fromBinding = false;
  for (const child of children) {
    if (!child) continue;
    if (child.type === 'JSXText') {
      const value = normalizeText(child.value);
      if (value) texts.push(value);
    } else if (child.type === 'JSXExpressionContainer') {
      const expr = child.expression;
      if (!expr) continue;
      if (expr.type === 'StringLiteral' || (expr.type === 'Literal' && typeof expr.value === 'string')) {
        texts.push(String(expr.value));
      } else if (expr.type === 'Identifier') {
        const val = getBindingVal(bindings, expr.name);
        if (typeof val === 'string') {
          texts.push(val);
          fromBinding = true;
        } else {
          return { text: '', dynamic: true, fromBinding: false };
        }
      } else if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
        texts.push(expr.quasis.map((q) => q.value.cooked || '').join(''));
      } else {
        return { text: '', dynamic: true, fromBinding: false };
      }
    } else if (child.type === 'JSXElement') {
      continue;
    }
  }
  return { text: normalizeText(texts.join(' ')), dynamic: false, fromBinding };
}

/** True when the element renders literal text as a direct child. */
function hasDirectLiteralText(node) {
  return (node.children || []).some(
    (child) => child?.type === 'JSXText' && normalizeText(child.value).length > 2
  );
}

function hasEditableMarker(node) {
  return hasJsxAttribute(node, 'data-preview-field-path') || hasJsxAttribute(node, 'data-preview-item-path');
}

function hasStaticMarker(node) {
  return hasJsxAttribute(node, 'data-preview-static');
}

function isElementOrParentHidden(pathNode) {
  let current = pathNode;
  while (current) {
    const node = current.node || current.value || current;
    if (node && (node.type === 'JSXElement' || node.type === 'JSXOpeningElement')) {
      const attrs = (node.type === 'JSXElement' ? node.openingElement?.attributes : node.attributes) || [];
      if (attrs.some((a) => a.type === 'JSXAttribute' && a.name && (
        a.name.name === 'hidden' ||
        (a.name.name === 'aria-hidden' && /true/.test(recast.print(a).code))
      ))) {
        return true;
      }
      const classAttr = attrs.find((a) => a.type === 'JSXAttribute' && a.name && (a.name.name === 'className' || a.name.name === 'class'));
      if (classAttr) {
        const rawClass = recast.print(classAttr).code;
        if (/(?<![\w-])hidden(?![a-zA-Z0-9_-])/.test(rawClass)) return true;
      }
      const styleAttr = attrs.find((a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'style');
      if (styleAttr) {
        const rawStyle = recast.print(styleAttr).code;
        if (/(?:display\s*:\s*['"]none['"]|visibility\s*:\s*['"]hidden['"])/.test(rawStyle)) return true;
      }
    }
    current = current.parentPath || current.parent;
  }
  return false;
}

function parentNames(pathNode) {
  const names = [];
  let current = pathNode.parent;
  while (current) {
    const node = current.node || current.value || current;
    if (node && node.type === 'JSXElement') names.push(getJsxName(node));
    current = current.parentPath || current.parent;
  }
  return names;
}

function inMapCallback(pathNode) {
  let current = pathNode.parent;
  while (current) {
    const node = current.node || current.value || current;
    if (node && node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee && callee.type === 'MemberExpression' && !callee.computed && callee.property && callee.property.name === 'map') {
        const callback = (node.arguments || [])[0];
        const params = callback?.params || [];
        return {
          objectName: callee.object && callee.object.type === 'Identifier' ? callee.object.name : null,
          call: node,
          callback,
          itemParam: params[0]?.type === 'Identifier' ? params[0].name : null,
          indexParam: params[1]?.type === 'Identifier' ? params[1].name : null,
          rootElement: callbackRootElement(callback),
        };
      }
    }
    current = current.parentPath || current.parent;
  }
  return null;
}

/**
 * The single JSX element a map callback returns. Collection contracts attach to
 * this element, so ARC must emit exactly one candidate per map instead of one
 * per descendant.
 */
function callbackRootElement(callback) {
  if (!callback) return null;
  const body = callback.body;
  if (!body) return null;
  if (body.type === 'JSXElement' || body.type === 'JSXFragment') return body;
  if (body.type === 'ParenthesizedExpression') return callbackRootElement({ body: body.expression });
  if (body.type === 'BlockStatement') {
    for (const statement of body.body || []) {
      if (statement.type === 'ReturnStatement' && statement.argument) {
        const argument = statement.argument.type === 'ParenthesizedExpression'
          ? statement.argument.expression
          : statement.argument;
        if (argument.type === 'JSXElement' || argument.type === 'JSXFragment') return argument;
      }
    }
  }
  return null;
}

/**
 * Finds which properties of the map item variable are rendered as visible text,
 * image sources or link destinations, so the generated list schema mirrors the
 * fields the component genuinely displays.
 */
function collectItemFieldUsage(callback, itemParam) {
  const usage = new Map();
  if (!callback || !itemParam) return usage;

  function record(property, role) {
    if (!property || usage.has(property)) return;
    usage.set(property, role);
  }

  function findItemMemberProperties(expr) {
    const props = [];
    if (!expr) return props;
    if (expr.type === 'MemberExpression' && !expr.computed) {
      if (expr.object?.type === 'Identifier' && expr.object.name === itemParam) {
        if (expr.property?.name) props.push(expr.property.name);
      } else if (expr.object?.type === 'MemberExpression') {
        const sub = findItemMemberProperties(expr.object);
        if (sub.length > 0 && expr.property?.name) {
          props.push(expr.property.name);
        }
      }
    } else if (expr.type === 'LogicalExpression' || expr.type === 'BinaryExpression') {
      props.push(...findItemMemberProperties(expr.left));
      props.push(...findItemMemberProperties(expr.right));
    } else if (expr.type === 'ConditionalExpression') {
      props.push(...findItemMemberProperties(expr.test));
      props.push(...findItemMemberProperties(expr.consequent));
      props.push(...findItemMemberProperties(expr.alternate));
    } else if (expr.type === 'TemplateLiteral') {
      for (const sub of expr.expressions || []) {
        props.push(...findItemMemberProperties(sub));
      }
    }
    return props;
  }

  let usesItemAsComponent = false;
  let usesDirectItem = false;
  const componentProps = new Set();
  recast.types.visit(callback, {
    visitJSXOpeningElement(pathNode) {
      const name = pathNode.node.name;
      if (name?.type === 'JSXMemberExpression') {
        const objectName = name.object && name.object.name;
        if ((name.object?.type === 'Identifier' || name.object?.type === 'JSXIdentifier') && objectName === itemParam) {
          usesItemAsComponent = true;
          if (name.property?.name) componentProps.add(name.property.name);
        }
      }
      this.traverse(pathNode);
    },
    visitJSXExpressionContainer(pathNode) {
      const rawExpr = pathNode.node.expression;
      const unwrapped = unwrapTypeCasts(rawExpr);
      if (unwrapped && (unwrapped.type === 'Identifier' || unwrapped.type === 'JSXIdentifier') && unwrapped.name === itemParam) {
        usesDirectItem = true;
      }
      const properties = findItemMemberProperties(pathNode.node.expression);
      for (const property of properties) {
        if (componentProps.has(property)) continue;
        const parent = pathNode.parent?.node || pathNode.parent?.value;
        if (parent?.type === 'JSXAttribute') {
          const attribute = parent.name?.name;
          if (attribute === 'src') record(property, 'image');
          else if (attribute === 'href') record(property, 'url');
          else if (attribute === 'alt' || attribute === 'title') record(property, 'text');
          else if (attribute === 'rating' || attribute === 'score' || attribute === 'count') record(property, 'number');
        } else {
          if (/rating|stars|score|count/i.test(property)) record(property, 'number');
          else if (/avatar|image|photo|icon/i.test(property)) record(property, 'image');
          else if (/quote|comment|review|bio|description/i.test(property)) record(property, 'textarea');
          else record(property, 'text');
        }
      }
      this.traverse(pathNode);
    },
  });

  return { usage, usesItemAsComponent, usesDirectItem };
}

function classNameOf(node) {
  return getJsxAttributeLiteral(node, 'className') || getJsxAttributeLiteral(node, 'class') || '';
}

function confidenceFor(kind, extras = {}) {
  if (extras.already) return 1;
  if (extras.dynamic) return 0.15;
  if (extras.apiOwned) return 0.2;
  if (extras.icon) return 0.1;
  if (kind === 'url' && extras.action === 'whatsapp') return 0.96;
  if (kind === 'url' && extras.social) return 0.93;
  if (kind === 'split-action-contract' || kind === 'form-submit-action') return 0.94;
  if (kind === 'text' && HEADING_TAGS.has(extras.tag)) return 0.95;
  if (kind === 'text' && extras.tag === 'p') return 0.9;
  if (kind === 'image') return 0.88;
  if (kind === 'alt') return 0.86;
  if (kind === 'placeholder') return 0.84;
  if (kind === 'text' && extras.tag === 'span') return extras.cta ? 0.82 : 0.7;
  if (kind === 'text' && extras.tag === 'button') return 0.9;
  if (kind === 'collection') return extras.staticCollection ? 0.86 : 0.35;
  if (kind === 'text') return 0.78;
  return 0.65;
}

function skipReasonForFile(relativeFile, code) {
  if (/\.(stories|spec|test)\.(tsx|jsx|ts|js)$/.test(relativeFile)) return 'test-or-story-file';
  if (/node_modules/.test(relativeFile)) return 'dependency';
  if (code.includes('class-variance-authority') && code.includes('Slot') && !collectLooseText(code)) {
    return 'primitive-ui';
  }
  return null;
}

function collectLooseText(code) {
  return /<(h[1-6]|p|Button|span)[^>]*>\s*[A-Za-z]/.test(code);
}

function analyzeFile(optionsOrFile, codeArg, profileArg) {
  let code, relativeFile, profile, graph, ownerScope, componentMeta, ir;
  if (typeof optionsOrFile === 'string') {
    relativeFile = optionsOrFile;
    code = codeArg;
    profile = profileArg;
    ir = profile?.ir || null;
  } else {
    ({ code, relativeFile, profile, graph, ownerScope, componentMeta, ir = profile?.ir || null } = optionsOrFile || {});
  }
  const adapters = activeAdapters(profile);
  const fileSkip = skipReasonForFile(relativeFile, code);
  if (fileSkip) {
    return { candidates: [], skipped: true, reason: fileSkip, alreadyEditable: fileAlreadyEditable(code) };
  }

  let ast;
  try {
    ast = parseSource(code, relativeFile);
  } catch (err) {
    return {
      candidates: [],
      skipped: true,
      reason: 'parse-error',
      error: err.message,
      alreadyEditable: fileAlreadyEditable(code),
    };
  }

  const bindings = collectStringBindings(ast);
  const imports = collectImportMap(ast);
  const candidates = [];
  const usedLocs = new Set();

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const name = getJsxName(node);
      const loc = locKey(node);
      if (!loc || usedLocs.has(loc)) {
        this.traverse(pathNode);
        return;
      }

      if (SKIP_TAGS.has(name) || name === 'React.Fragment' || name === '') {
        this.traverse(pathNode);
        return;
      }

      if (hasEditableMarker(node)) {
        candidates.push({
          loc,
          tag: name,
          kind: 'already-editable',
          confidence: 1,
          skip: true,
          reason: 'already-has-preview-binding',
          file: relativeFile,
          ownerScope,
        });
        this.traverse(pathNode);
        return;
      }

      if (isElementOrParentHidden(pathNode)) {
        candidates.push({
          loc,
          tag: name,
          kind: 'decoration',
          confidence: 0.1,
          skip: true,
          reason: 'hidden-element-strict-contract',
          file: relativeFile,
          ownerScope,
        });
        this.traverse(pathNode);
        return;
      }

      const importSource = imports[name.split('.')[0]];
      const recognition = recognizeWithAdapters(node, { profile, imports }, adapters);
      const mapInfo = inMapCallback(pathNode);
      let apiOwned = false;
      if (mapInfo && mapInfo.objectName) {
        let binding = bindings.get(mapInfo.objectName);
        if (!binding && imports[mapInfo.objectName]) {
          const currentFileAbs = profile?.root ? path.join(profile.root, relativeFile) : null;
          binding = resolveImportedBinding(imports[mapInfo.objectName], mapInfo.objectName, currentFileAbs, profile);
          if (binding) {
            bindings.set(mapInfo.objectName, binding);
          }
        }
        if (!binding || binding.kind !== 'array') apiOwned = true;
      }

      if (DECORATIVE_TAGS.has(name) || isIconComponent(name, importSource)) {
        candidates.push({
          loc,
          tag: name,
          kind: 'decoration',
          confidence: 0.1,
          skip: true,
          reason: 'decorative-icon',
          file: relativeFile,
          ownerScope,
          fingerprint: fingerprintCandidate({ tag: name, kind: 'icon', importSource }),
        });
        this.traverse(pathNode);
        return;
      }

      const parents = parentNames(pathNode);

      if (name === 'source' && (parents[0] === 'picture' || recognition?.kind === 'responsive-image-source')) {
        candidates.push({
          loc,
          tag: name,
          kind: 'decoration',
          confidence: 0.95,
          skip: true,
          reason: 'picture-source-child',
          file: relativeFile,
          ownerScope,
        });
        this.traverse(pathNode);
        return;
      }

      const href = getJsxAttributeLiteral(node, 'href');
      let src = getJsxAttributeLiteral(node, 'src');
      let importedAssetIdentifier = null;

      if (name === 'picture') {
        const children = node.children || [];
        const imgChild = children.find((c) => c && c.type === 'JSXElement' && (getJsxName(c) === 'img' || getJsxName(c) === 'Image'));
        if (imgChild) {
          src = getJsxAttributeLiteral(imgChild, 'src');
          if (!src && imgChild.openingElement) {
            const srcAttr = findJsxAttribute(imgChild, 'src');
            if (srcAttr && srcAttr.value?.type === 'JSXExpressionContainer') {
              const expr = srcAttr.value.expression;
              if (expr?.type === 'Identifier') {
                const spec = imports[expr.name];
                if (spec) {
                  const currentFileAbs = profile?.root ? path.join(profile.root, relativeFile) : null;
                  const publicUrl = resolvePublicAssetUrl(profile, currentFileAbs, spec);
                  if (publicUrl) {
                    src = publicUrl;
                    importedAssetIdentifier = expr.name;
                  }
                }
              }
            }
          }
        }
      }

      if (!src && node.openingElement) {
        const srcAttr = findJsxAttribute(node, 'src');
        if (srcAttr && srcAttr.value?.type === 'JSXExpressionContainer') {
          const expr = srcAttr.value.expression;
          if (expr?.type === 'Identifier') {
            const spec = imports[expr.name];
            if (spec) {
              const currentFileAbs = profile?.root ? path.join(profile.root, relativeFile) : null;
              const publicUrl = resolvePublicAssetUrl(profile, currentFileAbs, spec);
              if (publicUrl) {
                src = publicUrl;
                importedAssetIdentifier = expr.name;
              }
            }
          }
        }
      }
      const alt = getJsxAttributeLiteral(node, 'alt');
      const placeholder = getJsxAttributeLiteral(node, 'placeholder');
      const className = classNameOf(node);
      const textInfo = resolveChildText(node, bindings);
      const actionNode = resolveActionWithAdapters(node, adapters) || (ACTION_TAGS.has(name) ? node : null);

      const isHeaderNav =
        parents.some((p) => /header|nav|navbar/i.test(p)) ||
        /header|nav|navbar/i.test(name) ||
        /header|nav/i.test(relativeFile) ||
        componentMeta?.role === 'navigation';
      const ariaLabel = getJsxAttributeLiteral(node, 'aria-label') || '';
      const isExplicitLogo = /\b(site-logo|brand-logo|nav-logo|header-logo|monogram)\b/i.test(className);
      const isLogoContext =
        isExplicitLogo ||
        (isHeaderNav && /\blogo\b/i.test(className)) ||
        (isHeaderNav && /\b(logo|home)\b/i.test(ariaLabel)) ||
        (isHeaderNav && (href === '/' || href === ''));

      const baseMeta = {
        loc,
        tag: name,
        file: relativeFile,
        ownerScope: (isLogoContext && isHeaderNav) ? 'common' : ownerScope,
        componentName: componentMeta?.name,
        role: componentMeta?.role,
        className,
        parentName: parents[0],
        recognition,
        inMap: Boolean(mapInfo),
        apiOwned,
        fromBinding: textInfo.fromBinding,
      };

      if (isLogoContext) {
        if ((IMAGE_TAGS.has(name) || recognition?.kind === 'image') && src && !src.startsWith('{')) {
          usedLocs.add(loc);
          candidates.push({
            ...baseMeta,
            kind: 'image',
            operation: 'extract-image',
            value: src,
            extra: { alt: alt || 'Logo', isBrandLogo: true },
            confidence: 0.98,
            reason: 'brand-logo-image',
            fingerprint: fingerprintCandidate({ tag: name, kind: 'logo-image' }),
          });
          this.traverse(pathNode);
          return;
        }

        if (name === 'Link' || name === 'a' || name === 'span') {
          const logoText = textInfo.text || collectJsxText(node);
          if (logoText && !isStaticSkipText(logoText, true)) {
            usedLocs.add(loc);
            candidates.push({
              ...baseMeta,
              kind: 'text',
              operation: 'extract-text',
              value: logoText,
              extra: { tag: name, isBrandLogo: true },
              confidence: 0.98,
              reason: 'brand-logo-text',
              fingerprint: fingerprintCandidate({ tag: name, kind: 'logo-text', text: logoText }),
            });
            this.traverse(pathNode);
            return;
          }
        }
      }

      if ((IMAGE_TAGS.has(name) || recognition?.kind === 'image') && src && !src.startsWith('{')) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'image',
          operation: 'extract-image',
          value: src,
          extra: { alt, importedIdentifier: importedAssetIdentifier },
          confidence: confidenceFor('image', { dynamic: false }),
          reason: importedAssetIdentifier ? 'imported-static-asset-image' : 'literal-image-source',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'image', hasAlt: Boolean(alt), imported: Boolean(importedAssetIdentifier) }),
        });
        if (alt && !isStaticSkipText(alt)) {
          candidates.push({
            ...baseMeta,
            kind: 'alt',
            operation: 'extract-alt',
            value: alt,
            confidence: confidenceFor('alt'),
            reason: 'literal-image-alt',
            fingerprint: fingerprintCandidate({ tag: name, kind: 'alt' }),
          });
        }
        this.traverse(pathNode);
        return;
      }

      if (placeholder && !isStaticSkipText(placeholder)) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'placeholder',
          operation: 'extract-placeholder',
          value: placeholder,
          confidence: confidenceFor('placeholder'),
          reason: 'literal-placeholder',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'placeholder' }),
        });
      }

      const bgMatch = className && className.match(/\bbg-\[url\(['"]?([^'"\)]+)['"]?\)\]/);
      if (bgMatch && bgMatch[1] && !usedLocs.has(loc + ':bg')) {
        usedLocs.add(loc + ':bg');
        candidates.push({
          ...baseMeta,
          kind: 'image',
          operation: 'extract-tailwind-bg',
          value: bgMatch[1],
          extra: { rawClass: className, bgUrl: bgMatch[1] },
          confidence: 0.92,
          reason: 'tailwind-arbitrary-background-image',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'bg-image', url: bgMatch[1] }),
        });
      }

      const isCustomComponent = Boolean(name && ((name[0] >= 'A' && name[0] <= 'Z') || name.includes('.')));
      if (isCustomComponent && !apiOwned && node.openingElement && Array.isArray(node.openingElement.attributes)) {
        const passedLiteralProps = {};
        for (const attr of node.openingElement.attributes) {
          if (attr.type === 'JSXAttribute' && attr.name && USER_FACING_PROP_NAMES.has(attr.name.name)) {
            const propName = attr.name.name;
            let propValue = '';
            if (attr.value) {
              if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') {
                propValue = String(attr.value.value || '');
              } else if (attr.value.type === 'JSXExpressionContainer') {
                const expr = attr.value.expression;
                if (expr && (expr.type === 'StringLiteral' || expr.type === 'Literal')) {
                  propValue = String(expr.value || '');
                } else if (expr && (expr.type === 'NumericLiteral' || (expr.type === 'Literal' && typeof expr.value === 'number'))) {
                  propValue = expr.value;
                }
              }
            }
            if (propValue && !isStaticSkipText(String(propValue))) {
              passedLiteralProps[propName] = propValue;
              const propLoc = `${loc}:${propName}`;
              if (!usedLocs.has(propLoc)) {
                usedLocs.add(propLoc);
                candidates.push({
                  ...baseMeta,
                  loc: propLoc,
                  kind: 'text',
                  operation: 'extract-prop',
                  value: propValue,
                  extra: { propName, tag: name },
                  confidence: 0.88,
                  reason: `component-prop-${propName}`,
                  fingerprint: fingerprintCandidate({ tag: name, kind: 'prop', propName }),
                });
              }
            }
          }
        }
        if (Object.keys(passedLiteralProps).length > 0 && !usedLocs.has(loc + ':prop-flow')) {
          usedLocs.add(loc + ':prop-flow');
          const compDef = (profile?.components || []).find((c) => c.name === name) ||
            (ir && typeof ir.getComponent === 'function' && ir.getComponent(name));
          if (compDef) {
            candidates.push({
              ...baseMeta,
              kind: 'prop-flow',
              operation: 'prop-flow-callsite',
              value: passedLiteralProps,
              extra: {
                componentName: name,
                componentFile: compDef.file,
                literalProps: passedLiteralProps,
              },
              confidence: 0.95,
              reason: `reusable-component-prop-flow-${name}`,
              fingerprint: fingerprintCandidate({ tag: name, kind: 'prop-flow', props: Object.keys(passedLiteralProps) }),
            });
          }
        }
      }

      const insideForm = parents.some((p) => FORM_CONTAINER_TAGS.has(p));

      const actionableHref = href || (name === 'Button' ? getJsxAttributeLiteral(node, 'href') : null);
      const innerText = textInfo.dynamic ? '' : textInfo.text;
      const typeAttr = getJsxAttributeLiteral(node, 'type');
      const isSubmit = typeAttr === 'submit';

      // Check for action intent via classifyActionIntent (covers Form Submit, WhatsApp, Call/Phone, Directions, Location, Shop, Email)
      const actionIntent = !apiOwned ? classifyActionIntent(innerText, actionableHref) : null;

      const isFormSubmit =
        !apiOwned &&
        (ACTION_TAGS.has(name) || isLikelyCtaClass(className)) &&
        (isSubmit ||
          (insideForm && (actionIntent?.action === 'form-submit' || (innerText && !actionableHref))) ||
          actionIntent?.action === 'form-submit');

      if (isFormSubmit && innerText && !textInfo.dynamic) {
        usedLocs.add(loc);
        const resolvedHref = actionableHref || (actionIntent ? actionIntent.defaultUrl : 'https://wa.me/1234567890');
        candidates.push({
          ...baseMeta,
          kind: 'form-submit-action',
          operation: 'form-submit-action',
          value: resolvedHref,
          label: innerText,
          extra: {
            action: 'form-submit',
            external: true,
            insideForm,
            isSubmit,
          },
          confidence: confidenceFor('form-submit-action'),
          reason: 'form-submit-whatsapp-dispatch',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'form-submit-action', action: 'form-submit' }),
        });
        this.traverse(pathNode);
        return;
      }

      const isHashAnchor = Boolean(actionableHref && actionableHref.startsWith('#') && (!actionIntent || actionIntent.action === 'link'));
      if (isHashAnchor && innerText && !textInfo.dynamic && !apiOwned) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'text',
          operation: 'extract-text',
          value: innerText,
          confidence: confidenceFor('text'),
          reason: 'in-page-anchor-label',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'text', text: innerText }),
        });
        this.traverse(pathNode);
        return;
      }

      const isAction = !isSubmit && (Boolean(actionableHref) || Boolean(actionIntent)) && (ACTION_TAGS.has(name) || isLikelyCtaClass(className));

      if (isAction && (actionableHref || actionIntent)) {
        const action = actionIntent ? actionIntent.action : classifyHref(actionableHref);
        const resolvedHref = actionableHref || (actionIntent ? actionIntent.defaultUrl : '#');
        const looksCta = isLikelyCtaClass(className) || ['whatsapp', 'phone', 'email', 'directions', 'location', 'shop'].includes(action) || Boolean(innerText);
        if (looksCta && innerText && !textInfo.dynamic && !apiOwned) {
          usedLocs.add(loc);
          candidates.push({
            ...baseMeta,
            kind: 'split-action-contract',
            operation: 'split-action-contract',
            value: resolvedHref,
            label: innerText,
            extra: {
              action,
              external: actionIntent ? actionIntent.external : false,
              social: !['whatsapp', 'phone', 'email', 'directions', 'location', 'shop', 'link'].includes(action),
              platform: ['instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin', 'pinterest'].includes(action) ? action : undefined,
            },
            confidence: confidenceFor('split-action-contract', { action, social: action !== 'link' }),
            reason: `interactive-${action}-requires-split-contract`,
            fingerprint: fingerprintCandidate({ tag: name, kind: 'action', action, childCount: (node.children || []).length }),
          });
          this.traverse(pathNode);
          return;
        }

        if (action !== 'link' && !innerText && actionableHref) {
          usedLocs.add(loc);
          candidates.push({
            ...baseMeta,
            kind: 'url',
            operation: 'extract-url',
            value: actionableHref,
            extra: { action, platform: action },
            confidence: confidenceFor('url', { action, social: true }),
            reason: `literal-${action}-url`,
            fingerprint: fingerprintCandidate({ tag: name, kind: 'url', action }),
          });
          this.traverse(pathNode);
          return;
        }
      }

      const fragAnalysis = analyzeElementFragments(node);
      if (fragAnalysis.isButtonWithIcon && !apiOwned && !textInfo.dynamic && !usedLocs.has(loc)) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'text',
          operation: 'bind-button-with-icon',
          value: fragAnalysis.combinedText,
          extra: { tag: name, cta: true, hasIcons: true },
          confidence: 0.94,
          reason: 'action-button-with-icon-preserved',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'btn-icon', text: fragAnalysis.combinedText }),
        });
        this.traverse(pathNode);
        return;
      }

      if (fragAnalysis.isHighlightedHeading && !apiOwned && !textInfo.dynamic && !usedLocs.has(loc)) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'text',
          operation: 'bind-highlighted-heading',
          value: fragAnalysis.combinedText,
          extra: {
            tag: name,
            fragments: fragAnalysis.pureTextFragments.map((f) => ({
              type: f.type,
              text: f.text,
              className: f.className || '',
              tag: f.tag || 'span',
            })),
          },
          confidence: 0.96,
          reason: 'semantic-heading-with-highlight-span',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'heading-highlight', text: fragAnalysis.combinedText }),
        });
        this.traverse(pathNode);
        return;
      }

      const headingLike = HEADING_TAGS.has(name) || (recognition && recognition.kind === 'text' && HEADING_TAGS.has(recognition.tag || name));
      const textLike = TEXT_TAGS.has(name) || headingLike || name === 'Button' || name === 'button' || (recognition && recognition.kind === 'text');
      if (textLike && !isAction) {
        if (textInfo.dynamic || apiOwned) {
          candidates.push({
            ...baseMeta,
            kind: 'text',
            operation: 'skip-dynamic',
            skip: true,
            confidence: confidenceFor('text', { dynamic: textInfo.dynamic, apiOwned }),
            reason: apiOwned ? 'existing-dynamic-or-api-data' : 'non-literal-expression',
          });
          this.traverse(pathNode);
          return;
        }
        if (!isStaticSkipText(textInfo.text)) {
          usedLocs.add(loc);
          const kindTag = headingLike ? (name.startsWith('h') ? name : 'h1') : name;
          candidates.push({
            ...baseMeta,
            kind: 'text',
            operation: 'extract-text',
            value: textInfo.text,
            extra: { tag: kindTag, cta: name === 'Button' || name === 'button' },
            confidence: confidenceFor('text', { tag: kindTag, cta: name === 'Button' || name === 'button' }),
            reason: headingLike ? 'semantic-heading' : `literal-${name}-text`,
            fingerprint: fingerprintCandidate({ tag: name, kind: 'text', heading: headingLike }),
          });
        }
      }

      // Fivora refuses data-preview-field-path on broad containers, but strict
      // mode still requires every visible string to be covered. Literal text
      // sitting directly in a <div>/<section> is therefore wrapped in a span
      // that owns the contract, which is layout-neutral for inline content.
      if (
        !textLike &&
        !isAction &&
        BROAD_CONTENT_CONTAINERS.has(name) &&
        !textInfo.dynamic &&
        !apiOwned &&
        textInfo.text &&
        !isStaticSkipText(textInfo.text) &&
        hasDirectLiteralText(node)
      ) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'text',
          operation: 'wrap-text-span',
          value: textInfo.text,
          extra: { tag: name, wrapped: true },
          confidence: 0.86,
          reason: `literal-text-in-${name}-container`,
          fingerprint: fingerprintCandidate({ tag: name, kind: 'text', wrapped: true }),
        });
      }

      // One contract per collection, anchored on the element the map returns.
      if (
        mapInfo &&
        mapInfo.objectName &&
        mapInfo.rootElement === node &&
        bindings.get(mapInfo.objectName)?.kind === 'array'
      ) {
        const arr = bindings.get(mapInfo.objectName);
        const { usage: itemUsage, usesItemAsComponent, usesDirectItem } = collectItemFieldUsage(mapInfo.callback, mapInfo.itemParam);
        const objectItems = arr.items.every((item) => item.type === 'object');
        const stringItems = arr.items.every((item) => item.type === 'string');
        const rootTagName = getJsxName(mapInfo.rootElement);
        const isChildCustomComponent = /^[A-Z]/.test(rootTagName);
        const sampleItem = objectItems
          ? arr.items.find((item) => item?.value && typeof item.value === 'object')?.value
          : null;

        // JSX text positions alone look like generic text, but commerce values
        // such as a bare numeric `price` must remain numeric for catalog range
        // filters, sorting, totals, and database persistence. Formatted values
        // such as "$249" intentionally remain text for legacy templates.
        if (sampleItem) {
          for (const [key, role] of itemUsage) {
            if (role !== 'text') continue;
            const inferredRole = classifyFieldType('text', sampleItem[key], key);
            if (inferredRole !== 'text') itemUsage.set(key, inferredRole);
          }
        }

        // If the map returns a custom child component (e.g. <ProductCard product={item} />),
        // derive item fields from the sample object items if direct JSX member usage was empty
        if (isChildCustomComponent && objectItems && itemUsage.size === 0 && arr.items[0]?.value) {
          const sampleObj = arr.items[0].value;
          for (const key of Object.keys(sampleObj)) {
            if (/^(id|_id|key|slug)$/i.test(key)) continue;
            const role = classifyFieldType('text', sampleObj[key], key);
            itemUsage.set(key, role);
          }
        }

        const boundProperties = [...itemUsage.keys()];
        const convertible =
          (objectItems &&
            boundProperties.length > 0 &&
            arr.items.some((item) => boundProperties.some((key) => key in item.value))) ||
          (stringItems && usesDirectItem) ||
          (isChildCustomComponent && objectItems && boundProperties.length > 0);

        candidates.push({
          ...baseMeta,
          kind: 'collection',
          operation: 'collection-conversion',
          value: arr.items,
          extra: {
            staticCollection: true,
            isPrimitiveArray: stringItems && usesDirectItem,
            binding: mapInfo.objectName,
            itemParam: mapInfo.itemParam,
            indexParam: mapInfo.indexParam,
            itemFields: stringItems ? [] : [...itemUsage.entries()].map(([key, role]) => ({ key, role })),
            objectItems,
            hasComponentRef: usesItemAsComponent && !isChildCustomComponent,
            childComponentName: isChildCustomComponent ? rootTagName : null,
          },
          confidence: convertible
            ? confidenceFor('collection', { staticCollection: true })
            : usesItemAsComponent
              ? 0.2
              : 0.82,
          reason: usesItemAsComponent && !isChildCustomComponent
            ? 'collection-holds-component-ref'
            : isChildCustomComponent
              ? 'collection-with-child-component'
              : convertible
                ? (stringItems ? 'static-primitive-array-map' : 'static-array-map')
                : 'collection-shape-partial',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'collection', size: arr.items.length }),
        });
      }

      this.traverse(pathNode);
    },
  });

  return {
    ast,
    candidates,
    skipped: false,
    alreadyEditable: fileAlreadyEditable(code),
    bindings: Object.fromEntries([...bindings.entries()].filter(([, v]) => typeof v === 'string')),
    imports,
    code,
    relativeFile,
  };
}

function collectDesignSnapshot(code) {
  const classNames = [];
  const styles = [];
  recast.types.visit(parseSource(code, 'snapshot.tsx'), {
    visitJSXAttribute(pathNode) {
      const node = pathNode.node;
      const name = node.name && node.name.name;
      if (name === 'className' || name === 'class') {
        classNames.push(recast.print(node).code);
      }
      if (name === 'style') {
        styles.push(recast.print(node).code);
      }
      this.traverse(pathNode);
    },
  });
  return { classNames, styles };
}

module.exports = {
  analyzeFile,
  collectDesignSnapshot,
  collectStringBindings,
  fingerprintCandidate,
  normalizeText,
  isStaticSkipText,
  resolveChildText,
};

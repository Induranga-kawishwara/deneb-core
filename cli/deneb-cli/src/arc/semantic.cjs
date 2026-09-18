'use strict';

const recast = require('recast');
const {
  parseSource,
  locKey,
  getJsxName,
  getJsxAttributeLiteral,
  hasJsxAttribute,
  collectJsxText,
  findJsxAttribute,
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
const { BROAD_CONTENT_CONTAINERS } = require('./fivora-contract.cjs');

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

function fingerprintCandidate(features) {
  return shortHash(JSON.stringify(features));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isStaticSkipText(text) {
  const value = normalizeText(text);
  if (!value || value.length < 2) return true;
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

function resolveChildText(node, bindings) {
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
      } else if (expr.type === 'Identifier' && typeof bindings.get(expr.name) === 'string') {
        texts.push(bindings.get(expr.name));
        fromBinding = true;
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

  return { usage, usesItemAsComponent };
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

function analyzeFile({ code, relativeFile, profile, graph, ownerScope, componentMeta }) {
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

      const importSource = imports[name.split('.')[0]];
      const recognition = recognizeWithAdapters(node, { profile, imports }, adapters);
      const mapInfo = inMapCallback(pathNode);
      let apiOwned = false;
      if (mapInfo && mapInfo.objectName) {
        const binding = bindings.get(mapInfo.objectName);
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

      const href = getJsxAttributeLiteral(node, 'href');
      const src = getJsxAttributeLiteral(node, 'src');
      const alt = getJsxAttributeLiteral(node, 'alt');
      const placeholder = getJsxAttributeLiteral(node, 'placeholder');
      const className = classNameOf(node);
      const textInfo = resolveChildText(node, bindings);
      const parents = parentNames(pathNode);
      const actionNode = resolveActionWithAdapters(node, adapters) || (ACTION_TAGS.has(name) ? node : null);

      const baseMeta = {
        loc,
        tag: name,
        file: relativeFile,
        ownerScope,
        componentName: componentMeta?.name,
        role: componentMeta?.role,
        className,
        parentName: parents[0],
        recognition,
        inMap: Boolean(mapInfo),
        apiOwned,
        fromBinding: textInfo.fromBinding,
      };

      if ((IMAGE_TAGS.has(name) || recognition?.kind === 'image') && src && !src.startsWith('{')) {
        usedLocs.add(loc);
        candidates.push({
          ...baseMeta,
          kind: 'image',
          operation: 'extract-image',
          value: src,
          extra: { alt },
          confidence: confidenceFor('image', { dynamic: false }),
          reason: 'literal-image-source',
          fingerprint: fingerprintCandidate({ tag: name, kind: 'image', hasAlt: Boolean(alt) }),
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

      const isCustomComponent = Boolean(name && ((name[0] >= 'A' && name[0] <= 'Z') || name.includes('.')));
      if (isCustomComponent && !apiOwned && node.openingElement && Array.isArray(node.openingElement.attributes)) {
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
                }
              }
            }
            if (propValue && !isStaticSkipText(propValue)) {
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
        const { usage: itemUsage, usesItemAsComponent } = collectItemFieldUsage(mapInfo.callback, mapInfo.itemParam);
        const objectItems = arr.items.every((item) => item.type === 'object');
        const boundProperties = [...itemUsage.keys()];
        const convertible =
          objectItems &&
          boundProperties.length > 0 &&
          arr.items.some((item) => boundProperties.some((key) => key in item.value));

        candidates.push({
          ...baseMeta,
          kind: 'collection',
          operation: 'collection-conversion',
          value: arr.items,
          extra: {
            staticCollection: true,
            binding: mapInfo.objectName,
            itemParam: mapInfo.itemParam,
            indexParam: mapInfo.indexParam,
            itemFields: [...itemUsage.entries()].map(([key, role]) => ({ key, role })),
            objectItems,
            hasComponentRef: usesItemAsComponent,
          },
          confidence: convertible
            ? confidenceFor('collection', { staticCollection: true })
            : usesItemAsComponent
              ? 0.2
              : 0.82,
          reason: usesItemAsComponent
            ? 'collection-holds-component-ref'
            : convertible
              ? 'static-array-map'
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
};

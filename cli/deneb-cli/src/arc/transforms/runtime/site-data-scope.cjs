'use strict';

const recast = require('recast');

const SCOPE_STATUS = {
  ALREADY_BOUND: 'ALREADY_BOUND',
  PROP_BOUND: 'PROP_BOUND',
  HOOK_SAFE: 'HOOK_SAFE',
  SERVER_BOUNDARY: 'SERVER_BOUNDARY',
  UTILITY_FUNCTION: 'UTILITY_FUNCTION',
  PROVIDER_OWNER: 'PROVIDER_OWNER',
  INVALID_SCOPE: 'INVALID_SCOPE',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Checks if an AST node or its return statements return JSX elements or fragments.
 */
function functionReturnsJsx(fn) {
  if (!fn || !fn.body) return false;
  let returnsJsx = false;

  // Direct expression body: () => <div />
  if (fn.body.type === 'JSXElement' || fn.body.type === 'JSXFragment') {
    return true;
  }

  recast.types.visit(fn.body, {
    visitReturnStatement(pathNode) {
      const arg = pathNode.node.argument;
      if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
        returnsJsx = true;
        return false;
      }
      this.traverse(pathNode);
    },
    // Don't traverse into nested functions to avoid attributing nested JSX to outer function
    visitFunctionDeclaration() {
      return false;
    },
    visitFunctionExpression() {
      return false;
    },
    visitArrowFunctionExpression() {
      return false;
    },
  });

  return returnsJsx;
}

/**
 * Checks if a function mounts or references <SiteDataProvider> directly in its JSX.
 */
function functionMountsSiteDataProvider(fn) {
  if (!fn || !fn.body) return false;
  let mounts = false;

  recast.types.visit(fn.body, {
    visitJSXElement(pathNode) {
      const opening = pathNode.node.openingElement;
      if (opening && opening.name) {
        const name = opening.name.name;
        if (name === 'SiteDataProvider' || name === 'BaseSiteDataProvider' || name === 'DenebDataProvider') {
          mounts = true;
          return false;
        }
      }
      this.traverse(pathNode);
    },
    visitFunctionDeclaration() {
      return false;
    },
    visitFunctionExpression() {
      return false;
    },
    visitArrowFunctionExpression() {
      return false;
    },
  });

  return mounts;
}

/**
 * Checks if a function has a parameter named siteData (direct or destructured).
 */
function functionHasSiteDataParam(fn) {
  if (!fn || !Array.isArray(fn.params)) return false;
  for (const param of fn.params) {
    if (param.type === 'Identifier' && param.name === 'siteData') {
      return true;
    }
    if (param.type === 'AssignmentPattern' && param.left && param.left.name === 'siteData') {
      return true;
    }
    if (param.type === 'ObjectPattern' && Array.isArray(param.properties)) {
      for (const prop of param.properties) {
        if (prop.value && prop.value.type === 'Identifier' && prop.value.name === 'siteData') {
          return true;
        }
        if (prop.key && prop.key.type === 'Identifier' && prop.key.name === 'siteData') {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Checks if the function body already binds or declares `siteData`.
 */
function functionLocallyDeclaresSiteData(fn) {
  if (!fn || !fn.body || fn.body.type !== 'BlockStatement') return false;
  let declares = false;

  for (const stmt of fn.body.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id && decl.id.type === 'Identifier' && decl.id.name === 'siteData') {
          declares = true;
          break;
        }
      }
    }
    if (declares) break;
  }

  return declares;
}

/**
 * Checks if function calls useSiteData() already.
 */
function functionCallsUseSiteData(fn) {
  if (!fn || !fn.body) return false;
  let calls = false;

  recast.types.visit(fn.body, {
    visitCallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (callee && callee.type === 'Identifier' && callee.name === 'useSiteData') {
        calls = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });

  return calls;
}

/**
 * Checks if a function is a React component or custom hook.
 */
function isReactComponentOrHook(fn, fnName) {
  // Custom hooks: use*
  if (fnName && /^use[A-Z]/.test(fnName)) return true;

  // Capitalized function name
  const isCapitalized = Boolean(fnName && /^[A-Z]/.test(fnName));

  // Must return JSX to qualify as a component if not a hook
  const returnsJsx = functionReturnsJsx(fn);

  if (isCapitalized && returnsJsx) return true;
  if (returnsJsx) return true; // Anonymous or exported default component returning JSX

  return false;
}

/**
 * Classifies whether a function within an AST can safely have `useSiteData()` injected.
 * 
 * @param {object} fn AST Function node
 * @param {string|null} fnName Identifier name of function if available
 * @param {object} fileContext Context about the file (isServerComponent, mountsProvider, filePath)
 * @returns {string} Status code from SCOPE_STATUS
 */
function classifySiteDataRequirement(fn, fnName, fileContext = {}) {
  if (!fn) return SCOPE_STATUS.INVALID_SCOPE;

  // 1. Check if function already declares or receives siteData
  if (functionHasSiteDataParam(fn)) {
    return SCOPE_STATUS.PROP_BOUND;
  }

  if (functionLocallyDeclaresSiteData(fn) || functionCallsUseSiteData(fn)) {
    return SCOPE_STATUS.ALREADY_BOUND;
  }

  // 2. Check if async function -> Server Component / async handler
  if (fn.async) {
    return SCOPE_STATUS.SERVER_BOUNDARY;
  }

  // 3. Check if function mounts <SiteDataProvider>
  if (functionMountsSiteDataProvider(fn) || fileContext.mountsProvider) {
    return SCOPE_STATUS.PROVIDER_OWNER;
  }

  // 4. Check if function is RootLayout or Server Layout without 'use client'
  const isLayout = /(?:^|[/\\])layout\.(?:tsx|jsx|js|ts)$/.test(fileContext.filePath || '');
  if (fnName === 'RootLayout' || (isLayout && !fileContext.isClientComponent)) {
    return SCOPE_STATUS.SERVER_BOUNDARY;
  }

  // 5. Check if React component or custom hook
  if (!isReactComponentOrHook(fn, fnName)) {
    return SCOPE_STATUS.UTILITY_FUNCTION;
  }

  // 6. Safe to inject hook
  return SCOPE_STATUS.HOOK_SAFE;
}

module.exports = {
  SCOPE_STATUS,
  functionReturnsJsx,
  functionMountsSiteDataProvider,
  functionHasSiteDataParam,
  functionLocallyDeclaresSiteData,
  functionCallsUseSiteData,
  isReactComponentOrHook,
  classifySiteDataRequirement,
};

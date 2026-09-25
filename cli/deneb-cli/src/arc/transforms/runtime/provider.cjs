'use strict';

const fs = require('fs');
const path = require('path');
const recast = require('recast');
const { b } = require('../../ast.cjs');

const CANONICAL_SITE_DATA_CONTEXT = `'use client';

export {
  SiteDataProvider,
  useSiteData,
  contentText,
  contentObject,
  contentList,
  PREVIEW_DATA_MESSAGE,
  LEGACY_PREVIEW_DATA_MESSAGE,
  PREVIEW_READY_MESSAGE,
  LEGACY_PREVIEW_READY_MESSAGE,
  PREVIEW_FOCUS_MESSAGE,
  LEGACY_PREVIEW_FOCUS_MESSAGE,
  PREVIEW_FIELD_ATTRIBUTE,
} from '@deneb-ui/ui';

export type { SiteData, SiteDataProviderProps } from '@deneb-ui/ui';
`;

function fileAlreadyUsesSiteDataHook(ast) {
  let found = false;
  recast.types.visit(ast, {
    visitCallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (callee && callee.type === 'Identifier' && callee.name === 'useSiteData') {
        found = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return found;
}

function resolveSiteDataRuntimeSpecifier(profile) {
  const root = profile && profile.root;
  if (!root) return '@deneb-ui/ui';
  const candidates = [
    ['src/lib/siteDataContext.tsx', '@/lib/siteDataContext'],
    ['src/lib/siteDataContext.ts', '@/lib/siteDataContext'],
    ['lib/siteDataContext.tsx', '@/lib/siteDataContext'],
    ['lib/siteDataContext.ts', '@/lib/siteDataContext'],
  ];
  const hasAt = Object.keys(profile.aliasMap || {}).some((k) => k === '@/*' || k.startsWith('@/'));
  for (const [relative, alias] of candidates) {
    if (!fs.existsSync(path.join(root, relative))) continue;
    if (hasAt) return alias;
    const fromAbs = path.join(root, 'src/components/placeholder.tsx');
    const toAbs = path.join(root, relative.replace(/\.tsx?$/, ''));
    let relSpec = path.relative(path.dirname(fromAbs), toAbs).replace(/\\/g, '/');
    if (!relSpec.startsWith('.')) relSpec = './' + relSpec;
    return relSpec;
  }
  return '@deneb-ui/ui';
}

function functionReferencesSiteData(fn) {
  if (!fn || !fn.body) return false;
  let found = false;
  recast.types.visit(fn.body, {
    visitIdentifier(pathNode) {
      if (pathNode.node.name === 'siteData') {
        found = true;
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return found;
}

const {
  SCOPE_STATUS,
  classifySiteDataRequirement,
} = require('./site-data-scope.cjs');

function injectSiteDataHook(ast, filePath = 'file.tsx', options = {}) {
  let injected = false;
  let anyFunctionReferencedSiteData = false;
  let alreadyHasUseSiteData = false;

  const fileContext = {
    filePath,
    isServerComponent: options.isServerComponent ?? false,
    isClientComponent: options.isClientComponent ?? false,
    mountsProvider: options.mountsProvider ?? false,
  };

  // Inspect file-level AST properties
  recast.types.visit(ast, {
    visitCallExpression(pathNode) {
      if (pathNode.node.callee && pathNode.node.callee.name === 'useSiteData') {
        alreadyHasUseSiteData = true;
        return false;
      }
      this.traverse(pathNode);
    },
    visitJSXElement(pathNode) {
      const opening = pathNode.node.openingElement;
      if (opening && opening.name) {
        const name = opening.name.name;
        if (name === 'SiteDataProvider' || name === 'BaseSiteDataProvider' || name === 'DenebDataProvider') {
          fileContext.mountsProvider = true;
        }
      }
      this.traverse(pathNode);
    },
  });

  // If this file mounts SiteDataProvider, consumer hook injection is forbidden
  if (fileContext.mountsProvider) {
    return false;
  }

  function injectIntoFunction(fn, fnName) {
    if (!fn || !fn.body || fn.body.type !== 'BlockStatement') return false;

    const requirement = classifySiteDataRequirement(fn, fnName, fileContext);
    if (requirement !== SCOPE_STATUS.HOOK_SAFE) {
      return false;
    }

    const body = fn.body.body;
    const already = body.some((stmt) => recast.print(stmt).code.includes('useSiteData'));
    if (already) return false;

    const hook = b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier('siteData'),
        b.callExpression(b.identifier('useSiteData'), [])
      ),
    ]);
    body.unshift(hook);
    alreadyHasUseSiteData = true;
    return true;
  }

  // Pass 1: Inject useSiteData() into component functions that reference siteData
  recast.types.visit(ast, {
    visitFunctionDeclaration(pathNode) {
      const name = pathNode.node.id ? pathNode.node.id.name : null;
      if (functionReferencesSiteData(pathNode.node)) {
        anyFunctionReferencedSiteData = true;
        if (injectIntoFunction(pathNode.node, name)) injected = true;
      }
      this.traverse(pathNode);
    },
    visitFunctionExpression(pathNode) {
      const parent = pathNode.parent && pathNode.parent.node;
      const name = parent && parent.type === 'VariableDeclarator' && parent.id ? parent.id.name : null;
      if (functionReferencesSiteData(pathNode.node)) {
        anyFunctionReferencedSiteData = true;
        if (injectIntoFunction(pathNode.node, name)) injected = true;
      }
      this.traverse(pathNode);
    },
    visitArrowFunctionExpression(pathNode) {
      const parent = pathNode.parent && pathNode.parent.node;
      const name = parent && parent.type === 'VariableDeclarator' && parent.id ? parent.id.name : null;
      if (functionReferencesSiteData(pathNode.node)) {
        anyFunctionReferencedSiteData = true;
        if (injectIntoFunction(pathNode.node, name)) injected = true;
      }
      this.traverse(pathNode);
    },
  });

  // Pass 2: If no component references siteData yet, ensure the primary component receives useSiteData()
  if (!injected && !anyFunctionReferencedSiteData && !alreadyHasUseSiteData) {
    recast.types.visit(ast, {
      visitExportDefaultDeclaration(pathNode) {
        if (injected) return false;
        const decl = pathNode.node.declaration;
        if (decl && (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionExpression')) {
          const name = decl.id ? decl.id.name : 'DefaultExport';
          injected = injectIntoFunction(decl, name);
        }
        this.traverse(pathNode);
      },
      visitFunctionDeclaration(pathNode) {
        if (injected) return false;
        const name = pathNode.node.id && pathNode.node.id.name;
        if (name && /^[A-Z]/.test(name)) {
          injected = injectIntoFunction(pathNode.node, name);
          return false;
        }
        this.traverse(pathNode);
      },
      visitVariableDeclarator(pathNode) {
        if (injected) return false;
        const id = pathNode.node.id;
        const init = pathNode.node.init;
        if (id && id.type === 'Identifier' && /^[A-Z]/.test(id.name) && init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          injected = injectIntoFunction(init, id.name);
          return false;
        }
        this.traverse(pathNode);
      },
    });
  }

  return injected;
}

function resolveSiteDataSpecifier(profile, fromRelativeFile) {
  const aliases = (profile && profile.aliasMap) || {};
  const hasAt = Object.keys(aliases).some((k) => k === '@/*' || k.startsWith('@/'));
  const hasSrc = Boolean(profile && profile.hasSrc);
  const siteDataRel = hasSrc ? 'src/data/site-data.json' : 'data/site-data.json';
  if (hasAt && hasSrc) return '@/data/site-data.json';

  const root = profile && profile.root ? profile.root : process.cwd();
  const fromAbs = path.join(root, fromRelativeFile || 'page.tsx');
  const toAbs = path.join(root, siteDataRel);
  let relSpec = path.relative(path.dirname(fromAbs), toAbs).replace(/\\/g, '/');
  if (!relSpec.startsWith('.')) relSpec = './' + relSpec;
  return relSpec;
}

function rewriteRecursiveSiteDataContext(code) {
  const recursive =
    /export\s+function\s+SiteDataProvider\b/.test(code) &&
    /<(?:Base)?SiteDataProvider\b/.test(code);
  if (!recursive) return { code, updated: false };
  return { code: CANONICAL_SITE_DATA_CONTEXT, updated: true };
}

function ensureJsonModule(tsconfig) {
  if (!tsconfig || !tsconfig.compilerOptions) return { config: tsconfig, changed: false };
  if (tsconfig.compilerOptions.resolveJsonModule) return { config: tsconfig, changed: false };
  return {
    config: {
      ...tsconfig,
      compilerOptions: {
        ...tsconfig.compilerOptions,
        resolveJsonModule: true,
      },
    },
    changed: true,
  };
}

module.exports = {
  CANONICAL_SITE_DATA_CONTEXT,
  fileAlreadyUsesSiteDataHook,
  resolveSiteDataRuntimeSpecifier,
  functionReferencesSiteData,
  injectSiteDataHook,
  resolveSiteDataSpecifier,
  rewriteRecursiveSiteDataContext,
  ensureJsonModule,
};

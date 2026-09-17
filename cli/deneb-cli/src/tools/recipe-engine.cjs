/**
 * DENEB Recipe Engine & Learning System
 *
 * Preserves, identifies, and applies battle-tested storefront transformation recipes.
 * Enables developers and AI agents to save custom fixes from calibrated projects
 * and automatically re-apply them to any new frontend during `npx @deneb-ui/cli init`.
 *
 * Created by Chamika Gayashan & Induranga Kawishwara.
 */

const fs = require('fs');
const path = require('path');

const BUILT_IN_RECIPES_DIR = path.join(__dirname, '..', 'recipes');

/**
 * Load all available recipes (built-in + user-saved)
 */
function loadAllRecipes(projectDir) {
  const recipes = [];

  // 1. Built-in recipes
  if (fs.existsSync(BUILT_IN_RECIPES_DIR)) {
    const files = fs.readdirSync(BUILT_IN_RECIPES_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = JSON.parse(fs.readFileSync(path.join(BUILT_IN_RECIPES_DIR, file), 'utf8'));
        recipes.push({ ...content, isBuiltIn: true });
      } catch (err) {
        // Ignore malformed files
      }
    }
  }

  // 2. Local workspace / project recipes (.deneb/recipes)
  if (projectDir) {
    const localDir = path.join(projectDir, '.deneb', 'recipes');
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = JSON.parse(fs.readFileSync(path.join(localDir, file), 'utf8'));
          recipes.push({ ...content, isBuiltIn: false, source: 'local' });
        } catch {}
      }
    }
  }

  return recipes;
}

/**
 * Match the best recipe for an incoming project based on signatures
 */
function matchRecipeForProject(projectDir, pkg = {}, sourceFiles = []) {
  const allRecipes = loadAllRecipes(projectDir);
  if (allRecipes.length === 0) return null;

  const pkgStr = JSON.stringify(pkg).toLowerCase();
  const fileNamesStr = sourceFiles.map((f) => path.basename(f).toLowerCase()).join(' ');

  let bestMatch = null;
  let highestScore = 0;

  for (const recipe of allRecipes) {
    let score = 0;
    const signatures = recipe.signatures || {};
    const keywords = signatures.keywords || [];
    const roles = signatures.componentRoles || [];

    for (const kw of keywords) {
      if (pkgStr.includes(kw)) score += 3;
      if (fileNamesStr.includes(kw)) score += 2;
    }

    for (const role of roles) {
      if (fileNamesStr.includes(role.toLowerCase())) score += 5;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = recipe;
    }
  }

  // If score is decent, return recipe; otherwise default to ecommerce-storefront if available
  if (highestScore >= 6) {
    return bestMatch;
  }

  const defaultRecipe = allRecipes.find((r) => r.name === 'ecommerce-storefront');
  return defaultRecipe || allRecipes[0] || null;
}

/**
 * Learn & Save Recipe from an existing calibrated project
 */
function saveRecipeFromProject(projectDir, recipeName = 'custom-storefront', options = {}) {
  const manifestPath = path.join(projectDir, 'fivora-template.json');
  const siteDataPath = path.join(projectDir, 'src', 'data', 'site-data.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`fivora-template.json not found in ${projectDir}. Make sure the project is calibrated first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let siteData = {};
  if (fs.existsSync(siteDataPath)) {
    siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
  }

  const recipeId = recipeName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const recipe = {
    name: recipeId,
    label: options.label || manifest.name || recipeName,
    description: options.description || `Learned and saved recipe extracted from ${path.basename(projectDir)}.`,
    savedAt: new Date().toISOString(),
    signatures: {
      keywords: [recipeId, 'store', 'shop', 'product'],
      componentRoles: ['Navbar', 'Hero', 'ProductGrid', 'ProductCard', 'Footer'],
    },
    gridRules: {
      cardComponentNames: ['ProductCard', 'Card', 'ItemCard', 'ShoeCard'],
      cardFields: [
        { suffix: 'Image', type: 'image', label: 'Image' },
        { suffix: 'Badge', type: 'text', label: 'Badge' },
        { suffix: 'Category', type: 'text', label: 'Category' },
        { suffix: 'Name', type: 'text', label: 'Title' },
        { suffix: 'Price', type: 'text', label: 'Price' },
      ],
      autoIndex: true,
      defaultCardPrefix: 'product',
      withBasePathImages: true,
      safeNavigationButtons: true,
    },
    productDetailRules: {
      enabled: true,
      sectionPath: 'product',
      detailRoute: '/products/detail',
      sampleRoute: '/products/detail',
      usePlatformDetail: true,
      galleryWithBasePath: true,
      noStaticOnEditableAncestors: true,
    },
    actionRules: {
      splitActionAndLabel: true,
      whatsappKeywords: ['whatsapp', 'wa.me', 'order via whatsapp', 'chat on whatsapp'],
      actionFieldMapping: {
        whatsapp: { urlField: 'whatsappCtaUrl', labelField: 'whatsappCtaLabel' },
        order: { urlField: 'orderCtaUrl', labelField: 'orderCtaLabel' },
        promo: { urlField: 'promoCtaUrl', labelField: 'promoCtaLabel' },
      },
    },
    socialRules: {
      platforms: ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin'],
      targetPath: 'common.footer',
    },
    pages: (() => {
      const existingPages = Array.isArray(manifest.pages) ? [...manifest.pages] : [];
      const hasDetail = existingPages.some((p) => p.route === '/products/detail' || p.id === 'product-detail');
      if (!hasDetail && existingPages.some((p) => (p.route || '').includes('/product'))) {
        existingPages.push({
          id: 'product-detail',
          label: 'Live Product Detail',
          route: '/products/detail',
        });
      }
      return existingPages;
    })(),
    sections: (manifest.editorSchema?.sections || []).map((s) => ({
      ...s,
      path: s.path || s.id,
    })),
    defaults: siteData.content || {},
  };

  // 1. Save to global CLI recipes directory
  fs.mkdirSync(BUILT_IN_RECIPES_DIR, { recursive: true });
  const globalDest = path.join(BUILT_IN_RECIPES_DIR, `${recipeId}.json`);
  fs.writeFileSync(globalDest, JSON.stringify(recipe, null, 2) + '\n', 'utf8');

  // 2. Also save to project-local .deneb/recipes directory for portability
  const localDestDir = path.join(projectDir, '.deneb', 'recipes');
  fs.mkdirSync(localDestDir, { recursive: true });
  const localDest = path.join(localDestDir, `${recipeId}.json`);
  fs.writeFileSync(localDest, JSON.stringify(recipe, null, 2) + '\n', 'utf8');

  return { recipe, globalDest, localDest };
}

/**
 * Retrieve recipe by name or slug alias (e.g. 'fashion', 'electronics', 'cosmetics', 'vanta')
 */
function getRecipeByName(recipeName, projectDir) {
  if (!recipeName) return null;
  const allRecipes = loadAllRecipes(projectDir);
  const target = String(recipeName).trim().toLowerCase();

  // 1. Exact name match
  let match = allRecipes.find((r) => r.name.toLowerCase() === target);
  if (match) return match;

  // 2. Partial or slug match
  match = allRecipes.find((r) => {
    const rName = r.name.toLowerCase();
    const rLabel = (r.label || '').toLowerCase();
    return rName.includes(target) || target.includes(rName) || rLabel.includes(target);
  });
  if (match) return match;

  // 3. Keyword signature match
  match = allRecipes.find((r) => {
    const kws = r.signatures?.keywords || [];
    return kws.some((kw) => kw.toLowerCase() === target);
  });

  return match || null;
}

module.exports = {
  loadAllRecipes,
  matchRecipeForProject,
  saveRecipeFromProject,
  getRecipeByName,
};

#!/usr/bin/env node

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline');
const crypto = require('node:crypto');

// SHA-256 hash of default key — prevents plain text exposure in repository
const DENEB_AI_DEFAULT_KEY_HASH = '6f791210e05b535d0e48e260273b3ddb511aefb63ad2a2a35b838a80a6127588';

/**
 * Validates AI access key against either:
 * 1. Environment variable DENEB_AI_KEY (configurable by team / CI)
 * 2. Cryptographic SHA-256 hash of default key
 * @param {string} inputKey
 * @returns {boolean}
 */
function verifyAiAccessKey(inputKey) {
  if (!inputKey || typeof inputKey !== 'string') return false;
  const clean = inputKey.trim();
  if (process.env.DENEB_AI_KEY && clean === process.env.DENEB_AI_KEY.trim()) {
    return true;
  }
  const hash = crypto.createHash('sha256').update(clean).digest('hex');
  return hash === DENEB_AI_DEFAULT_KEY_HASH;
}

/**
 * Prompt the user with a question and return their answer.
 * @param {string} query - The question to display
 * @returns {Promise<string>}
 */
function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt the user for a password with masked input (shows * for each character).
 * @param {string} query - The prompt to display
 * @returns {Promise<string>}
 */
function askPassword(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(query);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    let pwd = '';
    const onData = (ch) => {
      const c = ch.toString();
      if (c === '\n' || c === '\r') {
        if (stdin.isTTY) stdin.setRawMode(wasRaw || false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(pwd);
      } else if (c === '\x7f' || c === '\b') {
        if (pwd.length > 0) {
          pwd = pwd.slice(0, -1);
          process.stdout.write('\r' + query + '*'.repeat(pwd.length) + ' \b');
        }
      } else if (c === '\x03') {
        if (stdin.isTTY) stdin.setRawMode(wasRaw || false);
        rl.close();
        process.exit(0);
      } else {
        pwd += c;
        process.stdout.write('*');
      }
    };
    stdin.resume();
    stdin.on('data', onData);
  });
}

const args = process.argv.slice(2);

const toolsDir = path.join(__dirname, '..', 'src', 'tools');

const FORBIDDEN_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '.npm',
  '.pnpm-store',
  '__macosx',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
]);

function isForbiddenFile(filename) {
  const lower = filename.toLowerCase();
  return (
    lower.startsWith('.env') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.log') ||
    lower.endsWith('.tsbuildinfo') ||
    lower === '.ds_store' ||
    lower === 'thumbs.db'
  );
}

function getVisualWidth(str) {
  if (!str) return 0;
  const stripped = String(str).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0);
    if (
      (code >= 0x1100 && code <= 0x115F) ||
      (code >= 0x2E80 && code <= 0xA4CF) ||
      (code >= 0xAC00 && code <= 0xD7A3) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFE10 && code <= 0xFE19) ||
      (code >= 0xFE30 && code <= 0xFE6F) ||
      (code >= 0xFF00 && code <= 0xFF60) ||
      (code >= 0xFFE0 && code <= 0xFFE6) ||
      (code >= 0x1F000 && code <= 0x1FAFF) ||
      (code >= 0x2600 && code <= 0x27BF)
    ) {
      width += 2;
    } else if (code > 0xFFFF) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function createBox(lines, preferredWidth = 58) {
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';
  const visualLengths = lines.map((l) => getVisualWidth(l));
  const maxLineVisual = Math.max(...visualLengths, 0);
  const boxWidth = Math.max(preferredWidth, maxLineVisual + 4);

  const top = `  ${cyan}╔${'═'.repeat(boxWidth)}╗${reset}`;
  const bottom = `  ${cyan}╚${'═'.repeat(boxWidth)}╝${reset}`;

  const rows = lines.map((line, idx) => {
    const rawLen = visualLengths[idx];
    const padTotal = Math.max(0, boxWidth - rawLen);
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    return `  ${cyan}║${reset}${' '.repeat(padLeft)}${line}${' '.repeat(padRight)}${cyan}║${reset}`;
  });

  return [top, ...rows, bottom].join('\n');
}

function packageCleanZip(sourceDir, outputPath) {
  let AdmZip;
  try {
    AdmZip = require('adm-zip');
  } catch {
    try {
      const { createRequire } = require('node:module');
      const projectRequire = createRequire(path.resolve(process.cwd(), 'package.json'));
      AdmZip = projectRequire('adm-zip');
    } catch {
      console.error('Error: adm-zip is required to package templates. Run "npm install -D adm-zip" or install @deneb-ui/cli with its dependencies.');
      process.exit(1);
    }
  }

  const zip = new AdmZip();
  let fileCount = 0;

  function addFolder(dir, base) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!FORBIDDEN_DIRS.has(entry.name.toLowerCase())) {
          addFolder(path.join(dir, entry.name), path.join(base, entry.name));
        }
      } else if (entry.isFile()) {
        if (!isForbiddenFile(entry.name)) {
          const fullPath = path.join(dir, entry.name);
          const zipPath = path.join(base, entry.name).replace(/\\/g, '/');
          const targetDirInZip = path.dirname(zipPath) === '.' ? '' : path.dirname(zipPath);
          zip.addLocalFile(fullPath, targetDirInZip);
          fileCount++;
        }
      }
    }
  }

  // Preflight check: check if TypeScript catches undefined variables or SSR crashes
  const tsconfigPath = path.join(sourceDir, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const { execSync } = require('child_process');
      execSync('npx tsc --noEmit', { cwd: sourceDir, stdio: 'pipe' });
    } catch (err) {
      const out = (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
      if (out.trim()) {
        console.warn('\n⚠️  [DENEB WARNING] TypeScript compiler detected errors in this storefront:');
        const lines = out.trim().split('\n');
        console.warn('   ' + lines.slice(0, 8).join('\n   '));
        if (lines.length > 8) {
          console.warn(`   ... and ${lines.length - 8} more errors.`);
        }
        console.warn('⚠️  CRITICAL: Undeclared variables and type errors break Next.js static pre-rendering ("Collecting page data") during portal preview warm-up!\n');
      }
    }
  }

  addFolder(sourceDir, '');
  zip.writeZip(outputPath);
  console.log(`\n✓ Successfully packaged clean template ZIP: ${outputPath}`);
  console.log(`  Packaged ${fileCount} clean source files.`);
  console.log(`  Automatically excluded: node_modules, .next, .git, .env, cache, and build files.`);
  console.log(`  Ready for upload at Developer Portal > Upload Template!\n`);
}

function copyCleanFolder(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!FORBIDDEN_DIRS.has(entry.name.toLowerCase())) {
        copyCleanFolder(srcPath, destPath);
      }
    } else if (entry.isFile()) {
      if (!isForbiddenFile(entry.name)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function createTemplate(targetName) {
  const projectName = targetName || 'fivora-template';
  const targetDir = path.resolve(process.cwd(), projectName);
  const monorepoTemplateDir = path.resolve(__dirname, '..', '..', '..', 'templates', 'nextjs');

  if (fs.existsSync(monorepoTemplateDir)) {
    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      console.error(`\nError: Directory "${projectName}" already exists and is not empty.\n`);
      process.exit(1);
    }

    console.log(`\n🚀 Initializing new Fivora Template in ${targetDir}...\n`);
    copyCleanFolder(monorepoTemplateDir, targetDir);

    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.name = path.basename(targetDir).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      } catch {
        // ignore
      }
    }

    console.log(`✓ Created Fivora template in ${targetDir}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${projectName}`);
    console.log(`  npm install`);
    console.log(`  npm run dev       # Start local development with hot-reload`);
    console.log(`  npm run lab       # Test in Visual Editing Lab`);
    console.log(`  npm run validate  # Run Fivora preflight checks`);
    console.log(`  npm run zip       # Create clean upload-ready ZIP\n`);
  } else {
    console.log(`\n🚀 Scaffolding new DENEB Storefront Template via @deneb-ui/create-template...\n`);
    const res = spawnSync('npx', ['--yes', '@deneb-ui/create-template', projectName], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    process.exit(res.status ?? 0);
  }
}

function detectPages(projectDir) {
  const pages = [
    { id: 'home', label: 'Home', route: '/', required: true },
  ];

  const candidateDirs = [
    path.join(projectDir, 'src', 'app'),
    path.join(projectDir, 'app'),
    path.join(projectDir, 'pages'),
    path.join(projectDir, 'src', 'pages'),
  ];

  const foundRoutes = new Set(['/']);

  for (const cDir of candidateDirs) {
    if (fs.existsSync(cDir) && fs.statSync(cDir).isDirectory()) {
      try {
        const entries = fs.readdirSync(cDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const routeName = entry.name;
            if (routeName.startsWith('(') || routeName.startsWith('_') || routeName === 'api') {
              continue;
            }
            if (!foundRoutes.has('/' + routeName)) {
              const pageFile = ['page.tsx', 'page.jsx', 'page.js']
                .map((name) => path.join(cDir, routeName, name))
                .find((file) => fs.existsSync(file));
              const pagesFile = ['tsx', 'jsx', 'js']
                .map((ext) => path.join(cDir, `${routeName}.${ext}`))
                .find((file) => fs.existsSync(file));
              if (!pageFile && !pagesFile && path.basename(cDir) !== 'pages' && path.basename(cDir) !== 'src') {
                continue;
              }
              if (!pageFile && path.basename(cDir) !== 'pages' && !cDir.endsWith(`${path.sep}pages`)) {
                continue;
              }
              foundRoutes.add('/' + routeName);
              const label = routeName
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());
              const isContact = routeName.toLowerCase().includes('contact');
              pages.push({
                id: routeName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase(),
                label: label,
                route: `/${routeName}`,
                ...(isContact ? { required: true } : {}),
              });
            }

            // Check for dynamic product detail routes (e.g. products/[slug] or shop/[id])
            const subDirPath = path.join(cDir, routeName);
            try {
              if (fs.existsSync(subDirPath)) {
                const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });
                const hasDynamicSlug = subEntries.some((se) => se.isDirectory() && se.name.startsWith('['));
                if (hasDynamicSlug && !foundRoutes.has('/' + routeName + '/detail')) {
                  foundRoutes.add('/' + routeName + '/detail');
                  let sampleSlug = 'vanta-aero-x';
                  const siteDataPath = path.join(projectDir, 'src', 'data', 'site-data.json');
                  if (fs.existsSync(siteDataPath)) {
                    try {
                      const sd = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
                      if (sd.content?.product?.slug) sampleSlug = sd.content.product.slug;
                      else if (sd.content?.home?.product1Slug) sampleSlug = sd.content.home.product1Slug;
                    } catch {}
                  }
                  pages.push({
                    id: 'product',
                    label: 'Product Detail',
                    route: `/${routeName}/${sampleSlug}`,
                  });
                }
              }
            } catch {}
          }
        }
      } catch {
        // ignore scanning errors
      }
    }
  }

  const contactExistsOnDisk = candidateDirs.some((cDir) =>
    fs.existsSync(path.join(cDir, 'contact.tsx')) ||
    fs.existsSync(path.join(cDir, 'contact.jsx')) ||
    fs.existsSync(path.join(cDir, 'contact.js')) ||
    fs.existsSync(path.join(cDir, 'contact', 'page.tsx')) ||
    fs.existsSync(path.join(cDir, 'contact', 'page.jsx')) ||
    fs.existsSync(path.join(cDir, 'contact', 'page.js'))
  );
  if (contactExistsOnDisk && !pages.some((p) => p.id === 'contact' || p.route === '/contact')) {
    pages.push({ id: 'contact', label: 'Contact', route: '/contact', required: true });
  }

  return pages;
}

function getDefaultManifest(projectName, pages) {
  return {
    framework: 'nextjs-static-export',
    version: 2,
    visualEditing: {
      contractVersion: 1,
      mode: 'strict',
      controlOnlyPaths: [],
    },
    siteDataFile: 'src/data/site-data.json',
    outputDirectory: 'out',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    basePathEnvVar: 'NEXT_PUBLIC_SITE_BASE_PATH',
    pages: pages,
    editorSchema: {
      version: 1,
      sections: [
        {
          id: 'common',
          path: 'common',
          type: 'object',
          label: 'Shared Website Content',
          fields: [
            {
              key: 'websiteTitle',
              type: 'text',
              label: 'Website Title',
              required: true,
            },
            {
              key: 'shortDescription',
              type: 'textarea',
              label: 'Short Description',
            },
            {
              key: 'logoUrl',
              type: 'image',
              label: 'Website Logo',
            },
            {
              key: 'headerCtaLabel',
              type: 'text',
              label: 'Header Button Label',
            },
          ],
        },
        {
          id: 'home',
          path: 'home',
          type: 'object',
          label: 'Home Page Content',
          fields: [
            {
              key: 'heroTitle',
              type: 'text',
              label: 'Hero Title',
              required: true,
            },
            {
              key: 'heroSummary',
              type: 'textarea',
              label: 'Hero Summary',
            },
            {
              key: 'primaryCtaLabel',
              type: 'text',
              label: 'Primary CTA Label',
            },
            {
              key: 'secondaryCtaLabel',
              type: 'text',
              label: 'Secondary CTA Label',
            },
          ],
        },
        ...(pages.some((p) => p.id === 'product')
          ? [
              {
                id: 'product',
                path: 'product',
                type: 'object',
                label: 'Product Detail Content',
                fields: [
                  { key: 'name', type: 'text', label: 'Product Title', required: true },
                  { key: 'price', type: 'text', label: 'Product Price', required: true },
                  { key: 'description', type: 'textarea', label: 'Product Description' },
                  { key: 'badge', type: 'text', label: 'Product Badge' },
                  { key: 'featuredImage', type: 'image', label: 'Featured Product Image' },
                  { key: 'addToSelectionLabel', type: 'text', label: 'Add to Selection Label' },
                  { key: 'specsTitle', type: 'text', label: 'Specifications Heading' },
                  { key: 'shippingTitle', type: 'text', label: 'Shipping Heading' },
                  { key: 'shippingSummary', type: 'text', label: 'Shipping Summary' },
                  { key: 'shippingReturns', type: 'text', label: 'Shipping Returns Note' },
                ],
              },
            ]
          : []),
      ],
    },
  };
}

function getDefaultSiteData(projectName, pages) {
  const navLabels = {};
  for (const page of pages) {
    navLabels[page.id] = page.label;
  }

  return {
    project: {
      id: `${projectName}-project`,
      title: projectName,
      status: 'APPROVED',
    },
    merchant: {
      businessName: projectName,
      description: 'A modern commerce storefront built for the Fivora.',
    },
    template: {
      id: `${projectName}-template`,
      name: projectName,
      engine: 'NEXT_STATIC_EXPORT',
      structure: {
        pages: pages.map((p) => p.id),
        theme: {
          primaryColor: '#016a7e',
          secondaryColor: '#0a1931',
          accentColor: '#00adb5',
          backgroundColor: '#ffffff',
          cardBackgroundColor: '#f8fafc',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          headingFont: 'Inter',
          bodyFont: 'Inter',
          baseSize: '16px',
          heroMinHeight: '70vh',
          sectionPadding: '4rem',
          dark: {
            primaryColor: '#00adb5',
            secondaryColor: '#f8fafc',
            accentColor: '#016a7e',
            backgroundColor: '#0b0f19',
            cardBackgroundColor: '#111827',
            textColor: '#f9fafb',
            borderColor: '#1f2937',
          },
        },
      },
    },
    theme: {
      primaryColor: '#016a7e',
      secondaryColor: '#0a1931',
      accentColor: '#00adb5',
      backgroundColor: '#ffffff',
      cardBackgroundColor: '#f8fafc',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: '16px',
      heroMinHeight: '70vh',
      sectionPadding: '4rem',
      dark: {
        primaryColor: '#00adb5',
        secondaryColor: '#f8fafc',
        accentColor: '#016a7e',
        backgroundColor: '#0b0f19',
        cardBackgroundColor: '#111827',
        textColor: '#f9fafb',
        borderColor: '#1f2937',
      },
    },
    requirements: {
      requiredPages: pages.filter((p) => p.required).map((p) => p.id),
      requiredFeatures: [],
    },
    content: {
      common: {
        websiteTitle: projectName,
        shortDescription: 'A high-converting online storefront built on the Fivora.',
        logoUrl: '/fivora-logo.png',
        headerCtaLabel: 'Contact Us',
        navLabels: navLabels,
        footerHeading: 'Powered by Fivora',
        copyright: `${projectName}. All rights reserved.`,
      },
      home: {
        heroTitle: `Welcome to ${projectName}`,
        heroSummary: 'Discover our premium collection with fast delivery and great support.',
        primaryCtaLabel: 'Shop Now',
        secondaryCtaLabel: 'Learn More',
      },
      ...(pages.some((p) => p.id === 'product')
        ? {
            product: {
              name: 'Signature Performance Edition',
              price: 'LKR 32,500',
              description: 'Lightweight performance runner with responsive foam midsole and breathable engineered mesh.',
              badge: 'NEW',
              featuredImage: '/products/vanta-aero-x.jpg',
              addToSelectionLabel: 'Add to Selection',
              specsTitle: 'Specifications',
              shippingTitle: 'Shipping & Returns',
              shippingSummary: 'Free Islandwide Delivery within 2-3 business days. Cash on delivery available.',
              shippingReturns: '14-day hassle-free exchanges for unworn footwear in original condition.',
              relatedLabel: 'You May Also Like',
              relatedTitle: 'Related Products',
            },
          }
        : {}),
    },
  };
}

function getComponentRegistry(importPkg = '@deneb-ui/ui') {
  return {
    'button': {
      file: 'Button.tsx',
      component: 'Button',
      code: `'use client';\n\nimport { Button, type EditableButtonProps } from '${importPkg}';\n\nexport { Button, type EditableButtonProps };\n`,
    },
    'dialog': {
      file: 'Dialog.tsx',
      component: 'Dialog',
      code: `'use client';\n\nimport { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, type DialogProps } from '${importPkg}';\n\nexport { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, type DialogProps };\n`,
    },
    'card': {
      file: 'Card.tsx',
      component: 'Card',
      code: `'use client';\n\nimport { Card, type EditableCardProps } from '${importPkg}';\n\nexport { Card, type EditableCardProps };\n`,
    },
    'product-card': {
      file: 'ProductCard.tsx',
      component: 'EditableProductCard',
      code: `'use client';\n\nimport { EditableProductCard, ProductCard, type EditableProductCardProps, type ProductItem } from '${importPkg}';\n\nexport { EditableProductCard, ProductCard, type EditableProductCardProps, type ProductItem };\n`,
    },
    'product-grid': {
      file: 'ProductGrid.tsx',
      component: 'EditableProductGrid',
      code: `'use client';\n\nimport { EditableProductGrid, ProductGrid, type EditableProductGridProps, type ProductGridItem } from '${importPkg}';\n\nexport { EditableProductGrid, ProductGrid, type EditableProductGridProps, type ProductGridItem };\n`,
    },
    'product-showcase': {
      file: 'ProductShowcase.tsx',
      component: 'EditableProductShowcase',
      code: `'use client';\n\nimport { EditableProductShowcase, ProductShowcase, type EditableProductShowcaseProps, type ProductShowcaseItem, type ProductShowcaseColor } from '${importPkg}';\n\nexport { EditableProductShowcase, ProductShowcase, type EditableProductShowcaseProps, type ProductShowcaseItem, type ProductShowcaseColor };\n`,
    },
    'product-detail': {
      file: 'ProductDetail.tsx',
      component: 'PlatformProductDetail',
      code: `'use client';\n\nimport { PlatformProductDetail, usePlatformProductDetail, platformProductDetailHref, type PlatformProductDetailProps } from '${importPkg}';\n\nexport function ProductDetail(props: PlatformProductDetailProps) {
  return <PlatformProductDetail {...props} />;
}

export { PlatformProductDetail, usePlatformProductDetail, platformProductDetailHref, type PlatformProductDetailProps };\n`,
    },
    'platform-product-detail': {
      file: 'PlatformProductDetail.tsx',
      component: 'PlatformProductDetail',
      code: `'use client';\n\nimport { PlatformProductDetail, usePlatformProductDetail, platformProductDetailHref, type PlatformProductDetailProps } from '${importPkg}';\n\nexport { PlatformProductDetail, usePlatformProductDetail, platformProductDetailHref, type PlatformProductDetailProps };\n`,
    },
    'customer-reviews': {
      file: 'CustomerReviews.tsx',
      component: 'EditableCustomerReviews',
      code: `'use client';\n\nimport { EditableCustomerReviews, CustomerReviews, type EditableCustomerReviewsProps, type CustomerReviewItem } from '${importPkg}';\n\nexport { EditableCustomerReviews, CustomerReviews, type EditableCustomerReviewsProps, type CustomerReviewItem };\n`,
    },
    'reviews': {
      file: 'CustomerReviews.tsx',
      component: 'CustomerReviews',
      code: `'use client';\n\nimport { EditableCustomerReviews, CustomerReviews, type EditableCustomerReviewsProps, type CustomerReviewItem } from '${importPkg}';\n\nexport { EditableCustomerReviews, CustomerReviews, type EditableCustomerReviewsProps, type CustomerReviewItem };\n`,
    },
    'google-feedback': {
      file: 'GoogleFeedback.tsx',
      component: 'GoogleFeedback',
      code: `'use client';\n\nimport { EditableGoogleFeedback, GoogleFeedback, type EditableGoogleFeedbackProps, type FeedbackItem } from '${importPkg}';\n\nexport { EditableGoogleFeedback, GoogleFeedback, type EditableGoogleFeedbackProps, type FeedbackItem };\n`,
    },
    'feedback': {
      file: 'GoogleFeedback.tsx',
      component: 'GoogleFeedback',
      code: `'use client';\n\nimport { EditableGoogleFeedback, GoogleFeedback, type EditableGoogleFeedbackProps, type FeedbackItem } from '${importPkg}';\n\nexport { EditableGoogleFeedback, GoogleFeedback, type EditableGoogleFeedbackProps, type FeedbackItem };\n`,
    },
    'testimonial-section': {
      file: 'TestimonialSection.tsx',
      component: 'TestimonialSection',
      code: `'use client';\n\nimport { EditableTestimonialSection, TestimonialSection, type EditableTestimonialSectionProps, type TestimonialSectionItem } from '${importPkg}';\n\nexport { EditableTestimonialSection, TestimonialSection, type EditableTestimonialSectionProps, type TestimonialSectionItem };\n`,
    },
    'testimonials': {
      file: 'TestimonialSection.tsx',
      component: 'TestimonialSection',
      code: `'use client';\n\nimport { EditableTestimonialSection, TestimonialSection, type EditableTestimonialSectionProps, type TestimonialSectionItem } from '${importPkg}';\n\nexport { EditableTestimonialSection, TestimonialSection, type EditableTestimonialSectionProps, type TestimonialSectionItem };\n`,
    },
    'cart-drawer': {
      file: 'CartDrawer.tsx',
      component: 'EditableCartDrawer',
      code: `'use client';\n\nimport { EditableCartDrawer, CartDrawer, type EditableCartDrawerProps } from '${importPkg}';\n\nexport { EditableCartDrawer, CartDrawer, type EditableCartDrawerProps };\n`,
    },
    'filter-sidebar': {
      file: 'FilterSidebar.tsx',
      component: 'EditableFilterSidebar',
      code: `'use client';\n\nimport { EditableFilterSidebar, FilterSidebar, type EditableFilterSidebarProps, type FilterOptionGroup } from '${importPkg}';\n\nexport { EditableFilterSidebar, FilterSidebar, type EditableFilterSidebarProps, type FilterOptionGroup };\n`,
    },
    'pricing-card': {
      file: 'PricingCard.tsx',
      component: 'EditablePricingCard',
      code: `'use client';\n\nimport { EditablePricingCard, type EditablePricingCardProps } from '${importPkg}';\n\nexport function PricingCard(props: EditablePricingCardProps) {
  return <EditablePricingCard {...props} />;
}
`,
    },
    'testimonial-card': {
      file: 'TestimonialCard.tsx',
      component: 'EditableTestimonialCard',
      code: `'use client';\n\nimport { EditableTestimonialCard, type EditableTestimonialCardProps } from '${importPkg}';\n\nexport function TestimonialCard(props: EditableTestimonialCardProps) {
  return <EditableTestimonialCard {...props} />;
}
`,
    },
    'contact-form': {
      file: 'ContactForm.tsx',
      component: 'EditableContactForm',
      code: `'use client';\n\nimport { EditableContactForm, type EditableContactFormProps } from '${importPkg}';\n\nexport function ContactForm(props: EditableContactFormProps) {
  return <EditableContactForm {...props} />;
}
`,
    },
    'faq': {
      file: 'FAQAccordion.tsx',
      component: 'EditableFAQAccordion',
      code: `'use client';\n\nimport { EditableFAQAccordion, EditableFAQItem, type EditableFAQAccordionProps } from '${importPkg}';\n\nexport function FAQAccordion(props: EditableFAQAccordionProps) {
  return <EditableFAQAccordion {...props} />;
}
\nexport { EditableFAQItem };\n`,
    },
    'navbar': {
      file: 'Navbar.tsx',
      component: 'EditableNavbar',
      code: `'use client';\n\nimport { EditableNavbar, type EditableNavbarProps } from '${importPkg}';\n\nexport function Navbar(props: EditableNavbarProps) {
  return <EditableNavbar {...props} />;
}
`,
    },
    'footer': {
      file: 'Footer.tsx',
      component: 'EditableFooter',
      code: `'use client';\n\nimport { EditableFooter, type EditableFooterProps } from '${importPkg}';\n\nexport function Footer(props: EditableFooterProps) {
  return <EditableFooter {...props} />;
}
`,
    },
    'hero': {
      file: 'Hero.tsx',
      component: 'EditableHeroCentered',
      code: `'use client';\n\nimport { EditableHeroCentered, EditableHeroSplit, type EditableHeroCenteredProps, type EditableHeroSplitProps } from '${importPkg}';\n\nexport function HeroCentered(props: EditableHeroCenteredProps) {
  return <EditableHeroCentered {...props} />;
}
\nexport function HeroSplit(props: EditableHeroSplitProps) {
  return <EditableHeroSplit {...props} />;
}
`,
    },
    'whatsapp-button': {
      file: 'WhatsAppButton.tsx',
      component: 'WhatsAppButton',
      code: `'use client';\n\nimport { WhatsAppButton, type WhatsAppButtonProps } from '${importPkg}';\n\nexport { WhatsAppButton, type WhatsAppButtonProps };\n`,
    },
    'whatsapp': {
      file: 'WhatsAppButton.tsx',
      component: 'WhatsAppButton',
      code: `'use client';\n\nimport { WhatsAppButton, type WhatsAppButtonProps } from '${importPkg}';\n\nexport { WhatsAppButton, type WhatsAppButtonProps };\n`,
    },
    'whatsapp-order-button': {
      file: 'WhatsAppOrderButton.tsx',
      component: 'WhatsAppOrderButton',
      code: `'use client';\n\nimport React from 'react';\nimport { useSiteData } from '${importPkg}';\nimport { MessageCircle } from 'lucide-react';\n\nexport interface WhatsAppOrderButtonProps {\n  product: { name: string; price?: string | number; brand?: string; condition?: string; [key: string]: any };\n  selectedColor?: string;\n  selectedStorage?: string;\n  className?: string;\n  showText?: boolean;\n}\n\nexport function WhatsAppOrderButton({\n  product,\n  selectedColor,\n  selectedStorage,\n  className = '',\n  showText = true,\n}: WhatsAppOrderButtonProps) {\n  const siteData = useSiteData();\n  const rawTarget =\n    siteData?.content?.home?.whatsappOrderUrl ||\n    siteData?.content?.home?.whatsappNumber ||\n    siteData?.content?.common?.business?.whatsapp ||\n    'https://wa.me/15550192834';\n  const orderLabel = siteData?.content?.home?.whatsappOrderLabel ?? 'Order via WhatsApp';\n\n  const handleWhatsAppClick = (e: React.MouseEvent) => {\n    e.stopPropagation();\n    const color = selectedColor || product.colors?.[0]?.name || 'Default';\n    const storage = selectedStorage || product.storageOptions?.[0] || 'Default';\n    const message = \`Hi, I would like to order the following product:\\n\\n*\${product.name}*\\nBrand: \${product.brand || 'Store'}\\nCondition: \${product.condition || 'New'}\\nColor: \${color}\\nStorage: \${storage}\\nPrice: Rs \${product.price}\\n\\nIs it available?\`;\n\n    let targetUrl = (rawTarget || '').trim();\n    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {\n      const cleanNum = targetUrl.replace(/[^0-9]/g, '');\n      targetUrl = \`https://wa.me/\${cleanNum || '15550192834'}\`;\n    }\n    const sep = targetUrl.includes('?') ? '&' : '?';\n    const url = \`\${targetUrl}\${sep}text=\${encodeURIComponent(message)}\`;\n    window.open(url, '_blank', 'noopener,noreferrer');\n  };\n\n  return (\n    <button type="button" onClick={handleWhatsAppClick} className={className}>\n      <MessageCircle className="h-4 w-4" />\n      {showText && (\n        <span data-preview-field-path="home.whatsappOrderLabel" data-preview-style-target="home.whatsappOrderLabel" data-preview-style-type="text">\n          {orderLabel}\n        </span>\n      )}\n    </button>\n  );\n}\n`,
    },
    'phone-button': {
      file: 'PhoneButton.tsx',
      component: 'PhoneButton',
      code: `'use client';\n\nimport { PhoneButton, type PhoneButtonProps } from '${importPkg}';\n\nexport { PhoneButton, type PhoneButtonProps };\n`,
    },
    'phone': {
      file: 'PhoneButton.tsx',
      component: 'PhoneButton',
      code: `'use client';\n\nimport { PhoneButton, type PhoneButtonProps } from '${importPkg}';\n\nexport { PhoneButton, type PhoneButtonProps };\n`,
    },
    'email-button': {
      file: 'EmailButton.tsx',
      component: 'EmailButton',
      code: `'use client';\n\nimport { EmailButton, type EmailButtonProps } from '${importPkg}';\n\nexport { EmailButton, type EmailButtonProps };\n`,
    },
    'email': {
      file: 'EmailButton.tsx',
      component: 'EmailButton',
      code: `'use client';\n\nimport { EmailButton, type EmailButtonProps } from '${importPkg}';\n\nexport { EmailButton, type EmailButtonProps };\n`,
    },
    'contact-actions': {
      file: 'ContactActions.tsx',
      component: 'ContactActions',
      code: `'use client';\n\nimport { ContactActions, type ContactActionsProps } from '${importPkg}';\n\nexport { ContactActions, type ContactActionsProps };\n`,
    },
    'contact': {
      file: 'ContactActions.tsx',
      component: 'ContactActions',
      code: `'use client';\n\nimport { ContactActions, type ContactActionsProps } from '${importPkg}';\n\nexport { ContactActions, type ContactActionsProps };\n`,
    },
    'location-card': {
      file: 'LocationCard.tsx',
      component: 'LocationCard',
      code: `'use client';\n\nimport { LocationCard, type LocationCardProps } from '${importPkg}';\n\nexport { LocationCard, type LocationCardProps };\n`,
    },
    'location': {
      file: 'LocationCard.tsx',
      component: 'LocationCard',
      code: `'use client';\n\nimport { LocationCard, type LocationCardProps } from '${importPkg}';\n\nexport { LocationCard, type LocationCardProps };\n`,
    },
    'location-link': {
      file: 'LocationLink.tsx',
      component: 'LocationLink',
      code: `'use client';\n\nimport { LocationLink, type LocationLinkProps } from '${importPkg}';\n\nexport { LocationLink, type LocationLinkProps };\n`,
    },
    'map-embed': {
      file: 'MapEmbed.tsx',
      component: 'MapEmbed',
      code: `'use client';\n\nimport { MapEmbed, type MapEmbedProps } from '${importPkg}';\n\nexport { MapEmbed, type MapEmbedProps };\n`,
    },
    'social-links': {
      file: 'SocialLinks.tsx',
      component: 'SocialLinks',
      code: `'use client';\n\nimport { SocialLinks, type SocialLinksProps } from '${importPkg}';\n\nexport { SocialLinks, type SocialLinksProps };\n`,
    },
    'social-button': {
      file: 'SocialButton.tsx',
      component: 'SocialButton',
      code: `'use client';\n\nimport { SocialButton, type SocialButtonProps } from '${importPkg}';\n\nexport { SocialButton, type SocialButtonProps };\n`,
    },
    'business-hours': {
      file: 'BusinessHours.tsx',
      component: 'BusinessHours',
      code: `'use client';\n\nimport { BusinessHours, type BusinessHoursProps, type WeeklyHours, type DaySchedule } from '${importPkg}';\n\nexport { BusinessHours, type BusinessHoursProps, type WeeklyHours, type DaySchedule };\n`,
    },
    'hours': {
      file: 'BusinessHours.tsx',
      component: 'BusinessHours',
      code: `'use client';\n\nimport { BusinessHours, type BusinessHoursProps, type WeeklyHours, type DaySchedule } from '${importPkg}';\n\nexport { BusinessHours, type BusinessHoursProps, type WeeklyHours, type DaySchedule };\n`,
    },
    'announcement-bar': {
      file: 'AnnouncementBar.tsx',
      component: 'EditableAnnouncementBar',
      code: `'use client';\n\nimport { EditableAnnouncementBar, AnnouncementBar, type EditableAnnouncementBarProps } from '${importPkg}';\n\nexport { EditableAnnouncementBar, AnnouncementBar, type EditableAnnouncementBarProps };\n`,
    },
    'category-pills': {
      file: 'CategoryPills.tsx',
      component: 'EditableCategoryPills',
      code: `'use client';\n\nimport { EditableCategoryPills, CategoryPills, type EditableCategoryPillsProps } from '${importPkg}';\n\nexport { EditableCategoryPills, CategoryPills, type EditableCategoryPillsProps };\n`,
    },
    'floating-contact-widget': {
      file: 'FloatingContactWidget.tsx',
      component: 'FloatingContactWidget',
      code: `'use client';\n\nimport { FloatingContactWidget, type FloatingContactWidgetProps } from '${importPkg}';\n\nexport { FloatingContactWidget, type FloatingContactWidgetProps };\n`,
    },
    'sticky-mobile-bar': {
      file: 'StickyMobileBar.tsx',
      component: 'StickyMobileBar',
      code: `'use client';\n\nimport { StickyMobileBar, type StickyMobileBarProps, type StickyMobileBarAction } from '${importPkg}';\n\nexport { StickyMobileBar, type StickyMobileBarProps, type StickyMobileBarAction };\n`,
    },
    'trust-badges': {
      file: 'TrustBadges.tsx',
      component: 'TrustBadges',
      code: `'use client';\n\nimport { TrustBadges, type TrustBadgesProps, type TrustBadgeItem } from '${importPkg}';\n\nexport { TrustBadges, type TrustBadgesProps, type TrustBadgeItem };\n`,
    },
    'product-quickview': {
      file: 'ProductQuickView.tsx',
      component: 'ProductQuickView',
      code: `'use client';\n\nimport { ProductQuickView, type ProductQuickViewProps, type ProductQuickViewItem } from '${importPkg}';\n\nexport { ProductQuickView, type ProductQuickViewProps, type ProductQuickViewItem };\n`,
    },
    'cookie-consent': {
      file: 'CookieConsentBanner.tsx',
      component: 'CookieConsentBanner',
      code: `'use client';\n\nimport { CookieConsentBanner, type CookieConsentBannerProps } from '${importPkg}';\n\nexport { CookieConsentBanner, type CookieConsentBannerProps };\n`,
    },
    'deneb-action': {
      file: 'DenebAction.tsx',
      component: 'DenebAction',
      code: `'use client';\n\nimport { DenebAction, type DenebActionProps } from '${importPkg}';\n\nexport { DenebAction, type DenebActionProps };\n`,
    },
  };
}

async function initProject(targetInput, options = {}) {
  const targetDir = path.resolve(process.cwd(), targetInput || '.');
  const pkgPath = path.join(targetDir, 'package.json');

  console.log('\n' + createBox([
    '\x1b[1m\x1b[37mDENEB ARC\x1b[0m',
    '\x1b[90mAdaptive Refactoring Compiler for Fivora-editable UI\x1b[0m',
    '\x1b[90mPowered by DENEB-UI Collaborate with FIVORA\x1b[0m'
  ], 58) + '\n');

  if (!fs.existsSync(pkgPath)) {
    console.error(`\x1b[31mError:\x1b[0m No package.json found in "${targetDir}".`);
    console.error(`\nPlease run 'deneb init' inside your Next.js project root, or scaffold a new project with:`);
    console.error(`  \x1b[36mnpx @deneb-ui/create-template <app-name>\x1b[0m\n`);
    process.exit(1);
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    console.error(`\x1b[31mError:\x1b[0m Failed to parse package.json: ${err.message}\n`);
    process.exit(1);
  }

  const projectName = pkg.name || path.basename(targetDir);
  console.log(`Configuring project: \x1b[1m${projectName}\x1b[0m in ${targetDir}...\n`);

  // Detect Next.js
  const hasNext = Boolean(
    (pkg.dependencies && pkg.dependencies.next) ||
    (pkg.devDependencies && pkg.devDependencies.next)
  );
  if (!hasNext) {
    console.log(`\x1b[33m⚠ Warning:\x1b[0m Next.js was not detected in dependencies. Fivora templates require Next.js with static export.\n`);
  }

  // 1. Scan / Detect Pages
  const detectedPages = detectPages(targetDir);

  // 2. Deneb ARC (default) or legacy regex converter (--legacy)
  let conversionRes = null;
  try {
    if (options.legacy) {
      const { runUniversalTemplateConversion } = require('../src/tools/template-converter.cjs');
      conversionRes = runUniversalTemplateConversion(targetDir, projectName, detectedPages, options);
    } else {
      const { runDenebArc } = require('../src/arc/index.cjs');
      conversionRes = await runDenebArc(targetDir, projectName, {
        ...options,
        detectedPages,
      });
    }
  } catch (err) {
    console.error(`\x1b[33m⚠ Note:\x1b[0m Automated conversion encountered an issue: ${err.message}. Falling back to default generation.`);
  }

  // ── AI-Guided Semantic Analysis (interactive prompt) ──
  // Only show prompt when: not already in AI mode, not a dry run, and running in an interactive terminal
  if (!options.aiEnabled && !options.dryRun && process.stdin.isTTY) {
    console.log('');
    const aiAnswer = await askQuestion(
      '\x1b[36m?\x1b[0m Would you like to interact with AI for advanced semantic analysis? \x1b[90m(y/N)\x1b[0m '
    );

    if (aiAnswer.toLowerCase() === 'y' || aiAnswer.toLowerCase() === 'yes') {
      let isAuthorized = false;

      // Check if DENEB_AI_KEY is already set in environment / .env
      if (process.env.DENEB_AI_KEY && verifyAiAccessKey(process.env.DENEB_AI_KEY)) {
        console.log('\x1b[32m✔ AI access key detected from environment (DENEB_AI_KEY).\x1b[0m');
        isAuthorized = true;
      } else {
        const password = await askPassword('\x1b[36m\u{1F511}\x1b[0m Enter AI access key: ');
        if (verifyAiAccessKey(password)) {
          isAuthorized = true;
        }
      }

      if (isAuthorized) {
        console.log('\n\x1b[32m✔ Access granted.\x1b[0m Activating AI-guided semantic analysis...\n');

        // Pre-flight check for OpenAI API configuration readiness
        try {
          const { loadEnv, checkAiReady } = require('../src/arc/ai-agent.cjs');
          loadEnv(targetDir);
          const aiCheck = checkAiReady();
          if (!aiCheck.ready) {
            console.log(`\x1b[33m⚠ Note:\x1b[0m ${aiCheck.reason}`);
            console.log('\x1b[90mEnsure OPENAI_API_KEY is configured in your .env file or environment.\x1b[0m\n');
          }
        } catch {
          // non-blocking pre-check
        }

        try {
          const { runDenebArc } = require('../src/arc/index.cjs');
          const aiResult = await runDenebArc(targetDir, projectName, {
            ...options,
            detectedPages,
            aiEnabled: true,
          });
          if (aiResult) conversionRes = aiResult;
          console.log('\x1b[32m✔ AI-guided refactoring complete.\x1b[0m');

          // Interactive Recipe Learning
          if (process.stdin.isTTY) {
            console.log('');
            const saveRecipeAnswer = await askQuestion(
              '\x1b[36m?\x1b[0m Would you like to learn & save these converted patterns as a reusable storefront recipe? \x1b[90m(y/N)\x1b[0m '
            );
            if (saveRecipeAnswer.toLowerCase() === 'y' || saveRecipeAnswer.toLowerCase() === 'yes') {
              try {
                const { saveRecipeFromProject } = require('../src/tools/recipe-engine.cjs');
                const saveRes = saveRecipeFromProject(targetDir, projectName);
                console.log(`\x1b[32m✔ Recipe saved successfully:\x1b[0m \x1b[1m${saveRes.recipe.name}\x1b[0m`);
                console.log(`  Saved to CLI recipe bank: \x1b[90m${saveRes.globalDest}\x1b[0m`);
              } catch (recErr) {
                console.log(`\x1b[33m⚠ Could not save recipe:\x1b[0m ${recErr.message}`);
              }
            }
          }
        } catch (aiErr) {
          console.error(`\x1b[33m⚠ AI refactoring encountered an issue:\x1b[0m ${aiErr.message}`);
          console.log('\x1b[90mContinuing with standard ARC results...\x1b[0m');
        }
      } else {
        console.log('\n\x1b[31m✖ Invalid access key.\x1b[0m Continuing with standard ARC results...\n');
      }
    } else {
      console.log('\x1b[90m⏩ Skipping AI analysis. Using standard ARC results.\x1b[0m');
    }
  }

  if (options.dryRun) {
    return conversionRes;
  }

  // 3. Fallback: Generate fivora-template.json if not yet present
  const manifestPath = path.join(targetDir, 'fivora-template.json');
  if (!fs.existsSync(manifestPath)) {
    const manifest = getDefaultManifest(projectName, detectedPages);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\x1b[32m✔ Created\x1b[0m fivora-template.json (version 2, strict visual editing contract)`);
  }

  // 4. Fallback: Generate siteDataFile if not yet present
  let manifestObj;
  try {
    manifestObj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    manifestObj = {};
  }
  const relSiteData = manifestObj.siteDataFile || 'src/data/site-data.json';
  const siteDataPath = path.join(targetDir, relSiteData);

  if (!fs.existsSync(siteDataPath)) {
    fs.mkdirSync(path.dirname(siteDataPath), { recursive: true });
    const siteData = getDefaultSiteData(projectName, detectedPages);
    fs.writeFileSync(siteDataPath, JSON.stringify(siteData, null, 2) + '\n');
    console.log(`\x1b[32m✔ Created\x1b[0m ${relSiteData} (merchant & editable site data)`);
  }

  // 4.5. Stable Live Product Detail Route (/products/detail) for Static Export
  const hasProductCatalog =
    Boolean(manifestObj?.editorSchema?.sections?.some((s) => s.path === 'products' || s.path?.startsWith('products['))) ||
    Boolean(fs.existsSync(siteDataPath) && fs.readFileSync(siteDataPath, 'utf8').includes('"products"')) ||
    detectedPages.some((p) => p.route === '/products' || p.route?.startsWith('/products'));

  if (hasNext && hasProductCatalog) {
    const appDir = fs.existsSync(path.join(targetDir, 'src', 'app'))
      ? path.join(targetDir, 'src', 'app')
      : fs.existsSync(path.join(targetDir, 'app'))
        ? path.join(targetDir, 'app')
        : null;

    if (appDir) {
      const detailDir = path.join(appDir, 'products', 'detail');
      const detailPage = path.join(detailDir, 'page.tsx');
      const detailPageJs = path.join(detailDir, 'page.jsx');
      const hasDetailPage = fs.existsSync(detailPage) || fs.existsSync(detailPageJs);

      if (!hasDetailPage) {
        fs.mkdirSync(detailDir, { recursive: true });
        const detailCode = `'use client';\n\nimport React from 'react';\nimport { PlatformProductDetail } from '@deneb-ui/ui';\n\nexport default function ProductDetailPage() {\n  return <PlatformProductDetail backHref="/" />;\n}\n`;
        fs.writeFileSync(detailPage, detailCode, 'utf8');
        console.log(`\x1b[32m✔ Scaffolded\x1b[0m ${path.relative(targetDir, detailPage)} (stable live catalog detail route)`);
      }

      // Ensure /products/detail is registered in manifest pages[]
      if (fs.existsSync(manifestPath)) {
        try {
          const currentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          currentManifest.pages = Array.isArray(currentManifest.pages) ? currentManifest.pages : [];
          const hasDetailInPages = currentManifest.pages.some((p) => p.route === '/products/detail' || p.id === 'product-detail');
          if (!hasDetailInPages) {
            currentManifest.pages.push({
              id: 'product-detail',
              label: 'Product Detail',
              route: '/products/detail',
            });
            fs.writeFileSync(manifestPath, JSON.stringify(currentManifest, null, 2) + '\n');
            console.log(`\x1b[32m✔ Registered\x1b[0m /products/detail in fivora-template.json`);
          }
        } catch {}
      }
    }
  }

  let importPkg = '@deneb-ui/ui';
  if (pkg.dependencies?.['@deneb-ui/ui'] || pkg.devDependencies?.['@deneb-ui/ui']) {
    importPkg = '@deneb-ui/ui';
  } else if (pkg.dependencies?.['@deneb/ui'] || pkg.devDependencies?.['@deneb/ui']) {
    importPkg = '@deneb/ui';
  } else if (pkg.dependencies?.['@fivora/editable-components'] || pkg.devDependencies?.['@fivora/editable-components']) {
    importPkg = '@fivora/editable-components';
  }

  // 4.6. Ensure Root Layout instruments SiteDataProvider
  const appLayoutCandidates = [
    path.join(targetDir, 'src', 'app', 'layout.tsx'),
    path.join(targetDir, 'src', 'app', 'layout.jsx'),
    path.join(targetDir, 'app', 'layout.tsx'),
    path.join(targetDir, 'app', 'layout.jsx'),
  ];
  const targetLayoutFile = appLayoutCandidates.find((f) => fs.existsSync(f));
  if (targetLayoutFile) {
    try {
      const layoutContent = fs.readFileSync(targetLayoutFile, 'utf8');
      const hasProvider = /SiteDataProvider|DenebDataProvider|<Providers\b/.test(layoutContent);
      if (!hasProvider) {
        const { instrumentLayoutSource } = require('../src/arc/transformer.cjs');
        const instrumented = instrumentLayoutSource(layoutContent, '@/data/site-data.json', importPkg);
        if (instrumented.updated && instrumented.code !== layoutContent) {
          fs.writeFileSync(targetLayoutFile, instrumented.code, 'utf8');
          console.log(`\x1b[32m✔ Instrumented\x1b[0m ${path.relative(targetDir, targetLayoutFile)} with <SiteDataProvider>`);
        }
      }
    } catch (layoutErr) {
      // Non-blocking layout instrumentation
    }
  }


  // 4.7. Auto-scaffold core ready-to-use DENEB UI components in src/components/ui/
  const uiDir = path.join(targetDir, 'src', 'components', 'ui');
  if (!fs.existsSync(uiDir)) {
    fs.mkdirSync(uiDir, { recursive: true });
  }
  const compRegistry = getComponentRegistry(importPkg);
  const coreToScaffold = [
    'product-grid',
    'product-card',
    'customer-reviews',
    'google-feedback',
    'location-card',
    'location-link',
    'whatsapp-button',
    'contact-actions',
    'business-hours',
    'map-embed',
  ];
  let scaffoldedCount = 0;
  for (const key of coreToScaffold) {
    const item = compRegistry[key];
    if (item) {
      const targetFile = path.join(uiDir, item.file);
      if (!fs.existsSync(targetFile)) {
        fs.writeFileSync(targetFile, item.code, 'utf8');
        scaffoldedCount++;
      }
    }
  }
  if (scaffoldedCount > 0) {
    console.log(`\x1b[32m✔ Auto-installed\x1b[0m ${scaffoldedCount} essential DENEB UI components in src/components/ui/ (ProductGrid, CustomerReviews, GoogleFeedback, LocationCard, WhatsAppButton, BusinessHours, etc.)`);
  }

  // 4. Update package.json scripts
  pkg.scripts = pkg.scripts || {};
  const scriptsToAdd = {
    'lab': 'deneb lab .',
    'validate': 'deneb validate .',
    'zip': 'deneb zip .',
    'validate-and-zip': 'deneb validate-and-zip .',
    'package:template': 'deneb package .',
    'update:deneb': 'deneb update',
    'fonts:install': 'deneb fonts install .',
  };
  let addedCount = 0;
  for (const [key, val] of Object.entries(scriptsToAdd)) {
    if (!pkg.scripts[key] || pkg.scripts[key].startsWith('fivora ')) {
      pkg.scripts[key] = val;
      addedCount++;
    }
  }
  // Ensure Node 20 LTS platform engine compatibility
  pkg.overrides = pkg.overrides || {};
  if (!pkg.overrides['content-type']) {
    pkg.overrides['content-type'] = '2.1.0';
    pkg.overrides['@octokit/request'] = { 'content-type': '2.1.0' };
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  if (addedCount > 0) {
    console.log(`\x1b[32m✔ Configured\x1b[0m DENEB scripts in package.json (lab, validate, zip, validate-and-zip, package:template, update:deneb)`);
  } else {
    console.log(`\x1b[90m⏩ DENEB scripts already present\x1b[0m in package.json`);
  }

  // 5. Check next.config for static export
  const nextConfigFiles = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
  let foundConfig = null;
  let hasExport = false;
  for (const cfg of nextConfigFiles) {
    const cfgPath = path.join(targetDir, cfg);
    if (fs.existsSync(cfgPath)) {
      foundConfig = cfg;
      const content = fs.readFileSync(cfgPath, 'utf8');
      if (/output\s*:\s*['"]export['"]/.test(content)) {
        hasExport = true;
      }
      break;
    }
  }

  if (foundConfig && !hasExport) {
    console.log(`\n\x1b[33mℹ Note for ${foundConfig}:\x1b[0m Remember to configure static export:`);
    console.log(`  \x1b[90mconst nextConfig = { output: 'export' };\x1b[0m`);
  }

  // 6. Install DENEB packages if missing
  const skipInstall = process.argv.includes('--skip-install');
  const hasUi = Boolean(
    (pkg.dependencies && (pkg.dependencies['@deneb-ui/ui'] || pkg.dependencies['@deneb/ui'])) ||
    (pkg.devDependencies && (pkg.devDependencies['@deneb-ui/ui'] || pkg.devDependencies['@deneb/ui']))
  );
  const hasCli = Boolean(
    (pkg.devDependencies && (pkg.devDependencies['@deneb-ui/cli'] || pkg.devDependencies['@deneb/cli'])) ||
    (pkg.dependencies && (pkg.dependencies['@deneb-ui/cli'] || pkg.dependencies['@deneb/cli']))
  );

  if (!skipInstall && (!hasUi || !hasCli)) {
    const depsToInstall = [];
    const devDepsToInstall = [];
    if (!hasUi) depsToInstall.push('@deneb-ui/ui@latest');
    if (!hasCli) devDepsToInstall.push('@deneb-ui/cli@latest');

    if (depsToInstall.length > 0) {
      console.log(`\n📦 Installing ${depsToInstall.join(' ')}...`);
      spawnSync('npm', ['install', ...depsToInstall], {
        cwd: targetDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
    }
    if (devDepsToInstall.length > 0) {
      console.log(`\n📦 Installing (dev) ${devDepsToInstall.join(' ')}...`);
      spawnSync('npm', ['install', '-D', ...devDepsToInstall], {
        cwd: targetDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
    }
  }

  if (!skipInstall && !process.env.DENEB_SKIP_FONTS) {
    try {
      const { runFontsInstall } = require('../src/tools/deneb-fonts.cjs');
      const plannedFontArgs = [];
      const fontList = conversionRes && Array.isArray(conversionRes.fontIds) ? conversionRes.fontIds : [];
      for (const id of fontList) {
        plannedFontArgs.push('--font', id);
      }
      console.log(`\n\x1b[36mAa Downloading and configuring DENEB Google Fonts...\x1b[0m`);
      runFontsInstall(targetDir, plannedFontArgs);
    } catch (err) {
      console.log(`\n\x1b[33m! Fonts were not installed automatically: ${err.message}. Run \x1b[1mdeneb fonts install .\x1b[0m\x1b[0m`);
    }
  }

  // 7. Post-Init Self-Healing Preflight Check
  try {
    const { runDoctor } = require('../src/tools/deneb-doctor.cjs');
    console.log(`\n\x1b[36m🩺 Running DENEB post-init diagnostic & auto-healing pass...\x1b[0m`);
    runDoctor(targetDir, { fix: true, json: false });
  } catch (docErr) {
    // Non-blocking doctor check
  }

  console.log(`\n\x1b[32m✔ Project initialization complete!\x1b[0m`);
  console.log(`\nYou can now run:`);
  console.log(`  \x1b[36mnpm run lab\x1b[0m               \x1b[90m# Launch Local Visual Editing Lab\x1b[0m`);
  console.log(`  \x1b[36mnpm run validate\x1b[0m          \x1b[90m# Check compliance with Fivora contract\x1b[0m`);
  console.log(`  \x1b[36mnpm run zip\x1b[0m               \x1b[90m# Package clean ZIP for 1-click upload\x1b[0m`);
  console.log(`  \x1b[36mnpm run validate-and-zip\x1b[0m  \x1b[90m# Validate preflight and bundle clean ZIP in 1 step\x1b[0m\n`);
}

function updateDependencies(cmdArgs = []) {
  let targetDir = '.';
  let isLocal = false;
  let localPath = path.resolve(__dirname, '..', '..', '..');

  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i];
    if (arg === '--local' || arg === '-l') {
      isLocal = true;
      if (cmdArgs[i + 1] && !cmdArgs[i + 1].startsWith('-')) {
        localPath = cmdArgs[++i];
      }
    } else if (arg.startsWith('--local=')) {
      isLocal = true;
      localPath = arg.split('=')[1];
    } else if (!arg.startsWith('-')) {
      targetDir = arg;
    }
  }

  targetDir = path.resolve(targetDir);
  const pkgPath = path.join(targetDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.error('\x1b[31mError:\x1b[0m No package.json found in ' + targetDir);
    process.exit(1);
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    console.error('\x1b[31mError:\x1b[0m Failed to parse package.json: ' + err.message);
    process.exit(1);
  }

  console.log('\n' + createBox([
    '\x1b[1m\x1b[37mDENEB PACKAGE & COMPONENT UPDATER\x1b[0m',
    '\x1b[90mUpdate DENEB packages and UI components to latest\x1b[0m',
    '\x1b[90mPowered by DENEB-UI Collaborate with FIVORA\x1b[0m'
  ], 58) + '\n');

  let importPkg = '@deneb-ui/ui';
  if (pkg.dependencies?.['@deneb-ui/ui'] || pkg.devDependencies?.['@deneb-ui/ui']) {
    importPkg = '@deneb-ui/ui';
  } else if (pkg.dependencies?.['@deneb/ui'] || pkg.devDependencies?.['@deneb/ui']) {
    importPkg = '@deneb/ui';
  }

  // 1. Update npm packages
  if (isLocal) {
    const uiDir = path.join(localPath, 'packages', 'deneb-ui');
    const cliDir = path.join(localPath, 'cli', 'deneb-cli');

    if (fs.existsSync(uiDir) && fs.existsSync(cliDir)) {
      console.log('🔄 Updating from local workspace:');
      console.log('   - ' + uiDir);
      console.log('   - ' + cliDir + '\n');

      const installRes = spawnSync('npm', ['install', uiDir, cliDir], {
        cwd: targetDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      if (installRes.status === 0) {
        console.log('\n\x1b[32m✔ Local DENEB packages re-linked & updated successfully!\x1b[0m\n');
      } else {
        console.log('\n\x1b[31m✖ Failed to link local packages (exit code: ' + installRes.status + ')\x1b[0m\n');
      }
    }
  } else {
    console.log('📦 Updating @deneb-ui/ui and @deneb-ui/cli to latest from npm...');
    const packagesToInstall = ['@deneb-ui/ui@latest', '@deneb-ui/cli@latest'];

    const installRes = spawnSync('npm', ['install', ...packagesToInstall], {
      cwd: targetDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (installRes.status === 0) {
      console.log('\n\x1b[32m✔ DENEB packages updated to latest versions successfully!\x1b[0m\n');
    } else {
      console.log('\n\x1b[31m✖ npm install failed with exit code ' + installRes.status + '\x1b[0m\n');
    }
  }

  // 2. Update DENEB components in src/components/ui/
  const uiDir = path.join(targetDir, 'src', 'components', 'ui');
  if (fs.existsSync(uiDir)) {
    console.log('🧩 Inspecting and refreshing installed DENEB UI components in src/components/ui/...\n');
    const registry = getComponentRegistry(importPkg);
    const existingFiles = fs.readdirSync(uiDir);
    let updatedComponentsCount = 0;

    for (const [key, item] of Object.entries(registry)) {
      if (existingFiles.includes(item.file)) {
        const filePath = path.join(uiDir, item.file);
        fs.writeFileSync(filePath, item.code);
        console.log(`  \x1b[32m✔ Updated\x1b[0m src/components/ui/${item.file} (${key})`);
        updatedComponentsCount++;
      }
    }

    if (updatedComponentsCount > 0) {
      console.log(`\n\x1b[32m✔ Successfully updated ${updatedComponentsCount} DENEB component(s) to the latest definitions!\x1b[0m\n`);
    } else {
      console.log(`  \x1b[90mNo existing DENEB UI components found in src/components/ui to update.\x1b[0m\n`);
    }
  }
}

function addComponent(componentName, targetDirInput) {
  const targetDir = path.resolve(targetDirInput || '.');
  const uiDir = path.join(targetDir, 'src', 'components', 'ui');
  fs.mkdirSync(uiDir, { recursive: true });

  const pkgPath = path.join(targetDir, 'package.json');
  let importPkg = '@deneb-ui/ui';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies?.['@deneb-ui/ui'] || pkg.devDependencies?.['@deneb-ui/ui']) {
        importPkg = '@deneb-ui/ui';
      } else if (pkg.dependencies?.['@deneb/ui'] || pkg.devDependencies?.['@deneb/ui']) {
        importPkg = '@deneb/ui';
      } else if (pkg.dependencies?.['@fivora/editable-components'] || pkg.devDependencies?.['@fivora/editable-components']) {
        importPkg = '@fivora/editable-components';
      }
    } catch {
      // ignore
    }
  }

  const REGISTRY = getComponentRegistry(importPkg);

  if (!componentName || componentName === 'list') {
    console.log('\n' + createBox([
      '\x1b[1m\x1b[37mDENEB UI COMPONENT REGISTRY\x1b[0m'
    ], 55) + '\n');
    console.log('Available components to add (run "deneb add <name>"):');
    for (const [key, val] of Object.entries(REGISTRY)) {
      console.log(`  - \x1b[32m${key.padEnd(18)}\x1b[0m -> src/components/ui/${val.file}`);
    }
    console.log(`  - \x1b[32m${'all'.padEnd(18)}\x1b[0m -> Install all components into src/components/ui/\n`);
    return;
  }

  const keysToAdd = componentName === 'all' ? Object.keys(REGISTRY) : [componentName.toLowerCase()];

  console.log(`\n\x1b[36m📦 Adding DENEB UI components to:\x1b[0m ${uiDir}\n`);

  for (const key of keysToAdd) {
    const item = REGISTRY[key];
    if (!item) {
      console.error(`\x1b[31m✖ Unknown component:\x1b[0m "${key}". Run "deneb add list" to view available components.`);
      continue;
    }
    const filePath = path.join(uiDir, item.file);
    fs.writeFileSync(filePath, item.code);
    console.log(`  \x1b[32m✔ Added\x1b[0m src/components/ui/${item.file}`);
  }

  console.log('\n\x1b[32m✔ Component(s) added successfully!\x1b[0m');
  console.log('Import them in your pages:\n  \x1b[90mimport { ... } from "@/components/ui/...";\x1b[0m\n');
}

function runValidateAndZip(targetDirInput, extraArgs = []) {
  if (targetDirInput === '--help' || targetDirInput === '-h' || extraArgs.includes('--help') || extraArgs.includes('-h')) {
    console.log(`\nUsage: deneb validate-and-zip [template-directory] [options]
  (or deneb validate --zip [template-directory])
  (or deneb validate and zip [template-directory])

Runs Fivora preflight verification against manifest contracts, static export fixtures,
and visual editing markers. If and only if all checks pass, packages a clean upload-ready
fivora-template.zip (excluding node_modules, .next, .git, .env*).

Options:
  --skip-install  Reuse existing dependencies in working directory (diagnostic only)
  --skip-build    Inspect existing build output directory in place (diagnostic only)
  --json          Output validation report as JSON\n`);
    process.exit(0);
  }

  const targetDir = path.resolve(targetDirInput || '.');
  const outputZip = path.resolve(targetDir, 'fivora-template.zip');

  console.log('\n' + createBox([
    '\x1b[1m\x1b[37mDENEB VALIDATE & ZIP PREFLIGHT\x1b[0m',
    '\x1b[90m1. Validate website configuration with Fivora platform\x1b[0m',
    '\x1b[90m2. Package clean upload-ready ZIP if 100% compliant\x1b[0m'
  ], 58) + '\n');

  console.log(`[Step 1/2] Running Fivora preflight validation in ${targetDir}...\n`);

  const validatorScript = path.join(toolsDir, 'deneb-template-validator.cjs');
  const valRes = spawnSync(process.execPath, [validatorScript, 'validate', targetDir, ...extraArgs], {
    stdio: 'inherit',
  });

  if (valRes.status !== 0) {
    console.error(`\n\x1b[31m✖ Validation failed with exit code ${valRes.status}.\x1b[0m`);
    console.error(`\x1b[33mRefusing to package ZIP: template does not meet Fivora platform requirements.\x1b[0m`);
    console.error(`Fix the validation errors above and re-run "deneb validate-and-zip".\n`);
    process.exit(valRes.status ?? 1);
  }

  console.log(`\n[Step 2/2] Validation PASSED! Creating clean upload-ready ZIP...\n`);
  packageCleanZip(targetDir, outputZip);

  console.log('\n' + createBox([
    '\x1b[1m\x1b[32m✔ PREFLIGHT VALIDATION & PACKAGING SUCCESSFUL!\x1b[0m',
    `\x1b[37mOutput:\x1b[0m ${path.basename(outputZip)}`,
    '\x1b[90mReady for 1-click upload at Fivora Developer Portal\x1b[0m'
  ], 58) + '\n');
}

function runDoctor(targetDirInput, options = {}) {
  const { runDoctor: executeDoctor } = require('../src/tools/deneb-doctor.cjs');
  return executeDoctor(targetDirInput, options);
}

// Normalize multi-word "validate and zip" or "validate & zip"
let command = args[0];
let commandArgs = args.slice(1);

if (command === 'validate' && (commandArgs[0] === 'and' || commandArgs[0] === '&') && commandArgs[1] === 'zip') {
  command = 'validate-and-zip';
  commandArgs = commandArgs.slice(2);
}

if (command === 'init') {
  let targetInput = '.';
  let recipeName = null;
  let dryRun = false;
  let explain = false;
  let legacy = false;
  let telemetry = 'off';
  let aiEnabled = false;
  let aiDryRun = false;
  for (let i = 0; i < commandArgs.length; i++) {
    const arg = commandArgs[i];
    if (arg === '--recipe' || arg === '-r') {
      recipeName = commandArgs[++i];
    } else if (arg.startsWith('--recipe=')) {
      recipeName = arg.split('=')[1];
    } else if (arg === '--dry-run' || arg === '--dryrun') {
      dryRun = true;
    } else if (arg === '--explain') {
      explain = true;
    } else if (arg === '--legacy') {
      legacy = true;
    } else if (arg === '--ai') {
      aiEnabled = true;
    } else if (arg === '--ai-dry-run') {
      aiEnabled = true;
      aiDryRun = true;
    } else if (arg === '--telemetry' && commandArgs[i + 1]) {
      telemetry = commandArgs[++i];
    } else if (arg.startsWith('--telemetry=')) {
      telemetry = arg.split('=')[1] || 'off';
    } else if (!arg.startsWith('-')) {
      targetInput = arg;
    }
  }
  initProject(targetInput, { recipeName, dryRun, explain, legacy, telemetry, aiEnabled, aiDryRun }).catch((err) => {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
    process.exit(1);
  });
} else if (command === 'create') {
  createTemplate(commandArgs[0]);
} else if (command === 'add') {
  addComponent(commandArgs[0], commandArgs[1]);
} else if (command === 'doctor' || command === 'check') {
  let targetInput = '.';
  let fix = false;
  let json = false;
  for (let i = 0; i < commandArgs.length; i++) {
    const arg = commandArgs[i];
    if (arg === '--fix' || arg === '-f') {
      fix = true;
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('-')) {
      targetInput = arg;
    }
  }
  const res = runDoctor(targetInput, { fix, json });
  if (res && res.errors > 0) {
    process.exit(1);
  }
} else if (command === 'lab') {
  const script = path.join(toolsDir, 'local-template-lab.cjs');
  const res = spawnSync(process.execPath, [script, ...commandArgs], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
} else if (command === 'validate') {
  if (commandArgs.includes('--zip') || commandArgs.includes('-z')) {
    const cleanArgs = commandArgs.filter((a) => a !== '--zip' && a !== '-z');
    runValidateAndZip(cleanArgs[0] || '.', cleanArgs.slice(1));
  } else {
    const script = path.join(toolsDir, 'deneb-template-validator.cjs');
    const res = spawnSync(process.execPath, [script, 'validate', ...commandArgs], { stdio: 'inherit' });
    process.exit(res.status ?? 0);
  }
} else if (command === 'pack' || command === 'zip') {
  const targetDir = path.resolve(commandArgs[0] || '.');
  const outputZip = path.resolve(targetDir, 'fivora-template.zip');
  packageCleanZip(targetDir, outputZip);
} else if (command === 'validate-and-zip' || command === 'validate-zip') {
  runValidateAndZip(commandArgs[0] || '.', commandArgs.slice(1));
} else if (command === 'update' || command === 'upgrade') {
  updateDependencies(commandArgs);
} else if (command === 'fonts') {
  const { runFontsCommand } = require('../src/tools/deneb-fonts.cjs');
  process.exit(runFontsCommand(commandArgs));
} else if (command === 'save-recipe' || command === 'learn') {
  const targetDir = path.resolve(commandArgs[0] || '.');
  const recipeName = commandArgs[1] || path.basename(targetDir);
  try {
    const { saveRecipeFromProject } = require('../src/tools/recipe-engine.cjs');
    const res = saveRecipeFromProject(targetDir, recipeName);
    console.log(`\n\x1b[32m✔ Successfully learned and saved recipe:\x1b[0m \x1b[1m${res.recipe.name}\x1b[0m`);
    console.log(`  Saved to CLI recipe bank: \x1b[90m${res.globalDest}\x1b[0m`);
    console.log(`  Saved to project recipe:  \x1b[90m${res.localDest}\x1b[0m`);
    console.log(`  Future runs of "npx @deneb-ui/cli init" will automatically apply these calibrated fix patterns!\n`);
  } catch (err) {
    console.error(`\x1b[31m✖ Failed to save recipe:\x1b[0m ${err.message}`);
    process.exit(1);
  }
} else {
  console.log(`Usage: deneb <command> [options]
  DENEB UI Framework — Powered by DENEB-UI Collaborate with FIVORA

Core Commands:
  init              Deneb ARC: convert an existing React/Next.js app into a Fivora-editable storefront
                    flags: --dry-run  --explain  --recipe <name>  --legacy  --ai  --ai-dry-run  --telemetry off|anonymous|enhanced
  doctor            Run comprehensive environment, manifest, visual editing AST & asset diagnostic checks (flags: --fix, --json)
  save-recipe       Learn and save calibrated fixes & schemas into reusable recipe bank (e.g. deneb save-recipe . shoes-store)
  learn             Alias for save-recipe
  fonts             Google Fonts catalog — list presets or install self-hosted @fontsource packages
  update            Update DENEB packages (@deneb-ui/ui, @deneb-ui/cli) and UI components
  validate          Validate website configuration and visual editing contracts with Fivora platform
  zip               Zip the project without unnecessary folders or files (node_modules, .next, .git, .env)
  validate-and-zip  Validate website configuration and immediately package clean upload-ready ZIP

Development & Scaffolding:
  add <component>   Add or update a DENEB UI component in src/components/ui/ (e.g. deneb add product-card)
  create <name>     Scaffold a new storefront template (e.g. deneb create my-store)
  lab               Start the local visual editing lab simulation
  pack              Alias for zip
  package           Run strict sandbox preflight verification and generate upload ZIP

Examples:
  deneb doctor
  deneb doctor --fix
  deneb doctor --json
  deneb init
  deneb init --dry-run
  deneb init --explain
  deneb init --recipe fashion
  deneb init --recipe electronics
  deneb init --recipe cosmetics
  deneb init --legacy
  deneb init --ai
  deneb init --ai-dry-run
  deneb fonts list
  deneb fonts install .
  deneb fonts install . --font inter --font playfair-display
  deneb update
  deneb validate .
  deneb validate --zip
  deneb validate-and-zip
  deneb zip .
  deneb add product-card
  deneb add all`);
  process.exit(1);
}

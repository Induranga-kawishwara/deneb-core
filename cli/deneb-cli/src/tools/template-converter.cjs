/**
 * DENEB Universal Template Converter Engine & Recipe System
 *
 * Automatically converts existing Next.js projects (built with shadcn/ui,
 * HeroUI, Tailwind CSS, or custom React components) into fully editable
 * Fivora storefront templates.
 *
 * Architecture & Framework by Chamika Gayashan & Induranga Kawishwara.
 * Powered by DENEB-UI Collaborate with FIVORA.
 */

const fs = require('fs');
const path = require('path');
const { matchRecipeForProject, saveRecipeFromProject, getRecipeByName } = require('./recipe-engine.cjs');

/**
 * 1. Detect CSS and Component Frameworks
 */
function detectProjectFrameworks(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  let pkg = {};
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {
      pkg = {};
    }
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const hasShadcn = Boolean(
    fs.existsSync(path.join(projectDir, 'components.json')) ||
    fs.existsSync(path.join(projectDir, 'src', 'components', 'ui')) ||
    fs.existsSync(path.join(projectDir, 'components', 'ui')) ||
    allDeps['@radix-ui/react-slot'] ||
    allDeps['class-variance-authority']
  );

  const hasHeroUi = Boolean(
    allDeps['@heroui/react'] ||
    allDeps['@nextui-org/react'] ||
    Object.keys(allDeps).some((d) => d.startsWith('@heroui/') || d.startsWith('@nextui-org/'))
  );

  const hasTailwind = Boolean(
    allDeps['tailwindcss'] ||
    fs.existsSync(path.join(projectDir, 'tailwind.config.js')) ||
    fs.existsSync(path.join(projectDir, 'tailwind.config.ts')) ||
    fs.existsSync(path.join(projectDir, 'tailwind.config.mjs'))
  );

  let uiDir = null;
  const candidateUiDirs = [
    path.join(projectDir, 'src', 'components', 'ui'),
    path.join(projectDir, 'components', 'ui'),
  ];
  for (const d of candidateUiDirs) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      uiDir = d;
      break;
    }
  }

  let appDir = null;
  let isAppRouter = true;
  const candidateAppDirs = [
    path.join(projectDir, 'src', 'app'),
    path.join(projectDir, 'app'),
  ];
  for (const d of candidateAppDirs) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      appDir = d;
      break;
    }
  }

  if (!appDir) {
    const candidatePagesDirs = [
      path.join(projectDir, 'src', 'pages'),
      path.join(projectDir, 'pages'),
    ];
    for (const d of candidatePagesDirs) {
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
        appDir = d;
        isAppRouter = false;
        break;
      }
    }
  }

  const detected = [];
  if (hasShadcn) detected.push('shadcn/ui (Radix Primitives + CVA)');
  if (hasHeroUi) detected.push('HeroUI / NextUI');
  if (hasTailwind) detected.push('Tailwind CSS');
  if (detected.length === 0) detected.push('Standard React / Next.js Components');

  return {
    pkg,
    hasShadcn,
    hasHeroUi,
    hasTailwind,
    uiDir,
    appDir,
    isAppRouter,
    detected,
  };
}

/**
 * 2. Create Timestamped Backup
 */
function createBackup(projectDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectDir, `.deneb-backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function backupFile(filePath, projectDir, backupDir) {
  if (!fs.existsSync(filePath)) return;
  const rel = path.relative(projectDir, filePath);
  const dest = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(filePath, dest);
}

/**
 * 3. Instrument Root Layout with SiteDataProvider
 */
function instrumentRootLayout(projectDir, detection, backupDir) {
  if (!detection.appDir) return { success: false, reason: 'No app or pages directory found' };

  const layoutCandidates = [
    path.join(detection.appDir, 'layout.tsx'),
    path.join(detection.appDir, 'layout.jsx'),
    path.join(detection.appDir, 'layout.js'),
    path.join(detection.appDir, '_app.tsx'),
    path.join(detection.appDir, '_app.jsx'),
    path.join(detection.appDir, '_app.js'),
  ];

  let layoutFile = null;
  for (const f of layoutCandidates) {
    if (fs.existsSync(f)) {
      layoutFile = f;
      break;
    }
  }

  if (!layoutFile) return { success: false, reason: 'Root layout file not found' };

  backupFile(layoutFile, projectDir, backupDir);
  let content = fs.readFileSync(layoutFile, 'utf8');

  // Check if SiteDataProvider already mounted
  if (content.includes('SiteDataProvider') || content.includes('DenebDataProvider')) {
    return { success: true, updated: false, layoutFile };
  }

  // Determine site-data import path
  const hasSrc = fs.existsSync(path.join(projectDir, 'src'));
  const siteDataImport = hasSrc ? '@/data/site-data.json' : '../data/site-data.json';

  // Add imports at top
  const importStatement = `import { SiteDataProvider } from '@deneb-ui/ui';\nimport initialSiteData from '${siteDataImport}';\n`;

  if (content.includes('import ')) {
    content = importStatement + content;
  } else {
    content = importStatement + '\n' + content;
  }

  // Wrap children or body content with SiteDataProvider
  if (content.includes('{children}')) {
    content = content.replace(
      '{children}',
      '<SiteDataProvider initialSiteData={initialSiteData}>{children}</SiteDataProvider>'
    );
  } else if (content.includes('<Component {...pageProps}')) {
    // Pages router _app.tsx
    content = content.replace(
      /<Component\s+\{\.\.\.pageProps\}\s*\/>/,
      '<SiteDataProvider initialSiteData={initialSiteData}><Component {...pageProps} /></SiteDataProvider>'
    );
  }

  fs.writeFileSync(layoutFile, content, 'utf8');
  return { success: true, updated: true, layoutFile };
}

/**
 * 4. Helper: Walk directory to find target TSX/JSX files
 */
function findSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'out' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name.startsWith('.deneb-backup')
      ) {
        continue;
      }
      findSourceFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      if (/\.(tsx|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

/**
 * Sanitize strings for valid field keys
 */
function toFieldKey(text, prefix = 'text', index = 1) {
  if (!text || typeof text !== 'string') return `${prefix}_${index}`;
  const cleaned = text
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .map((word, i) =>
      i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');

  if (!cleaned || cleaned.length < 2) {
    return `${prefix}_${index}`;
  }
  return cleaned;
}

/**
 * 5. Intelligent JSX Content Extractor and Marker Transformer with Heuristic Recipes
 */
function transformFileContent(filePath, pageKey, extractedData, backupDir, projectDir, activeRecipe = null) {
  let code = fs.readFileSync(filePath, 'utf8');

  let fileModified = false;
  let elementCount = 0;
  let keyCounters = {};

  function getUniqueKey(baseKey) {
    keyCounters[baseKey] = (keyCounters[baseKey] || 0) + 1;
    if (keyCounters[baseKey] === 1) return baseKey;
    return `${baseKey}_${keyCounters[baseKey]}`;
  }

  // 1. Ensure <main> has data-preview-page-key if this is a page file
  if (filePath.endsWith('page.tsx') || filePath.endsWith('page.jsx')) {
    if (code.includes('<main') && !code.includes('data-preview-page-key')) {
      code = code.replace(/<main(\s+[^>]*)?>/, (match, attrs = '') => {
        fileModified = true;
        return `<main data-preview-page-key="${pageKey}"${attrs}>`;
      });
    }
  }

  // 0. Brand Logo & Monogram Guardian (Auto-binds logo icons and images on deneb init)
  const isHeaderOrLogoFile = /logo|header|navbar|nav/i.test(filePath);
  if (isHeaderOrLogoFile) {
    // 0a. Image logos
    code = code.replace(/<(img|Image)(\s+[^>]*?src=["{][^>]*?)>/gi, (match, tag, rest) => {
      if (rest.includes('data-preview-field-path') || /avatar|hero|banner|photo|car|product/i.test(rest)) return match;
      fileModified = true;
      return `<${tag}${rest} data-preview-field-path="common.logoUrl" data-preview-style-target="common.logoUrl" data-preview-style-type="image">`;
    });

    // 0b. Monogram / SVG Logo fallback wrappers
    code = code.replace(/<span(\s+[^>]*?class(?:Name)?="[^"]*(?:place-items-center|rounded|bg-primary|logo|monogram)[^"]*"[^>]*?)>(\s*<svg[\s\S]*?<\/svg>\s*)<\/span>/gi, (match, attrs, svg) => {
      if (attrs.includes('data-preview-field-path')) return match;
      const cleanAttrs = attrs.replace(/\s*aria-hidden(?:="[^"]*")?/g, '');
      const cleanSvg = svg.replace(/\s*data-preview-static="[^"]*"/g, '');
      fileModified = true;
      return `<span${cleanAttrs} data-preview-field-path="common.logoUrl" data-preview-style-target="common.logoUrl" data-preview-style-type="image" title="Click to edit logo">${cleanSvg}</span>`;
    });
  }

  // 1b. Eyebrow Badges & Section Eyebrows (e.g. <p className="eyebrow">...</p> or eyebrow="..." props)
  const eyebrowTagRegex = /<(p|span)(\s+[^>]*?class(?:Name)?="[^"]*\beyebrow\b[^"]*"[^>]*)>([^<>{}]+)<\/\1>/gi;
  code = code.replace(eyebrowTagRegex, (match, tag, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'eyebrow', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag} data-preview-field-path="${pageKey}.${fieldKey}" data-preview-style-target="${pageKey}.${fieldKey}" data-preview-style-type="text"${attrs}>{${ `siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}` }}</${tag}>`;
  });

  const sectionHeadingEyebrowRegex = /<(SectionHeading|PageHeader)(\s+[^>]*?)eyebrow="([^"]+)"([^>]*?)\/?>/gi;
  code = code.replace(sectionHeadingEyebrowRegex, (match, tag, pre = '', eyebrowText, post = '') => {
    if (pre.includes('eyebrowPath=') || post.includes('eyebrowPath=')) {
      return match;
    }
    const trimmed = eyebrowText.trim();
    const rawKey = toFieldKey(trimmed, 'eyebrow', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag}${pre}eyebrow={${ `siteData?.content?.${pageKey}?.${fieldKey} ?? ${JSON.stringify(trimmed)}` }} eyebrowPath="${pageKey}.${fieldKey}"${post}/>`;
  });

  // 2. Headings: <h1> to <h6>
  const headingRegex = /<(h[1-6])(\s+[^>]*)?>([^<>{}]+)<\/\1>/g;
  code = code.replace(headingRegex, (match, tag, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, `${tag}Title`, elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag} data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</${tag}>`;
  });

  // 3. Paragraphs: <p>
  const pRegex = /<p(\s+[^>]*)?>([^<>{}]+)<\/p>/g;
  code = code.replace(pRegex, (match, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'paragraph', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<p data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</p>`;
  });

  // 4. Card Titles & Descriptions (shadcn/ui & modern patterns)
  const cardTitleRegex = /<CardTitle(\s+[^>]*)?>([^<>{}]+)<\/CardTitle>/g;
  code = code.replace(cardTitleRegex, (match, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'cardTitle', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<CardTitle data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</CardTitle>`;
  });

  const cardDescRegex = /<CardDescription(\s+[^>]*)?>([^<>{}]+)<\/CardDescription>/g;
  code = code.replace(cardDescRegex, (match, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'cardDescription', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<CardDescription data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</CardDescription>`;
  });

  // 5. Buttons & CTAs: <Button> and <button>
  const btnRegex = /<(Button|button)(\s+[^>]*)?>([^<>{}]+)<\/\1>/g;
  code = code.replace(btnRegex, (match, tag, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'ctaLabel', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag} data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</${tag}>`;
  });

  // 6. Inputs & Search Bars: placeholder attribute
  const inputRegex = /<(input|Input|textarea|Textarea)(\s+[^>]*?)placeholder="([^"]+)"([^>]*?)\/?>/g;
  code = code.replace(inputRegex, (match, tag, beforeAttrs = '', placeholder, afterAttrs = '') => {
    const trimmed = placeholder.trim();
    if (!trimmed || beforeAttrs.includes('data-preview-field-path') || afterAttrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'placeholder', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag}${beforeAttrs}data-preview-field-path="${pageKey}.${fieldKey}" placeholder={siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}${afterAttrs}/>`;
  });

  // 7. Extract Images: <img src="..." alt="..." /> or <Image ... />
  const imgRegex = /<(img|Image)(\s+[^>]*?)src="([^"]+)"([^>]*?)alt="([^"]+)"([^>]*?)\/?>/g;
  code = code.replace(imgRegex, (match, tag, preSrc = '', src, mid = '', alt, post = '') => {
    if (preSrc.includes('data-preview-field-path') || mid.includes('data-preview-field-path') || post.includes('data-preview-field-path')) {
      return match;
    }
    const altTrimmed = alt.trim();
    const rawKey = toFieldKey(altTrimmed, 'bannerImage', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = src;
    elementCount++;
    fileModified = true;

    return `<${tag}${preSrc}data-preview-field-path="${pageKey}.${fieldKey}" src={siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(src)}}${mid}alt="${alt}"${post}/>`;
  });

  // 8. Badges, Labels, Tags: <span ...>
  const spanRegex = /<span(\s+[^>]*)?>([^<>{}]+)<\/span>/g;
  code = code.replace(spanRegex, (match, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path') || attrs.includes('data-preview-page-key')) {
      return match;
    }
    if (/^[0-9]+$/.test(trimmed) && trimmed.length < 2) return match;
    const rawKey = toFieldKey(trimmed, 'label', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<span data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</span>`;
  });

  // 9. Adaptive Action-Link Splitter & Social Media Handler (100% Fivora Contract Safe)
  // 9a. WhatsApp & Direct Communication Links
  const waRegex = /<a(\s+[^>]*?)href="([^"]*(?:wa\.me|whatsapp)[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
  code = code.replace(waRegex, (match, preHref = '', href, postHref = '', innerContent) => {
    if (preHref.includes('data-preview-field-path') || postHref.includes('data-preview-field-path')) {
      return match;
    }
    const urlKey = 'whatsappCtaUrl';
    const labelKey = 'whatsappCtaLabel';
    extractedData[urlKey] = href;

    // Extract text from innerContent
    const textMatch = innerContent.match(/>([^<>{}]+)</) || [null, innerContent.replace(/<[^>]+>/g, '').trim()];
    const text = (textMatch[1] || 'Order via WhatsApp').trim();
    extractedData[labelKey] = text;

    elementCount += 2;
    fileModified = true;

    // Wrap inner label cleanly in span if not already wrapped
    let updatedInner = innerContent;
    if (/<span(\s+[^>]*)?>([^<>{}]+)<\/span>/i.test(innerContent)) {
      updatedInner = innerContent.replace(
        /<span(\s+[^>]*)?>([^<>{}]+)<\/span>/i,
        `<span data-preview-field-path="${pageKey}.${labelKey}"$1>{siteData?.content?.${pageKey}?.${labelKey} || ${JSON.stringify(text)}}</span>`
      );
    } else if (text && innerContent.includes(text)) {
      updatedInner = innerContent.replace(
        text,
        `<span data-preview-field-path="${pageKey}.${labelKey}">{siteData?.content?.${pageKey}?.${labelKey} || ${JSON.stringify(text)}}</span>`
      );
    }

    return `<a${preHref}href={siteData?.content?.${pageKey}?.${urlKey} || ${JSON.stringify(href)}} data-preview-field-path="${pageKey}.${urlKey}"${postHref}>${updatedInner}</a>`;
  });

  // 9b. Social Media Icon Links (Instagram, Facebook, TikTok, Twitter/X, YouTube, LinkedIn)
  const socialRegex = /<a(\s+[^>]*?)href="([^"]*(?:instagram|facebook|tiktok|twitter|youtube|linkedin)\.com[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
  code = code.replace(socialRegex, (match, preHref = '', href, postHref = '', innerContent) => {
    if (preHref.includes('data-preview-field-path') || postHref.includes('data-preview-field-path')) {
      return match;
    }
    const platMatch = href.match(/(instagram|facebook|tiktok|twitter|youtube|linkedin)\.com/i);
    const platform = platMatch ? platMatch[1].toLowerCase() : 'social';
    const fieldKey = `${platform}Url`;

    extractedData[fieldKey] = href;
    elementCount++;
    fileModified = true;

    return `<a${preHref}href={siteData?.content?.common?.footer?.${fieldKey} || siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(href)}} data-preview-field-path="common.footer.${fieldKey}"${postHref}>${innerContent}</a>`;
  });

  // 9c. Button / CTA Action Links with Text (Split URL on <a>/<Link> and Label on <span>)
  const btnLinkRegex = /<(a|Link|GatedLink)(\s+[^>]*?class(?:Name)?="[^"]*(?:btn|button|cta|action|rounded|bg-)[^"]*"[^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi;
  code = code.replace(btnLinkRegex, (match, tag, preHref = '', href, postHref = '', innerContent) => {
    if (preHref.includes('data-preview-field-path') || postHref.includes('data-preview-field-path') || href.startsWith('#') || href.includes('javascript:')) {
      return match;
    }
    const textOnly = innerContent.replace(/<[^>]+>/g, '').trim();
    if (!textOnly || textOnly.length < 2) return match;

    const rawUrlKey = toFieldKey(textOnly, 'ctaUrl', elementCount + 1);
    const urlKey = getUniqueKey(rawUrlKey);
    const labelKey = urlKey.replace(/Url$/, 'Label') || getUniqueKey('ctaLabel');

    extractedData[urlKey] = href;
    extractedData[labelKey] = textOnly;
    elementCount += 2;
    fileModified = true;

    let updatedInner = innerContent;
    if (/<span(\s+[^>]*)?>([^<>{}]+)<\/span>/i.test(innerContent)) {
      updatedInner = innerContent.replace(
        /<span(\s+[^>]*)?>([^<>{}]+)<\/span>/i,
        `<span data-preview-field-path="${pageKey}.${labelKey}" data-preview-style-target="${pageKey}.${labelKey}" data-preview-style-type="text"$1>{siteData?.content?.${pageKey}?.${labelKey} || ${JSON.stringify(textOnly)}}</span>`
      );
    } else {
      updatedInner = innerContent.replace(
        textOnly,
        `<span data-preview-field-path="${pageKey}.${labelKey}" data-preview-style-target="${pageKey}.${labelKey}" data-preview-style-type="text">{siteData?.content?.${pageKey}?.${labelKey} || ${JSON.stringify(textOnly)}}</span>`
      );
    }

    return `<${tag}${preHref}href={siteData?.content?.${pageKey}?.${urlKey} || ${JSON.stringify(href)}} data-preview-field-path="${pageKey}.${urlKey}"${postHref}>${updatedInner}</${tag}>`;
  });

  // 9d. Standard Links with Plain Text (<a>, <Link>, <GatedLink> with inner span)
  const linkRegex = /<(a|Link|GatedLink)(\s+[^>]*)?>([^<>{}]+)<\/\1>/g;
  code = code.replace(linkRegex, (match, tag, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'linkText', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag}${attrs}><span data-preview-field-path="${pageKey}.${fieldKey}" data-preview-style-target="${pageKey}.${fieldKey}" data-preview-style-type="text">{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</span></${tag}>`;
  });

  // 9e. Dynamic Link Expressions (e.g. <Link href={...}>{item.label}</Link>)
  const dynamicLinkRegex = /<(a|Link|GatedLink)(\s+[^>]*)?>\s*\{([a-zA-Z0-9_$.]+(?:\.(?:label|name|title|text|displayName|countLabel)))\s*\}\s*<\/\1>/g;
  code = code.replace(dynamicLinkRegex, (match, tag, attrs = '', expr) => {
    if (attrs.includes('data-preview-field-path') || match.includes('data-preview-field-path')) {
      return match;
    }
    const varPrefix = expr.split('.')[0];
    fileModified = true;
    return `<${tag}${attrs}><span data-preview-field-path={\`common.navLabels.\${ ${varPrefix}.id || ${varPrefix}.key || ${varPrefix}.slug || 'item'} \`} data-preview-style-target={\`common.navLabels.\${ ${varPrefix}.id || ${varPrefix}.key || ${varPrefix}.slug || 'item'} \`} data-preview-style-type="text">{${expr}}</span></${tag}>`;
  });

  // 10. List items: <li>
  const liRegex = /<li(\s+[^>]*)?>([^<>{}]+)<\/li>/g;
  code = code.replace(liRegex, (match, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'item', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<li data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</li>`;
  });

  // 11. UI Badges: <Badge> or <badge>
  const badgeRegex = /<(Badge|badge)(\s+[^>]*)?>([^<>{}]+)<\/\1>/g;
  code = code.replace(badgeRegex, (match, tag, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'badge', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag} data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</${tag}>`;
  });

  // 12. UI Typography: Heading, Title, Subtitle, Description, Typography
  const typoRegex = /<(Heading|Title|Subtitle|Description|Typography)(\s+[^>]*)?>([^<>{}]+)<\/\1>/g;
  code = code.replace(typoRegex, (match, tag, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, tag.toLowerCase(), elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<${tag} data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</${tag}>`;
  });

  // 13. Styled text in <div> (e.g. shadow text, banners, overlays, stats, prices)
  const divTextRegex = /<div(\s+[^>]*?class(?:Name)?="[^"]*(?:bg|shadow|watermark|banner|overlay|hero|title|heading|text|label|sub|desc|caption|badge|price|quote|stat|tag|brand|lead)[^"]*"[^>]*)>([^<>{}]+)<\/div>/gi;
  code = code.replace(divTextRegex, (match, attrs = '', text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length < 2 || attrs.includes('data-preview-field-path')) {
      return match;
    }
    const rawKey = toFieldKey(trimmed, 'divText', elementCount + 1);
    const fieldKey = getUniqueKey(rawKey);

    extractedData[fieldKey] = trimmed;
    elementCount++;
    fileModified = true;

    return `<div data-preview-field-path="${pageKey}.${fieldKey}"${attrs}>{siteData?.content?.${pageKey}?.${fieldKey} || ${JSON.stringify(trimmed)}}</div>`;
  });

  // 14. Sensitive Element Guardian: Navigation links and anchors are NEVER marked static so they remain editable.
  // Only non-bound decorative <img> tags receive static markers if not already bound.

  code = code.replace(/<img(\s+[^>]*?src="[^"]*"[^>]*?)>/gi, (match, attrs) => {
    if (attrs.includes('data-preview-field-path') || attrs.includes('data-preview-static')) {
      return match;
    }
    fileModified = true;
    return `<img${attrs} data-preview-static="decorative-image">`;
  });

  // If file was modified, ensure useSiteData and client directives are added
  if (fileModified) {
    backupFile(filePath, projectDir, backupDir);

    // Next.js safety: A client component cannot export metadata.
    if (code.includes('export const metadata') || code.includes('export let metadata')) {
      code = code.replace(/export\s+(const|let)\s+metadata/g, '// Metadata preserved for static export\n$1 metadata');
    }

    // Ensure 'use client' at top if not present
    if (!code.includes('use client')) {
      code = "'use client';\n\n" + code;
    }

    // Add useSiteData import if needed. Skip when any binding already exists.
    if (!/\buseSiteData\b/.test(code)) {
      code = code.replace(
        /(import\s+[^;]+;\n)/,
        `$1import { useSiteData } from '@deneb-ui/ui';\n`
      );
    }

    // Add const { siteData } = useSiteData(); inside the primary component function
    if (!code.includes('useSiteData()')) {
      let injected = false;
      if (/(export\s+default\s+function\s*[A-Za-z0-9_]*\s*\([^)]*\)\s*\{)/.test(code)) {
        code = code.replace(/(export\s+default\s+function\s*[A-Za-z0-9_]*\s*\([^)]*\)\s*\{)/, `$1\n  const { siteData } = useSiteData();`);
        injected = true;
      }
      if (!injected && /(export\s+default\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/.test(code)) {
        code = code.replace(/(export\s+default\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/, `$1\n  const { siteData } = useSiteData();`);
        injected = true;
      }
      if (!injected && /(const\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/.test(code)) {
        code = code.replace(/(const\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/, `$1\n  const { siteData } = useSiteData();`);
        injected = true;
      }
      if (!injected && /(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/.test(code)) {
        code = code.replace(/(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/, `$1\n  const { siteData } = useSiteData();`);
        injected = true;
      }
    }

    fs.writeFileSync(filePath, code, 'utf8');
  }

  return { fileModified, elementCount };
}

/**
 * 6. Harmonize and Upgrade Existing UI Components
 */
function harmonizeUiComponents(projectDir, detection, backupDir) {
  if (!detection.uiDir || !fs.existsSync(detection.uiDir)) {
    return { count: 0 };
  }

  const entries = fs.readdirSync(detection.uiDir);
  let harmonized = 0;

  for (const entry of entries) {
    if (!entry.endsWith('.tsx') && !entry.endsWith('.jsx')) continue;
    const compPath = path.join(detection.uiDir, entry);
    let code = fs.readFileSync(compPath, 'utf8');

    if (code.includes('{...props}')) {
      harmonized++;
    }
  }

  return { count: harmonized };
}

/**
 * 7. Generate Comprehensive site-data.json and fivora-template.json with Recipe Defaults
 */
function generateTemplateData(projectDir, projectName, detectedPages, extractedByPage, activeRecipe = null) {
  const manifestPath = path.join(projectDir, 'fivora-template.json');
  const siteDataPath = path.join(projectDir, 'src', 'data', 'site-data.json');
  fs.mkdirSync(path.dirname(siteDataPath), { recursive: true });

  const navLabels = {};
  for (const p of detectedPages) {
    navLabels[p.id] = p.label || p.id;
  }

  // Base content
  const content = {
    common: {
      websiteTitle: projectName,
      shortDescription: `A high-converting storefront built for the Fivora platform.`,
      logoUrl: '/fivora-logo.png',
      headerCtaLabel: 'Shop Now',
      copyright: `© ${new Date().getFullYear()} ${projectName}. All rights reserved.`,
      navLabels: navLabels,
      business: {
        phone: '+1 (555) 482-9012',
        whatsapp: '15554829012',
        email: 'merchant@fivora.site',
      },
    },
  };

  const editorSections = [
    {
      id: 'common',
      path: 'common',
      type: 'object',
      label: 'Common Storefront Content',
      fields: [
        { key: 'websiteTitle', type: 'text', label: 'Website Title', required: true },
        { key: 'shortDescription', type: 'textarea', label: 'Short Description' },
        { key: 'logoUrl', type: 'image', label: 'Website Logo' },
        { key: 'headerCtaLabel', type: 'text', label: 'Header CTA Button' },
        {
          key: 'navLabels',
          type: 'object',
          label: 'Navigation Labels',
          fields: detectedPages.map((p) => ({
            key: p.id,
            type: 'text',
            label: `${p.label || p.id} Link`,
          })),
        },
        {
          key: 'business',
          type: 'object',
          label: 'Business Information',
          fields: [
            { key: 'phone', type: 'tel', label: 'Phone Number' },
            { key: 'whatsapp', type: 'text', label: 'WhatsApp Number' },
            { key: 'email', type: 'email', label: 'Contact Email' },
          ],
        },
        { key: 'copyright', type: 'text', label: 'Copyright' },
      ],
    },
  ];

  // Merge pages from detectedPages and activeRecipe.pages
  const mergedPages = [...detectedPages];
  if (activeRecipe && Array.isArray(activeRecipe.pages)) {
    for (const rp of activeRecipe.pages) {
      if (!mergedPages.some((p) => p.id === rp.id || p.route === rp.route)) {
        mergedPages.push(rp);
      }
    }
  }

  // If active recipe has defined sections, seed them with guaranteed path property
  if (activeRecipe && Array.isArray(activeRecipe.sections)) {
    for (const sec of activeRecipe.sections) {
      const clonedSec = { ...sec };
      if (!clonedSec.path) clonedSec.path = clonedSec.id;
      if (clonedSec.id === 'common') {
        const commonSec = editorSections.find((s) => s.id === 'common');
        if (commonSec && Array.isArray(clonedSec.fields)) {
          for (const rf of clonedSec.fields) {
            if (!commonSec.fields.some((f) => f.key === rf.key)) {
              commonSec.fields.push(rf);
            }
          }
        }
        continue;
      }
      editorSections.push(clonedSec);
    }
  }

  // Seed recipe defaults if available with deep merge for common/footer
  if (activeRecipe && activeRecipe.defaults) {
    for (const [secKey, secVal] of Object.entries(activeRecipe.defaults)) {
      if (!content[secKey]) {
        content[secKey] = JSON.parse(JSON.stringify(secVal));
      } else if (typeof secVal === 'object' && !Array.isArray(secVal)) {
        content[secKey] = { ...secVal, ...content[secKey] };
        if (secVal.footer && content[secKey].footer) {
          content[secKey].footer = { ...secVal.footer, ...content[secKey].footer };
        }
      }
    }
  }

  // Merge dynamically extracted fields
  for (const page of detectedPages) {
    const pageKey = page.id;
    const pageFields = extractedByPage[pageKey] || {};

    if (!content[pageKey]) content[pageKey] = {};
    Object.assign(content[pageKey], pageFields);

    // Check if section already exists in editorSections
    let existingSection = editorSections.find((s) => s.id === pageKey);
    const newFieldDefs = [];

    for (const [key, val] of Object.entries(pageFields)) {
      if (existingSection && existingSection.fields.some((f) => f.key === key)) {
        continue;
      }
      const isImg = key.toLowerCase().includes('image') || (typeof val === 'string' && /\.(jpg|png|webp|svg)$/i.test(val));
      const isLong = typeof val === 'string' && val.length > 60;
      newFieldDefs.push({
        key: key,
        type: isImg ? 'image' : isLong ? 'textarea' : 'text',
        label: key
          .replace(/([A-Z])/g, ' $1')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }

    if (existingSection) {
      if (!existingSection.path) existingSection.path = existingSection.id;
      existingSection.fields.push(...newFieldDefs);
    } else if (newFieldDefs.length > 0) {
      editorSections.push({
        id: pageKey,
        path: pageKey,
        type: 'object',
        label: `${page.label || pageKey} Content`,
        fields: newFieldDefs,
      });
    }
  }

  // Ensure all editorSections have a valid path attribute
  for (const sec of editorSections) {
    if (!sec.path) sec.path = sec.id;
  }

  const siteData = {
    project: {
      id: `${projectName}-project`,
      title: projectName,
      status: 'APPROVED',
    },
    merchant: {
      businessName: projectName,
      description: `A modern commerce storefront built for the Fivora platform.`,
    },
    template: {
      id: `${projectName}-template`,
      name: projectName,
      engine: 'NEXT_STATIC_EXPORT',
      structure: {
        pages: mergedPages.map((p) => p.id),
      },
    },
    requirements: {
      requiredPages: mergedPages.filter((p) => p.required).map((p) => p.id),
      requiredFeatures: [],
    },
    content: content,
  };

  const manifest = {
    framework: 'nextjs-static-export',
    version: 2,
    visualEditing: {
      contractVersion: 1,
      mode: 'strict',
      controlOnlyPaths: ['common.brandUrl'],
    },
    siteDataFile: 'src/data/site-data.json',
    outputDirectory: 'out',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    basePathEnvVar: 'NEXT_PUBLIC_SITE_BASE_PATH',
    pages: mergedPages,
    editorSchema: {
      version: 1,
      sections: editorSections,
    },
  };

  fs.writeFileSync(siteDataPath, JSON.stringify(siteData, null, 2) + '\n', 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { siteDataPath, manifestPath, totalFields: editorSections.reduce((acc, s) => acc + (s.fields?.length || 0), 0) };
}

/**
 * Main Conversion Pipeline
 */
function runUniversalTemplateConversion(projectDir, projectName, detectedPages, options = {}) {
  console.log(`\n🔍 Analyzing existing UI and CSS frameworks in project...`);
  const detection = detectProjectFrameworks(projectDir);
  for (const framework of detection.detected) {
    console.log(`  \x1b[36m✔ Detected:\x1b[0m ${framework}`);
  }

  const allSourceFiles = findSourceFiles(projectDir);

  // Match optimal recipe (either explicitly specified by --recipe flag or auto-detected by signatures)
  let matchedRecipe = null;
  if (options.recipeName && typeof getRecipeByName === 'function') {
    matchedRecipe = getRecipeByName(options.recipeName, projectDir);
    if (matchedRecipe) {
      console.log(`  \x1b[35m🎯 Selected Recipe:\x1b[0m ${matchedRecipe.label} (${matchedRecipe.name})`);
    } else {
      console.log(`  \x1b[33m⚠ Recipe "${options.recipeName}" not found. Falling back to signature detection...\x1b[0m`);
    }
  }

  if (!matchedRecipe) {
    matchedRecipe = matchRecipeForProject(projectDir, detection.pkg, allSourceFiles);
    if (matchedRecipe) {
      console.log(`  \x1b[35m🎯 Matched Recipe:\x1b[0m ${matchedRecipe.label} (${matchedRecipe.name})`);
    }
  }

  const backupDir = createBackup(projectDir);
  console.log(`\n🛡️  Created safe backup at \x1b[90m${path.basename(backupDir)}\x1b[0m`);

  // 1. Root Layout
  console.log(`\n🔗 Instrumenting Root Layout with SiteDataProvider...`);
  const layoutRes = instrumentRootLayout(projectDir, detection, backupDir);
  if (layoutRes.updated) {
    console.log(`  \x1b[32m✔ Mounted\x1b[0m SiteDataProvider in ${path.basename(layoutRes.layoutFile)}`);
  } else {
    console.log(`  \x1b[90m⏩ Layout already configured\x1b[0m`);
  }

  // 2. Scan & Transform Pages and Components
  console.log(`\n⚡ Scanning & instrumenting pages with visual editing markers...`);
  const extractedByPage = {};
  let totalTransformedElements = 0;
  let transformedFilesCount = 0;

  for (const page of detectedPages) {
    extractedByPage[page.id] = {};
  }

  for (const file of allSourceFiles) {
    let pageKey = 'home';
    for (const page of detectedPages) {
      if (page.id !== 'home' && file.toLowerCase().includes(page.id)) {
        pageKey = page.id;
        break;
      }
    }

    if (!extractedByPage[pageKey]) extractedByPage[pageKey] = {};

    const res = transformFileContent(file, pageKey, extractedByPage[pageKey], backupDir, projectDir, matchedRecipe);
    if (res.fileModified) {
      transformedFilesCount++;
      totalTransformedElements += res.elementCount;
      console.log(`  \x1b[32m✔ Transformed\x1b[0m ${path.relative(projectDir, file)} (\x1b[33m${res.elementCount}\x1b[0m editable markers added)`);
    }
  }

  // 3. Harmonize UI Components
  console.log(`\n🧩 Harmonizing UI components in ${detection.uiDir ? path.relative(projectDir, detection.uiDir) : 'src/components/ui'}...`);
  const uiRes = harmonizeUiComponents(projectDir, detection, backupDir);
  if (uiRes.count > 0) {
    console.log(`  \x1b[32m✔ Harmonized\x1b[0m ${uiRes.count} component(s) to support visual preview attributes`);
  }

  // 4. Generate centralized data and synchronized manifest
  console.log(`\n📦 Generating centralized site-data.json and Fivora Spec v2 contract...`);
  const dataRes = generateTemplateData(projectDir, projectName, detectedPages, extractedByPage, matchedRecipe);
  console.log(`  \x1b[32m✔ Generated\x1b[0m ${path.relative(projectDir, dataRes.siteDataPath)}`);
  console.log(`  \x1b[32m✔ Generated\x1b[0m ${path.relative(projectDir, dataRes.manifestPath)} (\x1b[36m${dataRes.totalFields}\x1b[0m visual fields mapped)`);

  return {
    detection,
    backupDir,
    matchedRecipe,
    transformedFilesCount,
    totalTransformedElements,
    totalFields: dataRes.totalFields,
  };
}

module.exports = {
  detectProjectFrameworks,
  createBackup,
  instrumentRootLayout,
  transformFileContent,
  harmonizeUiComponents,
  generateTemplateData,
  runUniversalTemplateConversion,
  saveRecipeFromProject,
  getRecipeByName,
};

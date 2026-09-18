'use strict';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'our', 'are', 'you',
  'a', 'an', 'to', 'of', 'in', 'on', 'at', 'by', 'or', 'is',
]);

function toCamel(parts) {
  const cleaned = parts
    .join(' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w, i) => i === 0 || !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 5);
  if (!cleaned.length) return '';
  const camel = cleaned
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
  if (/^[0-9]/.test(camel)) {
    return 'item' + camel.charAt(0).toUpperCase() + camel.slice(1);
  }
  return camel;
}

function inferSection(context) {
  const haystack = [
    context.componentName,
    context.fileName,
    context.className,
    context.parentName,
    context.tag,
  ].filter(Boolean).join(' ').toLowerCase();

  const rules = [
    ['announcement', /announc|promo-bar|topbar/],
    ['header', /header|navbar|nav\b|site-header/],
    ['footer', /footer|site-footer/],
    ['hero', /hero|banner|jumbotron/],
    ['navigation', /nav|menu|links/],
    ['feedback', /feedback|google-review/],
    ['testimonials', /testimonial/],
    ['map', /map\b|location-map|google-map/],
    ['faq', /faq|accordion/],
    ['form', /form|booking|inquiry|registration/],
    ['contact', /contact|whatsapp|mailto/],
    ['featuredProducts', /featured|product-grid|collection/],
    ['newsletter', /newsletter|subscribe/],
    ['pricing', /pricing|plan/],
    ['features', /feature/],
    ['about', /about|story|brand/],
  ];
  for (const [name, re] of rules) {
    if (re.test(haystack)) return name;
  }
  if (context.role === 'navigation') return 'header';
  if (context.role === 'footer') return 'footer';
  if (context.role === 'hero') return 'hero';
  return null;
}

function inferFieldName(kind, tag, text, extra = {}) {
  if (kind === 'url') {
    if (extra.action === 'form-submit') return 'formWhatsappUrl';
    if (extra.platform) return `${extra.platform}Url`;
    if (extra.action === 'whatsapp') return 'whatsappUrl';
    if (extra.action === 'phone') return 'phoneUrl';
    if (extra.action === 'email') return 'emailUrl';
    if (extra.cta) return extra.cta === 'primary' ? 'primaryCtaUrl' : `${extra.cta}Url`;
    const fromText = toCamel([text || '', 'url']);
    return fromText || (extra.action ? `${extra.action}Url` : 'ctaUrl');
  }
  if (kind === 'label' && extra.paired) {
    if (extra.action === 'form-submit') return 'formSubmitLabel';
    if (extra.action === 'whatsapp') return 'whatsappLabel';
    if (extra.action === 'phone') return 'phoneLabel';
    if (extra.action === 'email') return 'emailLabel';
    if (extra.cta) return extra.cta === 'primary' ? 'primaryCtaLabel' : `${extra.cta}Label`;
    return toCamel([text || '', 'label']) || (extra.action ? `${extra.action}Label` : 'ctaLabel');
  }
  if (extra.isBrandLogo) {
    if (kind === 'image') return 'logoUrl';
    return 'logoText';
  }
  if (kind === 'image') return extra.alt ? toCamel([extra.alt, 'image']) || 'image' : 'image';
  if (kind === 'alt') return extra.imageField ? extra.imageField.replace(/Image$/, 'ImageAlt').replace(/image$/, 'imageAlt') : 'imageAlt';
  if (kind === 'placeholder') return toCamel([text || '', 'placeholder']) || 'placeholder';

  const tagMap = {
    h1: 'title',
    h2: 'heading',
    h3: 'subheading',
    h4: 'subheading',
    h5: 'label',
    h6: 'label',
    p: (text || '').length > 80 ? 'description' : 'subtitle',
    CardTitle: 'title',
    CardDescription: 'description',
    Heading: 'title',
    Title: 'title',
    Subtitle: 'subtitle',
    Description: 'description',
    Typography: 'text',
    Badge: 'badge',
    label: 'label',
    button: 'label',
    Button: 'label',
    span: 'label',
    li: 'item',
  };
  if (tagMap[tag]) {
    const mapped = typeof tagMap[tag] === 'function' ? tagMap[tag] : tagMap[tag];
    if (mapped === 'title' || mapped === 'heading' || mapped === 'subtitle' || mapped === 'description') {
      return mapped;
    }
    const named = toCamel([text || '', mapped]);
    return named || mapped;
  }
  return toCamel([text || kind || 'text']) || 'text';
}

function uniquePath(used, basePath) {
  if (!used.has(basePath)) {
    used.add(basePath);
    return basePath;
  }
  let i = 2;
  while (used.has(`${basePath}${i}`)) i++;
  const next = `${basePath}${i}`;
  used.add(next);
  return next;
}

function buildFieldPath({ scope, section, field, used }) {
  const resolvedScope = scope || 'home';
  const parts = [resolvedScope];
  // "about.about.title" reads worse than "about.title"; a section that merely
  // repeats its own route adds no addressing value.
  if (section && section !== resolvedScope) parts.push(section);
  parts.push(field || 'text');
  return uniquePath(used, parts.join('.'));
}

function humanLabel(fieldPath) {
  const last = String(fieldPath).split('.').pop() || fieldPath;
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function isListActionCtaKey(key) {
  return /Cta$/i.test(String(key || ''));
}

function listActionCtaItemFieldNames() {
  return ['buttonLabel', 'buttonUrl'];
}

function classifyFieldType(kind, value) {
  if (kind === 'image') return 'image';
  if (kind === 'url') return 'url';
  if (kind === 'email' || (typeof value === 'string' && /^mailto:/i.test(value))) return 'email';
  if (kind === 'phone' || (typeof value === 'string' && /^(tel:|\+)/i.test(value))) return 'tel';
  if (kind === 'color') return 'text';
  if (kind === 'rating' || kind === 'number' || typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (kind === 'textarea' || (typeof value === 'string' && value.length > 80)) return 'textarea';
  if (typeof value === 'string' && /\$|lkr|usd|rs\.?\s*\d/i.test(value)) return 'text';
  return 'text';
}

module.exports = {
  toCamel,
  inferSection,
  inferFieldName,
  uniquePath,
  buildFieldPath,
  humanLabel,
  classifyFieldType,
  isListActionCtaKey,
  listActionCtaItemFieldNames,
};

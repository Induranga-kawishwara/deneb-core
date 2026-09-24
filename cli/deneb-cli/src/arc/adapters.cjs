'use strict';

const { collectJsxText, getJsxAttributeLiteral } = require('./ast.cjs');
const {
  AdapterRegistry,
  defaultRegistry,
  BUILTIN_ADAPTERS,
  registerAdapter,
  getAdapter,
  getAllAdapters,
  activeAdapters,
  recognizeWithAdapters,
  resolveActionWithAdapters,
} = require('./adapters/registry.cjs');

const ICON_NAME_RE = /^(Icon|[A-Z][A-Za-z0-9]*(Icon|Logo)|Lucide[A-Z]|HiOutline|HiSolid|Fa[A-Z]|Md[A-Z]|Io[A-Z])/;
const DECORATIVE_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'ellipse',
  'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'use', 'mask',
]);
const SKIP_TAGS = new Set([
  'script', 'style', 'link', 'meta', 'head', 'html', 'Fragment', 'Suspense',
  'StrictMode', 'ErrorBoundary',
]);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'Heading', 'Title', 'CardTitle', 'ModalHeader', 'DialogTitle']);
const TEXT_TAGS = new Set(['p', 'span', 'li', 'blockquote', 'figcaption', 'label', 'CardDescription', 'Description', 'Subtitle', 'Typography', 'Text', 'Badge', 'badge']);
const ACTION_TAGS = new Set(['a', 'Link', 'NavLink', 'Button', 'button', 'IconButton', 'NavbarBrand']);
const IMAGE_TAGS = new Set(['img', 'Image', 'Img', 'BackgroundImage', 'picture']);
const FORM_INPUT_TAGS = new Set(['input', 'Input', 'textarea', 'Textarea', 'select', 'Select']);
const FORM_CONTAINER_TAGS = new Set(['form', 'Form']);

const ADAPTERS = BUILTIN_ADAPTERS;

function isIconComponent(name, importSource) {
  if (!name) return false;
  if (DECORATIVE_TAGS.has(name)) return true;
  if (ICON_NAME_RE.test(name)) return true;
  if (importSource && /(lucide-react|heroicons|react-icons|tabler\/icons)/i.test(importSource)) return true;
  return false;
}

function classifyHref(href) {
  const value = String(href || '');
  if (/wa\.me|whatsapp/i.test(value)) return 'whatsapp';
  if (/^tel:/i.test(value) || /phone|call/i.test(value)) return 'phone';
  if (/^mailto:/i.test(value)) return 'email';
  const social = value.match(/(instagram|facebook|tiktok|twitter|x\.com|youtube|linkedin|pinterest|threads)\./i);
  if (social) {
    const platform = social[1].toLowerCase().replace('x.com', 'twitter');
    return platform === 'x.com' ? 'twitter' : platform;
  }
  return 'link';
}

function isLikelyCtaClass(className) {
  return /\b(btn|button|cta|action|rounded|bg-|hero[-_]?cta)\b/i.test(className || '');
}

function classifyActionIntent(text, href) {
  const t = String(text || '').trim().toLowerCase();
  const h = String(href || '').trim().toLowerCase();

  // 0. Form Submit / WhatsApp Form Action
  if (
    /^(submit|send\s*message|send\s*inquiry|confirm\s*booking|place\s*order|book\s*now|confirm|get\s*quote|request\s*quote|send\s*request|schedule|register|sign\s*up|subscribe|apply|enroll)$/i.test(t) ||
    /\b(?:send\s*message|confirm\s*booking|submit\s*form|submit\s*inquiry|send\s*inquiry|request\s*quote|get\s*quote|send\s*request)\b/i.test(t)
  ) {
    return {
      action: 'form-submit',
      defaultUrl: /^https?:\/\//i.test(h) && !h.includes('#') ? href : 'https://wa.me/1234567890',
      external: true,
    };
  }

  // 1. WhatsApp
  if (
    /wa\.me|whatsapp/i.test(h) ||
    /\b(?:whatsapp|wa\.me)\b/i.test(t) ||
    /order on whatsapp|chat on whatsapp|message on whatsapp|whatsapp order|order via whatsapp|proceed to order|proceed to checkout|complete order|confirm priority repair|book repair|schedule repair|confirm repair/i.test(t)
  ) {
    return {
      action: 'whatsapp',
      defaultUrl: /^https?:\/\//i.test(h) && !h.includes('#') ? href : 'https://wa.me/1234567890',
      external: true,
    };
  }

  // 2. Phone / Call
  if (/^tel:/i.test(h) || /\b(?:call\s*(?:me|us|now)?|phone\s*(?:me|us|now)?|direct\s*line|ring\s*us)\b/i.test(t)) {
    return {
      action: 'phone',
      defaultUrl: /^tel:/i.test(h) ? href : 'tel:+1234567890',
      external: false,
    };
  }

  // 3. Directions
  if (/maps\.google|goo\.gl\/maps|map\.apple/i.test(h) || /\b(?:directions?|get\s*directions?|route|navigate)\b/i.test(t)) {
    return {
      action: 'directions',
      defaultUrl: /^https?:\/\//i.test(h) && !h.includes('#') ? href : 'https://maps.google.com/?q=store+location',
      external: true,
    };
  }

  // 4. Location / Map
  if (/\b(?:locations?|our\s*location|store\s*location|view\s*location|find\s*us|visit\s*us|locate\s*us|map)\b/i.test(t)) {
    return {
      action: 'location',
      defaultUrl: /^https?:\/\//i.test(h) && !h.includes('#') ? href : 'https://maps.google.com/?q=store+location',
      external: true,
    };
  }

  // 5. Shop / Order / Catalog / Menu
  if (/\b(?:shop(?:\s*now)?|order(?:\s*now)?|buy(?:\s*now)?|explore\s*(?:shop|products|offerings|collection|menu)|browse\s*(?:menu|catalog|shop)|view\s*(?:menu|catalog)|menu)\b/i.test(t) || /^\/(?:shop|products|menu|catalog)/i.test(h)) {
    return {
      action: 'shop',
      defaultUrl: h && !['#', ''].includes(h) ? href : '/shop',
      external: false,
    };
  }

  // 6. Email
  if (/^mailto:/i.test(h) || /\b(?:email\s*us|send\s*(?:us\s*)?email|contact\s*by\s*email)\b/i.test(t)) {
    return {
      action: 'email',
      defaultUrl: /^mailto:/i.test(h) ? href : 'mailto:info@example.com',
      external: false,
    };
  }

  // 7. Check href using existing classifyHref
  if (h && !['#', ''].includes(h)) {
    const fromHref = classifyHref(href);
    if (fromHref && fromHref !== 'link') {
      return {
        action: fromHref,
        defaultUrl: href,
        external: ['instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin', 'pinterest'].includes(fromHref),
      };
    }
  }

  return null;
}

module.exports = {
  AdapterRegistry,
  defaultRegistry,
  BUILTIN_ADAPTERS,
  registerAdapter,
  getAdapter,
  getAllAdapters,
  ADAPTERS,
  activeAdapters,
  recognizeWithAdapters,
  resolveActionWithAdapters,
  isIconComponent,
  classifyHref,
  classifyActionIntent,
  isLikelyCtaClass,
  DECORATIVE_TAGS,
  SKIP_TAGS,
  HEADING_TAGS,
  TEXT_TAGS,
  ACTION_TAGS,
  IMAGE_TAGS,
  FORM_INPUT_TAGS,
  FORM_CONTAINER_TAGS,
  collectJsxText,
  getJsxAttributeLiteral,
};

'use strict';

/**
 * Deneb ARC — Component Registry
 *
 * Master lookup of all known editable components in @deneb-ui/ui.
 * Used by the AI agent to classify "known vs unknown" components
 * during `deneb init --ai`.
 */

const KNOWN_EDITABLE_COMPONENTS = new Set([
  // ─── Core Text & Primitives ────────────────────────────────────
  'EditableText',
  'EditableHeading',
  'EditableParagraph',
  'EditableBadge',
  'EditableQuote',
  'EditableButton',
  'EditableImage',
  'EditableMap',
  'EditableList',
  'EditableBox',
  'EditableGrid',
  'EditableSection',
  'EditableDialog',

  // ─── Product & Commerce ────────────────────────────────────────
  'EditableProductCard',
  'EditableProductGrid',
  'EditableProductDetail',
  'EditableCartDrawer',
  'EditableFilterSidebar',
  'EditablePricingCard',
  'ProductQuickView',

  // ─── Content & Social Proof ────────────────────────────────────
  'EditableServiceCard',
  'EditableCard',
  'EditableTestimonialCard',
  'EditableTestimonialSection',
  'EditableCustomerReviews',
  'EditableGoogleFeedback',
  'EditableFAQAccordion',
  'EditableContactForm',

  // ─── Layout & Navigation ───────────────────────────────────────
  'EditableNavbar',
  'EditableFooter',
  'EditableHero',
  'EditableHeroCentered',
  'EditableHeroSplit',
  'EditableAnnouncementBar',
  'EditableCategoryPills',
  'StickyMobileBar',
  'TrustBadges',
  'CookieConsentBanner',

  // ─── Infrastructure ────────────────────────────────────────────
  'SiteDataProvider',
  'ThemeStyles',
  'ResponsiveBaseStyles',
  'DenebComponentStyles',
  'FontLoader',
  'PreviewField',
]);

/**
 * Canonical short-name aliases that Shadcn/HeroUI developers might use.
 * Maps common short names to their Deneb equivalents.
 */
const ALIAS_MAP = {
  'Button': 'EditableButton',
  'Card': 'EditableCard',
  'Dialog': 'EditableDialog',
  'Text': 'EditableText',
  'Heading': 'EditableHeading',
  'Paragraph': 'EditableParagraph',
  'Badge': 'EditableBadge',
  'Quote': 'EditableQuote',
  'Image': 'EditableImage',
  'Map': 'EditableMap',
  'Grid': 'EditableGrid',
  'Section': 'EditableSection',
  'Box': 'EditableBox',
  'List': 'EditableList',
  'ProductCard': 'EditableProductCard',
  'ProductGrid': 'EditableProductGrid',
  'ProductDetail': 'EditableProductDetail',
  'CustomerReviews': 'EditableCustomerReviews',
  'GoogleFeedback': 'EditableGoogleFeedback',
  'ServiceCard': 'EditableServiceCard',
  'PricingCard': 'EditablePricingCard',
  'TestimonialCard': 'EditableTestimonialCard',
  'TestimonialSection': 'EditableTestimonialSection',
  'Testimonials': 'EditableTestimonialSection',
  'FAQ': 'EditableFAQAccordion',
  'Accordion': 'EditableFAQAccordion',
  'ContactForm': 'EditableContactForm',
  'Navbar': 'EditableNavbar',
  'Header': 'EditableNavbar',
  'Footer': 'EditableFooter',
  'Hero': 'EditableHeroCentered',
  'HeroSplit': 'EditableHeroSplit',
  'AnnouncementBar': 'EditableAnnouncementBar',
  'CategoryPills': 'EditableCategoryPills',
  'CartDrawer': 'EditableCartDrawer',
  'FilterSidebar': 'EditableFilterSidebar',
};

/**
 * Check if a component name is already covered by @deneb-ui/ui.
 * Checks both the full Editable* name and common aliases.
 */
function isKnownComponent(name) {
  if (!name || typeof name !== 'string') return false;
  if (KNOWN_EDITABLE_COMPONENTS.has(name)) return true;
  if (ALIAS_MAP[name]) return true;
  // Also check if user passed the Editable-prefixed version
  if (KNOWN_EDITABLE_COMPONENTS.has(`Editable${name}`)) return true;
  return false;
}

/**
 * Returns the list of all known editable component names.
 */
function getKnownComponentNames() {
  return [...KNOWN_EDITABLE_COMPONENTS];
}

/**
 * Given a list of discovered component names from a project scan,
 * returns { known: string[], unknown: string[] }.
 */
function classifyComponents(componentNames) {
  const known = [];
  const unknown = [];
  const seen = new Set();

  for (const name of componentNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (isKnownComponent(name)) {
      known.push(name);
    } else {
      unknown.push(name);
    }
  }

  return { known, unknown };
}

module.exports = {
  KNOWN_EDITABLE_COMPONENTS,
  ALIAS_MAP,
  isKnownComponent,
  getKnownComponentNames,
  classifyComponents,
};

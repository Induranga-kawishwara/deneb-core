'use strict';

const { getJsxName, hasJsxAttribute } = require('../ast.cjs');

function detectFromProfile(profile, id) {
  return (profile?.componentLibraries || []).includes(id) || profile?.[id] === true;
}

const ACTION_TAGS = new Set(['a', 'Link', 'NavLink', 'Button', 'button', 'IconButton', 'NavbarBrand']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'Heading', 'Title', 'CardTitle', 'ModalHeader', 'DialogTitle']);
const TEXT_TAGS = new Set(['p', 'span', 'li', 'blockquote', 'figcaption', 'label', 'CardDescription', 'Description', 'Subtitle', 'Typography', 'Text', 'Badge', 'badge']);

const shadcnAdapter = {
  id: 'shadcn',
  detect: (project) => detectFromProfile(project, 'shadcn') || project?.shadcn,
  recognizeNode(node, ctx) {
    const name = getJsxName(node);
    if (name === 'Button') {
      return { library: 'shadcn', kind: 'button', asChild: hasJsxAttribute(node, 'asChild') };
    }
    if (name === 'CardTitle' || name === 'CardDescription' || name === 'Badge') {
      return { library: 'shadcn', kind: 'text', tag: name };
    }
    return null;
  },
  resolveAction(node) {
    const name = getJsxName(node);
    if (name === 'Button' && hasJsxAttribute(node, 'asChild')) {
      const child = (node.children || []).find((c) => c && c.type === 'JSXElement');
      if (child && ACTION_TAGS.has(getJsxName(child))) return child;
    }
    return null;
  },
};

const herouiAdapter = {
  id: 'heroui',
  detect: (project) => detectFromProfile(project, 'heroui') || project?.heroui,
  recognizeNode(node) {
    const name = getJsxName(node);
    if (['Button', 'Link', 'Navbar', 'NavbarBrand', 'NavbarItem', 'NavbarContent'].includes(name)) {
      return { library: 'heroui', kind: name === 'Button' || name === 'Link' ? 'action' : 'structure', tag: name };
    }
    return null;
  },
  resolveAction(node) {
    const name = getJsxName(node);
    if (name === 'Button' && (hasJsxAttribute(node, 'href') || hasJsxAttribute(node, 'as'))) return node;
    if (name === 'Link') return node;
    return null;
  },
};

const nextjsAdapter = {
  id: 'nextjs',
  detect: (project) => project?.framework === 'nextjs',
  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Link') return { library: 'nextjs', kind: 'action', tag: 'Link' };
    if (name === 'Image') return { library: 'nextjs', kind: 'image', tag: 'Image' };
    return null;
  },
  resolveAction(node) {
    return getJsxName(node) === 'Link' ? node : null;
  },
};

const framerMotionAdapter = {
  id: 'framer-motion',
  detect: (project) => (project?.animationLibraries || []).includes('framer-motion'),
  recognizeNode(node) {
    const name = getJsxName(node);
    if (name.startsWith('motion.')) {
      const tag = name.slice('motion.'.length);
      return { library: 'framer-motion', kind: HEADING_TAGS.has(tag) || TEXT_TAGS.has(tag) ? 'text' : 'structure', tag };
    }
    return null;
  },
};

const reactBitsAdapter = {
  id: 'react-bits',
  detect: (project) => project?.reactBits,
  recognizeNode(node) {
    const name = getJsxName(node);
    if (/SplitText|BlurText|GradientText|ShinyText|CountUp|RotatingText/.test(name)) {
      return { library: 'react-bits', kind: 'text', tag: name };
    }
    return null;
  },
};

const denebAdapter = {
  id: 'deneb',
  detect: (project) =>
    (project?.componentLibraries || []).includes('@deneb-ui/ui') ||
    project?.['@deneb-ui/ui'] === true ||
    Boolean(project?.dependencies && project?.dependencies['@deneb-ui/ui']),
  recognizeNode(node) {
    const name = getJsxName(node);
    if (['EditableContactForm', 'ContactForm'].includes(name)) {
      return { library: 'deneb', kind: 'form', tag: name };
    }
    if (['EditableGoogleFeedback', 'EditableCustomerReviews', 'CustomerReviews', 'GoogleFeedback'].includes(name)) {
      return { library: 'deneb', kind: 'feedback', tag: name };
    }
    if (['EditableTestimonialSection', 'EditableTestimonialCard', 'TestimonialSection', 'Testimonials'].includes(name)) {
      return { library: 'deneb', kind: 'testimonial', tag: name };
    }
    if (name === 'EditableMap' || name === 'Map') {
      return { library: 'deneb', kind: 'map', tag: name };
    }
    if (['EditableImage', 'EditableText', 'EditableCard', 'EditableProductCard', 'Image', 'Text', 'Card'].includes(name)) {
      return { library: 'deneb', kind: 'editable-primitive', tag: name };
    }
    return null;
  },
};

const radixAdapter = {
  id: 'radix',
  detect: (project) => (project?.componentLibraries || []).includes('radix'),
  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Slot' || name.endsWith('.Root') || name.endsWith('.Trigger')) {
      return { library: 'radix', kind: 'structure', tag: name };
    }
    return null;
  },
};

module.exports = {
  shadcnAdapter,
  herouiAdapter,
  nextjsAdapter,
  framerMotionAdapter,
  reactBitsAdapter,
  denebAdapter,
  radixAdapter,
};

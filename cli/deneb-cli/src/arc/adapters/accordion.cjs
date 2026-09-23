'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * Radix & shadcn Accordion Adapter
 * Supports Accordion, AccordionItem, AccordionTrigger, AccordionContent.
 */
const accordionAdapter = {
  id: 'accordion',

  detect: () => true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Accordion' || name.endsWith('Accordion')) {
      return { library: 'accordion', kind: 'collection', role: 'accordion-container', tag: name };
    }
    if (name === 'AccordionItem') {
      return { library: 'accordion', kind: 'collection-item', role: 'accordion-item', tag: name };
    }
    if (name === 'AccordionTrigger') {
      return { library: 'accordion', kind: 'text', role: 'accordion-header', tag: name };
    }
    if (name === 'AccordionContent') {
      return { library: 'accordion', kind: 'text', role: 'accordion-body', tag: name };
    }
    return null;
  },
};

module.exports = accordionAdapter;

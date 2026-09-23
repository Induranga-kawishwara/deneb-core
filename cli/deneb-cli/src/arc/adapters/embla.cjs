'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * Embla & shadcn Carousel Adapter
 * Supports Carousel, CarouselContent, CarouselItem from embla-carousel or shadcn.
 */
const emblaAdapter = {
  id: 'embla',

  detect: (project) =>
    (project?.dependencies &&
      ('embla-carousel' in project.dependencies || 'embla-carousel-react' in project.dependencies)) ||
    true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Carousel' || name === 'CarouselContent') {
      return { library: 'embla', kind: 'collection', role: 'carousel-container', tag: name };
    }
    if (name === 'CarouselItem') {
      return { library: 'embla', kind: 'collection-item', role: 'carousel-slide', tag: name };
    }
    return null;
  },
};

module.exports = emblaAdapter;

'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * React-Slick Carousel Adapter
 * Supports Slider from react-slick / slick-carousel.
 */
const slickAdapter = {
  id: 'slick',

  detect: (project) =>
    (project?.dependencies &&
      ('react-slick' in project.dependencies || 'slick-carousel' in project.dependencies)) ||
    true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Slider') {
      return { library: 'slick', kind: 'collection', role: 'carousel-container', tag: name };
    }
    return null;
  },
};

module.exports = slickAdapter;

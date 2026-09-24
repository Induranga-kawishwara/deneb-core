'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * Swiper Carousel Adapter
 * Supports Swiper & SwiperSlide from swiper/react.
 */
const swiperAdapter = {
  id: 'swiper',

  detect: (project) =>
    (project?.dependencies &&
      ('swiper' in project.dependencies || 'swiper/react' in project.dependencies)) ||
    true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Swiper') {
      return { library: 'swiper', kind: 'collection', role: 'carousel-container', tag: name };
    }
    if (name === 'SwiperSlide') {
      return { library: 'swiper', kind: 'collection-item', role: 'carousel-slide', tag: name };
    }
    return null;
  },
};

module.exports = swiperAdapter;

'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * Gallery & Masonry Grid Adapter
 * Supports Masonry, Gallery, Lightbox, PhotoGrid components.
 */
const galleryAdapter = {
  id: 'gallery',

  detect: () => true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (/Masonry|Gallery|Lightbox|PhotoGrid/i.test(name)) {
      return { library: 'gallery', kind: 'collection', role: 'gallery-container', tag: name };
    }
    return null;
  },
};

module.exports = galleryAdapter;

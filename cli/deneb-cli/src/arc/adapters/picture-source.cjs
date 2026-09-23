'use strict';

const { getJsxName, getJsxAttributeLiteral, findJsxAttribute, hasJsxAttribute } = require('../ast.cjs');

/**
 * Responsive Media Adapter (<picture> & <source>)
 * Supports HTML5 responsive image art direction with multi-breakpoint media queries.
 */
const pictureSourceAdapter = {
  id: 'picture-source',

  detect: () => true,

  recognizeNode(node, ctx) {
    const name = getJsxName(node);
    if (name === 'picture') {
      return {
        library: 'html',
        kind: 'responsive-image-container',
        role: 'picture',
        tag: 'picture',
      };
    }
    if (name === 'source') {
      const srcSet = getJsxAttributeLiteral(node, 'srcSet') || getJsxAttributeLiteral(node, 'srcset');
      const media = getJsxAttributeLiteral(node, 'media');
      return {
        library: 'html',
        kind: 'responsive-image-source',
        role: 'picture-source',
        tag: 'source',
        media: media || undefined,
        srcSet: srcSet || undefined,
      };
    }
    return null;
  },

  /**
   * Extracts responsive configuration from a <picture> JSX node.
   */
  extractPictureDetails(pictureNode) {
    const children = pictureNode.children || [];
    const sources = [];
    let fallbackImg = null;

    for (const child of children) {
      if (!child || child.type !== 'JSXElement') continue;
      const childName = getJsxName(child);
      if (childName === 'source') {
        const srcSet = getJsxAttributeLiteral(child, 'srcSet') || getJsxAttributeLiteral(child, 'srcset');
        const media = getJsxAttributeLiteral(child, 'media');
        sources.push({
          node: child,
          media,
          srcSet,
        });
      } else if (childName === 'img' || childName === 'Image') {
        fallbackImg = child;
      }
    }

    return {
      sources,
      fallbackImg,
      hasResponsiveSources: sources.length > 0,
    };
  },
};

module.exports = pictureSourceAdapter;

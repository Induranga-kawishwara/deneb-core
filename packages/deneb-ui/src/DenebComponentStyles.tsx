import React from 'react';

/**
 * Base CSS variable mappings for real-time visual style editing.
 * Components apply `--deneb-*` vars via useComponentStyle; this sheet defines fallbacks.
 */
export function DenebComponentStyles() {
  const css = `
    .deneb-card {
      width: var(--deneb-card-width, auto);
      min-width: var(--deneb-card-min-width, unset);
      max-width: var(--deneb-card-max-width, 100%);
      height: var(--deneb-card-height, auto);
      aspect-ratio: var(--deneb-card-aspect-ratio, auto);
      padding-top: var(--deneb-card-pt, 1.25rem);
      padding-bottom: var(--deneb-card-pb, 1.25rem);
      padding-left: var(--deneb-card-pl, 1.25rem);
      padding-right: var(--deneb-card-pr, 1.25rem);
      border-radius: var(--deneb-card-radius, 0.75rem);
      border-width: var(--deneb-card-border-w, 0);
      border-style: var(--deneb-card-border-s, solid);
      border-color: var(--deneb-card-border-c, rgba(0, 0, 0, 0.08));
      background-color: var(--deneb-card-bg, transparent);
      background-image: var(--deneb-card-bg-gradient, none);
      box-shadow: var(--deneb-card-shadow, none);
      backdrop-filter: blur(var(--deneb-card-blur, 0px));
      gap: var(--deneb-card-gap, unset);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .deneb-card-balance {
      display: flex;
      flex-direction: column;
      flex: 1 1 0%;
      min-width: 0;
      height: 100%;
    }
    .deneb-text {
      font-family: var(--deneb-font-family, inherit);
      font-size: var(--deneb-font-size, inherit);
      font-weight: var(--deneb-font-weight, inherit);
      line-height: var(--deneb-line-height, inherit);
      letter-spacing: var(--deneb-letter-spacing, inherit);
      color: var(--deneb-color, inherit);
      text-align: var(--deneb-text-align, inherit);
      text-transform: var(--deneb-text-transform, inherit);
      margin-top: var(--deneb-margin-top, 0);
      margin-bottom: var(--deneb-margin-bottom, 0);
      margin-left: var(--deneb-margin-left, 0);
      margin-right: var(--deneb-margin-right, 0);
    }
    .deneb-btn {
      border-radius: var(--deneb-btn-radius, inherit);
      padding-left: var(--deneb-btn-px, inherit);
      padding-right: var(--deneb-btn-px, inherit);
      padding-top: var(--deneb-btn-py, inherit);
      padding-bottom: var(--deneb-btn-py, inherit);
      background-color: var(--deneb-btn-bg, inherit);
      color: var(--deneb-btn-color, inherit);
      border-color: var(--deneb-btn-border-c, inherit);
    }
    .deneb-btn:hover {
      background-color: var(--deneb-btn-hover-bg, inherit);
      color: var(--deneb-btn-hover-color, inherit);
    }
    .deneb-grid {
      grid-template-columns: var(--deneb-grid-cols, inherit);
      column-gap: var(--deneb-grid-gap-x, inherit);
      row-gap: var(--deneb-grid-gap-y, inherit);
      align-items: var(--deneb-grid-equal-height, inherit);
    }
    .deneb-section {
      padding-top: var(--deneb-section-pt, inherit);
      padding-bottom: var(--deneb-section-pb, inherit);
      padding-left: var(--deneb-section-px, inherit);
      padding-right: var(--deneb-section-px, inherit);
      max-width: var(--deneb-section-max-w, inherit);
      background-color: var(--deneb-section-bg, inherit);
      background-image: var(--deneb-section-bg-image, none);
      text-align: var(--deneb-section-align, inherit);
      display: var(--deneb-section-display, block);
      order: var(--deneb-section-order, 0);
    }
    body > main, main, [data-preview-page-key] {
      display: flex;
      flex-direction: column;
    }
  `;

  return <style data-deneb-component-styles>{css}</style>;
}

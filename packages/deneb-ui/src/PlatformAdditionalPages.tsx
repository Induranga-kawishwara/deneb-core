'use client';

/**
 * PlatformAdditionalPages
 * ────────────────────────
 * Drop this component once inside your layout (or footer). It renders the
 * `additionalPages` list with all the correct Fivora visual-editing markers
 * so the editor can add, reorder, and rename pages via the control panel.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The strict visual-editing contract requires:
 *   - data-preview-list-path   on the container
 *   - data-preview-item-path   on each <li>
 *   - data-preview-field-path  on each editable field (label)
 *   - data-preview-static      on navigation buttons (to cover the href)
 *   - field-path items must NOT be inside a data-preview-static ancestor
 *
 * This exact nesting is non-obvious and easy to get wrong. Putting it here
 * means every template gets it right with ONE import — no template should
 * need to know these rules.
 *
 * USAGE (in layout.tsx or footer.tsx)
 * ─────────────────────────────────────
 *   import { PlatformAdditionalPages } from '@deneb-ui/ui';
 *
 *   // Inside your Footer or Layout (renders as a styled nav):
 *   <PlatformAdditionalPages
 *     basePath={basePath}
 *     className="space-y-2.5 text-sm text-muted-foreground"
 *     linkClassName="hover:text-primary transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
 *   />
 *
 * The component is invisible when additionalPages is empty (default state).
 * It only renders when the platform has assigned additional pages to this site.
 */

import React from 'react';
import { useSiteData, contentList, contentText, contentObject } from './SiteDataProvider';

export interface PlatformAdditionalPagesProps {
  /** Base path prefix for navigation (e.g. from withBasePath). Defaults to ''. */
  basePath?: string;
  /** Optional className applied to the outer <ul> list container. */
  className?: string;
  /** Optional className applied to each navigation <button> element. */
  linkClassName?: string;
  /** Optional wrapper function for the route (e.g. withBasePath). */
  resolveRoute?: (route: string) => string;
}

export function PlatformAdditionalPages({
  basePath = '',
  className = '',
  linkClassName = 'hover:text-primary transition-colors text-left bg-transparent border-0 p-0 cursor-pointer text-sm',
  resolveRoute,
}: PlatformAdditionalPagesProps) {
  const siteData = useSiteData();
  const additionalPages = contentList<Record<string, unknown>>(
    contentObject(siteData.content).additionalPages,
  );

  if (additionalPages.length === 0) return null;

  function toHref(route: unknown): string {
    const r = contentText(route) || '/';
    if (resolveRoute) return resolveRoute(r);
    return `${basePath}${r}`.replace(/\/+/g, '/') || '/';
  }

  return (
    <ul className={className} data-preview-list-path="additionalPages">
      {additionalPages.map((page, index) => (
        /*
         * Marker nesting rules (enforced by strict contract):
         *   - data-preview-item-path  } both on the <li> — item is also a concrete field
         *   - data-preview-field-path }
         *   - label span WRAPS the button so field-path is ABOVE data-preview-static
         *   - button has data-preview-static to cover its onClick/href without
         *     claiming the label text as a non-editable string
         */
        <li
          key={page['id'] != null ? String(page['id']) : index}
          data-preview-item-path={`additionalPages[${index}]`}
          data-preview-field-path={`additionalPages[${index}]`}
        >
          <span data-preview-field-path={`additionalPages[${index}].label`}>
            <button
              type="button"
              data-preview-static="Additional page navigation button"
              className={linkClassName}
              onClick={() => {
                window.location.href = toHref(page['route']);
              }}
            >
              {contentText(page['label'])}
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * @deprecated Use PlatformAdditionalPages instead.
 * Kept for backwards compatibility with templates that imported this under
 * the older name before it was standardised.
 */
export const AdditionalPagesNav = PlatformAdditionalPages;

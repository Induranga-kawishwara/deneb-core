import React, { useState } from 'react';
import { withBasePath } from './utils';

export type DenebImageAspectRatio =
  | 'square'
  | '1/1'
  | 'video'
  | '16/9'
  | 'portrait'
  | '3/4'
  | '4/3'
  | '2/3'
  | '21/9'
  | (string & {});

export type DenebImageRadius =
  | 'none'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | 'full'
  | (string & {});

const ASPECT_MAP: Record<string, string> = {
  square: '1 / 1',
  '1/1': '1 / 1',
  video: '16 / 9',
  '16/9': '16 / 9',
  portrait: '3 / 4',
  '3/4': '3 / 4',
  '4/3': '4 / 3',
  '2/3': '2 / 3',
  '21/9': '21 / 9',
};

const RADIUS_MAP: Record<string, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
};

export const DEFAULT_IMAGE_FALLBACK_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none"><rect width="600" height="400" fill="%23f1f5f9"/><path d="M250 180a30 30 0 100-60 30 30 0 000 60zM170 300l80-90 60 70 70-100 90 120H170z" fill="%23cbd5e1"/></svg>';

export interface DenebImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  id?: string;
  'data-preview-field-path'?: string;
  src?: string | null;
  fallbackSrc?: string;
  aspectRatio?: DenebImageAspectRatio;
  radius?: DenebImageRadius;
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  hoverZoom?: boolean;
}

/**
 * Universal auto-resolving image component for DENEB & Fivora templates.
 *
 * - Automatically prepends NEXT_PUBLIC_SITE_BASE_PATH to local assets
 * - Preserves remote URLs (https://..., http://..., data:...)
 * - Safely guards against empty string ("") triggers
 * - Gracefully falls back to fallbackSrc or placeholder on error or missing src
 */
export function DenebImage({
  id,
  'data-preview-field-path': previewFieldPath,
  src,
  fallbackSrc = DEFAULT_IMAGE_FALLBACK_SVG,
  alt = '',
  aspectRatio,
  radius,
  fit = 'cover',
  hoverZoom = false,
  style,
  className = '',
  onError,
  ...props
}: DenebImageProps) {
  const [hasError, setHasError] = useState(false);
  const path = previewFieldPath || id;

  const resolvedAspect = aspectRatio ? (ASPECT_MAP[aspectRatio] || aspectRatio) : undefined;
  const resolvedRadius = radius ? (RADIUS_MAP[radius] || radius) : undefined;

  const combinedStyle: React.CSSProperties = {
    ...(resolvedAspect ? { aspectRatio: resolvedAspect } : {}),
    ...(resolvedRadius ? { borderRadius: resolvedRadius } : {}),
    ...(fit ? { objectFit: fit } : {}),
    ...(hoverZoom ? { transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' } : {}),
    ...style,
  };

  const rawSrc = hasError || !src || (typeof src === 'string' && src.trim() === '')
    ? fallbackSrc
    : src;

  const finalSrc = typeof rawSrc === 'string' ? withBasePath(rawSrc) : rawSrc;

  return (
    <img
      data-preview-field-path={path}
      src={finalSrc}
      alt={alt}
      style={combinedStyle}
      className={`deneb-image ${hoverZoom ? 'hover:scale-105' : ''} ${className}`.trim()}
      onError={(e) => {
        if (!hasError && fallbackSrc && finalSrc !== withBasePath(fallbackSrc)) {
          setHasError(true);
        }
        onError?.(e);
      }}
      {...props}
    />
  );
}

export { DenebImage as SafeImage };

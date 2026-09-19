'use client';

import React from 'react';
import { createMapUrl } from '../utils/urls';

export interface MapLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  name?: string | null;
  mapUrl?: string | null;
  addressUrl?: string | null;
  url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  label?: React.ReactNode;
  /** Visible label field path, e.g. `contact.directionsLabel`. */
  labelFieldPath?: string;
  /** Hidden URL field path, e.g. `contact.directionsUrl`. */
  urlFieldPath?: string;
  /** @deprecated Use `urlFieldPath` instead. */
  fieldPath?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

/**
 * Directions CTA with Fivora-safe split fields: label on the button, URL on a hidden sibling.
 */
export function MapLink({
  name,
  mapUrl,
  addressUrl,
  url,
  address,
  city,
  state,
  country,
  postalCode,
  label = 'Get Directions',
  labelFieldPath,
  urlFieldPath,
  fieldPath,
  variant = 'outline',
  size = 'md',
  icon,
  className = '',
  style,
  ...rest
}: MapLinkProps) {
  const resolvedUrlFieldPath = urlFieldPath || fieldPath || 'contact.directionsUrl';
  const resolvedLabelFieldPath = labelFieldPath || resolvedUrlFieldPath.replace(/Url$/, 'Label');
  const explicitUrl = (addressUrl || mapUrl || url || '').trim();
  const resolvedHref = createMapUrl({ name, mapUrl: explicitUrl, addressUrl: explicitUrl, url: explicitUrl, address, city, state, country, postalCode });
  const finalHref = resolvedHref || '#';

  if (!finalHref && !label) return null;

  const defaultIcon = (
    <svg data-preview-static="map-link-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    borderRadius: '0.5rem',
    ...style,
  };

  const sizeStyles: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
    sm: { fontSize: '0.875rem', padding: '0.375rem 0.75rem' },
    md: { fontSize: '0.95rem', padding: '0.5rem 1rem' },
    lg: { fontSize: '1.05rem', padding: '0.75rem 1.5rem' },
  };

  const variantStyles: Record<'primary' | 'secondary' | 'outline' | 'ghost' | 'link', React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary, #0f172a)',
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: 'var(--color-secondary, #f1f5f9)',
      color: 'var(--color-text, #0f172a)',
    },
    outline: {
      backgroundColor: 'transparent',
      border: '1px solid var(--color-border, #e2e8f0)',
      color: 'var(--color-text, #0f172a)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text, #0f172a)',
    },
    link: {
      backgroundColor: 'transparent',
      color: 'var(--color-primary, #2563eb)',
      padding: 0,
      textDecoration: 'underline',
      borderRadius: 0,
    },
  };

  const mergedStyles = {
    ...baseStyles,
    ...(variant !== 'link' ? sizeStyles[size] : {}),
    ...variantStyles[variant],
  };

  const opensNewTab = finalHref !== '#';

  return (
    <a
      href={finalHref}
      data-preview-field-path={resolvedUrlFieldPath}
      target={opensNewTab ? '_blank' : undefined}
      rel={opensNewTab ? 'noopener noreferrer' : undefined}
      className={`deneb-map-link ${className}`.trim()}
      style={mergedStyles}
      {...rest}
    >
      {icon !== undefined ? icon : defaultIcon}
      <span data-preview-field-path={resolvedLabelFieldPath}>{label}</span>
    </a>
  );
}

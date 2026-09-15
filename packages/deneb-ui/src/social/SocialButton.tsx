'use client';

import React from 'react';

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'twitter'
  | 'x'
  | 'pinterest'
  | 'github';

export interface SocialButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  platform: SocialPlatform;
  url?: string | null;
  label?: React.ReactNode;
  fieldPath?: string;
  variant?: 'icon' | 'pill' | 'button';
  size?: 'sm' | 'md' | 'lg';
}

const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { label: string; bg: string; color: string; icon: (size: number) => React.ReactNode }
> = {
  instagram: {
    label: 'Instagram',
    bg: '#E4405F',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    bg: '#1877F2',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  tiktok: {
    label: 'TikTok',
    bg: '#000000',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    bg: '#FF0000',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
        <polygon points="10 15 15 12 10 9 10 15"/>
      </svg>
    ),
  },
  linkedin: {
    label: 'LinkedIn',
    bg: '#0A66C2',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect width="4" height="12" x="2" y="9"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  twitter: {
    label: 'Twitter',
    bg: '#1DA1F2',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
      </svg>
    ),
  },
  x: {
    label: 'X',
    bg: '#0f172a',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  pinterest: {
    label: 'Pinterest',
    bg: '#BD081C',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="8" y2="16"/>
        <line x1="8" x2="16" y1="12" y2="12"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  github: {
    label: 'GitHub',
    bg: '#24292e',
    color: '#ffffff',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
        <path d="M9 18c-4.51 2-5-2-7-2"/>
      </svg>
    ),
  },
};

export function SocialButton({
  platform,
  url,
  href,
  label,
  fieldPath,
  variant = 'icon',
  size = 'md',
  className = '',
  style,
  ...rest
}: SocialButtonProps) {
  const derivedFieldPath = fieldPath || `common.business.social.${platform}`;
  const targetUrl = url ?? href ?? '#';

  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.x;
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    transition: 'transform 0.15s ease, opacity 0.15s ease',
    cursor: 'pointer',
    ...style,
  };

  let variantStyles: React.CSSProperties = {};
  if (variant === 'icon') {
    const dim = size === 'sm' ? '32px' : size === 'lg' ? '44px' : '38px';
    variantStyles = {
      width: dim,
      height: dim,
      borderRadius: '50%',
      backgroundColor: 'var(--color-secondary, #f1f5f9)',
      color: 'var(--color-text, #0f172a)',
    };
  } else if (variant === 'pill') {
    variantStyles = {
      gap: '0.4rem',
      padding: size === 'sm' ? '0.25rem 0.6rem' : '0.4rem 0.85rem',
      borderRadius: '9999px',
      fontSize: size === 'sm' ? '0.8rem' : '0.9rem',
      backgroundColor: 'var(--color-secondary, #f1f5f9)',
      color: 'var(--color-text, #0f172a)',
    };
  } else {
    variantStyles = {
      gap: '0.5rem',
      padding: size === 'sm' ? '0.4rem 0.75rem' : '0.55rem 1.1rem',
      borderRadius: '0.5rem',
      fontSize: size === 'sm' ? '0.85rem' : '0.95rem',
      backgroundColor: config.bg,
      color: config.color,
    };
  }

  return (
    <a
      href={targetUrl}
      data-preview-field-path={derivedFieldPath}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={typeof label === 'string' ? label : config.label}
      className={`deneb-social-btn deneb-social-${platform} deneb-social-${variant} ${className}`.trim()}
      style={{ ...baseStyles, ...variantStyles }}
      {...rest}
    >
      {config.icon(iconSize)}
      {variant !== 'icon' && <span>{label || config.label}</span>}
    </a>
  );
}

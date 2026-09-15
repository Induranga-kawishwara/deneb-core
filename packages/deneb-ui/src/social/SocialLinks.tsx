'use client';

import React from 'react';
import { SocialButton, SocialPlatform } from './SocialButton';

export interface SocialLinksProps {
  social?: Record<string, string | null | undefined>;
  fieldPathPrefix?: string;
  variant?: 'icon' | 'pill' | 'button';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
  'x',
  'pinterest',
  'github',
];

/**
 * Always-mounted social buttons so empty-state preview keeps field markers.
 */
export function SocialLinks({
  social = {},
  fieldPathPrefix = 'common.business.social',
  variant = 'icon',
  size = 'md',
  className = '',
  style,
}: SocialLinksProps) {
  const platforms = SUPPORTED_PLATFORMS.filter((platform) =>
    Object.prototype.hasOwnProperty.call(social, platform) || Object.keys(social).length === 0
  );
  const rendered = platforms.length ? platforms : SUPPORTED_PLATFORMS;

  const containerStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.625rem',
    ...style,
  };

  return (
    <div className={`deneb-social-links ${className}`.trim()} style={containerStyles}>
      {rendered.map((platform) => (
        <SocialButton
          key={platform}
          platform={platform}
          url={social[platform] ?? ''}
          fieldPath={`${fieldPathPrefix}.${platform}`}
          variant={variant}
          size={size}
        />
      ))}
    </div>
  );
}

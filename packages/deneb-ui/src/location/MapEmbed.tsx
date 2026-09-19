'use client';

import React from 'react';
import { MapLink } from './MapLink';
import { useShop, useSiteData } from '../SiteDataProvider';

export interface MapEmbedProps {
  embedUrl?: string | null;
  mapUrl?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  title?: string;
  fieldPath?: string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Safe, responsive Google Maps Embed component with automatic fallback to MapLink
 * when an embed URL is not yet configured by the merchant.
 * Automatically self-hydrates from live shop registration and site data when props are omitted.
 */
export function MapEmbed({
  embedUrl,
  mapUrl,
  address,
  city,
  country,
  title = 'Business Location Map',
  fieldPath = 'common.business.location.mapEmbedUrl',
  height = 360,
  className = '',
  style,
}: MapEmbedProps) {
  const liveShop = useShop();
  const siteData = useSiteData();
  const contact = (siteData?.content as any)?.contact || (siteData?.content as any)?.common?.contact || {};
  const merchant = (siteData as any)?.merchant || {};

  const effectiveEmbedUrl = embedUrl ?? contact.mapEmbedUrl ?? merchant.mapEmbedUrl ?? '';
  const effectiveMapUrl = (mapUrl || liveShop?.mapLocation || contact.googleMapLink || contact.mapLocation || merchant.mapLocation || '').trim();
  const effectiveAddress = address ?? liveShop?.address ?? contact.address ?? contact.location ?? merchant.address ?? '';
  const effectiveCity = city ?? liveShop?.city ?? contact.city ?? merchant.city ?? '';
  const effectiveCountry = country ?? contact.country ?? merchant.country ?? '';

  const containerStyles: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid var(--color-border, #e2e8f0)',
    backgroundColor: 'var(--color-secondary, #f8fafc)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  if (effectiveEmbedUrl && (effectiveEmbedUrl.startsWith('http://') || effectiveEmbedUrl.startsWith('https://'))) {
    return (
      <div
        className={`deneb-map-embed ${className}`.trim()}
        style={containerStyles}
      >
        <iframe
          data-preview-field-path={fieldPath}
          src={effectiveEmbedUrl}
          title={title}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  // Fallback when no direct iframe URL is provided
  return (
    <div
      className={`deneb-map-embed deneb-map-fallback ${className}`.trim()}
      style={containerStyles}
    >
      <div style={{ textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ marginBottom: '0.75rem', opacity: 0.6 }}>
          <svg data-preview-static="map-pin-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <p data-preview-static="map-placeholder-title" style={{ margin: '0 0 0.75rem 0', fontWeight: 500, color: 'var(--color-text, #0f172a)' }}>
          {effectiveAddress ? `${effectiveAddress}${effectiveCity ? `, ${effectiveCity}` : ''}` : 'Location Map'}
        </p>
        <MapLink
          mapUrl={effectiveMapUrl}
          address={effectiveAddress}
          city={effectiveCity}
          country={effectiveCountry}
          label="Open in Google Maps ↗"
          variant="primary"
          size="sm"
        />
      </div>
    </div>
  );
}

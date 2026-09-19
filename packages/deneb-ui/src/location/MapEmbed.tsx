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
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

  const effectiveEmbedUrl = (embedUrl ?? (typeof contact.mapEmbedUrl === 'string' ? contact.mapEmbedUrl : null) ?? (typeof merchant.mapEmbedUrl === 'string' ? merchant.mapEmbedUrl : null) ?? '') as string;
  const effectiveMapUrl = (mapUrl || liveShop?.mapLocation || (typeof contact.googleMapLink === 'string' ? contact.googleMapLink : null) || (typeof contact.mapLocation === 'string' ? contact.mapLocation : null) || (typeof merchant.mapLocation === 'string' ? merchant.mapLocation : null) || '').trim() as string;
  const effectiveAddress = (address ?? liveShop?.address ?? (typeof contact.address === 'string' ? contact.address : null) ?? (typeof contact.location === 'string' ? contact.location : null) ?? (typeof merchant.address === 'string' ? merchant.address : null) ?? '') as string;
  const effectiveCity = (city ?? liveShop?.city ?? (typeof contact.city === 'string' ? contact.city : null) ?? (typeof merchant.city === 'string' ? merchant.city : null) ?? '') as string;
  const effectiveCountry = (country ?? (typeof contact.country === 'string' ? contact.country : null) ?? (typeof merchant.country === 'string' ? merchant.country : null) ?? '') as string;

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

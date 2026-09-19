'use client';

import React from 'react';
import { Address } from './Address';
import { MapLink } from './MapLink';
import { EditableText } from '../EditableText';
import { useShop, useSiteData } from '../SiteDataProvider';

export interface LocationCardProps {
  name?: string | null;
  title?: string;
  titleFieldPath?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  mapUrl?: string | null;
  addressUrl?: string | null;
  url?: string | null;
  fieldPath?: string;
  nameFieldPath?: string;
  addressFieldPath?: string;
  mapUrlFieldPath?: string;
  directionsLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Premium storefront LocationCard displaying address, pin icon, and Google Maps directions button.
 * Automatically self-hydrates from live shop registration and site data when props are omitted.
 */
export function LocationCard({
  name,
  title = 'Our Location',
  titleFieldPath,
  address,
  city,
  state,
  country,
  postalCode,
  mapUrl,
  addressUrl,
  url,
  fieldPath,
  nameFieldPath,
  addressFieldPath = 'common.business.location.address',
  mapUrlFieldPath = 'common.business.location.addressUrl',
  directionsLabel = 'Get Directions →',
  className = '',
  style,
}: LocationCardProps) {
  const liveShop = useShop();
  const siteData = useSiteData();
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

  const effectiveAddress = (address ?? liveShop?.address ?? (typeof contact.address === 'string' ? contact.address : null) ?? (typeof contact.location === 'string' ? contact.location : null) ?? (typeof merchant.address === 'string' ? merchant.address : null) ?? '') as string;
  const effectiveCity = (city ?? liveShop?.city ?? (typeof contact.city === 'string' ? contact.city : null) ?? (typeof merchant.city === 'string' ? merchant.city : null) ?? '') as string;
  const effectiveState = (state ?? '') as string;
  const effectiveCountry = (country ?? (typeof contact.country === 'string' ? contact.country : null) ?? (typeof merchant.country === 'string' ? merchant.country : null) ?? '') as string;
  const effectivePostalCode = (postalCode ?? (typeof contact.postalCode === 'string' ? contact.postalCode : null) ?? '') as string;
  const explicitUrl = (addressUrl || mapUrl || url || liveShop?.mapLocation || (typeof contact.googleMapLink === 'string' ? contact.googleMapLink : null) || (typeof contact.mapLocation === 'string' ? contact.mapLocation : null) || (typeof merchant.mapLocation === 'string' ? merchant.mapLocation : null) || (typeof merchant.googleMapLink === 'string' ? merchant.googleMapLink : null) || '').trim() as string;
  const effectiveName = (name ?? liveShop?.name ?? (typeof common.websiteTitle === 'string' ? common.websiteTitle : null) ?? (typeof merchant.businessName === 'string' ? merchant.businessName : null) ?? title ?? 'Our Location') as string;
  const resolvedTitleFieldPath = nameFieldPath || titleFieldPath || (fieldPath ? `${fieldPath}.name` : 'contact.locationTitle');

  if (!effectiveAddress && !effectiveCity && !effectiveCountry && !explicitUrl && !effectiveName) {
    return null;
  }

  const cardStyles: React.CSSProperties = {
    padding: '2rem',
    borderRadius: '1rem',
    border: '1px solid var(--color-border, #e2e8f0)',
    backgroundColor: 'var(--color-surface, #ffffff)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1rem',
    maxWidth: '400px',
    ...style,
  };

  const iconCircleStyles: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-secondary, #f1f5f9)',
    color: 'var(--color-primary, #0f172a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div className={`deneb-location-card ${className}`.trim()} style={cardStyles}>
      <div style={iconCircleStyles}>
        <svg data-preview-static="location-card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>

      <EditableText
        as="h3"
        id={resolvedTitleFieldPath}
        defaultValue={effectiveName}
        style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}
      />

      <Address
        address={effectiveAddress}
        city={effectiveCity}
        country={effectiveCountry}
        postalCode={effectivePostalCode}
        fieldPath={fieldPath}
        addressFieldPath={addressFieldPath}
      />

      <div style={{ marginTop: '0.5rem', width: '100%' }}>
        <MapLink
          name={effectiveName}
          mapUrl={explicitUrl}
          addressUrl={explicitUrl}
          url={explicitUrl}
          address={effectiveAddress}
          city={effectiveCity}
          state={effectiveState}
          country={effectiveCountry}
          postalCode={effectivePostalCode}
          label={directionsLabel}
          urlFieldPath={mapUrlFieldPath}
          variant="primary"
          size="md"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}

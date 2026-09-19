'use client';

import React from 'react';
import { Address } from './Address';
import { MapLink } from './MapLink';
import { useShop, useSiteData } from '../SiteDataProvider';

export interface LocationLinkProps {
  address?: string | null;
  city?: string | null;
  country?: string | null;
  mapUrl?: string | null;
  fieldPath?: string;
  addressFieldPath?: string;
  mapUrlFieldPath?: string;
  directionsLabel?: string;
  showAddress?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Combines physical address with an interactive "Get Directions" action.
 * Automatically self-hydrates from live shop registration and site data when props are omitted.
 */
export function LocationLink({
  address,
  city,
  country,
  mapUrl,
  fieldPath,
  addressFieldPath = 'common.business.location.address',
  mapUrlFieldPath = 'common.business.location.addressUrl',
  directionsLabel = 'Get Directions',
  showAddress = true,
  className = '',
  style,
}: LocationLinkProps) {
  const liveShop = useShop();
  const siteData = useSiteData();
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

  const effectiveAddress = (address ?? liveShop?.address ?? (typeof contact.address === 'string' ? contact.address : null) ?? (typeof contact.location === 'string' ? contact.location : null) ?? (typeof merchant.address === 'string' ? merchant.address : null) ?? '') as string;
  const effectiveCity = (city ?? liveShop?.city ?? (typeof contact.city === 'string' ? contact.city : null) ?? (typeof merchant.city === 'string' ? merchant.city : null) ?? '') as string;
  const effectiveCountry = (country ?? (typeof contact.country === 'string' ? contact.country : null) ?? (typeof merchant.country === 'string' ? merchant.country : null) ?? '') as string;
  const effectiveMapUrl = (mapUrl || liveShop?.mapLocation || (typeof contact.googleMapLink === 'string' ? contact.googleMapLink : null) || (typeof contact.mapLocation === 'string' ? contact.mapLocation : null) || (typeof merchant.mapLocation === 'string' ? merchant.mapLocation : null) || '').trim() as string;

  if (!effectiveAddress && !effectiveCity && !effectiveCountry && !effectiveMapUrl) {
    return null;
  }

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'flex-start',
    ...style,
  };

  return (
    <div className={`deneb-location-link ${className}`.trim()} style={containerStyles}>
      {showAddress && (
        <Address
          address={effectiveAddress}
          city={effectiveCity}
          country={effectiveCountry}
          fieldPath={fieldPath}
          addressFieldPath={addressFieldPath}
        />
      )}
      <MapLink
        mapUrl={effectiveMapUrl}
        address={effectiveAddress}
        city={effectiveCity}
        country={effectiveCountry}
        label={directionsLabel}
        fieldPath={mapUrlFieldPath}
        variant="outline"
        size="sm"
      />
    </div>
  );
}

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
  const contact = (siteData?.content as any)?.contact || (siteData?.content as any)?.common?.contact || {};
  const merchant = (siteData as any)?.merchant || {};

  const effectiveAddress = address ?? liveShop?.address ?? contact.address ?? contact.location ?? merchant.address ?? '';
  const effectiveCity = city ?? liveShop?.city ?? contact.city ?? merchant.city ?? '';
  const effectiveCountry = country ?? contact.country ?? merchant.country ?? '';
  const effectiveMapUrl = (mapUrl || liveShop?.mapLocation || contact.googleMapLink || contact.mapLocation || merchant.mapLocation || '').trim();

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

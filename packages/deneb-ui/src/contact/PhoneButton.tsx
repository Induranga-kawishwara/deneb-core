'use client';

import React from 'react';
import { ContactButton, ContactButtonProps } from './ContactButton';
import { useShop, useSiteData } from '../SiteDataProvider';

export interface PhoneButtonProps extends Omit<ContactButtonProps, 'type'> {
  phoneNumber?: string | null;
}

export function PhoneButton({
  phoneNumber,
  value,
  label = 'Call Us',
  fieldPath = 'common.business.phone',
  variant = 'primary',
  ...rest
}: PhoneButtonProps) {
  const liveShop = useShop();
  const siteData = useSiteData();
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

  const effectiveNumber =
    phoneNumber ||
    value ||
    liveShop?.contact?.phone ||
    contact.phone ||
    common.phone ||
    merchant.phone ||
    '';

  if (!effectiveNumber && !fieldPath) return null;

  return (
    <ContactButton
      type="phone"
      value={effectiveNumber}
      label={label}
      fieldPath={fieldPath}
      variant={variant}
      {...rest}
    />
  );
}

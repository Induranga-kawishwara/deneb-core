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
  const contact = (siteData?.content as any)?.contact || (siteData?.content as any)?.common?.contact || {};
  const common = (siteData?.content as any)?.common || {};
  const merchant = (siteData as any)?.merchant || {};

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

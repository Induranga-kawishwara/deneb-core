'use client';

import React from 'react';
import { ContactButton, ContactButtonProps } from './ContactButton';
import { useShop, useSiteData } from '../SiteDataProvider';

export interface EmailButtonProps extends Omit<ContactButtonProps, 'type'> {
  email?: string | null;
}

export function EmailButton({
  email,
  value,
  label = 'Email Us',
  fieldPath = 'common.business.email',
  variant = 'outline',
  ...rest
}: EmailButtonProps) {
  const liveShop = useShop();
  const siteData = useSiteData();
  const contact = (siteData?.content as any)?.contact || (siteData?.content as any)?.common?.contact || {};
  const common = (siteData?.content as any)?.common || {};
  const merchant = (siteData as any)?.merchant || {};

  const effectiveEmail =
    email ||
    value ||
    liveShop?.contact?.email ||
    contact.email ||
    common.email ||
    merchant.email ||
    '';

  if (!effectiveEmail && !fieldPath) return null;

  return (
    <ContactButton
      type="email"
      value={effectiveEmail}
      label={label}
      fieldPath={fieldPath}
      variant={variant}
      {...rest}
    />
  );
}

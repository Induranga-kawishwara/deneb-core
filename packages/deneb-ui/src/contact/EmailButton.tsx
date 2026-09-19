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
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

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

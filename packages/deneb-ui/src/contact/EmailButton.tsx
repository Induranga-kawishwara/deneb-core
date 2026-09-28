'use client';

import React from 'react';
import { ContactButton, ContactButtonProps } from './ContactButton';
import { useShop, useSiteData, isPreviewValidation, DUMMY_PREVIEW_EMAIL } from '../SiteDataProvider';

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
  const isPreview = isPreviewValidation(siteData);
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

  const liveEmail =
    liveShop?.contact?.email ||
    (typeof liveShop?.businessEmail === 'string' ? liveShop.businessEmail : null);

  const effectiveEmail =
    email ||
    (!isPreview ? liveEmail : null) ||
    value ||
    contact.email ||
    contact.emailAddress ||
    common.email ||
    common.emailAddress ||
    merchant.email ||
    (isPreview ? DUMMY_PREVIEW_EMAIL : '');

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

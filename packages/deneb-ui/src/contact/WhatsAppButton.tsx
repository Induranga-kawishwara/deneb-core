'use client';

import React from 'react';
import { ContactButton, ContactButtonProps } from './ContactButton';
import { useShop, useSiteData } from '../SiteDataProvider';

export interface WhatsAppButtonProps extends Omit<ContactButtonProps, 'type'> {
  phoneNumber?: string | null;
}

/**
 * WhatsAppButton automatically connects customers directly to the shop's WhatsApp chat.
 * Self-hydrates from live shop registration, contact config, and merchant profile if phoneNumber is omitted.
 */
export function WhatsAppButton({
  phoneNumber,
  value,
  label = 'Chat on WhatsApp',
  fieldPath = 'common.business.whatsapp',
  variant = 'whatsapp',
  message,
  ...rest
}: WhatsAppButtonProps) {
  const liveShop = useShop();
  const siteData = useSiteData();
  const contact = (siteData?.content as any)?.contact || (siteData?.content as any)?.common?.contact || {};
  const common = (siteData?.content as any)?.common || {};
  const home = (siteData?.content as any)?.home || {};
  const merchant = (siteData as any)?.merchant || {};

  const effectiveNumber =
    phoneNumber ||
    value ||
    liveShop?.contact?.whatsapp ||
    liveShop?.contact?.phone ||
    contact.whatsapp ||
    contact.phone ||
    home.whatsappNumber ||
    home.whatsappCtaUrl ||
    common.whatsapp ||
    merchant.whatsapp ||
    merchant.phone ||
    '';

  if (!effectiveNumber && !fieldPath) return null;

  return (
    <ContactButton
      type="whatsapp"
      value={effectiveNumber}
      label={label}
      fieldPath={fieldPath}
      variant={variant}
      message={message}
      {...rest}
    />
  );
}

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
  const content = (siteData?.content && typeof siteData.content === 'object' ? siteData.content : {}) as Record<string, unknown>;
  const common = (content.common && typeof content.common === 'object' ? content.common : {}) as Record<string, unknown>;
  const contact = (content.contact && typeof content.contact === 'object' ? content.contact : (common.contact && typeof common.contact === 'object' ? common.contact : {})) as Record<string, unknown>;
  const home = (content.home && typeof content.home === 'object' ? content.home : {}) as Record<string, unknown>;
  const merchant = (siteData && 'merchant' in siteData && typeof (siteData as Record<string, unknown>).merchant === 'object' ? (siteData as Record<string, unknown>).merchant : {}) as Record<string, unknown>;

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

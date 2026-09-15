'use client';

import React from 'react';
import { WhatsAppButton } from './WhatsAppButton';
import { PhoneButton } from './PhoneButton';
import { EmailButton } from './EmailButton';

export interface ContactActionsProps {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  phoneFieldPath?: string;
  whatsappFieldPath?: string;
  emailFieldPath?: string;
  labels?: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  layout?: 'row' | 'column' | 'wrap';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Always-mounted contact channels so Fivora empty-state validation keeps
 * the field markers clickable when values are blank.
 */
export function ContactActions({
  phone,
  whatsapp,
  email,
  phoneFieldPath = 'common.business.phone',
  whatsappFieldPath = 'common.business.whatsapp',
  emailFieldPath = 'common.business.email',
  labels = {},
  size = 'md',
  layout = 'row',
  className = '',
  style,
}: ContactActionsProps) {
  const layoutStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: layout === 'column' ? 'column' : 'row',
    flexWrap: layout === 'wrap' || layout === 'row' ? 'wrap' : 'nowrap',
    alignItems: 'center',
    gap: '0.75rem',
    ...style,
  };

  return (
    <div className={`deneb-contact-actions deneb-layout-${layout} ${className}`.trim()} style={layoutStyles}>
      <PhoneButton
          value={phone ?? ''}
          fieldPath={phoneFieldPath}
          label={labels.phone || 'Call Us'}
          size={size}
        />
      <WhatsAppButton
          value={whatsapp ?? ''}
          fieldPath={whatsappFieldPath}
          label={labels.whatsapp || 'Chat on WhatsApp'}
          size={size}
        />
      <EmailButton
          value={email ?? ''}
          fieldPath={emailFieldPath}
          label={labels.email || 'Email Us'}
          size={size}
        />
    </div>
  );
}

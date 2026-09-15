'use client';

import React from 'react';
import { ContactButton, ContactButtonProps } from './ContactButton';

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
  const number = phoneNumber ?? value;

  if (!number && !fieldPath) return null;

  return (
    <ContactButton
      type="phone"
      value={number}
      label={label}
      fieldPath={fieldPath}
      variant={variant}
      {...rest}
    />
  );
}

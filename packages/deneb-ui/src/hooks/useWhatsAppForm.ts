'use client';

import React, { useState, useCallback } from 'react';
import { useSiteData } from '../SiteDataProvider';

export interface UseWhatsAppFormOptions {
  /** The WhatsApp URL or phone number (e.g. "https://wa.me/1234567890", "+1234567890") */
  whatsappUrl?: string | null;
  /** Field path to query in siteData (e.g. "contact.formWhatsappUrl") */
  whatsappUrlPath?: string;
  /** Form name for message header (e.g. "Contact Inquiry", "Book Repair") */
  formName?: string;
  /** Business name for message header */
  businessName?: string;
  /** Custom message formatter callback */
  formatMessage?: (data: Record<string, any>) => string;
  /** Callback fired after opening WhatsApp */
  onSuccess?: (details: { data: Record<string, any>; url: string }) => void;
  /** Callback fired if submission encounters an error */
  onError?: (error: Error) => void;
}

export interface UseWhatsAppFormReturn {
  /** Submit directly from an HTML form element or submit FormEvent */
  submitViaWhatsApp: (
    eOrForm: React.FormEvent<HTMLFormElement> | HTMLFormElement,
    extraData?: Record<string, any>
  ) => boolean;
  /** Submit explicit key-value data */
  submitDataViaWhatsApp: (data: Record<string, any>) => boolean;
  /** Construct full WhatsApp URL without triggering window navigation */
  buildWhatsAppUrl: (data: Record<string, any>) => string;
  /** Resolved target phone or URL */
  resolvedWhatsappUrl: string;
  /** The most recently generated WhatsApp link */
  whatsAppLink: string | null;
  /** Submission state */
  isSubmitting: boolean;
}

/**
 * Extracts digits from a raw phone number, full wa.me link, or WhatsApp API link.
 */
export function resolveWhatsAppNumber(target?: string | null): string {
  if (!target) return '';
  const trimmed = String(target).trim();
  const waMatch = trimmed.match(/wa\.me\/([0-9+]+)/i);
  if (waMatch && waMatch[1]) {
    return waMatch[1].replace(/[^0-9]/g, '');
  }
  const queryMatch = trimmed.match(/[?&]phone=([0-9+]+)/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1].replace(/[^0-9]/g, '');
  }
  return trimmed.replace(/[^0-9]/g, '');
}

function getValueByPath(obj: any, path?: string): any {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let curr = obj;
  for (const part of parts) {
    if (curr == null) return undefined;
    curr = curr[part];
  }
  return curr;
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extracts form field labels and values from an HTMLFormElement.
 */
export function extractFormData(form: HTMLFormElement): Record<string, any> {
  const result: Record<string, any> = {};
  const elements = Array.from(form.elements) as HTMLElement[];

  for (const el of elements) {
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      )
    ) {
      continue;
    }

    if (!el.name || el.disabled || el.type === 'submit' || el.type === 'reset' || el.type === 'button') {
      continue;
    }

    if ((el.type === 'checkbox' || el.type === 'radio') && !(el as HTMLInputElement).checked) {
      continue;
    }

    let fieldLabel = '';
    if (el.id) {
      const labelEl = form.querySelector(`label[for="${el.id}"]`);
      if (labelEl && labelEl.textContent) {
        fieldLabel = labelEl.textContent.trim();
      }
    }

    if (!fieldLabel) {
      const parentLabel = el.closest('label');
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
        fieldLabel = clone.textContent?.trim() || '';
      }
    }

    if (!fieldLabel && el.getAttribute('aria-label')) {
      fieldLabel = el.getAttribute('aria-label') || '';
    }

    if (!fieldLabel && 'placeholder' in el && (el as HTMLInputElement | HTMLTextAreaElement).placeholder) {
      fieldLabel = (el as HTMLInputElement | HTMLTextAreaElement).placeholder.trim();
    }

    if (!fieldLabel) {
      fieldLabel = humanizeFieldName(el.name);
    }

    result[fieldLabel] = el.value;
  }

  return result;
}

export function defaultFormatMessage(
  data: Record<string, any>,
  options: { formName?: string; businessName?: string } = {}
): string {
  const lines: string[] = [];

  if (options.formName && options.businessName) {
    lines.push(`*${options.formName} - ${options.businessName}*`);
  } else if (options.formName) {
    lines.push(`*${options.formName}*`);
  } else if (options.businessName) {
    lines.push(`*New Message for ${options.businessName}*`);
  } else {
    lines.push(`*New Form Submission*`);
  }
  lines.push('────────────────────────');

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null || val === '') continue;
    if (Array.isArray(val)) {
      lines.push(`*${key}*:`);
      val.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          lines.push(`  ${idx + 1}. ${JSON.stringify(item)}`);
        } else {
          lines.push(`  • ${item}`);
        }
      });
    } else if (typeof val === 'object' && val !== null) {
      lines.push(`*${key}*: ${JSON.stringify(val)}`);
    } else {
      lines.push(`*${key}*: ${val}`);
    }
  }

  lines.push('────────────────────────');
  lines.push('_Sent via website form_');

  return lines.join('\n');
}

/**
 * Universal Form-to-WhatsApp Hook.
 * Supports HTMLFormElement submission, controlled component state data,
 * automatic siteData URL lookup, and popup-blocker safe redirection.
 */
export function useWhatsAppForm(options: UseWhatsAppFormOptions = {}): UseWhatsAppFormReturn {
  const siteData = useSiteData() as any;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsAppLink, setWhatsAppLink] = useState<string | null>(null);

  // 1. Resolve WhatsApp URL from options, siteData path, or fallback siteData fields
  const content = siteData?.content;
  const business = siteData?.business;

  let resolvedUrl = options.whatsappUrl;
  if (!resolvedUrl && options.whatsappUrlPath) {
    resolvedUrl =
      getValueByPath(content, options.whatsappUrlPath) ||
      getValueByPath(siteData, options.whatsappUrlPath);
  }

  if (!resolvedUrl) {
    resolvedUrl =
      content?.contact?.formWhatsappUrl ||
      content?.contact?.whatsappUrl ||
      content?.home?.contact?.formWhatsappUrl ||
      business?.whatsapp ||
      siteData?.contact?.whatsapp ||
      'https://wa.me/1234567890';
  }

  const resolvedBusinessName =
    options.businessName ||
    business?.name ||
    content?.common?.business?.name ||
    siteData?.project?.name ||
    '';

  const buildUrl = useCallback(
    (data: Record<string, any>): string => {
      const number = resolveWhatsAppNumber(resolvedUrl);
      const message = options.formatMessage
        ? options.formatMessage(data)
        : defaultFormatMessage(data, {
            formName: options.formName,
            businessName: resolvedBusinessName,
          });

      if (number) {
        return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
      }

      if (resolvedUrl && /^https?:\/\//i.test(resolvedUrl)) {
        const separator = resolvedUrl.includes('?') ? '&' : '?';
        return `${resolvedUrl}${separator}text=${encodeURIComponent(message)}`;
      }

      return `https://wa.me/?text=${encodeURIComponent(message)}`;
    },
    [resolvedUrl, options.formatMessage, options.formName, resolvedBusinessName]
  );

  const dispatchUrl = useCallback(
    (url: string, data: Record<string, any>): boolean => {
      setIsSubmitting(true);
      setWhatsAppLink(url);

      try {
        if (typeof window !== 'undefined') {
          const opened = window.open(url, '_blank', 'noopener,noreferrer');
          if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            window.location.href = url;
          }
        }
        options.onSuccess?.({ data, url });
        return true;
      } catch (err: any) {
        options.onError?.(err);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [options]
  );

  const submitDataViaWhatsApp = useCallback(
    (data: Record<string, any>): boolean => {
      const url = buildUrl(data);
      return dispatchUrl(url, data);
    },
    [buildUrl, dispatchUrl]
  );

  const submitViaWhatsApp = useCallback(
    (
      eOrForm: React.FormEvent<HTMLFormElement> | HTMLFormElement,
      extraData?: Record<string, any>
    ): boolean => {
      let form: HTMLFormElement | null = null;

      if ('preventDefault' in eOrForm && typeof eOrForm.preventDefault === 'function') {
        eOrForm.preventDefault();
        form = (eOrForm.currentTarget || eOrForm.target) as HTMLFormElement;
      } else if (eOrForm instanceof HTMLElement) {
        form = eOrForm;
      }

      const extracted = form ? extractFormData(form) : {};
      const merged = extraData ? { ...extracted, ...extraData } : extracted;
      const url = buildUrl(merged);
      return dispatchUrl(url, merged);
    },
    [buildUrl, dispatchUrl]
  );

  return {
    submitViaWhatsApp,
    submitDataViaWhatsApp,
    buildWhatsAppUrl: buildUrl,
    resolvedWhatsappUrl: String(resolvedUrl),
    whatsAppLink,
    isSubmitting,
  };
}

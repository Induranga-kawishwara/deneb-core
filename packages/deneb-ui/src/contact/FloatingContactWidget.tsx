import React, { useState } from 'react';
import { useSiteData } from '../SiteDataProvider';
import { createWhatsAppUrl, createPhoneUrl, createEmailUrl } from '../utils/urls';

export interface FloatingContactWidgetProps {
  fieldPath?: string;
  defaultPhone?: string;
  defaultWhatsApp?: string;
  defaultEmail?: string;
  defaultMessage?: string;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * DENEB UI — Floating Contact Widget
 * 
 * Sticky conversion powerhouse widget for e-commerce and local commerce storefronts.
 * Sits elegantly in the corner of the screen across desktop and mobile, offering
 * instant 1-click WhatsApp chat, phone calls, and email inquiries.
 * 
 * Created by Chamika Gayashan & Induranga Kawishwara
 */
export function FloatingContactWidget({
  fieldPath = 'contact',
  defaultPhone,
  defaultWhatsApp,
  defaultEmail,
  defaultMessage = 'Hello! I have an inquiry about your products.',
  position = 'bottom-right',
  className = '',
  style = {},
}: FloatingContactWidgetProps) {
  const { siteData } = useSiteData();
  const [isOpen, setIsOpen] = useState(false);

  const contactData = (siteData as any)?.contact || {};
  const phone = contactData.phone || defaultPhone || '';
  const whatsapp = contactData.whatsapp || defaultWhatsApp || phone;
  const email = contactData.email || defaultEmail || '';
  const storeName = (siteData as any)?.site?.name || 'Support';

  const hasWhatsApp = Boolean(whatsapp && whatsapp.trim().length > 0);
  const hasPhone = Boolean(phone && phone.trim().length > 0);
  const hasEmail = Boolean(email && email.trim().length > 0);

  // If no contact channel exists, hide cleanly
  if (!hasWhatsApp && !hasPhone && !hasEmail) {
    return null;
  }

  const isRight = position === 'bottom-right';

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '1.5rem',
    [isRight ? 'right' : 'left']: '1.5rem',
    zIndex: 50,
    fontFamily: 'inherit',
    ...style,
  };

  const bubbleStyle: React.CSSProperties = {
    backgroundColor: '#25D366', // Official WhatsApp green
    color: '#ffffff',
    width: '3.5rem',
    height: '3.5rem',
    borderRadius: '9999px',
    boxShadow: '0 10px 25px -5px rgba(37, 211, 102, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease',
  };

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '4.25rem',
    [isRight ? 'right' : 'left']: '0',
    width: 'min(18rem, calc(100vw - 2rem))',
    maxWidth: 'calc(100vw - 2rem)',
    backgroundColor: 'var(--card-bg, var(--color-surface, #ffffff))',
    color: 'var(--page-text, inherit)',
    borderRadius: '1rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    border: '1px solid var(--color-border, rgba(226, 232, 240, 0.8))',
    overflow: 'hidden',
    animation: 'deneb-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div
      className={`deneb-floating-contact fixed z-50 bottom-6 ${isRight ? 'right-6 deneb-floating-right' : 'left-6 deneb-floating-left'} ${className}`}
      style={containerStyle}
      data-preview-field-path={fieldPath}
    >
      {isOpen && (
        <div
          className="deneb-contact-popup absolute bottom-16 bg-white rounded-2xl shadow-2xl border border-slate-200 w-72 overflow-hidden text-slate-800"
          style={menuStyle}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm leading-tight text-white">{storeName}</h4>
              <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Online & Ready to Help
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              aria-label="Close contact drawer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Action List */}
          <div className="p-3 space-y-2 text-sm bg-slate-50">
            {hasWhatsApp && (
              <a
                href={createWhatsAppUrl(whatsapp, defaultMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-emerald-400 hover:shadow-sm transition-all text-slate-800"
                data-preview-field-path={`${fieldPath}.whatsapp`}
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-1.116-.073-.266-.086-.61-.225-1.047-.417-1.854-.814-3.056-2.695-3.15-2.819-.092-.124-.755-.999-.755-1.907 0-.909.479-1.353.649-1.536.17-.183.371-.23.495-.23.124 0 .248.002.355.008.113.006.265-.043.414.316.155.372.531 1.296.577 1.39.046.094.077.204.015.328-.061.124-.092.202-.184.31-.092.108-.195.241-.278.324-.093.093-.19.195-.082.381.109.186.483.797 1.037 1.289.713.633 1.314.829 1.501.922.186.093.295.078.404-.047.11-.124.467-.543.591-.729.124-.186.248-.155.418-.093.17.062 1.082.51 1.268.603.186.093.31.14.356.217.046.077.046.449-.098.854z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 text-xs">Chat on WhatsApp</div>
                  <div className="text-[11px] text-slate-500 truncate">{whatsapp}</div>
                </div>
              </a>
            )}

            {hasPhone && (
              <a
                href={createPhoneUrl(phone)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-sm transition-all text-slate-800"
                data-preview-field-path={`${fieldPath}.phone`}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 text-xs">Direct Call</div>
                  <div className="text-[11px] text-slate-500 truncate">{phone}</div>
                </div>
              </a>
            )}

            {hasEmail && (
              <a
                href={createEmailUrl(email, `Inquiry: ${storeName}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-purple-400 hover:shadow-sm transition-all text-slate-800"
                data-preview-field-path={`${fieldPath}.email`}
              >
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 text-xs">Send Email</div>
                  <div className="text-[11px] text-slate-500 truncate">{email}</div>
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={bubbleStyle}
        className="deneb-bubble hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-none"
        aria-label="Toggle contact channels"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-1.116-.073-.266-.086-.61-.225-1.047-.417-1.854-.814-3.056-2.695-3.15-2.819-.092-.124-.755-.999-.755-1.907 0-.909.479-1.353.649-1.536.17-.183.371-.23.495-.23.124 0 .248.002.355.008.113.006.265-.043.414.316.155.372.531 1.296.577 1.39.046.094.077.204.015.328-.061.124-.092.202-.184.31-.092.108-.195.241-.278.324-.093.093-.19.195-.082.381.109.186.483.797 1.037 1.289.713.633 1.314.829 1.501.922.186.093.295.078.404-.047.11-.124.467-.543.591-.729.124-.186.248-.155.418-.093.17.062 1.082.51 1.268.603.186.093.31.14.356.217.046.077.046.449-.098.854z" />
          </svg>
        )}
      </button>
    </div>
  );
}

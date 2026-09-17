import React from 'react';
import { useSiteData } from './SiteDataProvider';

export interface StickyMobileBarAction {
  id: string;
  label: string;
  href: string;
  icon?: 'phone' | 'whatsapp' | 'cart' | 'message' | 'shop' | 'custom';
  customIcon?: React.ReactNode;
  isPrimary?: boolean;
  onClick?: () => void;
  badge?: string | number;
}

export interface StickyMobileBarProps {
  fieldPath?: string;
  actions?: StickyMobileBarAction[];
  showOnDesktop?: boolean;
  className?: string;
  style?: React.CSSProperties;
  phone?: string;
  whatsapp?: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  onPrimaryAction?: () => void;
}

/**
 * DENEB UI — Sticky Mobile Commerce Action Bar
 * 
 * High-converting persistent bottom action dock for mobile shoppers.
 * Provides instant 1-tap Call, WhatsApp, and Buy/Checkout access.
 * 
 * Features:
 * - Automatically pulls store phone & WhatsApp from SiteData
 * - Responsive: docks fixed at bottom on mobile (lg:hidden by default)
 * - Ultra-crisp inline SVG icons (zero external icon library dependencies)
 * - Glassmorphism backdrop blur with high contrast touch targets
 * 
 * Created by Chamika Gayashan & Induranga Kawishwara
 */
export function StickyMobileBar({
  fieldPath,
  actions,
  showOnDesktop = false,
  className = '',
  style = {},
  phone: propPhone,
  whatsapp: propWhatsapp,
  primaryActionLabel = 'Shop Now',
  primaryActionHref = '#products',
  onPrimaryAction,
}: StickyMobileBarProps) {
  const { siteData } = useSiteData();

  // Resolve merchant contacts from siteData if not explicitly provided
  const merchant = (siteData as any)?.merchant || {};
  const phone = propPhone || merchant.phone || merchant.supportPhone || '';
  const whatsapp = propWhatsapp || merchant.whatsapp || merchant.phone || '';

  // Default action buttons if custom actions array is not provided
  const resolvedActions: StickyMobileBarAction[] = actions || [
    ...(phone
      ? [
          {
            id: 'call',
            label: 'Call Us',
            href: `tel:${phone.replace(/[^0-9+]/g, '')}`,
            icon: 'phone' as const,
          },
        ]
      : []),
    ...(whatsapp
      ? [
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            href: `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello! I would like to inquire about your products.')}`,
            icon: 'whatsapp' as const,
          },
        ]
      : []),
    {
      id: 'primary',
      label: primaryActionLabel,
      href: primaryActionHref,
      isPrimary: true,
      onClick: onPrimaryAction,
      icon: 'cart' as const,
    },
  ];

  const renderIcon = (icon?: string, custom?: React.ReactNode) => {
    if (custom) return custom;
    switch (icon) {
      case 'phone':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        );
      case 'whatsapp':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.772.82 2.791.82 3.183 0 5.769-2.587 5.769-5.767.001-3.182-2.584-5.765-5.769-5.765zm0 10.375c-.947 0-1.874-.255-2.684-.736l-.192-.114-1.992.522.532-1.942-.125-.199a4.618 4.618 0 01-.707-2.473c.001-2.548 2.073-4.62 4.622-4.62 2.549 0 4.622 2.072 4.622 4.62 0 2.549-2.073 4.62-4.622 4.62z" />
          </svg>
        );
      case 'cart':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
        );
      case 'shop':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        );
    }
  };

  return (
    <aside
      className={`deneb-sticky-mobile-bar fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-3 transition-transform duration-300 ${
        showOnDesktop ? 'block' : 'lg:hidden'
      } ${className}`}
      data-preview-field-path={fieldPath}
      style={{
        backgroundColor: 'var(--header-bg, var(--card-bg, rgba(255, 255, 255, 0.92)))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--color-border, rgba(226, 232, 240, 0.8))',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
        ...style,
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {resolvedActions.map((action) => {
          const isPrimary = action.isPrimary;
          return (
            <a
              key={action.id}
              href={action.href}
              onClick={action.onClick}
              className={`relative flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
                isPrimary
                  ? 'flex-1 py-3 px-4 text-white shadow-md hover:brightness-110'
                  : 'py-2.5 px-3 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/60'
              }`}
              style={
                isPrimary
                  ? {
                      backgroundColor: 'var(--color-primary, #0f172a)',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                    }
                  : {}
              }
            >
              {action.badge && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {action.badge}
                </span>
              )}
              {renderIcon(action.icon, action.customIcon)}
              <span className="truncate">{action.label}</span>
            </a>
          );
        })}
      </div>
    </aside>
  );
}

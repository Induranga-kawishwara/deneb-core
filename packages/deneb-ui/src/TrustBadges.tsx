import React from 'react';

export interface TrustBadgeItem {
  id: string;
  title: string;
  description: string;
  icon?: 'shipping' | 'security' | 'guarantee' | 'support' | 'eco' | 'custom';
  customIcon?: React.ReactNode;
}

export interface TrustBadgesProps {
  fieldPath?: string;
  title?: string;
  subtitle?: string;
  badges?: TrustBadgeItem[];
  variant?: 'grid' | 'inline' | 'cards';
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_BADGES: TrustBadgeItem[] = [
  {
    id: 'shipping',
    title: 'Fast & Free Delivery',
    description: 'Complimentary shipping on orders over $50 with real-time tracking.',
    icon: 'shipping',
  },
  {
    id: 'security',
    title: '100% Secure Checkout',
    description: 'Bank-grade 256-bit SSL encryption. We protect your payment details.',
    icon: 'security',
  },
  {
    id: 'guarantee',
    title: '30-Day Money Back',
    description: 'Hassle-free 30-day return policy. Shop with complete peace of mind.',
    icon: 'guarantee',
  },
  {
    id: 'support',
    title: '24/7 Expert Support',
    description: 'Friendly, responsive customer care via Live Chat, WhatsApp, & Phone.',
    icon: 'support',
  },
];

/**
 * DENEB UI — Trust & Guarantee Badges
 * 
 * High-converting proof component for e-commerce checkouts and product pages.
 * Increases conversion rates by answering buyer objections proactively.
 * 
 * Features:
 * - 4 built-in e-commerce assurance icons (Shipping, Security, Guarantee, Support)
 * - 3 modern layout variants: 'grid', 'inline', and 'cards'
 * - Responsive mobile to desktop grid layout
 * 
 * Created by Chamika Gayashan & Induranga Kawishwara
 */
export function TrustBadges({
  fieldPath = 'content.trustBadges',
  title,
  subtitle,
  badges = DEFAULT_BADGES,
  variant = 'cards',
  className = '',
  style = {},
}: TrustBadgesProps) {
  const renderIcon = (badge: TrustBadgeItem) => {
    if (badge.customIcon) return badge.customIcon;
    switch (badge.icon) {
      case 'shipping':
        return (
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
          </svg>
        );
      case 'security':
        return (
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        );
      case 'guarantee':
        return (
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
        );
      case 'support':
        return (
          <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
    }
  };

  return (
    <section
      className={`w-full py-8 my-4 ${className}`}
      data-preview-field-path={fieldPath}
      style={style}
    >
      {(title || subtitle) && (
        <div className="text-center mb-8">
          {title && (
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div
        className={
          variant === 'inline'
            ? 'flex flex-wrap items-center justify-around gap-6'
            : 'deneb-trust-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'
        }
      >
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`flex items-start gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 ${
              variant === 'cards'
                ? 'bg-white border border-slate-200/80 shadow-sm hover:shadow-md dark:bg-slate-900/60 dark:border-slate-800 dark:hover:border-slate-700'
                : 'bg-transparent'
            }`}
          >
            <div className="flex-shrink-0 p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-800/80 dark:border-slate-700 flex items-center justify-center">
              {renderIcon(badge)}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                {badge.title}
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {badge.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

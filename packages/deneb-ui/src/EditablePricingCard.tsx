import React from 'react';
import { EditableText } from './EditableText';
import { EditableBadge } from './EditableText';

export interface PricingFeature {
  text: string;
  included?: boolean;
}

export interface PricingItem {
  id?: string | number;
  name?: string;
  title?: string;
  badge?: string;
  price?: string | number;
  interval?: string;
  description?: string;
  ctaText?: string;
  ctaTarget?: string;
  isPopular?: boolean;
  features?: (string | PricingFeature)[];
  [key: string]: unknown;
}

export interface EditablePricingCardProps extends React.HTMLAttributes<HTMLElement> {
  itemPath: string;
  item: PricingItem;
  as?: React.ElementType;
  isPopular?: boolean;
  actionSlot?: React.ReactNode;
}

/**
 * EditablePricingCard is a high-converting tier card designed for SaaS, digital products,
 * and service packages with strict Fivora visual editing sync.
 */
export function EditablePricingCard({
  itemPath,
  item,
  as: Component = 'div',
  isPopular = false,
  actionSlot,
  className = '',
  style,
  ...props
}: EditablePricingCardProps) {
  const name = String(item?.name || item?.title || 'Standard Plan');
  const badge = String(item?.badge || (item?.isPopular || isPopular ? 'Popular' : ''));
  const price = String(item?.price || '$49');
  const interval = String(item?.interval || '/month');
  const description = String(item?.description || '');
  const ctaText = String(item?.ctaText || 'Get Started');
  const ctaTarget = String(item?.ctaTarget || 'contact');
  const features = Array.isArray(item?.features) ? item.features : [];
  const popular = item?.isPopular || isPopular;

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    backgroundColor: 'var(--card-bg, var(--color-surface, #ffffff))',
    border: popular ? '2px solid var(--brand-color, #2563eb)' : '1px solid var(--card-border, var(--color-border, #e2e8f0))',
    borderRadius: '20px',
    padding: '2.5rem 2rem',
    boxShadow: popular
      ? '0 20px 35px -10px rgba(37, 99, 235, 0.15), 0 1px 3px rgba(0,0,0,0.05)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    ...style,
  };

  return (
    <Component
      data-preview-item-path={itemPath}
      style={cardStyle}
      className={`editable-pricing-card ${popular ? 'is-popular' : ''} ${className}`.trim()}
      {...(props as any)}
    >
      <div>
        {/* Floating Popular Pill */}
        {badge && (
          <div style={{ position: 'absolute', top: '-14px', right: '24px' }}>
            <EditableBadge
              id={`${itemPath}.badge`}
              defaultValue={badge}
              badgeVariant={popular ? 'primary' : 'secondary'}
            />
          </div>
        )}

        {/* Plan Title */}
        <EditableText
          as="h3"
          id={`${itemPath}.name`}
          defaultValue={name}
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--heading-color, #0f172a)',
            marginBottom: '0.5rem',
          }}
        />

        {/* Short Description */}
        <EditableText
          as="p"
          id={`${itemPath}.description`}
          defaultValue={description}
          style={{
            fontSize: '0.875rem',
            color: 'var(--muted-text, #64748b)',
            marginBottom: '1.5rem',
            lineHeight: 1.5,
          }}
        />

        {/* Price & Billing Cycle */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.5rem' }}>
          <EditableText
            as="span"
            id={`${itemPath}.price`}
            defaultValue={price}
            className="deneb-pricing-amount"
            style={{
              fontSize: '2.75rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--heading-color, #0f172a)',
            }}
          />
          <EditableText
            as="span"
            id={`${itemPath}.interval`}
            defaultValue={interval}
            style={{
              fontSize: '0.875rem',
              color: 'var(--muted-text, #64748b)',
              fontWeight: 500,
            }}
          />
        </div>

        {/* Features Checklist */}
        {(features.length > 0 || Array.isArray(item?.features)) && (
          <ul
            data-preview-list-path={`${itemPath}.features`}
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 2rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {features.map((feat, idx) => {
              const text = typeof feat === 'string' ? feat : feat?.text || '';
              const included = typeof feat === 'string' ? true : feat?.included !== false;

              return (
                <li
                  key={idx}
                  data-preview-item-path={`${itemPath}.features[${idx}]`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.925rem',
                    color: included ? 'var(--page-text, #0f172a)' : 'var(--muted-text, #94a3b8)',
                    textDecoration: included ? 'none' : 'line-through',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    data-preview-static="pricing-check-icon"
                    style={{ flexShrink: 0 }}
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="9"
                      fill={included ? 'var(--brand-color, #2563eb)' : '#e2e8f0'}
                      fillOpacity={included ? 0.15 : 1}
                    />
                    <path
                      d="M6 10l3 3 5-6"
                      stroke={included ? 'var(--brand-color, #2563eb)' : '#94a3b8'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <EditableText id={`${itemPath}.features[${idx}]`} defaultValue={text} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* CTA Action */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
        {actionSlot ? (
          actionSlot
        ) : (
          <span data-target-page={ctaTarget}>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const basePath = (process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? '').replace(/\/$/, '');
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.href = `${basePath}/${ctaTarget}`;
                }
              }}
              style={{
                display: 'block',
                textAlign: 'center',
                width: '100%',
                padding: '0.875rem 1.5rem',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                backgroundColor: popular ? 'var(--brand-color, #2563eb)' : 'var(--brand-secondary, #0f172a)',
                color: '#ffffff',
                border: 0,
                cursor: 'pointer',
                boxShadow: popular ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
                transition: 'opacity 0.2s ease',
              }}
            >
              <span data-preview-field-path={`${itemPath}.ctaText`}>{ctaText}</span>
            </button>
          </span>
        )}
      </div>
    </Component>
  );
}

'use client';

import React from 'react';
import { useSiteData } from './SiteDataProvider';
import { EditableHeading, EditableParagraph, EditableBadge } from './EditableText';
import { EditableImage } from './EditableImage';

export interface EditableHeroCenteredProps extends React.HTMLAttributes<HTMLElement> {
  pageKey?: string;
  badgePath?: string;
  titlePath?: string;
  summaryPath?: string;
  imagePath?: string;
  primaryCtaPath?: string;
  secondaryCtaPath?: string;
  primaryCtaTarget?: string;
  secondaryCtaTarget?: string;
  basePath?: string;
}

export function EditableHeroCentered({
  pageKey = 'home',
  badgePath = 'home.heroEyebrow',
  titlePath = 'home.heroTitle',
  summaryPath = 'home.heroSummary',
  imagePath = 'home.bannerImageUrl',
  primaryCtaPath = 'home.primaryCtaLabel',
  secondaryCtaPath = 'home.secondaryCtaLabel',
  primaryCtaTarget = 'contact',
  secondaryCtaTarget = 'services',
  basePath = '',
  className = '',
  style,
  ...props
}: EditableHeroCenteredProps) {
  const siteData = useSiteData();
  const content = (siteData?.content?.[pageKey] as Record<string, any>) || {};

  const badge = String(content?.heroEyebrow || content?.heroBadge || '');
  const title = String(content?.heroTitle || 'Engineered for Modern Living');
  const summary = String(
    content?.heroSummary || content?.heroSubtitle || 'Discover our curated collection crafted with meticulous detail.'
  );
  const imageUrl = String(content?.bannerImageUrl || content?.heroImage || '');
  const primaryCta = String(content?.primaryCtaLabel || content?.heroCtaText || 'Get Started');
  const secondaryCta = String(content?.secondaryCtaLabel || 'Explore Services');

  const requiredPages = Array.isArray(siteData?.requirements?.requiredPages)
    ? siteData.requirements.requiredPages
    : (siteData?.template?.structure?.pages as string[]) || ['home', 'contact'];

  const hasPrimaryTarget = requiredPages.includes(primaryCtaTarget);
  const hasSecondaryTarget = requiredPages.includes(secondaryCtaTarget);

  const basePathEnv =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_BASE_PATH
      ? process.env.NEXT_PUBLIC_SITE_BASE_PATH
      : '';
  const effectiveBasePath = basePath || basePathEnv;

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      const cleanBase = effectiveBasePath.replace(/\/$/, '');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      window.location.href = `${cleanBase}${cleanPath}` || '/';
    }
  };

  return (
    <section
      id={props.id || "hero"}
      data-design-section="hero"
      data-section-id="hero"
      style={{
        padding: '5rem 1.5rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      className={`editable-hero-centered ${className}`.trim()}
      {...(props as any)}
    >
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        {/* Eyebrow Badge */}
        <div style={{ marginBottom: '1.25rem', display: 'inline-block' }}>
          <EditableBadge
            id={badgePath}
            defaultValue={badge}
            badgeVariant="primary"
          />
        </div>

        {/* Hero Title */}
        <EditableHeading
          level={1}
          id={titlePath}
          defaultValue={title}
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.1,
            color: 'var(--heading-color, #0f172a)',
            marginBottom: '1.5rem',
          }}
        />

        {/* Hero Summary */}
        <EditableParagraph
          lead
          id={summaryPath}
          defaultValue={summary}
          style={{
            fontSize: '1.2rem',
            lineHeight: 1.6,
            color: 'var(--muted-text, #64748b)',
            maxWidth: '680px',
            margin: '0 auto 2.5rem',
          }}
        />

        {/* Dual CTA Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '3.5rem',
          }}
        >
          {hasPrimaryTarget ? (
            <span data-target-page={primaryCtaTarget}>
              <button
                type="button"
                onClick={() => navigate(primaryCtaTarget)}
                style={{
                  display: 'inline-block',
                  padding: '0.875rem 2rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--brand-color, #2563eb)',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  border: 0,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  transition: 'opacity 0.2s ease',
                }}
              >
                <span data-preview-field-path={primaryCtaPath}>{primaryCta}</span>
              </button>
            </span>
          ) : (
            <span
              data-target-page={primaryCtaTarget}
              className="button-primary unavailable"
              data-preview-field-path={primaryCtaPath}
            >
              {primaryCta}
            </span>
          )}

          {hasSecondaryTarget ? (
            <span data-target-page={secondaryCtaTarget}>
              <button
                type="button"
                onClick={() => navigate(secondaryCtaTarget)}
                style={{
                  display: 'inline-block',
                  padding: '0.875rem 2rem',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  color: 'var(--page-text, #0f172a)',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <span data-preview-field-path={secondaryCtaPath}>{secondaryCta}</span>
              </button>
            </span>
          ) : (
            <span
              data-target-page={secondaryCtaTarget}
              className="button-secondary unavailable"
              data-preview-field-path={secondaryCtaPath}
            >
              {secondaryCta}
            </span>
          )}
        </div>

        {/* Hero Image Banner */}
        <div
          style={{
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
          }}
        >
          <EditableImage
            id={imagePath}
            src={imageUrl}
            alt={title}
            aspectRatio="16/9"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </section>
  );
}

export interface EditableHeroSplitProps extends React.HTMLAttributes<HTMLElement> {
  pageKey?: string;
  badgePath?: string;
  titlePath?: string;
  summaryPath?: string;
  imagePath?: string;
  primaryCtaPath?: string;
  primaryCtaTarget?: string;
  basePath?: string;
}

export function EditableHeroSplit({
  pageKey = 'home',
  badgePath = 'home.heroEyebrow',
  titlePath = 'home.heroTitle',
  summaryPath = 'home.heroSummary',
  imagePath = 'home.bannerImageUrl',
  primaryCtaPath = 'home.primaryCtaLabel',
  primaryCtaTarget = 'contact',
  basePath = '',
  className = '',
  style,
  ...props
}: EditableHeroSplitProps) {
  const siteData = useSiteData();
  const content = (siteData?.content?.[pageKey] as Record<string, any>) || {};

  const badge = String(content?.heroEyebrow || content?.heroBadge || '');
  const title = String(content?.heroTitle || 'Engineered for Modern Living');
  const summary = String(
    content?.heroSummary || content?.heroSubtitle || 'Discover our curated collection crafted with meticulous detail.'
  );
  const imageUrl = String(content?.bannerImageUrl || content?.heroImage || '');
  const primaryCta = String(content?.primaryCtaLabel || content?.heroCtaText || 'Get Started');

  const requiredPages = Array.isArray(siteData?.requirements?.requiredPages)
    ? siteData.requirements.requiredPages
    : (siteData?.template?.structure?.pages as string[]) || ['home', 'contact'];

  const hasPrimaryTarget = requiredPages.includes(primaryCtaTarget);

  const basePathEnv =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_BASE_PATH
      ? process.env.NEXT_PUBLIC_SITE_BASE_PATH
      : '';
  const effectiveBasePath = basePath || basePathEnv;

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      const cleanBase = effectiveBasePath.replace(/\/$/, '');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      window.location.href = `${cleanBase}${cleanPath}` || '/';
    }
  };

  return (
    <section
      id={props.id || "hero"}
      data-design-section="hero"
      data-section-id="hero"
      style={{
        padding: '5rem 1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        alignItems: 'center',
        gap: '4rem',
        ...style,
      }}
      className={`editable-hero-split ${className}`.trim()}
      {...(props as any)}
    >
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <EditableBadge
            id={badgePath}
            defaultValue={badge}
            badgeVariant="primary"
          />
        </div>

        <EditableHeading
          level={1}
          id={titlePath}
          defaultValue={title}
          style={{
            fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: 'var(--heading-color, #0f172a)',
            marginBottom: '1.25rem',
          }}
        />

        <EditableParagraph
          lead
          id={summaryPath}
          defaultValue={summary}
          style={{
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: 'var(--muted-text, #64748b)',
            marginBottom: '2rem',
          }}
        />

        {hasPrimaryTarget ? (
          <span data-target-page={primaryCtaTarget}>
            <button
              type="button"
              onClick={() => navigate(primaryCtaTarget)}
              style={{
                display: 'inline-block',
                padding: '0.875rem 2rem',
                borderRadius: '12px',
                backgroundColor: 'var(--brand-color, #2563eb)',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 600,
                border: 0,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'opacity 0.2s ease',
              }}
            >
              <span data-preview-field-path={primaryCtaPath}>{primaryCta}</span>
            </button>
          </span>
        ) : (
          <span
            data-target-page={primaryCtaTarget}
            className="button-primary unavailable"
            data-preview-field-path={primaryCtaPath}
          >
            {primaryCta}
          </span>
        )}
      </div>

      <div>
        <div
          style={{
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
          }}
        >
          <EditableImage
            id={imagePath}
            src={imageUrl}
            alt={title}
            aspectRatio="4/3"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </section>
  );
}

export const Hero = EditableHeroCentered;
export const HeroSplit = EditableHeroSplit;

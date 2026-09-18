'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';
import { useSiteData } from './SiteDataProvider';

export interface CarouselTestimonialItem {
  id?: string | number;
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: string;
  rating?: number;
}

export interface EditableTestimonialCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  listPath?: string;
  items?: CarouselTestimonialItem[];
  autoplay?: boolean;
  autoplayInterval?: number;
  titleId?: string;
  defaultTitle?: string;
  subtitleId?: string;
  defaultSubtitle?: string;
}

export function EditableTestimonialCarousel({
  listPath = 'home.testimonials',
  items,
  autoplay = true,
  autoplayInterval = 5000,
  titleId = 'home.testimonialsSection.title',
  defaultTitle = 'Loved by Over 5,000+ Happy Clients',
  subtitleId = 'home.testimonialsSection.subtitle',
  defaultSubtitle = 'Real experiences, authentic transformations, and 5-star artistry.',
  className = '',
  style,
  ...props
}: EditableTestimonialCarouselProps) {
  const siteData = useSiteData();
  const defaultItems: CarouselTestimonialItem[] = [
    {
      id: '1',
      quote: 'The balayage and haircut completely transformed my look. The stylists here take genuine time to understand your face shape and hair texture. Absolutely premier experience!',
      author: 'Sophia Kensington',
      role: 'Fashion Director & Verified Client',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      rating: 5,
    },
    {
      id: '2',
      quote: 'Flawless precision fade and hot towel treatment. This is not just a haircut, it is true modern atelier craftsmanship. I have been coming here every two weeks for two years.',
      author: 'Marcus Vance',
      role: 'Creative Producer',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      rating: 5,
    },
    {
      id: '3',
      quote: 'Brought my daughter here for her first styling experience. The patience, warmth, and luxury care they showed made it unforgettable. Cannot recommend enough!',
      author: 'Elena Rostova',
      role: 'Architect & Mother',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      rating: 5,
    },
  ];

  // Resolve collection from siteData content if present
  let resolvedList: CarouselTestimonialItem[] = defaultItems;
  if (items && items.length > 0) {
    resolvedList = items;
  } else if (siteData?.content) {
    const parts = listPath.split('.');
    let curr: any = siteData.content;
    for (const part of parts) {
      if (curr && typeof curr === 'object') {
        curr = curr[part];
      } else {
        curr = null;
        break;
      }
    }
    if (Array.isArray(curr) && curr.length > 0) {
      resolvedList = curr;
    }
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % resolvedList.length);
  }, [resolvedList.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + resolvedList.length) % resolvedList.length);
  }, [resolvedList.length]);

  useEffect(() => {
    if (!autoplay || isPaused || resolvedList.length <= 1) return;
    const interval = setInterval(nextSlide, autoplayInterval);
    return () => clearInterval(interval);
  }, [autoplay, isPaused, autoplayInterval, nextSlide, resolvedList.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 60) {
      nextSlide();
    }
    if (touchStartX.current - touchEndX.current < -60) {
      prevSlide();
    }
  };

  const currentItem = resolvedList[activeIndex] || resolvedList[0];

  return (
    <div
      className={`editable-testimonial-carousel relative py-12 px-4 max-w-5xl mx-auto ${className}`.trim()}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '56rem',
        margin: '0 auto',
        padding: '3rem 1rem',
        ...style,
      }}
      {...props}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <EditableText
          id={titleId}
          defaultValue={defaultTitle}
          as="h2"
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: '0.75rem',
            color: 'var(--color-text, #0f172a)',
          }}
        />
        <EditableText
          id={subtitleId}
          defaultValue={defaultSubtitle}
          as="p"
          style={{
            fontSize: '1rem',
            color: '#64748b',
            maxWidth: '36rem',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Main Slide Card */}
      <div
        data-preview-list-path={listPath}
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '24px',
          padding: '3rem 2.5rem',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.07)',
          border: '1px solid var(--color-border, #f1f5f9)',
          minHeight: '280px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div data-preview-item-path={`${listPath}[${activeIndex}]`}>
          {/* Star Rating */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill={i < (currentItem?.rating ?? 5) ? '#f59e0b' : '#e2e8f0'}
                data-preview-static="carousel-star"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>

          {/* Quote */}
          <EditableText
            id={`${listPath}[${activeIndex}].quote`}
            defaultValue={currentItem?.quote}
            as="p"
            style={{
              fontSize: '1.25rem',
              lineHeight: 1.7,
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--color-text, #1e293b)',
              marginBottom: '2rem',
            }}
          />

          {/* Author Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <EditableImage
              id={`${listPath}[${activeIndex}].avatar`}
              src={currentItem?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
              alt={currentItem?.author || 'Client'}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '9999px',
                objectFit: 'cover',
                border: '2px solid #e2e8f0',
              }}
            />
            <div>
              <EditableText
                id={`${listPath}[${activeIndex}].author`}
                defaultValue={currentItem?.author}
                as="h4"
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-text, #0f172a)',
                  margin: 0,
                }}
              />
              <EditableText
                id={`${listPath}[${activeIndex}].role`}
                defaultValue={currentItem?.role || currentItem?.company || 'Verified Client'}
                as="p"
                style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  margin: '0.2rem 0 0 0',
                }}
              />
            </div>
          </div>
        </div>

        {/* Carousel Navigation Buttons & Dots */}
        <div
          data-preview-static="carousel-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          {/* Dots */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {resolvedList.map((item, idx) => (
              <button
                key={item.id || item.author || idx}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setActiveIndex(idx)}
                style={{
                  width: idx === activeIndex ? '28px' : '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  backgroundColor: idx === activeIndex ? 'var(--color-primary, #0f172a)' : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>

          {/* Prev / Next Arrows */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous testimonial"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '9999px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#334155',
                transition: 'background-color 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next testimonial"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '9999px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#334155',
                transition: 'background-color 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TestimonialCarousel = EditableTestimonialCarousel;

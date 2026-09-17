/* eslint-disable @next/next/no-img-element */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { TestimonialItem } from './EditableTestimonialCard';

export interface TestimonialSectionItem extends TestimonialItem {
  tag?: string;
  [key: string]: unknown;
}

export interface EditableTestimonialSectionProps extends React.HTMLAttributes<HTMLElement> {
  basePath?: string;
  badge?: string;
  heading?: string;
  subheading?: string;
  testimonials?: TestimonialSectionItem[];
  maxStars?: number;
  className?: string;
  cardClassName?: string;
}

const DEFAULT_TESTIMONIALS: TestimonialSectionItem[] = [
  {
    id: 1,
    quote: 'The thermal profile Liceria achieves on their refurbished drum is revelatory. You get bright floral acidity harmonized with unprecedented chocolate depth.',
    author: 'Chef Antoine Laurent',
    role: 'Michelin Star Restaurateur & Sommelier',
    avatar: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    tag: 'Culinary Master',
  },
  {
    id: 2,
    quote: 'Manual spring-lever extraction pulled at 93.5°C with mineralized volcanic water. This is not just coffee; this is pure thermodynamic equilibrium.',
    author: 'Clara Sorensen',
    role: 'World Barista Championship Sensory Judge',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    tag: 'Sensory Panel',
  },
  {
    id: 3,
    quote: 'The flagship parlor is our neighborhood sanctuary. Whether for a quiet morning espresso or meeting international bean importers, there is nowhere else quite like it.',
    author: 'Maximilian Sterling',
    role: 'Architecture & Design Critic, Urban Loft',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    tag: 'Design & Culture',
  },
];

function StarSvg({ filled = true, size = 16 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fill: filled ? '#fa7014' : '#dadce0',
        color: filled ? '#fa7014' : '#dadce0',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function TestimonialCard({
  item,
  index,
  maxStars,
  cardClassName,
}: {
  item: TestimonialItem;
  index: number;
  maxStars: number;
  cardClassName?: string;
}) {
  const currentItem = item || {};
  const rawRating = currentItem.rating != null && (currentItem.rating as unknown) !== '' ? currentItem.rating : 5;
  const initialRating = Math.min(Math.max(Math.round(Number(rawRating) || 5), 1), maxStars);

  const [currentRating, setCurrentRating] = useState<number>(initialRating);
  const ratingRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setCurrentRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    const el = ratingRef.current;
    if (!el) return;

    const parseValue = () => {
      const text = el.textContent?.trim() ?? '';
      if (!text) return;
      const num = Number(text);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        const clamped = Math.min(Math.max(Math.round(num), 1), maxStars);
        setCurrentRating(clamped);
      }
    };

    const observer = new MutationObserver(parseValue);
    observer.observe(el, { characterData: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [maxStars]);

  const handleFocusRating = () => {
    if (ratingRef.current) {
      ratingRef.current.focus();
      ratingRef.current.click();
    }
  };

  const quoteText = String(currentItem.quote || '');
  const authorName = String(currentItem.author || 'Anonymous');
  const authorRole = String(currentItem.role || '');
  const authorAvatar = String(
    currentItem.avatar ||
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=300&auto=format&fit=crop',
  );
  const tagText = String(currentItem.tag || '');

  return (
    <div
      data-preview-item-path={`testimonials.testimonials[${index}]`}
      className={`relative p-5 sm:p-7 lg:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md dark:bg-gradient-to-b dark:from-slate-900/70 dark:to-slate-950/90 dark:border-slate-800/80 dark:hover:border-slate-700 dark:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5 min-w-0 ${cardClassName || ''}`.trim()}
    >
      <div className="space-y-4 min-w-0">
        {/* Category Tag & Rating Stars */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {Boolean(currentItem.tag) && (
            <span
              data-preview-field-path={`testimonials.testimonials[${index}].tag`}
              className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-lime-400 dark:border-lime-400/20 text-[10px] sm:text-[11px] uppercase tracking-wider font-extrabold shrink-0"
            >
              {tagText}
            </span>
          )}

          <div
            className="inline-flex items-center gap-1.5 p-1 -mr-1 rounded-lg cursor-pointer transition-all hover:bg-amber-500/10 group ml-auto shrink-0"
            onClick={handleFocusRating}
            title={`Rating: ${currentRating} of ${maxStars} (Click to edit)`}
          >
            <div className="flex items-center gap-[2px]" data-fivora-stars-row="true">
              {Array.from({ length: maxStars }).map((_, sIdx) => (
                <StarSvg key={sIdx} filled={sIdx < currentRating} size={14} />
              ))}
            </div>
            <span
              ref={ratingRef}
              data-preview-field-path={`testimonials.testimonials[${index}].rating`}
              data-fivora-rating-text="true"
              className="text-xs font-black text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors tabular-nums"
              title="Star count (1-5)"
            >
              {currentRating}
            </span>
          </div>
        </div>

        {/* Quote Body */}
        <blockquote
          data-preview-field-path={`testimonials.testimonials[${index}].quote`}
          className="font-serif-italic text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed break-words"
        >
          &ldquo;{quoteText}&rdquo;
        </blockquote>
      </div>

      {/* Author Info */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 min-w-0">
        <img
          src={authorAvatar}
          alt={authorName}
          data-preview-field-path={`testimonials.testimonials[${index}].avatar`}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4
            data-preview-field-path={`testimonials.testimonials[${index}].author`}
            className="font-heading font-black text-sm sm:text-base text-slate-900 dark:text-white truncate"
          >
            {authorName}
          </h4>
          <p
            data-preview-field-path={`testimonials.testimonials[${index}].role`}
            className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-snug line-clamp-2"
          >
            {authorRole}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EditableTestimonialSection({
  basePath = 'testimonials',
  badge = 'WORDS OF ACCLAIM',
  heading = 'WHAT THE CRITICS ARE SAYING',
  subheading = 'Reflections from international cuppers, culinary masters, and dedicated regulars.',
  testimonials = DEFAULT_TESTIMONIALS,
  maxStars = 5,
  className = '',
  cardClassName = '',
  style,
  ...props
}: EditableTestimonialSectionProps) {
  const items = useMemo(() => {
    const list = Array.isArray(testimonials) ? testimonials : [];
    if (list.length === 0) {
      return DEFAULT_TESTIMONIALS;
    }
    return list.map((item, index) => {
      const fallback = DEFAULT_TESTIMONIALS[index % DEFAULT_TESTIMONIALS.length] || DEFAULT_TESTIMONIALS[0];
      if (!item || typeof item !== 'object') {
        return { ...fallback, id: `fallback-${index}` };
      }
      return {
        ...fallback,
        ...item,
        id: item.id || `testimonial-${index}`,
        rating: item.rating !== undefined && item.rating !== null ? item.rating : 5,
      };
    });
  }, [testimonials]);

  return (
    <section
      data-preview-page-key={basePath}
      data-design-section={basePath}
      className={`editable-testimonial-section w-full py-12 sm:py-20 px-3 sm:px-6 lg:px-8 ${className}`.trim()}
      style={style}
      {...props}
    >
      <div className="w-full mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 sm:mb-14 px-2">
          {badge && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800/80 dark:text-lime-400 dark:border-lime-400/20 text-xs uppercase tracking-widest font-black shadow-sm">
              <span data-preview-field-path={`testimonials.badge`}>{badge}</span>
            </div>
          )}
          <h2
            data-preview-field-path={`testimonials.heading`}
            className="font-heading text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight"
          >
            {heading}
          </h2>
          <p
            data-preview-field-path={`testimonials.subheading`}
            className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto"
          >
            {subheading}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div
          data-preview-list-path={`testimonials.testimonials`}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))] w-full"
        >
          {items.map((item, index) => (
            <TestimonialCard
              key={item.id || String(index)}
              item={item}
              index={index}
              maxStars={maxStars}
              cardClassName={cardClassName}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

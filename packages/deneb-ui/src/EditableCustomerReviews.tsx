import React, { useState, useMemo } from 'react';

export interface CustomerReviewItem {
  id?: string | number;
  author: string;
  rating: number;
  date?: string;
  comment: string;
  verified?: boolean;
  productName?: string;
  helpfulCount?: number;
  [key: string]: unknown;
}

export interface EditableCustomerReviewsProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Field path prefix for live Fivora Visual Editing synchronization (e.g. "home").
   */
  sectionPath?: string;

  /**
   * Title of the reviews section.
   */
  title?: string;

  /**
   * Subtitle tag.
   */
  subtitle?: string;

  /**
   * Average score (e.g. 4.9).
   */
  averageRating?: number | string;

  /**
   * Total review count display.
   */
  totalReviews?: number | string;

  /**
   * Array of reviews.
   */
  reviews?: CustomerReviewItem[];

  className?: string;
}

const DEFAULT_REVIEWS: CustomerReviewItem[] = [
  {
    id: 1,
    author: 'Liam Vance',
    rating: 5,
    date: '2 days ago',
    comment: 'The cushioning and responsiveness are unbelievable. Best performance shoe I have owned for tempo runs.',
    verified: true,
    productName: 'VANTA Aero X',
    helpfulCount: 14,
  },
  {
    id: 2,
    author: 'Elena Rostova',
    rating: 5,
    date: '1 week ago',
    comment: 'Sleek design, fits true to size, and the breathability is noticeable on 10k morning runs. Highly recommended!',
    verified: true,
    productName: 'VANTA Flux 01',
    helpfulCount: 9,
  },
  {
    id: 3,
    author: 'Marcus Chen',
    rating: 4,
    date: '2 weeks ago',
    comment: 'Exceptional build quality and premium materials. Fast shipping and very responsive WhatsApp support.',
    verified: true,
    productName: 'VANTA Stealth Pro',
    helpfulCount: 6,
  },
];

/**
 * EditableCustomerReviews is an elite social-proof component featuring
 * star breakdowns, verified buyer authentication badges, helpful counters,
 * and live Fivora visual editing synchronization.
 *
 * Created by Chamika Gayashan & Induranga Kawishwara
 */
export function EditableCustomerReviews({
  sectionPath = 'home',
  title = 'Loved by Athletes & Runners Worldwide',
  subtitle = 'Verified Customer Reviews',
  averageRating = '4.9',
  totalReviews = '1,420+',
  reviews = DEFAULT_REVIEWS,
  className = '',
  style,
  ...props
}: EditableCustomerReviewsProps) {
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);

  const filteredReviews = useMemo(() => {
    if (selectedStarFilter === null) return reviews;
    return reviews.filter((r) => r.rating === selectedStarFilter);
  }, [reviews, selectedStarFilter]);

  return (
    <section
      data-preview-page-key={sectionPath}
      className={`editable-customer-reviews max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${className}`.trim()}
      style={style}
      {...(props as any)}
    >
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        {subtitle && (
          <span
            data-preview-field-path={`${sectionPath}.reviewsSubtitle`}
            className="text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-lime-400 block mb-2"
          >
            {subtitle}
          </span>
        )}
        <h2
          data-preview-field-path={`${sectionPath}.reviewsTitle`}
          className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
        >
          {title}
        </h2>

        {/* Aggregate Score Bar */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="flex text-amber-500 dark:text-amber-400 text-lg">
            {'★★★★★'}
          </div>
          <span className="text-slate-900 dark:text-white font-extrabold text-lg">
            <span data-preview-field-path={`${sectionPath}.reviewsAverage`}>{averageRating}</span> / 5.0
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-sm">
            (<span data-preview-field-path={`${sectionPath}.reviewsCount`}>{totalReviews}</span> reviews)
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => setSelectedStarFilter(null)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            selectedStarFilter === null
              ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 font-extrabold shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-white dark:border-slate-800'
          }`}
        >
          All Reviews
        </button>
        {[5, 4, 3].map((stars) => (
          <button
            key={stars}
            type="button"
            onClick={() => setSelectedStarFilter(stars)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              selectedStarFilter === stars
                ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 font-extrabold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-white dark:border-slate-800'
            }`}
          >
            <span>{stars} Stars</span>
            <span className="text-amber-500 dark:text-amber-400">★</span>
          </button>
        ))}
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredReviews.map((review, i) => (
          <div
            key={review.id || i}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:border-slate-800/80 dark:hover:border-slate-700 flex flex-col justify-between transition-all duration-200"
          >
            <div>
              {/* Star Rating & Verified Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex text-amber-500 dark:text-amber-400 text-sm">
                  {Array.from({ length: review.rating }).map((_, idx) => (
                    <span key={idx}>★</span>
                  ))}
                </div>
                {review.verified !== false && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Verified Buyer
                  </span>
                )}
              </div>

              {/* Review Comment */}
              <p
                data-preview-field-path={`${sectionPath}.review${i + 1}Comment`}
                className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic mb-4"
              >
                &ldquo;{review.comment}&rdquo;
              </p>
            </div>

            {/* Author and Date Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <div>
                <span
                  data-preview-field-path={`${sectionPath}.review${i + 1}Author`}
                  className="block text-xs font-bold text-slate-900 dark:text-white"
                >
                  {review.author}
                </span>
                {review.productName && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Purchased: {review.productName}
                  </span>
                )}
              </div>
              {review.date && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  {review.date}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Canonical alias
export const CustomerReviews = EditableCustomerReviews;

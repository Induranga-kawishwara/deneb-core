import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useReviews, useSiteData } from './SiteDataProvider';

export interface FeedbackItem {
  id?: string | number;
  name?: string;
  avatar?: string;
  rating?: number | string;
  date?: string;
  comment?: string;
  verified?: boolean;
  [key: string]: unknown;
}

export interface EditableGoogleFeedbackProps extends React.HTMLAttributes<HTMLElement> {
  basePath?: string;
  badgeIcon?: string;
  badgeTitle?: string;
  badgeRating?: string | number;
  badgeReviewsCount?: string | number;
  heading?: string;
  subheading?: string;
  feedbacks?: FeedbackItem[];
  maxStars?: number;
  className?: string;
  cardClassName?: string;
}

const DEFAULT_GOOGLE_ICON = 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg';

const DEFAULT_FEEDBACKS: FeedbackItem[] = [
  {
    id: 1,
    name: 'Elena Vance',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    date: '3 days ago',
    comment: 'The Yirgacheffe pour-over is unmatched. You can taste the jasmine and wild bergamot notes immediately. The atmosphere of the salon is pure serenity.',
    verified: true,
  },
  {
    id: 2,
    name: 'Julian Thorne',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    date: '1 week ago',
    comment: 'Hands down the best flat white on the island. The milk texture was like velvet and the single-origin espresso cut through with rich cacao sweetness.',
    verified: true,
  },
  {
    id: 3,
    name: 'Maya Lin',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    date: '2 weeks ago',
    comment: 'Ordered 2 bags of the cast-iron roasted beans for my home setup. Shipping was lightning-fast and the roast profile was exceptionally dialed in.',
    verified: true,
  },
  {
    id: 4,
    name: 'David Sterling',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    date: '3 weeks ago',
    comment: 'The 9-bar manual lever pull is pure art. Wonderful baristas who genuinely know and love their craft. Liceria & Co. has set a whole new standard.',
    verified: true,
  },
  {
    id: 5,
    name: 'Sophia Aris',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop',
    rating: 5,
    date: '1 month ago',
    comment: 'Attended the private cupping session on Saturday. Educational, welcoming, and deeply flavorful. Easily our favorite coffee destination in the country.',
    verified: true,
  },
];

function GoogleStarSvg({ filled = true, size = 18 }: { filled?: boolean; size?: number }) {
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

function FeedbackCard({
  item,
  index,
  maxStars,
  badgeIcon,
  badgeTitle,
  cardClassName,
}: {
  item: FeedbackItem;
  index: number;
  maxStars: number;
  badgeIcon?: string;
  badgeTitle?: string;
  cardClassName?: string;
}) {
  const currentItem = item || {};
  const rawRating = currentItem.rating != null && currentItem.rating !== '' ? currentItem.rating : 5;
  const initialRating = Math.min(Math.max(Math.round(Number(rawRating) || 5), 1), maxStars);

  const [currentRating, setCurrentRating] = useState<number>(initialRating);
  const ratingRef = useRef<HTMLSpanElement>(null);

  // Sync state when props change
  useEffect(() => {
    setCurrentRating(initialRating);
  }, [initialRating]);

  // Real-time MutationObserver to sync DOM live edits from Fivora inspector instantly
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

  const reviewerName = String(currentItem.name || 'Anonymous');
  const reviewerAvatar = String(
    currentItem.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
  );
  const reviewerComment = String(currentItem.comment || '');
  const reviewerDate = String(currentItem.date || 'Recent review');

  return (
    <div
      data-preview-item-path={`feedback.feedbacks[${index}]`}
      className={`p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md dark:bg-gradient-to-b dark:from-slate-900/70 dark:to-slate-950/90 dark:border-slate-800/80 dark:hover:border-slate-700 dark:shadow-xl transition-[transform,box-shadow] duration-200 flex flex-col justify-between space-y-4 ${cardClassName || ''}`.trim()}
    >
      <div className="space-y-3.5">
        {/* Author Profile Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={reviewerAvatar}
              alt={reviewerName}
              data-preview-field-path={`feedback.feedbacks[${index}].avatar`}
              className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
            />
            <div>
              <span
                data-preview-field-path={`feedback.feedbacks[${index}].name`}
                className="block text-sm font-black text-slate-900 dark:text-white"
              >
                {reviewerName}
              </span>
              <span
                data-preview-field-path={`feedback.feedbacks[${index}].date`}
                className="block text-xs text-slate-500 dark:text-slate-400"
              >
                {reviewerDate}
              </span>
            </div>
          </div>

          {(() => {
            const itemCustomIcon = (currentItem as Record<string, unknown>)?.badgeIcon || (currentItem as Record<string, unknown>)?.platformIcon;
            const finalCardIcon = typeof itemCustomIcon === 'string' && itemCustomIcon.trim() ? itemCustomIcon : (badgeIcon || DEFAULT_GOOGLE_ICON);
            const cardIconFieldPath = typeof itemCustomIcon === 'string' && itemCustomIcon.trim()
              ? `feedback.feedbacks[${index}].badgeIcon`
              : `feedback.badgeIcon`;

            return (
              <img
                src={finalCardIcon}
                alt={badgeTitle || 'Review Platform'}
                data-preview-field-path={cardIconFieldPath}
                className="w-5 h-5 object-contain opacity-90 shrink-0 cursor-pointer"
                style={{
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  minHeight: '20px',
                  maxWidth: '20px',
                  maxHeight: '20px',
                }}
                title="Click to upload/change review platform icon (Google, Twitter, Trustpilot, etc.)"
              />
            );
          })()}
        </div>

        {/* Star rating row & Google verified tag */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div
            className="inline-flex items-center gap-2 p-1 -ml-1 rounded-lg cursor-pointer transition-all hover:bg-amber-500/10 group"
            onClick={handleFocusRating}
            title={`Rating: ${currentRating} of ${maxStars} (Click to edit)`}
          >
            <div className="flex items-center gap-[2px]" data-fivora-stars-row="true">
              {Array.from({ length: maxStars }).map((_, sIdx) => (
                <GoogleStarSvg key={sIdx} filled={sIdx < currentRating} size={18} />
              ))}
            </div>
            <span
              ref={ratingRef}
              data-preview-field-path={`feedback.feedbacks[${index}].rating`}
              data-fivora-rating-text="true"
              className="text-xs font-black text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors tabular-nums"
              title="Star count (1-5)"
            >
              {currentRating}
            </span>
          </div>

          {/* Google verified indicator */}
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span>Verified</span>
          </div>
        </div>

        {/* Comment / Review text */}
        <p
          data-preview-field-path={`feedback.feedbacks[${index}].comment`}
          className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed italic font-normal pt-1"
        >
          &ldquo;{reviewerComment}&rdquo;
        </p>
      </div>
    </div>
  );
}

export function EditableGoogleFeedback({
  heading,
  subheading,
  badgeTitle = 'Google Reviews',
  badgeRating,
  badgeReviewsCount,
  badgeIcon,
  feedbacks,
  maxStars = 5,
  className = '',
  cardClassName = '',
  style,
  basePath = 'feedback',
  ...props
}: EditableGoogleFeedbackProps) {
  const liveReviews = useReviews();
  const siteData = useSiteData();
  const siteFeedback = (siteData?.content as any)?.[basePath]?.feedbacks || (siteData?.content as any)?.[basePath]?.reviews || (siteData?.content as any)?.reviews;

  const rawFeedbacks = (feedbacks && feedbacks.length > 0)
    ? feedbacks
    : (liveReviews && liveReviews.length > 0)
      ? liveReviews
      : (Array.isArray(siteFeedback) && siteFeedback.length > 0)
        ? siteFeedback
        : DEFAULT_FEEDBACKS;

  const items: FeedbackItem[] = useMemo(() => {
    return rawFeedbacks.map((f: any, index: number) => ({
      id: f.id ?? index + 1,
      name: f.name || f.author || f.customerName || 'Customer',
      avatar: f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.name || f.author || String(index))}`,
      rating: typeof f.rating === 'number' ? f.rating : (parseInt(f.rating, 10) || 5),
      date: f.date || f.timeAgo || 'Recently',
      comment: f.comment || f.body || f.feedback || f.quote || '',
      verified: f.verified !== false,
    }));
  }, [rawFeedbacks]);

  const calculatedAvg = useMemo(() => {
    if (!items.length) return '5.0';
    const sum = items.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return (sum / items.length).toFixed(1);
  }, [items]);

  const hasLive = (liveReviews && liveReviews.length > 0) || (feedbacks && feedbacks.length > 0);
  const effectiveBadgeRating = badgeRating ?? (hasLive ? calculatedAvg : '4.9');
  const effectiveBadgeCount = badgeReviewsCount ?? (hasLive ? `${items.length} verified reviews` : '128 verified reviews');
  const effectiveHeading = heading ?? (siteData?.content as any)?.[basePath]?.heading ?? 'Loved by Customers Worldwide';
  const effectiveSubheading = subheading ?? (siteData?.content as any)?.[basePath]?.subheading ?? 'Real stories and verified 5-star reviews from our official Google Business profile.';
  const hasCustomPy = /(^|\s)(p|py|pt)-/.test(className);
  const defaultPadding = hasCustomPy ? '' : 'py-6 sm:py-8';

  return (
    <section
      data-preview-page-key={basePath}
      className={`editable-google-feedback w-full ${defaultPadding} ${className}`.trim()}
      style={style}
      {...props}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header & Google Rating Badge */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 sm:mb-8">
          <div className="max-w-2xl space-y-3">
            {/* Google Rating Pill Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-900/80 dark:border-slate-800 shadow-sm">
              <img
                src={badgeIcon || DEFAULT_GOOGLE_ICON}
                alt="Google"
                data-preview-field-path={`feedback.badgeIcon`}
                className="w-4 h-4 object-contain"
              />
              <span
                data-preview-field-path={`feedback.badgeTitle`}
                className="text-xs uppercase tracking-widest font-black text-slate-800 dark:text-slate-200"
              >
                {badgeTitle}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
              <div className="flex items-center gap-1.5">
                <span
                  data-preview-field-path={`feedback.badgeRating`}
                  className="text-xs font-black text-amber-600 dark:text-amber-400"
                >
                  {effectiveBadgeRating}
                </span>
                <div className="flex items-center gap-[2px]">
                  {Array.from({ length: 5 }).map((_, sIdx) => (
                    <GoogleStarSvg key={sIdx} filled={true} size={14} />
                  ))}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                (<span data-preview-field-path={`feedback.badgeReviewsCount`}>{effectiveBadgeCount}</span>)
              </span>
            </div>

            <h2
              data-preview-field-path={`feedback.heading`}
              className="font-heading text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight"
            >
              {effectiveHeading}
            </h2>
            <p
              data-preview-field-path={`feedback.subheading`}
              className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed"
            >
              {effectiveSubheading}
            </p>
          </div>

          {/* Aggregate Badge for Desktop */}
          <div className="hidden md:flex flex-col items-end text-right">
            <div className="flex items-center gap-2">
              <span
                data-preview-field-path={`feedback.badgeRating`}
                className="font-heading text-4xl font-black text-amber-500 dark:text-amber-400"
              >
                {badgeRating}
              </span>
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-[2px]">
                  {Array.from({ length: 5 }).map((_, sIdx) => (
                    <GoogleStarSvg key={sIdx} filled={true} size={16} />
                  ))}
                </div>
                <span
                  data-preview-field-path={`feedback.badgeReviewsCount`}
                  className="text-xs text-slate-500 dark:text-slate-400 font-bold"
                >
                  {badgeReviewsCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Cards List */}
        <div
          data-preview-list-path={`feedback.feedbacks`}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {items.map((item, index) => (
            <FeedbackCard
              key={item.id || String(index)}
              item={item}
              index={index}
              maxStars={maxStars}
              badgeIcon={badgeIcon}
              badgeTitle={badgeTitle}
              cardClassName={cardClassName}
            />
          ))}
        </div>
      </div>
    </section>
  );
}


// Canonical alias
export const GoogleFeedback = EditableGoogleFeedback;

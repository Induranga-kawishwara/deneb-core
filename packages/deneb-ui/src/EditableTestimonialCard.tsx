import React from 'react';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';

export interface TestimonialItem {
  id?: string | number;
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
  avatar?: string;
  rating?: number;
  [key: string]: unknown;
}

export interface EditableTestimonialCardProps extends React.HTMLAttributes<HTMLElement> {
  itemPath: string;
  item: TestimonialItem;
  as?: React.ElementType;
}

export function EditableTestimonialCard({
  itemPath,
  item,
  as: Component = 'div',
  className = '',
  style,
  ...props
}: EditableTestimonialCardProps) {
  const quote = String(item?.quote || 'Exceptional quality and service. Highly recommended!');
  const author = String(item?.author || 'Customer Name');
  const role = String(item?.role || item?.company || 'Verified Buyer');
  const avatar = String(item?.avatar || '');
  const rating = Number(item?.rating || 5);

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--card-bg, var(--color-surface, #ffffff))',
    border: '1px solid var(--card-border, var(--color-border, #f1f5f9))',
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: 'var(--card-shadow, 0 4px 20px -2px rgba(0, 0, 0, 0.04))',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ...style,
  };

  return (
    <Component
      data-preview-item-path={itemPath}
      style={cardStyle}
      className={`editable-testimonial-card ${className}`.trim()}
      {...(props as Record<string, unknown>)}
    >
      <div>
        {/* Star Rating */}
        <div style={{ display: 'flex', gap: '3px', marginBottom: '1.25rem' }}>
          {[...Array(5)].map((_, i) => (
            <svg
              key={i}
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill={i < rating ? '#f59e0b' : '#e2e8f0'}
              data-preview-static="testimonial-star"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        {/* Quote Text */}
        <EditableText
          as="p"
          id={`${itemPath}.quote`}
          defaultValue={quote}
          style={{
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--page-text, #334155)',
            fontStyle: 'italic',
            marginBottom: '1.5rem',
          }}
        />
      </div>

      {/* Author Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <EditableImage
          id={`${itemPath}.avatar`}
          src={avatar}
          alt={author}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '9999px',
            objectFit: 'cover',
          }}
        />

        <div>
          <EditableText
            as="h4"
            id={`${itemPath}.author`}
            defaultValue={author}
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--heading-color, #0f172a)',
              lineHeight: 1.2,
            }}
          />
          <EditableText
            as="p"
            id={`${itemPath}.role`}
            defaultValue={role}
            style={{
              fontSize: '0.825rem',
              color: 'var(--muted-text, #64748b)',
              marginTop: '0.125rem',
            }}
          />
        </div>
      </div>
    </Component>
  );
}

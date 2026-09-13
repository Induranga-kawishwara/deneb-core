import React from 'react';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';

export interface ServiceItem {
  id?: string | number;
  name?: string;
  title?: string;
  price?: string | number;
  description?: string;
  imageUrl?: string;
  image?: string;
  features?: unknown[];
  [key: string]: unknown;
}

export interface EditableServiceCardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The item path, e.g. "services[0]".
   */
  itemPath: string;

  /**
   * The service data object.
   */
  service: ServiceItem;

  /**
   * Fallback image URL if image is missing.
   */
  imageFallback?: string;

  /**
   * HTML wrapper tag (default: 'article').
   */
  as?: React.ElementType;

  /**
   * Text/content alignment for the card ('left' | 'center' | 'right').
   */
  align?: 'left' | 'center' | 'right';
  showPrice?: boolean;
}

/**
 * EditableServiceCard standardizes service presentation across Home and Services pages.
 * Supports service name, description, image, and repeatable features checklist.
 */
export function EditableServiceCard({
  itemPath,
  service,
  imageFallback = '/placeholder.svg',
  as: Component = 'article',
  align = 'left',
  showPrice = true,
  className = '',
  style,
  children,
  ...props
}: EditableServiceCardProps) {
  const name = String(service?.name || service?.title || '');
  const description = String(service?.description || '');
  const hasPrice = showPrice && service?.price !== undefined && service?.price !== null && String(service.price).trim() !== '';
  const imageUrl = String(service?.imageUrl || service?.image || '');
  const features = Array.isArray(service?.features) ? service.features : [];

  const mergedStyle: React.CSSProperties = {
    textAlign: align,
    ...style,
  };

  return (
    <Component
      data-preview-item-path={itemPath}
      className={`editable-service-card ${className}`.trim()}
      style={mergedStyle}
      {...(props as any)}
    >
      {(imageUrl || service?.imageUrl !== undefined || service?.image !== undefined) && (
        <div className="service-card-image-wrap">
          <EditableImage
            id={`${itemPath}.imageUrl`}
            data-preview-field-path={`${itemPath}.imageUrl`}
            src={imageUrl}
            fallbackSrc={imageFallback}
            alt={name}
            className="service-card-image"
          />
        </div>
      )}

      <div className="service-card-body">
        <EditableText
          as="h2"
          id={`${itemPath}.name`}
          data-preview-field-path={`${itemPath}.name`}
          defaultValue={name}
          className="service-card-title"
        />

        <EditableText
          as="p"
          id={`${itemPath}.description`}
          data-preview-field-path={`${itemPath}.description`}
          defaultValue={description}
          className="service-card-description"
        />

        {hasPrice && (
          <div className="service-card-price-wrap" style={{ margin: '0.5rem 0' }}>
            <EditableText
              as="span"
              id={`${itemPath}.price`}
              data-preview-field-path={`${itemPath}.price`}
              defaultValue={String(service.price)}
              className="service-card-price"
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--brand-color, #2563eb)',
              }}
            />
          </div>
        )}

        {(features.length > 0 || Array.isArray(service?.features)) && (
          <ul
            data-preview-list-path={`${itemPath}.features`}
            className="service-card-features"
          >
            {features.map((feature, featureIndex) => {
              const featureText =
                typeof feature === 'string'
                  ? feature
                  : typeof (feature as any)?.title === 'string'
                  ? (feature as any).title
                  : String(feature ?? '');

              return (
                <li
                  key={featureIndex}
                  data-preview-item-path={`${itemPath}.features[${featureIndex}]`}
                >
                  <EditableText
                    id={`${itemPath}.features[${featureIndex}]`}
                    data-preview-field-path={`${itemPath}.features[${featureIndex}]`}
                    defaultValue={featureText}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {children}
      </div>
    </Component>
  );
}

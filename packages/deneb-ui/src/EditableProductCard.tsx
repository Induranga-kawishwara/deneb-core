import React from 'react';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';
import { EditableBadge } from './EditableText';
import { MeasurementUnit } from './utils/productOptions';
import { useOptionalCart, getProductWhatsAppUrl, formatCurrency } from './cart/useCart';

export interface ProductItem {
  id?: string | number;
  name?: string;
  title?: string;
  brand?: string;
  price?: string | number;
  originalPrice?: string | number;
  currency?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  image?: string;
  images?: string[];
  badge?: string;
  rating?: number | string;
  reviewsCount?: number | string;
  isNew?: boolean;
  isBestSeller?: boolean;

  // WhatsApp & CTA custom bindings per product
  whatsappNumber?: string;
  whatsappButtonText?: string;
  addToCartButtonText?: string;
  buttonText?: string;

  // Variants & Measurements System
  unit?: MeasurementUnit;
  measurement?: string;
  optionsLabel?: string;
  options?: (string | number)[] | string;
  optionsText?: string;
  sizes?: (string | number)[] | string;
  sizesText?: string;
  sizesLabel?: string;
  colors?: Array<string | { name: string; hex?: string }> | string;
  colorsText?: string;
  colorsLabel?: string;

  [key: string]: unknown;
}

export type ProductCardVariant = 'modern-glass' | 'classic' | 'minimal' | 'horizontal';

export interface EditableProductCardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The item path for the product, e.g. "products[0]" or "featuredProducts[1]".
   */
  itemPath: string;

  /**
   * The product data object.
   */
  product: ProductItem;

  /**
   * Design variant: 'modern-glass' | 'classic' | 'minimal' | 'horizontal'
   */
  cardVariant?: ProductCardVariant;

  /**
   * Fallback image URL if product image is empty.
   */
  imageFallback?: string;

  /**
   * HTML wrapper tag (default: 'article').
   */
  as?: React.ElementType;

  /**
   * Currency code or symbol (default: 'LKR').
   */
  currency?: string;

  /**
   * Whether to display the brand tag (default: true).
   */
  showBrand?: boolean;

  /**
   * Whether to display the price field (default: true).
   */
  showPrice?: boolean;

  /**
   * Whether to display the description field (default: true).
   */
  showDescription?: boolean;

  /**
   * Whether to display category pill (default: true if present).
   */
  showCategory?: boolean;

  /**
   * Default WhatsApp account number for inquiries (e.g. '94771234567').
   */
  whatsappNumber?: string;

  /**
   * Store name for WhatsApp message templates.
   */
  storeName?: string;

  /**
   * Whether to display the WhatsApp contact button (default: true).
   */
  showWhatsAppButton?: boolean;

  /**
   * Whether to display the Add to Cart button (default: true).
   */
  showAddToCartButton?: boolean;

  /**
   * Default label for the WhatsApp button (default: 'Inquire on WhatsApp').
   */
  whatsappActionLabel?: string;

  /**
   * Default label for the Add to Cart button (default: 'Add to Cart').
   */
  addToCartLabel?: string;

  /**
   * Optional custom action slot (overrides dual action buttons).
   */
  actionSlot?: React.ReactNode;

  /**
   * Legacy action label fallback.
   */
  actionLabel?: string;

  /**
   * Legacy action label path fallback.
   */
  actionLabelPath?: string;

  /**
   * Optional callback when Add to Cart is clicked.
   */
  onAddToCart?: (product: ProductItem) => void;

  /**
   * Optional callback when WhatsApp button is clicked.
   */
  onWhatsAppClick?: (product: ProductItem, url: string) => void;
}

// Clean inline SVG icons for zero external dependencies
function WhatsAppIcon({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M12.031 0C5.398 0 .02 5.378.02 12.011c0 2.118.552 4.188 1.6 6.009L.055 24l6.16-1.615a11.97 11.97 0 005.816 1.488h.005c6.632 0 12.01-5.378 12.01-12.012 0-3.21-1.25-6.227-3.52-8.497A11.936 11.936 0 0012.031 0zm-.005 21.84a9.92 9.92 0 01-5.06-1.385l-.363-.216-3.762.986 1.004-3.668-.236-.376a9.924 9.924 0 01-1.52-5.37C2.089 6.52 6.549 2.06 12.026 2.06c2.652 0 5.147 1.033 7.02 2.906A9.878 9.878 0 0121.95 12c0 5.48-4.46 9.84-9.924 9.84zm5.438-7.389c-.298-.15-1.764-.87-2.037-.97-.273-.1-.472-.15-.67.15-.199.3-.77 9.7-.945 1.17-.174.199-.348.224-.646.075-.298-.15-1.258-.464-2.397-1.48a8.91 8.91 0 01-1.657-2.057c-.174-.299-.019-.46.13-.61.135-.133.298-.348.447-.522.15-.174.199-.298.298-.498.1-.199.05-.373-.025-.522-.075-.15-.67-1.618-.92-2.215-.243-.582-.49-.503-.67-.512l-.573-.01c-.198 0-.522.075-.795.373-.273.298-1.043 1.02-1.043 2.488s1.068 2.886 1.217 3.085c.15.199 2.102 3.21 5.093 4.502.711.308 1.267.492 1.7.63.715.228 1.365.196 1.88.119.573-.086 1.764-.72 2.012-1.416.248-.696.248-1.293.174-1.417-.075-.124-.273-.199-.572-.348z" />
    </svg>
  );
}

function CartIcon({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  );
}

/**
 * EditableProductCard is an elite, auto-balancing commerce card featuring
 * Sri Lankan Rupee (LKR) pricing, dual WhatsApp + Add to Cart actions,
 * brand attribution, and strict Fivora visual editing synchronization.
 */
export function EditableProductCard({
  itemPath,
  product,
  cardVariant = 'modern-glass',
  imageFallback,
  as: Component = 'article',
  currency = 'LKR',
  showBrand = true,
  showPrice = true,
  showDescription = true,
  showCategory = true,
  whatsappNumber = '94770000000',
  storeName,
  showWhatsAppButton = true,
  showAddToCartButton = true,
  whatsappActionLabel = 'Inquire on WhatsApp',
  addToCartLabel = 'Add to Cart',
  actionSlot,
  actionLabel,
  actionLabelPath,
  onAddToCart,
  onWhatsAppClick,
  className = '',
  style,
  ...props
}: EditableProductCardProps) {
  const cart = useOptionalCart();

  const name = String(product?.name || product?.title || 'Untitled Product');
  const brand = String(product?.brand || '');
  const hasPrice = showPrice && product?.price !== undefined && product?.price !== null && String(product.price).trim() !== '';

  const rawPrice = product?.price;
  const priceNum = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '').replace(/[^0-9.]/g, '')) || 0;
  const formattedPrice = hasPrice ? (typeof rawPrice === 'string' && rawPrice.includes('LKR') ? rawPrice : formatCurrency(priceNum, currency)) : '';

  const originalPrice = product?.originalPrice !== undefined ? String(product.originalPrice) : '';
  const description = String(product?.description || '');
  const category = String(product?.category || '');
  const badge = String(product?.badge || '');
  const fallbackImage = imageFallback || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80';
  const imageUrl = String(product?.imageUrl || product?.image || fallbackImage);

  // Resolved phone number for WhatsApp
  const resolvedPhone = String(product?.whatsappNumber || whatsappNumber || '94770000000');
  const resolvedWhatsAppText = String(product?.whatsappButtonText || whatsappActionLabel);
  const resolvedAddToCartText = String(product?.addToCartButtonText || addToCartLabel);

  const isHorizontal = cardVariant === 'horizontal';

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getProductWhatsAppUrl(
      { ...product, name, brand, price: formattedPrice },
      resolvedPhone,
      { storeName, currency }
    );
    if (onWhatsAppClick) {
      onWhatsAppClick(product, url);
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const itemToAdd = {
      id: String(product?.id || name.toLowerCase().replace(/\s+/g, '-')),
      name,
      brand,
      price: priceNum,
      image: imageUrl,
      quantity: 1,
    };

    if (cart) {
      cart.addItem(itemToAdd);
      cart.openCart();
    }
    if (onAddToCart) {
      onAddToCart(product);
    }
  };

  const variantStyles: Record<ProductCardVariant, React.CSSProperties> = {
    'modern-glass': {
      backgroundColor: 'var(--product-card-bg, #0F1424)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--product-card-border, #1E2638)',
      borderRadius: '16px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
      overflow: 'hidden',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
    },
    classic: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '14px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      overflow: 'hidden',
      transition: 'transform 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
    },
    minimal: {
      backgroundColor: 'transparent',
      border: 'none',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    horizontal: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
    },
  };

  return (
    <Component
      data-preview-item-path={itemPath}
      style={{
        ...variantStyles[cardVariant],
        ...style,
      }}
      className={`editable-product-card group ${isHorizontal ? 'is-horizontal' : ''} ${className}`.trim()}
      {...(props as any)}
    >
      {/* Image Wrap */}
      <div
        className="deneb-product-card-media"
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: isHorizontal ? '40%' : '100%',
          flexShrink: 0,
        }}
      >
        <EditableImage
          id={`${itemPath}.imageUrl`}
          data-preview-field-path={`${itemPath}.imageUrl`}
          src={imageUrl}
          fallbackSrc={imageFallback}
          alt={name}
          aspectRatio={isHorizontal ? 'square' : '4/3'}
          fit="cover"
          hoverZoom
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Floating Sale / New Badge */}
        {badge && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
            <EditableBadge
              id={`${itemPath}.badge`}
              data-preview-field-path={`${itemPath}.badge`}
              defaultValue={badge}
              badgeVariant="primary"
            />
          </div>
        )}
      </div>

      {/* Body Wrap */}
      <div
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Category & Brand Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.375rem' }}>
            {showCategory && category ? (
              <EditableText
                as="span"
                id={`${itemPath}.category`}
                data-preview-field-path={`${itemPath}.category`}
                defaultValue={category}
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--brand-accent, #a3e635)',
                  fontWeight: 700,
                  display: 'inline-block',
                }}
              />
            ) : null}

            {showBrand && brand ? (
              <EditableText
                as="span"
                id={`${itemPath}.brand`}
                data-preview-field-path={`${itemPath}.brand`}
                defaultValue={brand}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              />
            ) : null}
          </div>

          {/* Product Title */}
          <EditableText
            as="h3"
            id={`${itemPath}.name`}
            data-preview-field-path={`${itemPath}.name`}
            defaultValue={name}
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--heading-color, #ffffff)',
              marginBottom: '0.375rem',
            }}
          />

          {/* Description */}
          {showDescription && description ? (
            <EditableText
              as="p"
              id={`${itemPath}.description`}
              data-preview-field-path={`${itemPath}.description`}
              defaultValue={description}
              style={{
                fontSize: '0.875rem',
                color: 'var(--muted-text, #94a3b8)',
                lineHeight: 1.5,
                marginBottom: '0.75rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            />
          ) : null}
        </div>

        {/* Pricing and Dual Action Buttons */}
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: cardVariant === 'minimal' ? 'none' : '1px solid rgba(51, 65, 85, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Price Row (in LKR) */}
          {hasPrice ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <EditableText
                as="span"
                id={`${itemPath}.price`}
                data-preview-field-path={`${itemPath}.price`}
                defaultValue={formattedPrice}
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: 'var(--brand-color, #ffffff)',
                  letterSpacing: '-0.02em',
                }}
              />
              {originalPrice ? (
                <EditableText
                  as="span"
                  id={`${itemPath}.originalPrice`}
                  data-preview-field-path={`${itemPath}.originalPrice`}
                  defaultValue={originalPrice}
                  style={{
                    fontSize: '0.875rem',
                    textDecoration: 'line-through',
                    color: 'var(--muted-text, #94a3b8)',
                  }}
                />
              ) : null}
              {product?.measurement ? (
                <EditableText
                  as="span"
                  id={`${itemPath}.measurement`}
                  data-preview-field-path={`${itemPath}.measurement`}
                  defaultValue={`/ ${String(product.measurement)}`}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: 'var(--muted-text, #64748b)',
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {/* Actions: Custom Action Slot OR Dual Buttons */}
          {actionSlot ? (
            <div>{actionSlot}</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: showWhatsAppButton && showAddToCartButton ? '1fr 1fr' : '1fr',
                gap: '0.5rem',
                width: '100%',
              }}
            >
              {/* Button 1: WhatsApp Inquiry Button */}
              {showWhatsAppButton && (
                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  title="Chat directly on WhatsApp about this product"
                  style={{
                    backgroundColor: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '10px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
                  }}
                  className="hover:brightness-105 active:scale-95"
                >
                  <WhatsAppIcon />
                  <EditableText
                    as="span"
                    id={`${itemPath}.whatsappButtonText`}
                    data-preview-field-path={`${itemPath}.whatsappButtonText`}
                    defaultValue={resolvedWhatsAppText}
                    style={{ color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  />
                </button>
              )}

              {/* Button 2: Add to Cart Button */}
              {showAddToCartButton && (
                <button
                  type="button"
                  onClick={handleAddToCartClick}
                  title="Add this product to shopping cart"
                  style={{
                    backgroundColor: 'var(--brand-color, #2563eb)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '10px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  }}
                  className="hover:brightness-105 active:scale-95"
                >
                  <CartIcon />
                  <EditableText
                    as="span"
                    id={`${itemPath}.addToCartButtonText`}
                    data-preview-field-path={`${itemPath}.addToCartButtonText`}
                    defaultValue={resolvedAddToCartText}
                    style={{ color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Component>
  );
}

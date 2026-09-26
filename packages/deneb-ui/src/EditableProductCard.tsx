import React, { useState, useMemo, useEffect } from 'react';
import { EditableText, EditableBadge } from './EditableText';
import { EditableImage } from './EditableImage';
import { useOptionalCart, formatCurrency, getProductWhatsAppUrl } from './cart/useCart';
import {
  resolveProductOptions,
  resolveVariantPrice,
  MeasurementUnit,
  ProductVariant,
  ProductOptionInput,
} from './utils/productOptions';

const COLOR_HEX_MAP: Record<string, string> = {
  black: '#111827',
  white: '#ffffff',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  navy: '#1e3a8a',
  grey: '#6b7280',
  gray: '#6b7280',
  silver: '#d1d5db',
  gold: '#f59e0b',
  brown: '#78350f',
  beige: '#f5f5dc',
  maroon: '#800000',
  olive: '#808000',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  rose: '#f43f5e',
  emerald: '#10b981',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  charcoal: '#374151',
  cream: '#fffdd0',
  burgundy: '#800020',
};

export interface ProductItem {
  id?: string | number;
  name?: string;
  title?: string;
  productName?: string;
  itemTitle?: string;
  brand?: string;
  price?: string | number;
  cost?: string | number;
  amount?: string | number;
  productPrice?: string | number;
  compareAtPrice?: string | number;
  originalPrice?: string | number;
  currency?: string;
  description?: string;
  desc?: string;
  details?: string;
  category?: string;
  imageUrl?: string;
  image?: string;
  photo?: string;
  thumbnail?: string;
  productImage?: string;
  gallery?: string[];
  images?: string[];
  badge?: string;
  tag?: string;
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
  colors?: Array<string | { name: string; hex?: string; image?: string }> | string;
  colorsText?: string;
  colorsLabel?: string;
  variants?: ProductVariant[];
  variantPrices?: Record<string, number | string>;
  minPrice?: string | number;
  maxPrice?: string | number;
  priceMin?: string | number;
  priceMax?: string | number;
  priceRange?: [number | string, number | string] | string;

  [key: string]: unknown;
}

export type ProductCardVariant = 'modern-glass' | 'classic' | 'minimal' | 'horizontal';

export interface EditableProductCardProps extends React.HTMLAttributes<HTMLElement> {
  itemPath: string;
  product: ProductItem;
  cardVariant?: ProductCardVariant;
  imageFallback?: string;
  as?: React.ElementType;
  currency?: string;
  showBrand?: boolean;
  showPrice?: boolean;
  showDescription?: boolean;
  showCategory?: boolean;
  whatsappNumber?: string;
  storeName?: string;
  showWhatsAppButton?: boolean;
  showAddToCartButton?: boolean;
  whatsappActionLabel?: string;
  addToCartLabel?: string;
  actionSlot?: React.ReactNode;
  actionLabel?: string;
  actionLabelPath?: string;
  onAddToCart?: (product: ProductItem) => void;
  onWhatsAppClick?: (product: ProductItem, url: string) => void;
}

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

  // Dynamic Options, Measurements & Colors resolution
  const resolvedOptions = useMemo(
    () => resolveProductOptions(product as ProductOptionInput),
    [product]
  );

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [colorImage, setColorImage] = useState<string>('');

  // Sync if selection is no longer present in updated product (e.g. during live visual editing)
  useEffect(() => {
    if (selectedColor && !resolvedOptions.colors.some((c) => c.toLowerCase() === selectedColor.toLowerCase())) {
      setSelectedColor('');
      setColorImage('');
    }
  }, [product, resolvedOptions.colors]);

  useEffect(() => {
    if (selectedOption && !resolvedOptions.options.some((o) => o.toLowerCase() === selectedOption.toLowerCase())) {
      setSelectedOption('');
    }
  }, [product, resolvedOptions.options]);

  // Variant & Dynamic Price Resolution
  const resolvedPrice = useMemo(
    () => resolveVariantPrice(product as ProductOptionInput, selectedOption, selectedColor, currency),
    [product, selectedOption, selectedColor, currency]
  );

  const titleKey =
    'title' in (product || {}) && !('name' in (product || {}) && (product as any).name)
      ? 'title'
      : ('productName' in (product || {}) && !('name' in (product || {}) && (product as any).name)
        ? 'productName'
        : 'name');
  const name = String(
    product?.name || product?.title || (product as any)?.productName || (product as any)?.itemTitle || 'Untitled Product'
  );
  const brand = String(product?.brand || '');

  const rawPriceCandidate =
    product?.price ?? (product as any)?.cost ?? (product as any)?.amount ?? (product as any)?.productPrice;
  const basePriceNum =
    typeof rawPriceCandidate === 'number'
      ? rawPriceCandidate
      : parseFloat(String(rawPriceCandidate || '').replace(/[^0-9.]/g, '')) || 0;
  const baseFormattedPrice =
    rawPriceCandidate !== undefined && rawPriceCandidate !== null && String(rawPriceCandidate).trim() !== ''
      ? typeof rawPriceCandidate === 'string' &&
        (rawPriceCandidate.includes('LKR') || rawPriceCandidate.includes('-') || rawPriceCandidate.includes('–'))
        ? rawPriceCandidate
        : formatCurrency(basePriceNum, currency)
      : '';

  const displayPrice = resolvedPrice.formattedPrice || baseFormattedPrice;
  const hasPrice = showPrice && Boolean(displayPrice && displayPrice.trim() !== '');

  const priceKey =
    'cost' in (product || {}) && !('price' in (product || {}) && (product as any).price !== undefined)
      ? 'cost'
      : ('amount' in (product || {}) && !('price' in (product || {}) && (product as any).price !== undefined)
        ? 'amount'
        : 'price');

  const rawOriginalPrice = product?.originalPrice ?? (product as any)?.compareAtPrice;
  const baseOriginalPrice =
    rawOriginalPrice !== undefined && rawOriginalPrice !== null ? String(rawOriginalPrice) : '';
  const displayOriginalPrice = resolvedPrice.formattedOriginalPrice || baseOriginalPrice;

  const originalPriceKey =
    'compareAtPrice' in (product || {}) && !('originalPrice' in (product || {}) && (product as any).originalPrice !== undefined)
      ? 'compareAtPrice'
      : 'originalPrice';

  const descriptionKey =
    'desc' in (product || {}) && !('description' in (product || {}) && (product as any).description)
      ? 'desc'
      : 'description';
  const description = String(product?.description || (product as any)?.desc || (product as any)?.details || '');

  const category = String(product?.category || '');
  const badgeKey =
    'tag' in (product || {}) && !('badge' in (product || {}) && (product as any).badge) ? 'tag' : 'badge';
  const badge = String(product?.badge || (product as any)?.tag || '');

  const fallbackImage =
    imageFallback || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80';
  const rawImage =
    product?.imageUrl ||
    product?.image ||
    (product as any)?.photo ||
    (product as any)?.thumbnail ||
    (product as any)?.productImage ||
    (Array.isArray(product?.gallery) && product.gallery[0]) ||
    (Array.isArray(product?.images) && product.images[0]);
  const baseImageUrl = String(rawImage || fallbackImage);

  // Active image: clicked color image -> resolved variant image -> product base image
  const currentImage = colorImage || resolvedPrice.variantImage || baseImageUrl;
  const imageKey =
    'image' in (product || {}) && !('imageUrl' in (product || {}) && (product as any).imageUrl)
      ? 'image'
      : ('photo' in (product || {}) && !('imageUrl' in (product || {}) && (product as any).imageUrl)
        ? 'photo'
        : 'imageUrl');

  const resolvedPhone = String(product?.whatsappNumber || whatsappNumber || '94770000000');
  const resolvedWhatsAppText = String(product?.whatsappButtonText || whatsappActionLabel);
  const resolvedAddToCartText = String(product?.addToCartButtonText || addToCartLabel);

  const isHorizontal = cardVariant === 'horizontal';

  const handleColorClick = (c: { name: string; hex?: string; image?: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedColor.toLowerCase() === c.name.toLowerCase()) {
      setSelectedColor('');
      setColorImage('');
    } else {
      setSelectedColor(c.name);
      if (c.image) {
        setColorImage(c.image);
      } else {
        const v = (product.variants as any[])?.find(
          (item) =>
            String(item.color || '').trim().toLowerCase() === c.name.toLowerCase() &&
            (item.image || item.imageUrl || item.photo)
        );
        if (v) {
          setColorImage(v.image || v.imageUrl || v.photo);
        } else {
          setColorImage('');
        }
      }
    }
  };

  const handleOptionClick = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedOption.toLowerCase() === opt.toLowerCase()) {
      setSelectedOption('');
    } else {
      setSelectedOption(opt);
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getProductWhatsAppUrl(
      {
        ...product,
        name,
        brand,
        price: displayPrice,
        size: selectedOption || undefined,
        color: selectedColor || undefined,
        option: selectedOption || undefined,
      },
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
    const effectivePrice = resolvedPrice.numericPrice || basePriceNum;
    const variantSuffix = [selectedColor, selectedOption].filter(Boolean).join('-');
    const itemToAdd = {
      id:
        String(product?.id || name.toLowerCase().replace(/\s+/g, '-')) +
        (variantSuffix ? `-${variantSuffix}` : ''),
      name,
      brand,
      price: effectivePrice,
      image: currentImage,
      quantity: 1,
      size: selectedOption || undefined,
      color: selectedColor || undefined,
      option: selectedOption || undefined,
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
      backgroundColor: 'var(--product-card-bg, var(--card-bg, var(--color-surface, rgba(255, 255, 255, 0.85))))',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--product-card-border, var(--card-border, var(--color-border, rgba(226, 232, 240, 0.8))))',
      borderRadius: '16px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
      overflow: 'hidden',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
    },
    classic: {
      backgroundColor: 'var(--card-bg, var(--color-surface, #ffffff))',
      border: '1px solid var(--card-border, var(--color-border, #e2e8f0))',
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
      backgroundColor: 'var(--card-bg, var(--color-surface, #ffffff))',
      border: '1px solid var(--card-border, var(--color-border, #e2e8f0))',
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
          id={`${itemPath}.${imageKey}`}
          data-preview-field-path={`${itemPath}.${imageKey}`}
          src={currentImage}
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
              id={`${itemPath}.${badgeKey}`}
              data-preview-field-path={`${itemPath}.${badgeKey}`}
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
                  color: 'var(--tag-color, var(--muted-text, var(--color-muted, #64748b)))',
                  backgroundColor: 'var(--tag-bg, var(--color-secondary, rgba(241, 245, 249, 0.9)))',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              />
            ) : null}
          </div>

          {/* Product Title */}
          <EditableText
            as="h3"
            id={`${itemPath}.${titleKey}`}
            data-preview-field-path={`${itemPath}.${titleKey}`}
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
              id={`${itemPath}.${descriptionKey}`}
              data-preview-field-path={`${itemPath}.${descriptionKey}`}
              defaultValue={description}
              style={{
                fontSize: '0.875rem',
                color: 'var(--muted-text, #94a3b8)',
                lineHeight: 1.5,
                marginBottom: '0.625rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            />
          ) : null}

          {/* Interactive Color Swatches (Apparel & Multivariant Products) */}
          {resolvedOptions.detailedColors.length > 0 && (
            <div style={{ marginTop: '0.5rem', marginBottom: '0.375rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-text, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {product.colorsLabel ? String(product.colorsLabel) : 'Color'}
                </span>
                {selectedColor ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-accent, #a3e635)' }}>
                    {selectedColor}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
                {resolvedOptions.detailedColors.map((c) => {
                  const isSelected = selectedColor.toLowerCase() === c.name.toLowerCase();
                  const colorHex = c.hex || COLOR_HEX_MAP[c.name.toLowerCase()] || '#64748b';
                  const isLight = colorHex.toLowerCase() === '#ffffff' || colorHex.toLowerCase() === '#fff' || colorHex.toLowerCase() === '#fffdd0' || colorHex.toLowerCase() === '#f5f5dc';
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={(e) => handleColorClick(c, e)}
                      title={c.name}
                      aria-label={`Select color ${c.name}`}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '9999px',
                        backgroundColor: colorHex,
                        border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.2)',
                        outline: isSelected ? '2px solid var(--brand-accent, #a3e635)' : 'none',
                        outlineOffset: '2px',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.15s ease, outline 0.15s ease',
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        boxShadow: isSelected ? '0 0 8px rgba(163, 230, 53, 0.4)' : '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Size / Option Chips */}
          {resolvedOptions.options.length > 0 && (
            <div style={{ marginTop: '0.375rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-text, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {product.sizesLabel || product.optionsLabel ? String(product.sizesLabel || product.optionsLabel) : resolvedOptions.optionsLabel}
                </span>
                {selectedOption ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-accent, #a3e635)' }}>
                    {resolvedOptions.formatSelectedDisplay(selectedOption)}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {resolvedOptions.options.map((opt) => {
                  const isSelected = selectedOption.toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={(e) => handleOptionClick(opt, e)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        border: isSelected
                          ? '1px solid var(--brand-accent, #a3e635)'
                          : '1px solid var(--card-border, rgba(226, 232, 240, 0.4))',
                        backgroundColor: isSelected
                          ? 'var(--brand-accent, #a3e635)'
                          : 'var(--tag-bg, rgba(255, 255, 255, 0.08))',
                        color: isSelected
                          ? '#020617'
                          : 'var(--muted-text, #e2e8f0)',
                        transition: 'all 0.15s ease',
                        transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      }}
                    >
                      {resolvedOptions.formatOption(opt)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pricing and Dual Action Buttons */}
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: cardVariant === 'minimal' ? 'none' : '1px solid var(--card-border, var(--color-border, rgba(226, 232, 240, 0.7)))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Price Row (in LKR or currency, supporting price ranges and dynamic variant prices) */}
          {hasPrice ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <EditableText
                as="span"
                id={`${itemPath}.${priceKey}`}
                data-preview-field-path={`${itemPath}.${priceKey}`}
                defaultValue={displayPrice}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--brand-color, #ffffff)',
                  letterSpacing: '-0.02em',
                }}
              />
              {displayOriginalPrice ? (
                <EditableText
                  as="span"
                  id={`${itemPath}.${originalPriceKey}`}
                  data-preview-field-path={`${itemPath}.${originalPriceKey}`}
                  defaultValue={displayOriginalPrice}
                  style={{
                    fontSize: '0.875rem',
                    textDecoration: 'line-through',
                    color: 'var(--muted-text, #94a3b8)',
                  }}
                />
              ) : null}
              {product?.measurement && !selectedOption ? (
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
                    backgroundColor: 'var(--button-bg, var(--brand-color, #2563eb))',
                    color: 'var(--button-text, #ffffff)',
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
                    style={{ color: 'var(--button-text, #ffffff)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
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

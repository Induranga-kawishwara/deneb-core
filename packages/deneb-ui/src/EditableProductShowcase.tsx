'use client';

import React, { useState, useMemo } from 'react';
import { useSiteData } from './SiteDataProvider';

export interface ProductShowcaseColor {
  name: string;
  hex: string;
}

export interface ProductShowcaseItem {
  id?: string | number;
  name?: string;
  title?: string;
  brand?: string;
  subtitle?: string;
  price?: string | number;
  compareAtPrice?: string | number;
  originalPrice?: string | number;
  condition?: string;
  category?: string;
  image?: string;
  imageUrl?: string;
  badge?: string;
  colors?: Array<ProductShowcaseColor | string>;
  isAvailable?: boolean;
  [key: string]: unknown;
}

export interface EditableProductShowcaseProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Field path prefix for live Fivora visual editing synchronization (e.g. "home").
   */
  sectionPath?: string;

  /**
   * List path under sectionPath (default: "featuredPhones").
   */
  listPath?: string;

  /**
   * Badge / tagline label displayed above the section title.
   */
  badge?: string;

  /**
   * Section heading text.
   */
  heading?: string;

  /**
   * Section description text.
   */
  description?: string;

  /**
   * Products array. If omitted, pulls live products from siteData.
   */
  products?: ProductShowcaseItem[];

  /**
   * Currency symbol or code (default: "Rs").
   */
  currency?: string;

  /**
   * Free courier or shipping label (default: "Free Insured Courier").
   */
  shippingLabel?: string;

  /**
   * WhatsApp button order label (default: "Order via WhatsApp").
   */
  whatsappOrderLabel?: string;

  /**
   * Category filter list (e.g. ['All', 'Apple', 'Samsung', 'Google', 'Refurbished']).
   * If omitted, derived automatically from product categories/brands.
   */
  categories?: string[];

  /**
   * Callback when user clicks quick view eye icon.
   */
  onQuickView?: (product: ProductShowcaseItem, index: number) => void;

  /**
   * Base route for product detail pages (default: "/products/detail").
   * Compatible with Fivora generated-site-product-route.ts middleware.
   */
  productDetailRoutePrefix?: string;

  className?: string;
}

const DEFAULT_PRODUCTS: ProductShowcaseItem[] = [
  {
    id: 'phone-iphone-16-pro',
    name: 'iPhone 16 Pro Max',
    brand: 'Apple',
    subtitle: 'Grade 5 Titanium · A18 Pro 3nm',
    price: 1199,
    originalPrice: 1299,
    condition: 'Brand New',
    category: 'Apple',
    colors: [
      { name: 'Desert Titanium', hex: '#bba795' },
      { name: 'Natural Titanium', hex: '#9d9890' },
      { name: 'White Titanium', hex: '#f0ede6' },
      { name: 'Black Titanium', hex: '#393836' },
    ],
    image: '/images/showcase-phone.jpg',
    badge: 'Popular Flagship',
  },
  {
    id: 'phone-galaxy-s25-ultra',
    name: 'Galaxy S25 Ultra',
    brand: 'Samsung',
    subtitle: 'Armor Titanium · Snapdragon 8 Elite',
    price: 1299,
    originalPrice: 1399,
    condition: 'Brand New',
    category: 'Samsung',
    colors: [
      { name: 'Titanium Gray', hex: '#5e6166' },
      { name: 'Titanium Black', hex: '#26282b' },
      { name: 'Titanium Violet', hex: '#4d4359' },
      { name: 'Titanium Yellow', hex: '#d4c794' },
    ],
    image: '/images/s24-ultra.jpg',
    badge: 'AI Flagship',
  },
  {
    id: 'phone-pixel-9-pro',
    name: 'Pixel 9 Pro XL',
    brand: 'Google',
    subtitle: 'Google Tensor G4 · Gemini Nano',
    price: 1099,
    originalPrice: 1199,
    condition: 'Brand New',
    category: 'Google',
    colors: [
      { name: 'Obsidian', hex: '#222326' },
      { name: 'Porcelain', hex: '#ebe7de' },
      { name: 'Hazel', hex: '#878c7f' },
      { name: 'Rose', hex: '#e3b8b6' },
    ],
    image: '/images/pixel-9.jpg',
    badge: 'Pro Optics',
  },
];

/**
 * EditableProductShowcase
 *
 * Elite, fully editable product showcase section featuring:
 * - Direct showroom badge, section title & description with Fivora live bindings
 * - Category filter pills with active state
 * - Glassmorphism product cards with hover glow and transform transitions
 * - Interactive color swatch buttons and active color label bindings ([DNB-COL-009])
 * - Strikethrough compare-at price ([DNB-COL-009])
 * - Full-width WhatsApp order button with dynamic merchant URL resolution ([DNB-WHA-008])
 * - Guarded image fallback against empty strings ([DNB-IMG-002])
 * - Aligned with Fivora generated-site product routing (/products/detail/?id=...)
 */
export function EditableProductShowcase({
  sectionPath = 'home',
  listPath = 'featuredPhones',
  badge = 'Direct Showroom & Verified Refurbished',
  heading = 'Upgrade Your Everyday.',
  description = 'Brand new flagships and laboratory-certified refurbished devices. 100% genuine components, clean IMEI, and up to 12 months comprehensive warranty.',
  products: userProducts,
  currency = 'Rs',
  shippingLabel = 'Free Insured Courier',
  whatsappOrderLabel = 'Order via WhatsApp',
  categories,
  onQuickView,
  productDetailRoutePrefix = '/products/detail',
  className = '',
  ...props
}: EditableProductShowcaseProps) {
  const siteData = useSiteData();
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [selectedColors, setSelectedColors] = useState<Record<string, number>>({});

  // Resolve section content from siteData
  const secContent = (siteData?.content as Record<string, any>)?.[sectionPath] || {};
  const resolvedBadge = secContent.featuredProductsBadge || secContent.badge || badge;
  const resolvedHeading = secContent.featuredProductsHeading || secContent.heading || heading;
  const resolvedDescription = secContent.featuredProductsDescription || secContent.description || description;

  // Resolve raw products list
  const liveList = secContent[listPath] || (siteData?.content as any)?.products;
  const rawProducts = Array.isArray(userProducts) && userProducts.length > 0
    ? userProducts
    : (Array.isArray(liveList) && liveList.length > 0 ? liveList : DEFAULT_PRODUCTS);

  // Normalize product items
  const normalizedProducts: (ProductShowcaseItem & { _index: number })[] = useMemo(() => {
    return rawProducts.map((item: any, idx: number) => {
      const def = DEFAULT_PRODUCTS[idx] || DEFAULT_PRODUCTS[0];
      const rawColors = item.colors || def.colors || [{ name: 'Default', hex: '#9d9890' }];
      const normalizedColors: ProductShowcaseColor[] = (
        Array.isArray(rawColors) ? rawColors : Object.values(rawColors)
      ).map((c: any, cIdx: number) => {
        if (typeof c === 'string') return { name: `Color ${cIdx + 1}`, hex: c };
        return { name: c?.name || `Color ${cIdx + 1}`, hex: c?.hex || '#9d9890' };
      });

      const resolvedImage =
        item.image && typeof item.image === 'string' && item.image.trim() !== ''
          ? item.image
          : (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim() !== ''
              ? item.imageUrl
              : (def.image || '/images/showcase-phone.jpg'));

      return {
        ...def,
        ...item,
        _index: idx,
        id: item.id || `product-${idx}`,
        name: item.name || item.title || def.name,
        brand: item.brand || item.category || def.brand || 'Store',
        subtitle: item.subtitle || def.subtitle || '',
        price: item.price != null ? Number(item.price) : def.price,
        originalPrice:
          item.originalPrice != null
            ? Number(item.originalPrice)
            : (item.compareAtPrice != null ? Number(item.compareAtPrice) : def.originalPrice),
        condition: item.condition || def.condition || 'Brand New',
        category: item.category || item.brand || def.category || 'All',
        badge: item.badge || def.badge || '',
        image: resolvedImage,
        colors: normalizedColors.length > 0 ? normalizedColors : [{ name: 'Default', hex: '#9d9890' }],
      };
    });
  }, [rawProducts]);

  // Derived category list
  const resolvedCategories = useMemo(() => {
    if (Array.isArray(categories) && categories.length > 0) return categories;
    const set = new Set<string>(['All']);
    for (const p of normalizedProducts) {
      if (p.brand) set.add(p.brand);
      if (p.category && p.category !== p.brand) set.add(p.category);
    }
    return Array.from(set);
  }, [categories, normalizedProducts]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (selectedFilter === 'All') return normalizedProducts;
    return normalizedProducts.filter((p) => {
      const matchBrand = p.brand?.toLowerCase() === selectedFilter.toLowerCase();
      const matchCat = p.category?.toLowerCase() === selectedFilter.toLowerCase();
      const matchCond = p.condition?.toLowerCase().includes(selectedFilter.toLowerCase());
      return matchBrand || matchCat || matchCond;
    });
  }, [normalizedProducts, selectedFilter]);

  // Resolve merchant WhatsApp target dynamically ([DNB-WHA-008])
  const rawWhatsAppTarget =
    secContent.whatsappOrderUrl ||
    secContent.whatsappNumber ||
    (siteData?.content as any)?.common?.business?.whatsapp ||
    (siteData?.content as any)?.merchant?.whatsapp ||
    'https://wa.me/15550192834';

  const handleWhatsAppOrder = (product: ProductShowcaseItem, colorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const productName = product.name || product.title || 'Product';
    const message = `Hi, I would like to order: *${productName}* (${product.brand || 'Flagship'}, Color: ${colorName}, Price: ${currency} ${product.price}). Is it available?`;

    let targetUrl = (rawWhatsAppTarget || '').trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const cleanNum = targetUrl.replace(/[^0-9]/g, '');
      targetUrl = `https://wa.me/${cleanNum || '15550192834'}`;
    }
    const sep = targetUrl.includes('?') ? '&' : '?';
    const url = `${targetUrl}${sep}text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section
      id="shop"
      className={`relative py-20 sm:py-28 overflow-clip bg-white ${className}`}
      {...props}
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute top-10 right-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16 gap-6">
          <div className="max-w-2xl">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-700 mb-4">
              <span
                data-preview-field-path={`${sectionPath}.featuredProductsBadge`}
                data-preview-style-target={`${sectionPath}.featuredProductsBadge`}
                data-preview-style-type="text"
              >
                {resolvedBadge}
              </span>
            </div>

            {/* Main Heading */}
            <h2
              className="text-3xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight"
              data-preview-field-path={`${sectionPath}.featuredProductsHeading`}
              data-preview-style-target={`${sectionPath}.featuredProductsHeading`}
              data-preview-style-type="text"
            >
              {resolvedHeading}
            </h2>

            {/* Description */}
            <p
              className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed"
              data-preview-field-path={`${sectionPath}.featuredProductsDescription`}
              data-preview-style-target={`${sectionPath}.featuredProductsDescription`}
              data-preview-style-type="text"
            >
              {resolvedDescription}
            </p>
          </div>

          {/* Category Filter Tabs */}
          {resolvedCategories.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl border border-black/[0.08] bg-black/[0.02] backdrop-blur-md self-start md:self-auto">
              {resolvedCategories.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  data-preview-static="category-filter-pill"
                  onClick={() => setSelectedFilter(filter)}
                  className={`rounded-xl px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    selectedFilter === filter
                      ? 'bg-zinc-950 text-white shadow-md'
                      : 'text-zinc-600 hover:text-black hover:bg-black/5'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Cards Grid */}
        <ul
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 list-none p-0 m-0"
          data-preview-list-path={`${sectionPath}.${listPath}`}
          data-preview-style-target={`${sectionPath}.${listPath}.grid`}
          data-preview-style-type="grid"
        >
          {filteredProducts.map((phone) => {
            const idx = phone._index;
            const phoneId = String(phone.id || idx);
            const activeColorIdx = selectedColors[phoneId] ?? 0;
            const colorsList = (phone.colors as ProductShowcaseColor[]) || [];
            const activeColor = colorsList[activeColorIdx] || colorsList[0] || { name: 'Default', hex: '#9d9890' };
            const detailUrl = `${productDetailRoutePrefix}/?id=${encodeURIComponent(phoneId)}`;

            return (
              <li
                key={phoneId}
                data-preview-item-path={`${sectionPath}.${listPath}[${idx}]`}
                data-preview-style-target={`${sectionPath}.${listPath}[${idx}].card`}
                data-preview-style-type="card"
                className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl border border-black/[0.08] bg-white/95 hover:border-cyan-400/60 transition-all duration-300 hover:-translate-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,240,255,0.12)]"
              >
                <div>
                  {/* Top Bar: Brand, Title, Subtitle, Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest text-cyan-600 font-mono"
                        data-preview-field-path={`${sectionPath}.${listPath}[${idx}].brand`}
                        data-preview-style-target={`${sectionPath}.${listPath}[${idx}].brand`}
                        data-preview-style-type="text"
                      >
                        {phone.brand}
                      </span>
                      <h3
                        className="mt-1 text-xl font-bold text-zinc-950 tracking-tight group-hover:text-cyan-600 transition-colors"
                        data-preview-field-path={`${sectionPath}.${listPath}[${idx}].name`}
                        data-preview-style-target={`${sectionPath}.${listPath}[${idx}].name`}
                        data-preview-style-type="text"
                      >
                        <a href={detailUrl} className="hover:underline">
                          {phone.name}
                        </a>
                      </h3>
                      {phone.subtitle && (
                        <p
                          className="text-xs text-zinc-500 mt-0.5"
                          data-preview-field-path={`${sectionPath}.${listPath}[${idx}].subtitle`}
                          data-preview-style-target={`${sectionPath}.${listPath}[${idx}].subtitle`}
                          data-preview-style-type="text"
                        >
                          {phone.subtitle}
                        </p>
                      )}
                    </div>

                    {phone.badge && (
                      <span
                        className="shrink-0 rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-0.5 text-[10px] font-semibold text-zinc-700 backdrop-blur-md"
                        data-preview-field-path={`${sectionPath}.${listPath}[${idx}].badge`}
                        data-preview-style-target={`${sectionPath}.${listPath}[${idx}].badge`}
                        data-preview-style-type="text"
                      >
                        {phone.badge}
                      </span>
                    )}
                  </div>

                  {/* Center Product Image Container */}
                  <div className="relative my-6 h-60 w-full overflow-clip rounded-2xl border border-black/[0.06] bg-slate-100 flex items-center justify-center">
                    <img
                      src={phone.image}
                      alt={phone.name || 'Product Image'}
                      data-preview-field-path={`${sectionPath}.${listPath}[${idx}].image`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
                  </div>

                  {/* Interactive Color Circles & Condition ([DNB-COL-009]) */}
                  <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                    <div
                      className="flex items-center gap-1.5"
                      data-preview-list-path={`${sectionPath}.${listPath}[${idx}].colors`}
                    >
                      {colorsList.map((c, colorIdx) => (
                        <div
                          key={c.name || colorIdx}
                          data-preview-item-path={`${sectionPath}.${listPath}[${idx}].colors[${colorIdx}]`}
                          className="inline-flex items-center"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedColors((prev) => ({ ...prev, [phoneId]: colorIdx }));
                            }}
                            aria-label={c.name}
                            title={c.name}
                            className={`h-4 w-4 rounded-full transition-all cursor-pointer ${
                              activeColorIdx === colorIdx
                                ? 'ring-2 ring-cyan-500 ring-offset-1 ring-offset-white scale-110'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex || '#9d9890' }}
                            data-preview-field-path={`${sectionPath}.${listPath}[${idx}].colors[${colorIdx}].hex`}
                            data-preview-field-type="color"
                          />
                          <span
                            className="sr-only"
                            data-preview-field-path={`${sectionPath}.${listPath}[${idx}].colors[${colorIdx}].name`}
                            data-preview-style-target={`${sectionPath}.${listPath}[${idx}].colors[${colorIdx}].name`}
                            data-preview-style-type="text"
                          >
                            {c.name}
                          </span>
                        </div>
                      ))}
                      <span
                        className="text-[11px] text-zinc-500 ml-1.5 [display:none] sm:inline cursor-pointer"
                        data-preview-field-path={`${sectionPath}.${listPath}[${idx}].colors[${activeColorIdx}].name`}
                        data-preview-style-target={`${sectionPath}.${listPath}[${idx}].colors[${activeColorIdx}].name`}
                        data-preview-style-type="text"
                      >
                        {activeColor.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <span
                        data-preview-field-path={`${sectionPath}.${listPath}[${idx}].condition`}
                        data-preview-style-target={`${sectionPath}.${listPath}[${idx}].condition`}
                        data-preview-style-type="text"
                      >
                        {phone.condition || 'Brand New'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Price, Original Price, Quick View & WhatsApp Order Button */}
                <div className="mt-6 pt-4 border-t border-black/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-zinc-500">{currency}</span>
                        <span
                          className="text-2xl font-black text-zinc-950 tracking-tight"
                          data-preview-field-path={`${sectionPath}.${listPath}[${idx}].price`}
                          data-preview-style-target={`${sectionPath}.${listPath}[${idx}].price`}
                          data-preview-style-type="text"
                        >
                          {phone.price}
                        </span>
                        {phone.originalPrice != null && (
                          <span
                            className="text-xs text-zinc-400 line-through"
                            data-preview-field-path={`${sectionPath}.${listPath}[${idx}].originalPrice`}
                            data-preview-style-target={`${sectionPath}.${listPath}[${idx}].originalPrice`}
                            data-preview-style-type="text"
                          >
                            {currency} {phone.originalPrice}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[10px] text-zinc-500 mt-0.5"
                        data-preview-field-path={`${sectionPath}.${listPath}[${idx}].shippingLabel`}
                        data-preview-style-target={`${sectionPath}.${listPath}[${idx}].shippingLabel`}
                        data-preview-style-type="text"
                      >
                        {shippingLabel}
                      </p>
                    </div>

                    {/* Quick View Eye Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onQuickView) onQuickView(phone, idx);
                        else if (typeof window !== 'undefined') window.location.href = detailUrl;
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-black/[0.02] text-zinc-600 hover:text-cyan-600 hover:border-cyan-400/50 hover:bg-cyan-50/50 transition-all cursor-pointer"
                      title="Quick View"
                      aria-label="Quick View Product"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>

                  {/* Full-width WhatsApp Order Button ([DNB-WHA-008]) */}
                  <button
                    type="button"
                    onClick={(e) => handleWhatsAppOrder(phone, activeColor.name, e)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-600 py-3 px-4 text-xs font-bold text-white shadow-[0_4px_15px_rgba(0,240,255,0.25)] hover:shadow-[0_6px_25px_rgba(0,240,255,0.45)] transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.055-.992-.061-.635-.206-1.464-.567-2.527-1.63-1.341-1.341-1.849-2.531-2.006-2.986-.157-.455-.015-.81.212-1.037.202-.202.455-.253.606-.253.152 0 .303.004.436.012.141.008.329-.053.515.394.192.465.657 1.602.714 1.719.057.116.096.253.019.405-.076.152-.114.248-.228.38-.114.133-.24.296-.343.397-.114.114-.233.238-.1.467.133.228.591.976 1.269 1.58 1.077.959 1.83 1.157 2.058 1.271.228.114.362.096.495-.057.133-.152.571-.666.723-.894.152-.228.303-.19.515-.114.212.076 1.346.635 1.575.749.228.114.38.171.436.266.057.095.057.553-.087.958z" />
                    </svg>
                    <span
                      data-preview-field-path={`${sectionPath}.whatsappOrderLabel`}
                      data-preview-style-target={`${sectionPath}.whatsappOrderLabel`}
                      data-preview-style-type="text"
                    >
                      {whatsappOrderLabel}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export { EditableProductShowcase as ProductShowcase };

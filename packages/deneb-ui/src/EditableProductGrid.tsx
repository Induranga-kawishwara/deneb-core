import React, { useState, useMemo } from 'react';
import { EditableProductCard, ProductItem, ProductCardVariant } from './EditableProductCard';
import { useProducts } from './SiteDataProvider';

export interface EditableProductGridProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Field path prefix for live Fivora Visual Editing synchronization (e.g. "home").
   */
  sectionPath?: string;

  /**
   * Collection path for products (default: "products").
   * When set, products are iterated with standard array indexing (e.g. "products[0]").
   */
  listPath?: string;

  /**
   * Title of the product grid section.
   */
  title?: string;

  /**
   * Subtitle or category tag for the grid section.
   */
  subtitle?: string;

  /**
   * Array of product items. If omitted or empty, automatically pulls live products using useProducts().
   */
  products?: ProductItem[];

  /**
   * Optional category filter tabs (e.g. ['All', 'Sneakers', 'Performance', 'Lifestyle']).
   * If omitted, automatically derived from product categories.
   */
  categories?: string[];

  /**
   * Card visual variant: 'modern-glass' | 'classic' | 'minimal' | 'horizontal'.
   */
  cardVariant?: ProductCardVariant;

  /**
   * Responsive columns configuration.
   */
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };

  /**
   * Callback when a user clicks the quick view action on a card.
   */
  onQuickView?: (product: ProductItem, itemPath: string) => void;

  /**
   * Custom field path prefix for individual cards (default: "product").
   * e.g. "home.product1", "home.product2", etc.
   */
  cardPrefix?: string;

  className?: string;
}

/**
 * EditableProductGrid is an elite, fully responsive e-commerce showcase grid
 * with interactive category filtering, live Fivora visual editing synchronization,
 * automatic useProducts() fallback rehydration, and built-in Quick View modal triggers.
 *
 * Created by Chamika Gayashan & Induranga Kawishwara
 */
export function EditableProductGrid({
  sectionPath = 'home',
  listPath = 'products',
  title = 'Featured Collection',
  subtitle = 'Just Dropped',
  products: userProducts,
  categories = ['All'],
  cardVariant = 'modern-glass',
  columns = { mobile: 1, tablet: 2, desktop: 4 },
  onQuickView,
  cardPrefix = 'product',
  className = '',
  style,
  ...props
}: EditableProductGridProps) {
  const liveProducts = useProducts();
  const products = userProducts && userProducts.length > 0 ? userProducts : liveProducts;

  const resolvedCategories = useMemo(() => {
    if (categories && categories.length > 1) {
      return categories;
    }
    const distinct = Array.from(
      new Set(
        products
          .map((p) => p.category)
          .filter((cat): cat is string => typeof cat === 'string' && cat.trim().length > 0)
      )
    );
    return distinct.length > 0 ? ['All', ...distinct] : categories;
  }, [categories, products]);

  const [activeCategory, setActiveCategory] = useState<string>(categories[0] || 'All');

  const filteredProducts = useMemo(() => {
    if (!activeCategory || activeCategory.toLowerCase() === 'all') {
      return products;
    }
    return products.filter((p) => {
      const cat = String(p.category || '').toLowerCase();
      return cat === activeCategory.toLowerCase();
    });
  }, [products, activeCategory]);

  // Map column config to CSS grid class names
  const gridColClasses = useMemo(() => {
    const m = columns.mobile || 1;
    const t = columns.tablet || 2;
    const d = columns.desktop || 4;

    const mClass = m === 2 ? 'grid-cols-2' : 'grid-cols-1';
    const tClass = t === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
    const dClass = d === 3 ? 'lg:grid-cols-3' : d === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-4';

    return `${mClass} ${tClass} ${dClass}`;
  }, [columns]);

  return (
    <section
      data-preview-page-key={sectionPath}
      className={`editable-product-grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${className}`.trim()}
      style={style}
      {...(props as any)}
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          {subtitle && (
            <span
              data-preview-field-path={`${sectionPath}.gridSubtitle`}
              className="text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-lime-400 block mb-2"
            >
              {subtitle}
            </span>
          )}
          <h2
            data-preview-field-path={`${sectionPath}.gridTitle`}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
          >
            {title}
          </h2>
        </div>

        {/* Category Pills Filter */}
        {resolvedCategories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {resolvedCategories.map((cat) => {
              const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md scale-102 font-extrabold'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-200/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-white dark:border-slate-800/80 dark:hover:bg-slate-850'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of Products */}
      {filteredProducts.length > 0 ? (
        <div
          {...(listPath ? { 'data-preview-list-path': listPath } : {})}
          className={`deneb-product-grid grid ${gridColClasses} gap-6 sm:gap-8`}
        >
          {filteredProducts.map((product, idx) => {
            const itemPath = listPath
              ? `${listPath}[${idx}]`
              : `${sectionPath}.${cardPrefix}${idx + 1}`;
            return (
              <div
                key={product.id || idx}
                data-preview-item-path={itemPath}
                className="relative group"
              >
                <EditableProductCard
                  itemPath={itemPath}
                  product={product}
                  cardVariant={cardVariant}
                  className="h-full"
                />

                {/* Quick View Hover Button */}
                {onQuickView && (
                  <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      type="button"
                      onClick={() => onQuickView(product, itemPath)}
                      className="p-2.5 rounded-xl bg-slate-950/80 backdrop-blur-md text-white hover:bg-lime-400 hover:text-slate-950 shadow-lg transition-all active:scale-95"
                      title="Quick View"
                      aria-label={`Quick View ${product.name || product.title}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30">
          <p className="text-sm font-medium text-slate-400">
            No products found matching category &quot;{activeCategory}&quot;.
          </p>
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-lime-400 text-slate-950 hover:bg-lime-300 transition-colors"
          >
            View All Products
          </button>
        </div>
      )}
    </section>
  );
}

// Canonical alias
export const ProductGrid = EditableProductGrid;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { EditableProductCard, ProductItem, ProductCardVariant } from './EditableProductCard';
import { useProducts, useSiteApi, useSiteData, isRecord } from './SiteDataProvider';

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

  /**
   * Whether to display the live search bar above the product grid (default: true).
   */
  showSearch?: boolean;

  /**
   * Custom placeholder text for the search input.
   */
  searchPlaceholder?: string;

  /**
   * Whether to enable live backend catalog search when query is typed (default: true).
   */
  enableBackendSearch?: boolean;

  /**
   * Callback fired whenever the search query changes.
   */
  onSearchChange?: (query: string) => void;

  /**
   * Whether to enable pagination for the product grid (default: true).
   */
  enablePagination?: boolean;

  /**
   * Number of products to display per page (default: 8).
   */
  pageSize?: number;

  /**
   * Selectable page size options for the dropdown selector (e.g. [8, 16, 24, 48]).
   */
  pageSizeOptions?: number[];

  /**
   * Whether to show the page size selector dropdown (default: false).
   */
  showPageSizeSelector?: boolean;

  /**
   * Pagination visual display variant:
   * - 'numbers': Standard numbered buttons with smart ellipsis and Prev/Next (default)
   * - 'simple': Minimal Previous / Next controls with page indicator
   * - 'load-more': Progressive infinite-style "Load More Products" button
   */
  paginationVariant?: 'numbers' | 'simple' | 'load-more';

  /**
   * Whether to automatically hide pagination controls when all products fit on a single page (default: true).
   */
  hidePaginationOnSinglePage?: boolean;

  /**
   * Controlled active page number (1-indexed).
   */
  currentPage?: number;

  /**
   * Initial page number when uncontrolled (default: 1).
   */
  initialPage?: number;

  /**
   * Callback fired when the active page changes.
   */
  onPageChange?: (page: number) => void;

  /**
   * Whether to smoothly scroll to the top of the grid section when the page changes (default: true).
   */
  scrollToTopOnPageChange?: boolean;

  /**
   * Total products count override when backend performs server-side pagination slicing.
   */
  totalProducts?: number;

  className?: string;
}

/**
 * EditableProductGrid is an elite, fully responsive e-commerce showcase grid
 * with interactive category filtering, live Fivora visual editing synchronization,
 * smart multi-variant pagination, automatic useProducts() fallback rehydration,
 * and built-in Quick View modal triggers.
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
  showSearch = true,
  searchPlaceholder = 'Search products by name, brand, or tag...',
  enableBackendSearch = true,
  onSearchChange,
  enablePagination = true,
  pageSize = 8,
  pageSizeOptions = [8, 16, 24, 48],
  showPageSizeSelector = false,
  paginationVariant = 'numbers',
  hidePaginationOnSinglePage = true,
  currentPage: controlledPage,
  initialPage = 1,
  onPageChange,
  scrollToTopOnPageChange = true,
  totalProducts,
  className = '',
  style,
  ...props
}: EditableProductGridProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const siteData = useSiteData();
  const siteApi = useSiteApi();
  const liveProducts = useProducts();
  const baseProducts = userProducts && userProducts.length > 0 ? userProducts : liveProducts;

  const resolvedListPath = useMemo(() => {
    if (listPath && listPath !== 'products') {
      return listPath;
    }
    const content = isRecord(siteData?.content) ? (siteData.content as Record<string, unknown>) : null;
    if (!content) return listPath || 'products';

    if (Array.isArray(content.products) && content.products.length > 0) return 'products';
    if (isRecord(content.shop) && Array.isArray((content.shop as Record<string, unknown>).products)) return 'shop.products';
    if (isRecord(content.home) && Array.isArray((content.home as Record<string, unknown>).products)) return 'home.products';
    if (isRecord(content.home) && Array.isArray((content.home as Record<string, unknown>).featuredProducts)) return 'home.featuredProducts';
    if (isRecord(content.catalog) && Array.isArray((content.catalog as Record<string, unknown>).products)) return 'catalog.products';
    if (isRecord(content.menu) && Array.isArray((content.menu as Record<string, unknown>).items)) return 'menu.items';
    if (isRecord(content.menu) && Array.isArray((content.menu as Record<string, unknown>).products)) return 'menu.products';
    if (isRecord(content.store) && Array.isArray((content.store as Record<string, unknown>).products)) return 'store.products';
    if (isRecord(content.shop) && Array.isArray((content.shop as Record<string, unknown>).items)) return 'shop.items';

    return listPath || 'products';
  }, [listPath, siteData]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const [backendProducts, setBackendProducts] = useState<ProductItem[] | null>(null);

  // Pagination internal state
  const [internalPage, setInternalPage] = useState(initialPage);
  const activePage = controlledPage !== undefined ? controlledPage : internalPage;
  const [activePageSize, setActivePageSize] = useState(pageSize);
  const [loadedCount, setLoadedCount] = useState(pageSize);

  // Sync internal page size if prop changes
  useEffect(() => {
    if (pageSize) {
      setActivePageSize(pageSize);
    }
  }, [pageSize]);

  // Use backend search results if available, else fallback to baseProducts
  const products = backendProducts && backendProducts.length > 0 ? backendProducts : baseProducts;

  // Live backend catalog search when query changes
  useEffect(() => {
    if (!enableBackendSearch || !searchQuery.trim()) {
      setBackendProducts(null);
      return;
    }

    const catalogUrl =
      siteApi?.catalogUrl ||
      (siteData?.siteInstance?.slug ? `/site-catalog/${siteData.siteInstance.slug}` : null);

    const slug = siteData?.siteInstance?.slug;
    const isPreviewMode =
      typeof window !== 'undefined' &&
      (window.location.pathname.includes('/template-preview/') ||
        window.location.pathname.includes('/preview/'));

    if (
      !catalogUrl ||
      isPreviewMode ||
      slug === 'template-validation' ||
      catalogUrl.includes('/template-validation/')
    ) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setIsSearchingBackend(true);
        const sep = catalogUrl.includes('?') ? '&' : '?';
        const url = `${catalogUrl}${sep}q=${encodeURIComponent(searchQuery.trim())}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.products || data.items || []);
          if (active && Array.isArray(items) && items.length > 0) {
            setBackendProducts(items);
          }
        }
      } catch {
        // Fallback to client-side filtering cleanly
      } finally {
        if (active) setIsSearchingBackend(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, enableBackendSearch, siteApi, siteData]);

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

  // Reset to page 1 whenever category or search query changes
  useEffect(() => {
    setInternalPage(1);
    setLoadedCount(activePageSize);
    onPageChange?.(1);
  }, [searchQuery, activeCategory, activePageSize]);

  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by category
    if (activeCategory && activeCategory.toLowerCase() !== 'all') {
      result = result.filter((p) => {
        const cat = String(p.category || '').toLowerCase();
        return cat === activeCategory.toLowerCase();
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        const name = String(p.name || p.title || (p as any).productName || (p as any).itemTitle || '').toLowerCase();
        const desc = String(p.description || (p as any).desc || (p as any).details || '').toLowerCase();
        const brand = String(p.brand || '').toLowerCase();
        const cat = String(p.category || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
        const badge = String(p.badge || (p as any).tag || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || brand.includes(q) || cat.includes(q) || tags.includes(q) || badge.includes(q);
      });
    }

    return result;
  }, [products, activeCategory, searchQuery]);

  // Total count calculation
  const totalItems = totalProducts !== undefined ? totalProducts : filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / activePageSize));

  // Products to render based on pagination mode
  const displayedProducts = useMemo(() => {
    if (!enablePagination) {
      return filteredProducts;
    }
    if (paginationVariant === 'load-more') {
      return filteredProducts.slice(0, loadedCount);
    }
    const startIndex = (activePage - 1) * activePageSize;
    const endIndex = startIndex + activePageSize;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, enablePagination, paginationVariant, loadedCount, activePage, activePageSize]);

  // Smart page numbers calculation with ellipsis (e.g. 1 ... 4 5 6 ... 10)
  const visiblePages = useMemo((): Array<number | 'ellipsis'> => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis', activePage - 1, activePage, activePage + 1, 'ellipsis', totalPages];
  }, [activePage, totalPages]);

  // Page navigation handler
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === activePage) return;
    if (controlledPage === undefined) {
      setInternalPage(newPage);
    }
    onPageChange?.(newPage);

    if (scrollToTopOnPageChange && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLoadMore = () => {
    setLoadedCount((prev) => Math.min(prev + activePageSize, filteredProducts.length));
  };

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

  const shouldShowPagination = enablePagination && !(hidePaginationOnSinglePage && totalPages <= 1);

  return (
    <section
      ref={sectionRef}
      data-preview-page-key={sectionPath}
      className={`editable-product-grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${className}`.trim()}
      style={style}
      {...(props as any)}
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
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

      {/* Interactive Live Search Bar */}
      {showSearch && (
        <div className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-400 dark:focus:ring-lime-400 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onSearchChange?.('');
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Results Counter & Live Indicator */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {isSearchingBackend && (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-lime-400 font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span>
                Searching live catalog...
              </span>
            )}
            <span className="font-semibold bg-slate-100 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              Showing <span className="text-slate-900 dark:text-white font-bold">{filteredProducts.length}</span> of {products.length} products
            </span>
          </div>
        </div>
      )}

      {/* Grid of Products — Keeps container with data-preview-list-path mounted in all states for strict Fivora visual editing contract! */}
      <div
        {...(resolvedListPath ? { 'data-preview-list-path': resolvedListPath } : {})}
        className={
          displayedProducts.length > 0
            ? `deneb-product-grid grid ${gridColClasses} gap-6 sm:gap-8`
            : 'deneb-product-grid-empty w-full'
        }
      >
        {displayedProducts.length > 0 ? (
          displayedProducts.map((product, idx) => {
            // Determine true index in baseProducts for exact Fivora visual editing focus targeting
            const baseIndex = baseProducts.findIndex(
              (bp) =>
                (bp.id && product.id ? String(bp.id) === String(product.id) : false) ||
                (bp.name && product.name ? bp.name === product.name : false) ||
                (bp.title && product.title ? bp.title === product.title : false) ||
                ((bp as any).productName && (product as any).productName ? (bp as any).productName === (product as any).productName : false)
            );
            const effectiveIndex =
              baseIndex !== -1 ? baseIndex : (activePage - 1) * activePageSize + idx;

            const itemPath = resolvedListPath
              ? `${resolvedListPath}[${effectiveIndex}]`
              : `${sectionPath}.${cardPrefix}${effectiveIndex + 1}`;

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
          })
        ) : (
          /* Empty State — strictly inside the listPath container */
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 w-full">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              No products found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No products matched "${searchQuery}"${activeCategory !== 'All' ? ` in category "${activeCategory}"` : ''}.`
                : `No products available in category "${activeCategory}".`}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Clear Search
                </button>
              )}
              {activeCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => setActiveCategory('All')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-lime-400 text-slate-950 hover:bg-lime-300 transition-colors shadow-sm"
                >
                  View All Products
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {shouldShowPagination && (
        <>
          {paginationVariant === 'load-more' ? (
            /* Progressive "Load More" Variant */
            <div className="mt-12 flex flex-col items-center justify-center gap-3 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing <strong className="text-slate-900 dark:text-white">{displayedProducts.length}</strong> of{' '}
                <strong className="text-slate-900 dark:text-white">{totalItems}</strong> products
              </span>
              {displayedProducts.length < totalItems && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="px-8 py-3 rounded-2xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 dark:bg-lime-400 dark:text-slate-950 dark:hover:bg-lime-300 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Load More Products ({totalItems - displayedProducts.length} remaining)
                </button>
              )}
            </div>
          ) : (
            /* Numbered & Simple Pagination Navigation */
            <nav
              role="navigation"
              aria-label="Product pagination"
              className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              {/* Summary Info & Optional Page Size Selector */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing{' '}
                  <strong className="text-slate-900 dark:text-white font-semibold">
                    {Math.min((activePage - 1) * activePageSize + 1, totalItems)}–
                    {Math.min(activePage * activePageSize, totalItems)}
                  </strong>{' '}
                  of <strong className="text-slate-900 dark:text-white font-semibold">{totalItems}</strong> products
                </span>

                {showPageSizeSelector && (
                  <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                    <span>Show</span>
                    <select
                      value={activePageSize}
                      onChange={(e) => {
                        const newSize = Number(e.target.value);
                        setActivePageSize(newSize);
                        setInternalPage(1);
                        onPageChange?.(1);
                      }}
                      className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-lime-400"
                    >
                      {pageSizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <span>per page</span>
                  </div>
                )}
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Previous Page Button */}
                <button
                  type="button"
                  onClick={() => handlePageChange(activePage - 1)}
                  disabled={activePage <= 1}
                  aria-label="Previous page"
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                    activePage <= 1
                      ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 active:scale-95 shadow-xs cursor-pointer'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>

                {/* Numbered Page Buttons */}
                {paginationVariant === 'numbers' ? (
                  <div className="flex items-center gap-1">
                    {visiblePages.map((pageNum, idx) => {
                      if (pageNum === 'ellipsis') {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            aria-hidden="true"
                            className="px-2 text-slate-400 dark:text-slate-600 select-none text-xs font-bold"
                          >
                            …
                          </span>
                        );
                      }
                      const isCurrent = pageNum === activePage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => handlePageChange(pageNum)}
                          aria-label={`Page ${pageNum}`}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={`min-w-[34px] h-[34px] px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                            isCurrent
                              ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 font-black shadow-md scale-105'
                              : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Simple Indicator */
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Page {activePage} of {totalPages}
                  </span>
                )}

                {/* Next Page Button */}
                <button
                  type="button"
                  onClick={() => handlePageChange(activePage + 1)}
                  disabled={activePage >= totalPages}
                  aria-label="Next page"
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                    activePage >= totalPages
                      ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 active:scale-95 shadow-xs cursor-pointer'
                  }`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

// Canonical alias
export const ProductGrid = EditableProductGrid;
export type ProductGridItem = ProductItem;

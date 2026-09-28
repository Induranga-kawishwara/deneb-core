'use client';

import React, { useState } from 'react';
import { useSiteData } from './SiteDataProvider';

export interface FilterState {
  selectedCategories: string[];
  priceRange: [number, number];
  selectedSizes: string[];
  inStockOnly?: boolean;
}

export interface EditableFilterSidebarProps {
  basePath?: string;
  categories?: string[];
  sizes?: string[];
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  initialFilters?: Partial<FilterState>;
  onFilterChange?: (filters: FilterState) => void;
  className?: string;
}

export function EditableFilterSidebar({
  basePath = 'filters',
  categories = ['All', 'Running', 'Lifestyle', 'Basketball', 'Training', 'Outdoor'],
  sizes = ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12'],
  minPrice = 0,
  maxPrice = 300,
  currency = '$',
  initialFilters,
  onFilterChange,
  className = '',
}: EditableFilterSidebarProps) {
  const { siteData } = useSiteData();

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialFilters?.selectedCategories || [],
  );
  const [currentPrice, setCurrentPrice] = useState<number>(
    initialFilters?.priceRange ? initialFilters.priceRange[1] : maxPrice,
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    initialFilters?.selectedSizes || [],
  );
  const [inStockOnly, setInStockOnly] = useState<boolean>(
    initialFilters?.inStockOnly || false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const getContent = (key: string, fallback: string) => {
    const section = (siteData as Record<string, any>)?.content?.[basePath];
    return (section?.[key] as string) || fallback;
  };

  const fieldPath = (key: string) => `${basePath}.${key}`;

  const triggerChange = (
    nextCats: string[],
    nextPrice: number,
    nextSizes: string[],
    nextInStock: boolean,
  ) => {
    if (onFilterChange) {
      onFilterChange({
        selectedCategories: nextCats,
        priceRange: [minPrice, nextPrice],
        selectedSizes: nextSizes,
        inStockOnly: nextInStock,
      });
    }
  };

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setSelectedCategories(next);
    triggerChange(next, currentPrice, selectedSizes, inStockOnly);
  };

  const toggleSize = (size: string) => {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(next);
    triggerChange(selectedCategories, currentPrice, next, inStockOnly);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentPrice(val);
    triggerChange(selectedCategories, val, selectedSizes, inStockOnly);
  };

  const toggleInStock = () => {
    const next = !inStockOnly;
    setInStockOnly(next);
    triggerChange(selectedCategories, currentPrice, selectedSizes, next);
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    setCurrentPrice(maxPrice);
    setSelectedSizes([]);
    setInStockOnly(false);
    triggerChange([], maxPrice, [], false);
  };

  const activeFiltersCount =
    selectedCategories.length +
    selectedSizes.length +
    (currentPrice < maxPrice ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  const title = getContent('title', 'Filters');
  const categoryTitle = getContent('categoryTitle', 'Categories');
  const priceTitle = getContent('priceTitle', 'Price Range');
  const sizeTitle = getContent('sizeTitle', 'Size');
  const availabilityTitle = getContent('availabilityTitle', 'Availability');
  const inStockLabel = getContent('inStockLabel', 'In Stock Only');
  const clearAllText = getContent('clearAllText', 'Clear All');

  return (
    <div className={`deneb-filter-sidebar-wrap w-full ${className}`}>
      <button
        type="button"
        className="deneb-filter-mobile-toggle mb-3 rounded-xl border border-neutral-800 bg-neutral-900/90 px-4 py-3 text-sm font-semibold text-white"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls="deneb-filter-panel"
        data-preview-static="filter-mobile-toggle"
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-neutral-400">
          {activeFiltersCount > 0 ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black">
              {activeFiltersCount}
            </span>
          ) : null}
          {mobileOpen ? '−' : '+'}
        </span>
      </button>

      <aside
        id="deneb-filter-panel"
        className={`deneb-filter-sidebar deneb-filter-sidebar-panel w-full rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-md p-6 text-white shadow-xl ${mobileOpen ? 'is-open' : ''}`}
        aria-label="Product Filters"
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <h3
            className="text-lg font-bold tracking-tight text-white"
            data-preview-field-path={fieldPath('title')}
          >
            {title}
          </h3>
          {activeFiltersCount > 0 && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black"
              data-preview-static="filter-active-count"
            >
              {activeFiltersCount}
            </span>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            data-preview-static="filter-clear-all"
          >
            <span data-preview-field-path={fieldPath('clearAllText')}>
              {clearAllText}
            </span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Categories */}
        <div>
          <h4
            className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3"
            data-preview-field-path={fieldPath('categoryTitle')}
          >
            {categoryTitle}
          </h4>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  data-preview-static="filter-cat-btn"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-white text-black shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price Slider */}
        <div className="border-t border-neutral-800/80 pt-6">
          <div className="flex justify-between items-center mb-2">
            <h4
              className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
              data-preview-field-path={fieldPath('priceTitle')}
            >
              {priceTitle}
            </h4>
            <span
              className="text-sm font-semibold text-emerald-400"
              data-preview-static="filter-price-display"
            >
              Up to {currency}{currentPrice}
            </span>
          </div>

          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={5}
            value={currentPrice}
            onChange={handlePriceChange}
            data-preview-static="filter-price-slider"
            className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-xs text-neutral-500 mt-1">
            <span>{currency}{minPrice}</span>
            <span>{currency}{maxPrice}</span>
          </div>
        </div>

        {/* Sizes */}
        {sizes.length > 0 && (
          <div className="border-t border-neutral-800/80 pt-6">
            <h4
              className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3"
              data-preview-field-path={fieldPath('sizeTitle')}
            >
              {sizeTitle}
            </h4>
            <div className="deneb-filter-size-grid grid grid-cols-3 gap-2">
              {sizes.map((size) => {
                const isSelected = selectedSizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    data-preview-static="filter-size-btn"
                    className={`rounded-lg py-2 text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'border-white bg-white text-black'
                        : 'border-neutral-800 bg-neutral-800/50 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* In Stock Toggle */}
        <div className="border-t border-neutral-800/80 pt-6">
          <h4
            className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400"
            data-preview-field-path={fieldPath('availabilityTitle')}
          >
            {availabilityTitle}
          </h4>
          <label
            className="flex items-center justify-between cursor-pointer group"
            data-preview-static="filter-instock-toggle"
          >
            <span
              className="text-xs font-medium text-neutral-300 group-hover:text-white transition-colors"
              data-preview-field-path={fieldPath('inStockLabel')}
            >
              {inStockLabel}
            </span>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={toggleInStock}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-emerald-500 accent-emerald-500 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </aside>
    </div>
  );
}

export const FilterSidebar = EditableFilterSidebar;

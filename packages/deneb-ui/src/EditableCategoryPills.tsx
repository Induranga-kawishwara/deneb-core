import React, { useState } from 'react';
import { useSiteData } from './SiteDataProvider';

export interface EditableCategoryPillsProps {
  categories?: string[];
  fieldPath?: string;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  allLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_CATEGORIES = ['All', 'Featured', 'New Arrivals', 'Best Sellers', 'Sale'];

/**
 * DENEB UI — Category Pills Filter Bar
 * 
 * High-converting horizontal filter ribbon for catalog and shop pages.
 * Supports live active tab switching, smooth horizontal scrolling,
 * and visual editing annotations.
 * 
 * Created by Chamika Gayashan & Induranga Kawishwara
 */
export function EditableCategoryPills({
  categories,
  fieldPath = 'categories',
  selectedCategory: controlledSelected,
  onSelectCategory,
  allLabel = 'All',
  className = '',
  style = {},
}: EditableCategoryPillsProps) {
  const { siteData } = useSiteData();
  const [internalSelected, setInternalSelected] = useState(allLabel);

  const activeCategory = controlledSelected !== undefined ? controlledSelected : internalSelected;

  // Resolve list of categories
  const resolvedCategories: string[] = React.useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.includes(allLabel) ? categories : [allLabel, ...categories];
    }
    const rawCategories = (siteData as any)?.categories;
    if (Array.isArray(rawCategories) && rawCategories.length > 0) {
      const cats = rawCategories.map((c: any) => (typeof c === 'string' ? c : c.name || String(c)));
      return cats.includes(allLabel) ? cats : [allLabel, ...cats];
    }
    // Infer categories from products array if present
    const rawProducts = (siteData as any)?.products;
    if (Array.isArray(rawProducts) && rawProducts.length > 0) {
      const inferred = Array.from(
        new Set(rawProducts.map((p: any) => p.category).filter(Boolean))
      ) as string[];
      if (inferred.length > 0) {
        return [allLabel, ...inferred];
      }
    }
    return DEFAULT_CATEGORIES;
  }, [categories, siteData, allLabel]);

  const handleSelect = (category: string) => {
    if (controlledSelected === undefined) {
      setInternalSelected(category);
    }
    if (onSelectCategory) {
      onSelectCategory(category);
    }
  };

  return (
    <nav
      className={`deneb-category-pills flex items-center gap-2 overflow-x-auto py-2 no-scrollbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        ...style,
      }}
      data-preview-field-path={fieldPath}
      aria-label="Product categories"
    >
      {resolvedCategories.map((cat, idx) => {
        const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
        return (
          <button
            key={`${cat}-${idx}`}
            type="button"
            onClick={() => handleSelect(cat)}
            className={`deneb-pill px-4 py-2 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 border ${
              isSelected
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm scale-105'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50'
            }`}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: isSelected ? '1px solid var(--brand-color, var(--color-primary, #0f172a))' : '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: isSelected ? 'var(--brand-color, var(--color-primary, #0f172a))' : 'var(--card-bg, var(--color-surface, #ffffff))',
              color: isSelected ? '#ffffff' : 'var(--color-text-muted, var(--muted-text, #475569))',
              boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
            data-preview-field-path={`${fieldPath}.${idx}`}
            aria-pressed={isSelected}
          >
            {cat}
          </button>
        );
      })}
    </nav>
  );
}

// Canonical alias
export const CategoryPills = EditableCategoryPills;

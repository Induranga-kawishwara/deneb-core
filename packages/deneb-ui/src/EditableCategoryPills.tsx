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
    const rawCandidates: string[] = [];
    if (categories && categories.length > 0) {
      rawCandidates.push(...categories);
    } else {
      const rawCategories = (siteData as any)?.categories;
      if (Array.isArray(rawCategories) && rawCategories.length > 0) {
        for (const c of rawCategories) {
          const name = typeof c === "string" ? c : c?.name || String(c);
          if (name) rawCandidates.push(name);
        }
      } else {
        const rawProducts = (siteData as any)?.products;
        if (Array.isArray(rawProducts) && rawProducts.length > 0) {
          for (const p of rawProducts) {
            if (p?.category) rawCandidates.push(p.category);
          }
        }
      }
    }

    const map = new Map<string, string>();
    for (const item of rawCandidates) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.toLowerCase() === allLabel.toLowerCase()) continue;
      const lower = trimmed.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, trimmed);
      }
    }
    const distinct = Array.from(map.values());
    return distinct.length > 1 ? [allLabel, ...distinct] : [];
  }, [categories, siteData, allLabel]);

  const handleSelect = (category: string) => {
    if (controlledSelected === undefined) {
      setInternalSelected(category);
    }
    if (onSelectCategory) {
      onSelectCategory(category);
    }
  };

  if (resolvedCategories.length <= 1) {
    return null;
  }

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
        const isSelected = activeCategory.trim().toLowerCase() === cat.trim().toLowerCase();
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

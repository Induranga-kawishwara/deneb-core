import React from 'react';
import { useComponentStyle } from './hooks/useComponentStyle';
import { resolveResponsiveColumns } from './utils/responsive';

export type GridSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | (string & {}) | number;

const SPACING_MAP: Record<string, string> = {
  none: '0',
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1.25rem',
  lg: '2rem',
  xl: '2.5rem',
  '2xl': '3.5rem',
};

export interface ResponsiveColumns {
  mobile?: number;
  tablet?: number;
  desktop?: number;
}

export interface EditableGridProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;

  id?: string;
  'data-preview-list-path'?: string;
  'data-preview-static'?: string;

  /**
   * Minimum width of each card in the grid (e.g. '280px', '320px').
   * When set, automatically creates a dynamic auto-balancing layout (`repeat(auto-fit, minmax(minCardWidth, 1fr))`)
   * where cards seamlessly reflow and expand to fill all remaining row space.
   */
  minCardWidth?: string;

  /**
   * Fixed column count or responsive columns config.
   */
  columns?: number | ResponsiveColumns;

  /**
   * Gap between cards in the grid ('xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' or custom CSS).
   */
  gap?: GridSpacing;

  /**
   * Force all cards in a row to have matching heights (default: true).
   */
  equalHeight?: boolean;

  /**
   * Align items inside the grid cells.
   */
  align?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * EditableGrid provides an auto-balancing card layout that automatically adjusts
 * card widths and fills available horizontal space evenly across mobile and desktop.
 */
export function EditableGrid({
  as: Component = 'div',
  id,
  'data-preview-list-path': previewListPath,
  'data-preview-static': previewStatic,
  minCardWidth = '280px',
  columns,
  gap = 'md',
  equalHeight = true,
  align = 'stretch',
  style,
  className = '',
  children,
  ...props
}: EditableGridProps) {
  const resolvedGap = gap !== undefined ? (SPACING_MAP[String(gap)] || String(gap)) : '1.25rem';
  const { template: templateCols, dataAttrs } = resolveResponsiveColumns(columns, minCardWidth);
  const listPath = previewListPath || id;
  const stylePath = listPath ? `${listPath}.grid` : undefined;
  const { cssVars: styleVars } = useComponentStyle(stylePath, 'grid');

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: templateCols,
    gap: resolvedGap,
    alignItems: equalHeight ? 'stretch' : align,
    ...(dataAttrs
      ? ({
          '--deneb-cols': dataAttrs['data-cols-mobile'],
          '--deneb-cols-tablet': dataAttrs['data-cols-tablet'],
          '--deneb-cols-desktop': dataAttrs['data-cols-desktop'],
        } as React.CSSProperties)
      : {}),
    ...styleVars,
    ...style,
  };

  return (
    <Component
      data-preview-list-path={listPath}
      data-preview-static={previewStatic}
      data-preview-style-target={stylePath}
      data-preview-style-type="grid"
      className={`deneb-grid editable-grid ${className}`.trim()}
      style={gridStyle}
      {...(dataAttrs || {})}
      {...(props as any)}
    >
      {children}
    </Component>
  );
}

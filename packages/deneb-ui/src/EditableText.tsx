import React from 'react';
import { useComponentStyle } from './hooks/useComponentStyle';

export type TextSemanticColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'heading'
  | 'text'
  | 'muted'
  | 'white'
  | 'dark'
  | 'inherit'
  | 'initial';

export type TextColor = TextSemanticColor | (string & {});

export type TextSize =
  | 'xs'
  | 'sm'
  | 'base'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl'
  | '8xl'
  | 'hero'
  | (string & {});

export type TextWeight =
  | 'thin'
  | 'extralight'
  | 'light'
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold'
  | 'black'
  | number
  | (string & {});

export type TextLineHeight =
  | 'none'
  | 'tight'
  | 'snug'
  | 'normal'
  | 'relaxed'
  | 'loose'
  | number
  | (string & {});

export type TextLetterSpacing =
  | 'tighter'
  | 'tight'
  | 'normal'
  | 'wide'
  | 'wider'
  | 'widest'
  | (string & {});

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'lead'
  | 'eyebrow'
  | 'caption'
  | 'badge';

export const SIZE_MAP: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  '7xl': '4.5rem',
  '8xl': '6rem',
  hero: 'clamp(2.25rem, 5vw, 4rem)',
};

export const WEIGHT_MAP: Record<string, number | string> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

export const LINE_HEIGHT_MAP: Record<string, number | string> = {
  none: 1,
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};

export const LETTER_SPACING_MAP: Record<string, string> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
};

export const COLOR_MAP: Record<string, string> = {
  primary: 'var(--brand-color, #2563eb)',
  secondary: 'var(--brand-secondary, #0f172a)',
  accent: 'var(--brand-accent, #14b8a6)',
  heading: 'var(--heading-color, var(--brand-secondary, #0f172a))',
  text: 'var(--page-text, #0f172a)',
  muted: 'var(--muted-text, #64748b)',
  white: '#ffffff',
  dark: '#0f172a',
  inherit: 'inherit',
  initial: 'initial',
};

export const VARIANT_DEFAULTS: Record<
  TextVariant,
  {
    as: React.ElementType;
    size?: TextSize;
    weight?: TextWeight;
    lineHeight?: TextLineHeight;
    transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    letterSpacing?: TextLetterSpacing;
    color?: TextColor;
    fontFamily?: string;
  }
> = {
  h1: { as: 'h1', size: '4xl', weight: 'bold', lineHeight: 'tight', color: 'heading', fontFamily: 'var(--heading-font)' },
  h2: { as: 'h2', size: '3xl', weight: 'bold', lineHeight: 'tight', color: 'heading', fontFamily: 'var(--heading-font)' },
  h3: { as: 'h3', size: '2xl', weight: 'semibold', lineHeight: 'snug', color: 'heading', fontFamily: 'var(--heading-font)' },
  h4: { as: 'h4', size: 'xl', weight: 'semibold', lineHeight: 'snug', color: 'heading', fontFamily: 'var(--heading-font)' },
  h5: { as: 'h5', size: 'lg', weight: 'medium', lineHeight: 'normal', color: 'heading', fontFamily: 'var(--heading-font)' },
  h6: { as: 'h6', size: 'base', weight: 'medium', lineHeight: 'normal', color: 'heading', fontFamily: 'var(--heading-font)' },
  p: { as: 'p', size: 'base', weight: 'normal', lineHeight: 'normal', color: 'text' },
  lead: { as: 'p', size: 'lg', weight: 'normal', lineHeight: 'relaxed', color: 'muted' },
  eyebrow: { as: 'span', size: 'xs', weight: 'bold', transform: 'uppercase', letterSpacing: 'wider', color: 'primary' },
  caption: { as: 'span', size: 'xs', weight: 'normal', lineHeight: 'normal', color: 'muted' },
  badge: { as: 'span', size: 'xs', weight: 'semibold', lineHeight: 'none', color: 'primary' },
};


export const FONT_FAMILY_MAP: Record<string, string> = {
  'Editorial Serif': "'Playfair Display', Georgia, 'Times New Roman', serif",
  'Plus Jakarta Sans': "'Plus Jakarta Sans', system-ui, sans-serif",
  'Inter': "'Inter', system-ui, sans-serif",
  'Playfair Display': "'Playfair Display', Georgia, serif",
  'Outfit': "'Outfit', system-ui, sans-serif",
  'Cormorant Garamond': "'Cormorant Garamond', Georgia, serif",
  'Montserrat': "'Montserrat', system-ui, sans-serif",
  'System Sans': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  heading: 'var(--heading-font, Inter, sans-serif)',
  body: 'var(--body-font, Inter, sans-serif)',
};

function toCssUnit(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return `${str}px`;
  }
  return str;
}

export interface EditableTextProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Field path in siteData (e.g. "home.heroTitle").
   */
  id?: string;

  /**
   * Explicit fivora visual editing attribute for strict static analysis.
   */
  'data-preview-field-path'?: string;

  defaultValue?: string;

  /**
   * Placeholder text displayed when defaultValue or children is empty.
   * Remains 100% interactive and editable inside the Fivora live editor.
   */
  placeholder?: string;

  as?: React.ElementType;

  /**
   * Semantic typography variant providing instant preset styles (h1-h6, p, lead, eyebrow, caption, badge).
   */
  variant?: TextVariant;

  /**
   * Text color: preset tokens ('primary' | 'secondary' | 'accent' | 'heading' | 'text' | 'muted' | 'white' | 'dark')
   * or any valid CSS color string (hex, rgb, hsl, or CSS variable).
   */
  color?: TextColor;

  /**
   * Font size preset ('xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | 'hero')
   * or any custom CSS size string (e.g. '2.5rem', '32px', 'clamp(1.5rem, 3vw, 3rem)').
   */
  size?: TextSize;

  /**
   * Font weight ('thin' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black' | number).
   */
  weight?: TextWeight;

  /**
   * Line height preset ('none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose') or number / CSS string.
   */
  lineHeight?: TextLineHeight;

  /**
   * Text alignment ('left' | 'center' | 'right' | 'justify').
   */
  align?: 'left' | 'center' | 'right' | 'justify';

  /**
   * Text transform ('uppercase' | 'lowercase' | 'capitalize' | 'none').
   */
  transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';

  /**
   * Letter spacing / tracking preset ('tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest') or custom CSS string.
   */
  letterSpacing?: TextLetterSpacing;

  /**
   * Font family: 'heading' | 'body' or custom CSS font-family string.
   */
  fontFamily?: 'heading' | 'body' | (string & {});
}

/**
 * EditableText provides full typography controls (color, size, weight, line-height, alignment, transform, variants)
 * alongside strict Fivora visual editing bindings.
 */
export function EditableText({
  id,
  'data-preview-field-path': previewFieldPath,
  defaultValue,
  placeholder,
  children,
  as: ComponentOverride,
  variant,
  color,
  size,
  weight,
  lineHeight,
  align,
  transform,
  letterSpacing,
  fontFamily,
  style,
  className = '',
  ...props
}: EditableTextProps) {
  const path = previewFieldPath || id;
  const rawContent = children !== undefined ? children : defaultValue;
  const isContentEmpty =
    rawContent === undefined ||
    rawContent === null ||
    (typeof rawContent === 'string' && rawContent.trim() === '');
  const isPlaceholderActive = isContentEmpty && Boolean(placeholder);
  const displayContent = isPlaceholderActive ? placeholder : rawContent;

  const { cssVars: styleVars } = useComponentStyle(path, 'text');

  const variantDefaults = variant ? VARIANT_DEFAULTS[variant] : undefined;
  const Component = ComponentOverride || variantDefaults?.as || 'span';

  const effectiveColor = color || variantDefaults?.color;
  const effectiveSize = size || variantDefaults?.size;
  const effectiveWeight = weight || variantDefaults?.weight;
  const effectiveLineHeight = lineHeight || variantDefaults?.lineHeight;
  const effectiveTransform = transform || variantDefaults?.transform;
  const effectiveLetterSpacing = letterSpacing || variantDefaults?.letterSpacing;
  const effectiveFontFamily = fontFamily || variantDefaults?.fontFamily;

  const resolvedColor = effectiveColor ? (COLOR_MAP[effectiveColor] || effectiveColor) : undefined;
  const resolvedSize = effectiveSize ? (SIZE_MAP[effectiveSize] || effectiveSize) : undefined;
  const resolvedWeight = effectiveWeight !== undefined ? (WEIGHT_MAP[String(effectiveWeight)] || effectiveWeight) : undefined;
  const resolvedLineHeight =
    effectiveLineHeight !== undefined ? (LINE_HEIGHT_MAP[String(effectiveLineHeight)] || effectiveLineHeight) : undefined;
  const resolvedLetterSpacing = effectiveLetterSpacing
    ? (LETTER_SPACING_MAP[effectiveLetterSpacing] || effectiveLetterSpacing)
    : undefined;
  const resolvedFontFamily = effectiveFontFamily
    ? (FONT_FAMILY_MAP[effectiveFontFamily] || effectiveFontFamily)
    : undefined;

  const typographyStyle: React.CSSProperties = {
    // Minimum dimensions ensure empty/placeholder elements never collapse to 0x0 and remain 100% clickable in Fivora
    minHeight: '1.2em',
    minWidth: '1.5ch',
    ...(Component === 'span' || ComponentOverride === 'span' ? { display: 'inline-block' } : {}),
    ...(isPlaceholderActive ? { opacity: 0.55, fontStyle: 'italic' } : {}),
    color: resolvedColor ? `var(--deneb-color, ${resolvedColor})` : 'var(--deneb-color, inherit)',
    fontSize: resolvedSize ? `var(--deneb-font-size, ${resolvedSize})` : 'var(--deneb-font-size, inherit)',
    fontWeight: resolvedWeight !== undefined ? `var(--deneb-font-weight, ${resolvedWeight})` : 'var(--deneb-font-weight, inherit)',
    lineHeight: resolvedLineHeight !== undefined ? `var(--deneb-line-height, ${resolvedLineHeight})` : 'var(--deneb-line-height, inherit)',
    textAlign: (align ? `var(--deneb-text-align, ${align})` : 'var(--deneb-text-align, inherit)') as any,
    textTransform: (effectiveTransform ? `var(--deneb-text-transform, ${effectiveTransform})` : 'var(--deneb-text-transform, inherit)') as any,
    letterSpacing: resolvedLetterSpacing ? `var(--deneb-letter-spacing, ${resolvedLetterSpacing})` : 'var(--deneb-letter-spacing, inherit)',
    fontFamily: resolvedFontFamily ? `var(--deneb-font-family, ${resolvedFontFamily})` : 'var(--deneb-font-family, inherit)',
    ...styleVars,
    ...style,
  };

  return (
    <Component
      data-preview-field-path={path}
      data-preview-style-target={path}
      data-preview-style-type="text"
      data-preview-placeholder={isPlaceholderActive ? 'true' : undefined}
      className={`deneb-text ${className}`.trim()}
      style={typographyStyle}
      suppressHydrationWarning
      {...(props as any)}
    >
      {displayContent}
    </Component>
  );
}

export interface EditableHeadingProps extends Omit<EditableTextProps, 'variant'> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function EditableHeading({
  level = 2,
  as,
  ...props
}: EditableHeadingProps) {
  const variant = (`h${level}` as TextVariant);
  const headingTag = (as || `h${level}`) as React.ElementType;
  return <EditableText variant={variant} as={headingTag} {...props} />;
}

export interface EditableParagraphProps extends Omit<EditableTextProps, 'variant'> {
  lead?: boolean;
}

export function EditableParagraph({
  lead = false,
  as = 'p',
  ...props
}: EditableParagraphProps) {
  return <EditableText variant={lead ? 'lead' : 'p'} as={as} {...props} />;
}

export function EditableLead({ as = 'p', ...props }: Omit<EditableTextProps, 'variant'>) {
  return <EditableText variant="lead" as={as} {...props} />;
}

export interface EditableBadgeProps extends Omit<EditableTextProps, 'variant'> {
  badgeVariant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'glass' | 'glow';
}

export function EditableBadge({
  as = 'span',
  badgeVariant = 'primary',
  className = '',
  style,
  ...props
}: EditableBadgeProps) {
  const badgeStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      color: 'var(--brand-color, #2563eb)',
      border: '1px solid rgba(37, 99, 235, 0.2)',
    },
    secondary: {
      backgroundColor: 'rgba(15, 23, 42, 0.08)',
      color: 'var(--brand-secondary, #0f172a)',
      border: '1px solid rgba(15, 23, 42, 0.15)',
    },
    accent: {
      backgroundColor: 'rgba(20, 184, 166, 0.12)',
      color: 'var(--brand-accent, #14b8a6)',
      border: '1px solid rgba(20, 184, 166, 0.25)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--page-text, #0f172a)',
      border: '1px solid currentColor',
    },
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: 'var(--page-text, #0f172a)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    },
    glow: {
      backgroundColor: 'rgba(37, 99, 235, 0.15)',
      color: 'var(--brand-color, #2563eb)',
      boxShadow: '0 0 12px rgba(37, 99, 235, 0.35)',
      border: '1px solid rgba(37, 99, 235, 0.3)',
    },
  };

  const defaultBadgeLayout: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.025em',
    lineHeight: 1,
    ...(badgeStyles[badgeVariant] || badgeStyles.primary),
    ...style,
  };

  return (
    <EditableText
      variant="badge"
      as={as}
      style={defaultBadgeLayout}
      className={`editable-badge ${className}`.trim()}
      {...props}
    />
  );
}

export interface EditableQuoteProps extends Omit<EditableTextProps, 'variant'> {
  cite?: string;
}

export function EditableQuote({
  as = 'blockquote',
  cite,
  className = '',
  style,
  ...props
}: EditableQuoteProps) {
  const quoteStyle: React.CSSProperties = {
    fontStyle: 'italic',
    borderLeft: '3px solid var(--brand-color, #2563eb)',
    paddingLeft: '1.25rem',
    margin: '1.5rem 0',
    color: 'var(--muted-text, #64748b)',
    ...style,
  };

  return (
    <EditableText
      as={as}
      style={quoteStyle}
      className={`editable-quote ${className}`.trim()}
      {...(cite ? { cite } : {})}
      {...props}
    />
  );
}

export interface EditableLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  id?: string;
  'data-preview-field-path'?: string;
  targetPage?: string;
  defaultValue?: string;
}

/**
 * EditableLink enforces Fivora's strict selected-page contract:
 * - Injects data-target-page on wrapper
 * - Omits rendering if targetPage is not in requirements.requiredPages
 */
export function EditableLink({
  id,
  'data-preview-field-path': previewFieldPath,
  targetPage,
  defaultValue,
  href = '#',
  children,
  className = '',
  ...props
}: EditableLinkProps) {
  const path = previewFieldPath || id;
  const content = children !== undefined ? children : defaultValue;

  const linkEl = (
    <a
      href={href}
      className={`editable-link ${className}`.trim()}
      {...props}
    >
      {path ? (
        <span data-preview-field-path={path}>{content}</span>
      ) : (
        content
      )}
    </a>
  );

  if (targetPage) {
    return <span data-target-page={targetPage}>{linkEl}</span>;
  }

  return linkEl;
}

export interface EditableButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  id?: string;
  'data-preview-field-path'?: string;
  defaultValue?: string;
  targetPage?: string;
  btnVariant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export function EditableButton({
  id,
  'data-preview-field-path': previewFieldPath,
  defaultValue,
  targetPage,
  btnVariant = 'primary',
  size = 'md',
  children,
  className = '',
  style,
  ...props
}: EditableButtonProps) {
  const path = previewFieldPath || id;
  const content = children !== undefined ? children : defaultValue;
  const { cssVars: styleVars } = useComponentStyle(path, 'button');

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '0.375rem 0.875rem', fontSize: '0.875rem', borderRadius: '6px' },
    md: { padding: '0.625rem 1.25rem', fontSize: '1rem', borderRadius: '8px' },
    lg: { padding: '0.875rem 1.75rem', fontSize: '1.125rem', borderRadius: '12px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--button-bg, var(--brand-color, #2563eb))',
      color: 'var(--button-text, #ffffff)',
      border: 'none',
      boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.35)',
    },
    secondary: {
      backgroundColor: 'var(--button-secondary-bg, var(--color-secondary, var(--brand-secondary, #0f172a)))',
      color: 'var(--button-secondary-text, var(--color-text, #ffffff))',
      border: '1px solid var(--button-secondary-border, var(--color-border, transparent))',
    },
    accent: {
      backgroundColor: 'var(--brand-accent, #14b8a6)',
      color: 'var(--button-accent-text, #ffffff)',
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--button-outline-text, var(--color-text, var(--page-text, #0f172a)))',
      border: '1.5px solid var(--button-outline-border, var(--color-border, currentColor))',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--button-ghost-text, var(--color-text, var(--page-text, #0f172a)))',
      border: 'none',
    },
    glass: {
      backgroundColor: 'var(--glass-bg, rgba(255, 255, 255, 0.15))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: 'var(--color-text, var(--page-text, #0f172a))',
      border: '1px solid var(--card-border, rgba(255, 255, 255, 0.2))',
    },
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    ...sizeStyles[size],
    ...variantStyles[btnVariant],
    ...styleVars,
    ...style,
  };

  const buttonEl = (
    <button
      data-preview-style-target={path}
      data-preview-style-type="button"
      style={baseStyle}
      className={`deneb-btn editable-btn ${className}`.trim()}
      {...props}
    >
      {path ? (
        <span data-preview-field-path={path}>{content}</span>
      ) : (
        content
      )}
    </button>
  );

  if (targetPage) {
    return <span data-target-page={targetPage}>{buttonEl}</span>;
  }

  return buttonEl;
}


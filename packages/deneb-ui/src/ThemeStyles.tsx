import React from 'react';
import { isDarkColor, getAutoContrastTextColor } from '@deneb-ui/core';
import { ResponsiveBaseStyles } from './ResponsiveBaseStyles';

export interface TemplateTheme {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headingColor?: string;
  mutedTextColor?: string;
  linkColor?: string;
  heroMinHeight?: string;
  sectionPadding?: string;
  baseSize?: string;
  headingFont?: string;
  bodyFont?: string;
  borderRadius?: string;
  align?: 'left' | 'center' | 'right';
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  dark?: Partial<TemplateTheme>;
  light?: Partial<TemplateTheme>;
  [key: string]: unknown;
}

/**
 * Pre-configured, high-converting theme presets tailored for different business categories.
 * Allows developers and AI agents to instantly generate distinct designs without copy-pasting styles.
 */
export const THEME_PRESETS: Record<string, TemplateTheme> = {
  restaurant: {
    primaryColor: '#b45309', // Warm amber
    secondaryColor: '#1c1917', // Deep charcoal
    accentColor: '#f59e0b', // Golden yellow
    backgroundColor: '#0c0a09', // Dark atmospheric background
    textColor: '#f5f5f4', // Off-white
    headingFont: 'Playfair Display, Georgia, serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '12px',
    align: 'left',
  },
  medical: {
    primaryColor: '#0284c7', // Serene ocean blue
    secondaryColor: '#0f172a', // Deep slate
    accentColor: '#0d9488', // Teal accent
    backgroundColor: '#ffffff', // Pure clean white
    textColor: '#334155', // Slate body text
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '8px',
    align: 'left',
  },
  luxury: {
    primaryColor: '#d4af37', // Metallic gold
    secondaryColor: '#000000', // Jet black
    accentColor: '#e5e5e5', // Platinum silver
    backgroundColor: '#0a0a0a', // Obsidian dark
    textColor: '#ffffff',
    headingFont: 'Cormorant Garamond, serif',
    bodyFont: 'Montserrat, sans-serif',
    borderRadius: '4px',
    align: 'center',
  },
  tech: {
    primaryColor: '#6366f1', // Electric indigo
    secondaryColor: '#0f172a', // Dark slate
    accentColor: '#06b6d4', // Neon cyan
    backgroundColor: '#030712', // Midnight abyss
    textColor: '#f8fafc',
    headingFont: 'Inter, system-ui, sans-serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '16px',
    align: 'left',
  },
  retail: {
    primaryColor: '#e11d48', // Vibrant rose/coral
    secondaryColor: '#18181b', // Zinc
    accentColor: '#fbbf24', // Sunny amber
    backgroundColor: '#ffffff',
    textColor: '#27272a',
    headingFont: 'Outfit, sans-serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '12px',
    align: 'left',
  },
  corporate: {
    primaryColor: '#1e3a8a', // Corporate navy
    secondaryColor: '#0f172a', // Slate
    accentColor: '#3b82f6', // Bright cobalt
    backgroundColor: '#f8fafc', // Soft light gray
    textColor: '#1e293b',
    headingFont: 'Merriweather, serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '6px',
    align: 'left',
  },
  cyberpunk: {
    primaryColor: '#f43f5e', // Neon crimson
    secondaryColor: '#09090b', // Deep zinc
    accentColor: '#06b6d4', // Electric cyan
    backgroundColor: '#09090b', // Dark void
    textColor: '#f4f4f5',
    headingFont: 'Outfit, sans-serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '4px',
    align: 'left',
  },
  minimalDark: {
    primaryColor: '#e2e8f0', // Clean silver
    secondaryColor: '#000000', // Pitch black
    accentColor: '#38bdf8', // Sky accent
    backgroundColor: '#0c0a09', // Dark basalt
    textColor: '#f1f5f9',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '12px',
    align: 'left',
  },
  nordicPastel: {
    primaryColor: '#0f766e', // Nordic pine
    secondaryColor: '#1e293b', // Deep slate
    accentColor: '#f59e0b', // Amber sun
    backgroundColor: '#fafaf9', // Crisp stone
    textColor: '#334155',
    headingFont: 'Playfair Display, serif',
    bodyFont: 'Inter, sans-serif',
    borderRadius: '16px',
    align: 'left',
  },
  emeraldGold: {
    primaryColor: '#059669', // Emerald
    secondaryColor: '#064e3b', // Deep forest
    accentColor: '#d97706', // Imperial gold
    backgroundColor: '#022c22', // Emerald dark
    textColor: '#ecfdf5',
    headingFont: 'Cormorant Garamond, serif',
    bodyFont: 'Montserrat, sans-serif',
    borderRadius: '10px',
    align: 'center',
  },
};


/**
 * Merges category presets with custom developer/agent overrides.
 */
export function getCategoryTheme(
  category: keyof typeof THEME_PRESETS | string,
  overrides?: Partial<TemplateTheme>,
): TemplateTheme {
  const base = THEME_PRESETS[category] || THEME_PRESETS.tech;
  return { ...base, ...overrides };
}

/**
 * Extracts a typed CSSProperties object containing both standard and custom theme tokens.
 * Any custom property defined by a developer in `theme` (e.g. cardBg: "#111")
 * is automatically converted to a CSS variable (e.g. --card-bg: #111).
 */
export function getThemeCssProperties(theme?: TemplateTheme | null): React.CSSProperties {
  const customVars: Record<string, string> = {};

  if (theme) {
    for (const [key, val] of Object.entries(theme)) {
      if (key !== 'dark' && key !== 'light' && (typeof val === 'string' || typeof val === 'number')) {
        const cssVarName = `--${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
        customVars[cssVarName] = String(val);
      }
    }
  }

  const isDark = isDarkColor(theme?.backgroundColor);
  const bgColor = theme?.backgroundColor || (isDark ? '#090d1a' : '#ffffff');
  const textColor = theme?.textColor || (isDark ? '#f8fafc' : '#0f172a');
  const mutedColor = theme?.mutedTextColor || (isDark ? 'rgba(248, 250, 252, 0.7)' : '#64748b');
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0';
  const cardBg = isDark ? '#111a2e' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.09)' : '#e2e8f0';

  const primaryColor = theme?.primaryColor || '#2563eb';
  const buttonBg = String(theme?.buttonBackgroundColor || primaryColor || '#2563eb');
  const autoButtonText = getAutoContrastTextColor(buttonBg);
  const buttonText = String(theme?.buttonTextColor || autoButtonText);
  const buttonSecondaryBg = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : (theme?.secondaryColor && !isDarkColor(theme.secondaryColor) ? theme.secondaryColor : '#f1f5f9');
  const buttonSecondaryText = isDark ? '#f8fafc' : '#0f172a';

  return {
    '--brand-color': primaryColor,
    '--brand-secondary': theme?.secondaryColor || (isDark ? '#1e293b' : '#0f172a'),
    '--brand-accent': theme?.accentColor || '#14b8a6',
    '--page-background': bgColor,
    '--page-text': textColor,
    '--heading-color': theme?.headingColor || (isDark ? '#ffffff' : theme?.secondaryColor || '#0f172a'),
    '--muted-text': mutedColor,
    '--link-color': theme?.linkColor || primaryColor,
    '--hero-min-height': theme?.heroMinHeight || '72vh',
    '--section-padding': theme?.sectionPadding || '5rem',
    '--base-size': theme?.baseSize || '16px',
    '--heading-font': theme?.headingFont || 'Inter, sans-serif',
    '--body-font': theme?.bodyFont || 'Inter, sans-serif',
    '--border-radius': theme?.borderRadius || '8px',
    '--content-align': theme?.align || 'left',
    // Canonical color system tokens for light & dark mode harmony
    '--color-primary': primaryColor,
    '--color-secondary': buttonSecondaryBg,
    '--color-accent': theme?.accentColor || '#14b8a6',
    '--color-text': textColor,
    '--color-text-muted': mutedColor,
    '--color-border': borderColor,
    '--color-surface': isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    '--card-bg': cardBg,
    '--card-border': cardBorder,
    '--product-card-bg': cardBg,
    '--product-card-border': cardBorder,
    '--tag-bg': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(241, 245, 249, 0.9)',
    '--tag-color': mutedColor,
    '--card-shadow': isDark ? '0 10px 25px -5px rgba(0, 0, 0, 0.4)' : '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
    '--header-bg': isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.82)',
    '--input-bg': isDark ? '#1e293b' : '#ffffff',
    '--input-border': isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
    '--input-color': textColor,
    // Dedicated Button Design Tokens
    '--button-bg': buttonBg,
    '--button-text': buttonText,
    '--button-primary-bg': buttonBg,
    '--button-primary-text': buttonText,
    '--button-secondary-bg': buttonSecondaryBg,
    '--button-secondary-text': buttonSecondaryText,
    '--button-outline-border': isDark ? 'rgba(255, 255, 255, 0.22)' : 'currentColor',
    '--button-outline-text': isDark ? '#f8fafc' : textColor,
    '--button-ghost-text': isDark ? '#f8fafc' : textColor,
    fontFamily: theme?.bodyFont || 'Inter, sans-serif',
    ...customVars,
  } as React.CSSProperties;
}

export interface ThemeStylesProps {
  theme?: TemplateTheme | null;
  defaultPrimary?: string;
  defaultSecondary?: string;
  defaultAccent?: string;
  defaultBg?: string;
  defaultText?: string;
  /**
   * Automatically generate opposite mode selectors (.dark / .light or [data-theme="..."])
   * so templates with theme switchers transition without writing manual CSS.
   * Default: true.
   */
  enableDualMode?: boolean;
}

/**
 * Automatically injects standard and custom fivora theme variables into the document.
 * Supports light-only, dark-only, and dual-mode (light & dark toggle) templates.
 */
export function ThemeStyles({
  theme,
  enableDualMode = true,
}: ThemeStylesProps) {
  const styleProps = getThemeCssProperties(theme);
  const baseLines = Object.entries(styleProps)
    .filter(([key]) => key.startsWith('--'))
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  let css = `
    :root {
${baseLines}
    }
  `;

  if (enableDualMode) {
    const isDarkBase = isDarkColor(theme?.backgroundColor);
    if (isDarkBase) {
      // Base theme is dark. Generate light mode rules for .light or [data-theme="light"]
      const lightTheme: TemplateTheme = {
        ...theme,
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        mutedTextColor: '#64748b',
        ...(theme?.light || {}),
      };
      const lightProps = getThemeCssProperties(lightTheme);
      const lightLines = Object.entries(lightProps)
        .filter(([key]) => key.startsWith('--'))
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');

      css += `
    .light, [data-theme="light"] {
${lightLines}
    }
      `;
    } else {
      // Base theme is light. Generate dark mode rules for .dark or [data-theme="dark"]
      const darkTheme: TemplateTheme = {
        ...theme,
        backgroundColor: '#090d1a',
        textColor: '#f8fafc',
        mutedTextColor: 'rgba(248, 250, 252, 0.7)',
        ...(theme?.dark || {}),
      };
      const darkProps = getThemeCssProperties(darkTheme);
      const darkLines = Object.entries(darkProps)
        .filter(([key]) => key.startsWith('--'))
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');

      css += `
    .dark, [data-theme="dark"] {
${darkLines}
    }
      `;
    }
  }

  return (
    <>
      <ResponsiveBaseStyles />
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}

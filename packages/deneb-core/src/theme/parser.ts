import {
  VisualCustomization,
  VisualCustomizationColors,
  VisualCustomizationTypography,
  VisualCustomizationSpacing,
  VisualCustomizationLayout,
  VisualCustomizationComponents,
  VisualCustomizationSectionOverride,
  VisualCustomizationElementStyle,
  TemplateThemeShape,
} from './types';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseVisualCustomization(value: unknown): VisualCustomization {
  if (!isPlainRecord(value)) return { version: 1 };
  return {
    version: 1,
    colors: isPlainRecord(value.colors)
      ? (value.colors as VisualCustomizationColors)
      : undefined,
    colorReplacements: isPlainRecord(value.colorReplacements)
      ? (value.colorReplacements as Record<string, string>)
      : undefined,
    typography: isPlainRecord(value.typography)
      ? (value.typography as VisualCustomizationTypography)
      : undefined,
    spacing: isPlainRecord(value.spacing)
      ? (value.spacing as VisualCustomizationSpacing)
      : undefined,
    layout: isPlainRecord(value.layout)
      ? (value.layout as VisualCustomizationLayout)
      : undefined,
    components: isPlainRecord(value.components)
      ? (value.components as VisualCustomizationComponents)
      : undefined,
    sections: isPlainRecord(value.sections)
      ? (value.sections as Record<string, VisualCustomizationSectionOverride>)
      : undefined,
    elementStyles: isPlainRecord(value.elementStyles)
      ? (value.elementStyles as Record<string, VisualCustomizationElementStyle>)
      : undefined,
  };
}

export function customizationToTheme(
  customization: VisualCustomization,
): TemplateThemeShape {
  const colors = customization.colors ?? {};
  return {
    designCustomizationVersion: 1,
    colorReplacements: customization.colorReplacements,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    backgroundColor: colors.background,
    textColor: colors.text,
    surfaceColor: colors.surface ?? colors.cardBackground,
    surfaceAltColor: colors.surfaceAlt,
    headingColor: colors.heading ?? colors.text,
    mutedTextColor: colors.mutedText,
    borderColor: colors.border,
    headerBackgroundColor: colors.headerBackground,
    footerBackgroundColor: colors.footerBackground,
    cardBackgroundColor: colors.cardBackground ?? colors.surface,
    buttonBackgroundColor: colors.buttonBackground,
    buttonTextColor: colors.buttonText,
    ...customization.typography,
    ...customization.spacing,
    ...customization.layout,
    ...customization.components,
    sections: customization.sections,
    elementStyles: customization.elementStyles,
  };
}

export function mergeVisualCustomizationIntoTheme(
  baseTheme: TemplateThemeShape | null | undefined,
  customization: unknown,
): TemplateThemeShape | null {
  const parsed = parseVisualCustomization(customization);
  const hasOverrides = [
    parsed.colors,
    parsed.colorReplacements,
    parsed.typography,
    parsed.spacing,
    parsed.layout,
    parsed.components,
    parsed.sections,
    parsed.elementStyles,
  ].some((group) =>
    Boolean(
      group &&
        Object.values(group).some(
          (value) => value !== undefined && value !== '',
        ),
    ),
  );
  if (!hasOverrides) return baseTheme ?? null;
  return Object.fromEntries(
    Object.entries({
      ...(baseTheme ?? {}),
      ...customizationToTheme(parsed),
    }).filter(([, value]) => value !== undefined),
  ) as TemplateThemeShape;
}

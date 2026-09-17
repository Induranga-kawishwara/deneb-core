export interface VisualCustomizationColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  surface?: string;
  surfaceAlt?: string;
  heading?: string;
  mutedText?: string;
  border?: string;
  headerBackground?: string;
  footerBackground?: string;
  cardBackground?: string;
  buttonBackground?: string;
  buttonText?: string;
}

export interface VisualCustomizationTypography {
  headingFont?: string;
  bodyFont?: string;
  baseSize?: string;
  headingScale?: string;
  bodyLineHeight?: string;
  headingLineHeight?: string;
  headingWeight?: string;
  bodyWeight?: string;
  letterSpacing?: string;
}

export interface VisualCustomizationSpacing {
  heroMinHeight?: string;
  sectionPadding?: string;
  contentMaxWidth?: string;
  containerPadding?: string;
  sectionGap?: string;
  elementGap?: string;
  gridGap?: string;
}

export interface VisualCustomizationLayout {
  textAlign?: string;
  contentAlign?: string;
  heroTextAlign?: string;
  cardTextAlign?: string;
  gridColumns?: string;
}

export interface VisualCustomizationComponents {
  cardWidth?: string;
  cardMinHeight?: string;
  cardPadding?: string;
  cardRadius?: string;
  cardBorderWidth?: string;
  cardShadow?: string;
  buttonPadding?: string;
  buttonRadius?: string;
  buttonShadow?: string;
  imageRadius?: string;
  headerHeight?: string;
}

export interface VisualCustomizationSectionOverride {
  backgroundColor?: string;
  textColor?: string;
  headingColor?: string;
  minHeight?: string;
  padding?: string;
  contentMaxWidth?: string;
  gap?: string;
  textAlign?: string;
  contentAlign?: string;
  cardBackgroundColor?: string;
  cardWidth?: string;
  cardMinHeight?: string;
  cardRadius?: string;
  gridColumns?: string;
  visible?: boolean;
}

export interface VisualCustomizationElementStyle {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  fontWeight?: string;
  letterSpacing?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;
  boxShadow?: string;
  opacity?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
}

export interface VisualCustomization {
  version: 1;
  colors?: VisualCustomizationColors;
  colorReplacements?: Record<string, string>;
  typography?: VisualCustomizationTypography;
  spacing?: VisualCustomizationSpacing;
  layout?: VisualCustomizationLayout;
  components?: VisualCustomizationComponents;
  sections?: Record<string, VisualCustomizationSectionOverride>;
  elementStyles?: Record<string, VisualCustomizationElementStyle>;
}

export interface TemplateThemeShape {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  surfaceColor?: string;
  surfaceAltColor?: string;
  headingColor?: string;
  mutedTextColor?: string;
  borderColor?: string;
  headerBackgroundColor?: string;
  footerBackgroundColor?: string;
  cardBackgroundColor?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  headingFont?: string;
  bodyFont?: string;
  baseSize?: string;
  headingScale?: string;
  bodyLineHeight?: string;
  headingLineHeight?: string;
  headingWeight?: string;
  bodyWeight?: string;
  letterSpacing?: string;
  heroMinHeight?: string;
  sectionPadding?: string;
  contentMaxWidth?: string;
  containerPadding?: string;
  sectionGap?: string;
  elementGap?: string;
  gridGap?: string;
  textAlign?: string;
  contentAlign?: string;
  heroTextAlign?: string;
  cardTextAlign?: string;
  gridColumns?: string;
  cardWidth?: string;
  cardMinHeight?: string;
  cardPadding?: string;
  cardRadius?: string;
  cardBorderWidth?: string;
  cardShadow?: string;
  buttonPadding?: string;
  buttonRadius?: string;
  buttonShadow?: string;
  imageRadius?: string;
  headerHeight?: string;
  style?: string;
  designCustomizationVersion?: number;
  colorReplacements?: Record<string, string>;
  sections?: Record<string, VisualCustomizationSectionOverride>;
  elementStyles?: Record<string, VisualCustomizationElementStyle>;
  [key: string]: unknown;
}

export interface ThemePalette {
  id: string;
  name: string;
  badge: string;
  mode: 'light' | 'dark';
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  buttonBg?: string;
  buttonText?: string;
}

export interface FontPairing {
  id: string;
  name: string;
  headingFont: string;
  bodyFont: string;
  description: string;
}

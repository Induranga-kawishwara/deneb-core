export interface BaseStyleProperties {
  marginTop?: string | number;
  marginBottom?: string | number;
  marginLeft?: string | number;
  marginRight?: string | number;
  /** Legacy Fivora field-style alias */
  spacingTop?: string | number;
  spacingBottom?: string | number;
  spacingLeft?: string | number;
  spacingRight?: string | number;
}

export interface TextStyleProperties extends BaseStyleProperties {
  fontFamily?: string;
  fontSize?: string | number;
  /** When true, px/rem font sizes become responsive clamp() values */
  responsiveFontSize?: boolean;
  fontWeight?: string | number;
  lineHeight?: string | number;
  letterSpacing?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface CardStyleProperties extends BaseStyleProperties {
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  height?: string | number;
  aspectRatio?: string;
  paddingTop?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
  paddingRight?: string | number;
  borderRadius?: string | number;
  borderWidth?: string | number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderColor?: string;
  backgroundColor?: string;
  backgroundGradient?: string;
  boxShadow?: string;
  backdropBlur?: string | number;
  gap?: string | number;
}

export interface ButtonStyleProperties extends BaseStyleProperties {
  variant?: 'solid' | 'outline' | 'ghost' | 'soft';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: string | number;
  paddingX?: string | number;
  paddingY?: string | number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
}

export interface GridStyleProperties {
  columns?: number | 'auto-fit' | 'auto-fill';
  minCardWidth?: string;
  gapX?: string | number;
  gapY?: string | number;
  equalHeight?: boolean;
}

export interface SectionStyleProperties {
  paddingTop?: string | number;
  paddingBottom?: string | number;
  paddingX?: string | number;
  maxWidth?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundOverlayColor?: string;
  backgroundOverlayOpacity?: number;
  textAlign?: "left" | "center" | "right";
  display?: string;
  order?: number | string;
}

export type StyleKind = 'text' | 'card' | 'button' | 'grid' | 'section';

export type ComponentStyle =
  | { kind: 'text'; style: TextStyleProperties }
  | { kind: 'card'; style: CardStyleProperties }
  | { kind: 'button'; style: ButtonStyleProperties }
  | { kind: 'grid'; style: GridStyleProperties }
  | { kind: 'section'; style: SectionStyleProperties };

export type StyleProperties =
  | TextStyleProperties
  | CardStyleProperties
  | ButtonStyleProperties
  | GridStyleProperties
  | SectionStyleProperties;

import type {
  ButtonStyleProperties,
  CardStyleProperties,
  GridStyleProperties,
  SectionStyleProperties,
  TextStyleProperties,
} from '../types/styles';
import { formatFontSize } from '../fonts/clamp';
import { resolveFontFamily } from '../fonts/resolve';
import { resolveShadowPreset, resolveThemeToken } from './tokenResolver';

export function formatUnit(value: string | number | undefined): string | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  if (typeof value === 'number') return `${value}px`;
  return /^\d+$/.test(value) ? `${value}px` : value;
}

function marginVars(
  style: Record<string, unknown>,
  prefix: string,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const top = style.marginTop ?? style.spacingTop;
  const bottom = style.marginBottom ?? style.spacingBottom;
  const left = style.marginLeft ?? style.spacingLeft;
  const right = style.marginRight ?? style.spacingRight;
  if (top !== undefined) vars[`${prefix}-margin-top`] = formatUnit(top as string | number)!;
  if (bottom !== undefined) vars[`${prefix}-margin-bottom`] = formatUnit(bottom as string | number)!;
  if (left !== undefined) vars[`${prefix}-margin-left`] = formatUnit(left as string | number)!;
  if (right !== undefined) vars[`${prefix}-margin-right`] = formatUnit(right as string | number)!;
  return vars;
}

export function textStyleToCssVariables(
  style: TextStyleProperties,
): Record<string, string> {
  const vars: Record<string, string> = {
    ...marginVars(style as Record<string, unknown>, '--deneb'),
  };
  if (style.fontFamily) {
    vars['--deneb-font-family'] = resolveFontFamily(style.fontFamily)!;
  }
  if (style.fontSize !== undefined) {
    vars['--deneb-font-size'] = formatFontSize(style.fontSize, {
      responsive: style.responsiveFontSize === true,
    })!;
  }
  if (style.fontWeight !== undefined) {
    vars['--deneb-font-weight'] = String(style.fontWeight);
  }
  if (style.lineHeight !== undefined) {
    vars['--deneb-line-height'] =
      typeof style.lineHeight === 'number'
        ? String(style.lineHeight)
        : String(style.lineHeight);
  }
  if (style.letterSpacing) {
    vars['--deneb-letter-spacing'] = style.letterSpacing;
  }
  if (style.color) {
    vars['--deneb-color'] = resolveThemeToken(style.color)!;
  }
  if (style.textAlign) {
    vars['--deneb-text-align'] = style.textAlign;
  }
  if (style.textTransform) {
    vars['--deneb-text-transform'] = style.textTransform;
  }
  return vars;
}

export function cardStyleToCssVariables(
  style: CardStyleProperties,
): Record<string, string> {
  const vars: Record<string, string> = {
    ...marginVars(style as Record<string, unknown>, '--deneb-card'),
  };
  if (style.width !== undefined) vars['--deneb-card-width'] = formatUnit(style.width)!;
  if (style.minWidth !== undefined) vars['--deneb-card-min-width'] = formatUnit(style.minWidth)!;
  if (style.maxWidth !== undefined) vars['--deneb-card-max-width'] = formatUnit(style.maxWidth)!;
  if (style.height !== undefined) vars['--deneb-card-height'] = formatUnit(style.height)!;
  if (style.aspectRatio) vars['--deneb-card-aspect-ratio'] = style.aspectRatio;

  if (style.paddingTop !== undefined) vars['--deneb-card-pt'] = formatUnit(style.paddingTop)!;
  if (style.paddingBottom !== undefined) vars['--deneb-card-pb'] = formatUnit(style.paddingBottom)!;
  if (style.paddingLeft !== undefined) vars['--deneb-card-pl'] = formatUnit(style.paddingLeft)!;
  if (style.paddingRight !== undefined) vars['--deneb-card-pr'] = formatUnit(style.paddingRight)!;

  if (style.borderRadius !== undefined) vars['--deneb-card-radius'] = formatUnit(style.borderRadius)!;
  if (style.borderWidth !== undefined) vars['--deneb-card-border-w'] = formatUnit(style.borderWidth)!;
  if (style.borderStyle) vars['--deneb-card-border-s'] = style.borderStyle;
  if (style.borderColor) vars['--deneb-card-border-c'] = style.borderColor;

  if (style.backgroundColor) vars['--deneb-card-bg'] = resolveThemeToken(style.backgroundColor)!;
  if (style.backgroundGradient) vars['--deneb-card-bg-gradient'] = style.backgroundGradient;
  if (style.boxShadow) vars['--deneb-card-shadow'] = resolveShadowPreset(style.boxShadow)!;
  if (style.backdropBlur !== undefined) vars['--deneb-card-blur'] = formatUnit(style.backdropBlur)!;
  if (style.gap !== undefined) vars['--deneb-card-gap'] = formatUnit(style.gap)!;
  return vars;
}

export function buttonStyleToCssVariables(
  style: ButtonStyleProperties,
): Record<string, string> {
  const vars: Record<string, string> = {
    ...marginVars(style as Record<string, unknown>, '--deneb-btn'),
  };
  if (style.borderRadius !== undefined) vars['--deneb-btn-radius'] = formatUnit(style.borderRadius)!;
  if (style.paddingX !== undefined) vars['--deneb-btn-px'] = formatUnit(style.paddingX)!;
  if (style.paddingY !== undefined) vars['--deneb-btn-py'] = formatUnit(style.paddingY)!;
  if (style.backgroundColor) vars['--deneb-btn-bg'] = resolveThemeToken(style.backgroundColor)!;
  if (style.textColor) vars['--deneb-btn-color'] = resolveThemeToken(style.textColor)!;
  if (style.borderColor) vars['--deneb-btn-border-c'] = style.borderColor;
  if (style.hoverBackgroundColor) vars['--deneb-btn-hover-bg'] = style.hoverBackgroundColor;
  if (style.hoverTextColor) vars['--deneb-btn-hover-color'] = style.hoverTextColor;
  return vars;
}

export function gridStyleToCssVariables(
  style: GridStyleProperties,
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (style.columns !== undefined) vars['--deneb-grid-cols'] = String(style.columns);
  if (style.minCardWidth) vars['--deneb-grid-min-card'] = style.minCardWidth;
  if (style.gapX !== undefined) vars['--deneb-grid-gap-x'] = formatUnit(style.gapX)!;
  if (style.gapY !== undefined) vars['--deneb-grid-gap-y'] = formatUnit(style.gapY)!;
  if (style.equalHeight !== undefined) {
    vars['--deneb-grid-equal-height'] = style.equalHeight ? 'stretch' : 'start';
  }
  return vars;
}

export function sectionStyleToCssVariables(
  style: SectionStyleProperties,
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (style.paddingTop !== undefined) vars['--deneb-section-pt'] = formatUnit(style.paddingTop)!;
  if (style.paddingBottom !== undefined) vars['--deneb-section-pb'] = formatUnit(style.paddingBottom)!;
  if (style.paddingX !== undefined) vars['--deneb-section-px'] = formatUnit(style.paddingX)!;
  if (style.maxWidth) vars['--deneb-section-max-w'] = style.maxWidth;
  if (style.backgroundColor) vars['--deneb-section-bg'] = resolveThemeToken(style.backgroundColor)!;
  if (style.backgroundImage) vars['--deneb-section-bg-image'] = style.backgroundImage;
  if (style.backgroundOverlayColor) vars['--deneb-section-overlay'] = style.backgroundOverlayColor;
  if (style.backgroundOverlayOpacity !== undefined) {
    vars['--deneb-section-overlay-opacity'] = String(style.backgroundOverlayOpacity);
  }
  if (style.textAlign) vars['--deneb-section-align'] = style.textAlign;
  if (style.display) vars['--deneb-section-display'] = style.display;
  if (style.order !== undefined && style.order !== '') vars['--deneb-section-order'] = String(style.order);
  return vars;
}

export function styleToCssVariables(
  styleKind: 'text' | 'card' | 'button' | 'grid' | 'section',
  style: Record<string, unknown>,
): Record<string, string> {
  switch (styleKind) {
    case 'text':
      return textStyleToCssVariables(style as TextStyleProperties);
    case 'card':
      return cardStyleToCssVariables(style as CardStyleProperties);
    case 'button':
      return buttonStyleToCssVariables(style as ButtonStyleProperties);
    case 'grid':
      return gridStyleToCssVariables(style as GridStyleProperties);
    case 'section':
      return sectionStyleToCssVariables(style as SectionStyleProperties);
    default:
      return {};
  }
}

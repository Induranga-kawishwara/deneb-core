import { formatCurrency, parseNumericPrice } from "../cart/useCart";

export type MeasurementUnit =
  | "size"
  | "g"
  | "kg"
  | "mg"
  | "ml"
  | "l"
  | "pcs"
  | "pack"
  | "oz"
  | "lb"
  | (string & {});

export interface ProductVariant {
  id?: string | number;
  size?: string | number;
  option?: string | number;
  color?: string;
  price?: string | number;
  cost?: string | number;
  amount?: string | number;
  compareAtPrice?: string | number;
  originalPrice?: string | number;
  image?: string;
  imageUrl?: string;
  photo?: string;
  sku?: string;
  inStock?: boolean;
  [key: string]: unknown;
}

export interface ProductOptionInput {
  id?: string | number;
  name?: string;
  title?: string;
  unit?: MeasurementUnit;
  measurement?: string;
  price?: string | number;
  cost?: string | number;
  amount?: string | number;
  productPrice?: string | number;
  minPrice?: string | number;
  maxPrice?: string | number;
  priceMin?: string | number;
  priceMax?: string | number;
  priceRange?: [number | string, number | string] | string;
  compareAtPrice?: string | number;
  originalPrice?: string | number;
  optionsLabel?: string;
  options?: (string | number)[];
  optionsText?: string;
  sizes?: (string | number)[] | string;
  sizesText?: string;
  sizesLabel?: string;
  colors?: Array<string | { name: string; hex?: string; image?: string; photo?: string; imageUrl?: string }> | string;
  colorsText?: string;
  colorsLabel?: string;
  variants?: ProductVariant[];
  variantPrices?: Record<string, number | string>;
  [key: string]: unknown;
}

export interface ResolvedPriceResult {
  formattedPrice: string;
  numericPrice: number;
  isRange: boolean;
  minPrice: number;
  maxPrice: number;
  formattedOriginalPrice?: string;
  hasVariantPrice: boolean;
  matchedVariant?: ProductVariant;
  variantImage?: string;
}

export interface ResolvedProductOptions {
  unit: string;
  optionsLabel: string;
  options: string[];
  defaultOption: string;
  isMeasurement: boolean;
  formatOption: (option: string | number) => string;
  formatSelectedDisplay: (option: string | number) => string;
  formatOrderSnippet: (selectedOption?: string | number, selectedColor?: string) => string;
  colors: string[];
  detailedColors: Array<{ name: string; hex?: string; image?: string }>;
  colorsLabel: string;
  defaultColor: string;
}

function parseList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "object" && "name" in item && typeof (item as any).name === "string") {
          return (item as any).name.trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }
  return [];
}

export function parsePriceRange(
  rawPrice: unknown,
  minOverride?: unknown,
  maxOverride?: unknown,
  currency = "LKR",
): { isRange: boolean; min: number; max: number; formatted: string } {
  let min = parseNumericPrice(minOverride);
  let max = parseNumericPrice(maxOverride);

  if (typeof rawPrice === "string") {
    const trimmed = rawPrice.trim();
    if (trimmed.includes("-") || trimmed.includes("–") || trimmed.includes("—") || /\bto\b/i.test(trimmed)) {
      const parts = trimmed
        .split(/[-–—]|\bto\b/i)
        .map((s) => parseNumericPrice(s))
        .filter((n) => n > 0);
      if (parts.length >= 2) {
        min = Math.min(parts[0], parts[1]);
        max = Math.max(parts[0], parts[1]);
      } else if (parts.length === 1 && !min) {
        min = parts[0];
      }
    }
  } else if (Array.isArray(rawPrice) && rawPrice.length >= 2) {
    min = parseNumericPrice(rawPrice[0]);
    max = parseNumericPrice(rawPrice[1]);
  }

  if (min > 0 && max > 0 && min !== max) {
    return {
      isRange: true,
      min,
      max,
      formatted: `${formatCurrency(min, currency)} – ${formatCurrency(max, currency)}`,
    };
  }

  const single = min || max || parseNumericPrice(rawPrice);
  return {
    isRange: false,
    min: single,
    max: single,
    formatted: single > 0 ? formatCurrency(single, currency) : (rawPrice ? String(rawPrice) : ""),
  };
}

export function resolveVariantPrice(
  product?: ProductOptionInput | Record<string, unknown> | null,
  selectedOption?: string | number,
  selectedColor?: string,
  currency = "LKR",
): ResolvedPriceResult {
  const p = (product || {}) as ProductOptionInput;

  const baseRawPrice =
    p.price ?? (p as any).cost ?? (p as any).amount ?? (p as any).productPrice;
  const baseOriginalPrice = p.originalPrice ?? p.compareAtPrice;

  const variants = Array.isArray(p.variants) ? (p.variants as ProductVariant[]) : [];
  const variantPrices =
    p.variantPrices && typeof p.variantPrices === "object" && !Array.isArray(p.variantPrices)
      ? (p.variantPrices as Record<string, unknown>)
      : null;

  const normOption = selectedOption ? String(selectedOption).trim().toLowerCase() : "";
  const normColor =
    selectedColor && selectedColor !== "Standard"
      ? String(selectedColor).trim().toLowerCase()
      : "";

  let matchedVariant: ProductVariant | undefined;
  if (variants.length > 0 && (normOption || normColor)) {
    if (normOption && normColor) {
      matchedVariant = variants.find((v) => {
        const vOpt = String(v.size || v.option || "").trim().toLowerCase();
        const vCol = String(v.color || "").trim().toLowerCase();
        return vOpt === normOption && vCol === normColor;
      });
    }
    if (!matchedVariant && normOption) {
      matchedVariant = variants.find((v) => {
        const vOpt = String(v.size || v.option || "").trim().toLowerCase();
        return vOpt === normOption;
      });
    }
    if (!matchedVariant && normColor) {
      matchedVariant = variants.find((v) => {
        const vCol = String(v.color || "").trim().toLowerCase();
        return vCol === normColor;
      });
    }
  }

  let variantImage: string | undefined;
  if (matchedVariant) {
    variantImage =
      (typeof matchedVariant.image === "string" && matchedVariant.image) ||
      (typeof matchedVariant.imageUrl === "string" && matchedVariant.imageUrl) ||
      (typeof (matchedVariant as any).photo === "string" && (matchedVariant as any).photo) ||
      undefined;
  }

  if (!variantImage && normColor && Array.isArray(p.colors)) {
    const colorObj = p.colors.find((c) => {
      if (typeof c === "object" && c && "name" in c) {
        return String(c.name).trim().toLowerCase() === normColor;
      }
      return false;
    }) as { name?: string; image?: string; photo?: string; imageUrl?: string } | undefined;
    if (colorObj) {
      variantImage = colorObj.image || colorObj.imageUrl || colorObj.photo;
    }
  }

  let variantPriceNum: number | null = null;
  let variantOriginalPriceNum: number | null = null;

  if (matchedVariant) {
    const rawVPrice = matchedVariant.price ?? matchedVariant.cost ?? matchedVariant.amount;
    if (rawVPrice !== undefined && rawVPrice !== null && String(rawVPrice).trim() !== "") {
      variantPriceNum = parseNumericPrice(rawVPrice);
    }
    const rawVOriginal = matchedVariant.compareAtPrice ?? matchedVariant.originalPrice;
    if (rawVOriginal !== undefined && rawVOriginal !== null && String(rawVOriginal).trim() !== "") {
      variantOriginalPriceNum = parseNumericPrice(rawVOriginal);
    }
  }

  if (variantPriceNum === null && variantPrices && (normOption || normColor)) {
    const keysToTry = [
      `${selectedOption}-${selectedColor}`,
      `${selectedColor}-${selectedOption}`,
      String(selectedOption || ""),
      String(selectedColor || ""),
    ];
    for (const key of keysToTry) {
      if (key && key in variantPrices) {
        const val = variantPrices[key];
        const parsed = parseNumericPrice(val);
        if (parsed > 0) {
          variantPriceNum = parsed;
          break;
        }
      }
    }
  }

  if (variantPriceNum !== null && variantPriceNum > 0) {
    return {
      formattedPrice: formatCurrency(variantPriceNum, currency),
      numericPrice: variantPriceNum,
      isRange: false,
      minPrice: variantPriceNum,
      maxPrice: variantPriceNum,
      formattedOriginalPrice:
        variantOriginalPriceNum && variantOriginalPriceNum > variantPriceNum
          ? formatCurrency(variantOriginalPriceNum, currency)
          : (baseOriginalPrice ? (typeof baseOriginalPrice === "number" ? formatCurrency(baseOriginalPrice, currency) : String(baseOriginalPrice)) : undefined),
      hasVariantPrice: true,
      matchedVariant,
      variantImage,
    };
  }

  const allVariantPrices: number[] = [];
  if (variants.length > 0) {
    variants.forEach((v) => {
      const pNum = parseNumericPrice(v.price ?? v.cost ?? v.amount);
      if (pNum > 0) allVariantPrices.push(pNum);
    });
  } else if (variantPrices) {
    Object.values(variantPrices).forEach((val) => {
      const pNum = parseNumericPrice(val);
      if (pNum > 0) allVariantPrices.push(pNum);
    });
  }

  const explicitMin = p.minPrice ?? p.priceMin ?? (Array.isArray(p.priceRange) ? p.priceRange[0] : undefined);
  const explicitMax = p.maxPrice ?? p.priceMax ?? (Array.isArray(p.priceRange) ? p.priceRange[1] : undefined);

  let rangeMin = parseNumericPrice(explicitMin);
  let rangeMax = parseNumericPrice(explicitMax);

  if (allVariantPrices.length > 1 && (!rangeMin || !rangeMax)) {
    rangeMin = Math.min(...allVariantPrices);
    rangeMax = Math.max(...allVariantPrices);
  }

  const rangeCheck = parsePriceRange(baseRawPrice, rangeMin || undefined, rangeMax || undefined, currency);

  const formattedOriginalPrice = baseOriginalPrice
    ? (typeof baseOriginalPrice === "number"
        ? formatCurrency(baseOriginalPrice, currency)
        : String(baseOriginalPrice))
    : undefined;

  return {
    formattedPrice: rangeCheck.formatted || (baseRawPrice ? String(baseRawPrice) : "LKR 0"),
    numericPrice: rangeCheck.min || parseNumericPrice(baseRawPrice),
    isRange: rangeCheck.isRange,
    minPrice: rangeCheck.min,
    maxPrice: rangeCheck.max,
    formattedOriginalPrice,
    hasVariantPrice: false,
    matchedVariant,
    variantImage,
  };
}

export function resolveProductOptions(
  product?: ProductOptionInput | Record<string, unknown> | null,
): ResolvedProductOptions {
  const p = (product || {}) as ProductOptionInput;

  let colors = parseList(p.colorsText);
  if (!colors.length) colors = parseList(p.colors);
  const colorsLabel = (typeof p.colorsLabel === "string" && p.colorsLabel.trim()) || "Available Colors";
  const defaultColor = colors[0] || "Standard";

  const detailedColors: Array<{ name: string; hex?: string; image?: string }> = [];
  if (Array.isArray(p.colors)) {
    p.colors.forEach((c) => {
      if (typeof c === "string" && c.trim()) {
        detailedColors.push({ name: c.trim() });
      } else if (c && typeof c === "object" && "name" in c) {
        detailedColors.push({
          name: String(c.name).trim(),
          hex: typeof c.hex === "string" ? c.hex : undefined,
          image: typeof c.image === "string" ? c.image : (c as any).imageUrl || (c as any).photo,
        });
      }
    });
  } else if (colors.length > 0) {
    colors.forEach((name) => detailedColors.push({ name }));
  }

  let options = parseList(p.optionsText);
  if (!options.length) options = parseList(p.options);
  if (!options.length) options = parseList(p.sizesText);
  if (!options.length) options = parseList(p.sizes);
  if (!options.length && typeof p.measurement === "string" && p.measurement.trim()) {
    options = [p.measurement.trim()];
  }

  let unit = (typeof p.unit === "string" ? p.unit.trim().toLowerCase() : "") as string;
  if (!unit) {
    const probe = [
      ...options,
      typeof p.measurement === "string" ? p.measurement : "",
      typeof p.title === "string" ? p.title : "",
      typeof p.name === "string" ? p.name : "",
    ].join(" ");

    if (/\b(\d+)\s*(mg)\b/i.test(probe)) {
      unit = "mg";
    } else if (/\b(\d+)\s*(kg)\b/i.test(probe)) {
      unit = "kg";
    } else if (/\b(\d+)\s*(g|grams?)\b/i.test(probe)) {
      unit = "g";
    } else if (/\b(\d+)\s*(ml)\b/i.test(probe)) {
      unit = "ml";
    } else if (/\b(\d+)\s*(l|litres?|liters?)\b/i.test(probe)) {
      unit = "l";
    } else if (/\b(\d+)\s*(pcs|pieces?|pack|packs?|boxes?)\b/i.test(probe)) {
      unit = "pcs";
    } else if (/\b(\d+)\s*(oz|fl\s*oz)\b/i.test(probe)) {
      unit = "oz";
    } else if (/\b(\d+)\s*(lb|lbs)\b/i.test(probe)) {
      unit = "lb";
    } else {
      unit = "size";
    }
  }

  const isMeasurement = unit !== "size";

  let optionsLabel = (typeof p.optionsLabel === "string" && p.optionsLabel.trim()) || "";
  if (!optionsLabel && typeof p.sizesLabel === "string" && p.sizesLabel.trim()) {
    optionsLabel = p.sizesLabel.trim();
  }
  if (!optionsLabel) {
    switch (unit) {
      case "g":
      case "kg":
      case "mg":
      case "oz":
      case "lb":
        optionsLabel = "Net Weight";
        break;
      case "ml":
      case "l":
        optionsLabel = "Volume";
        break;
      case "pcs":
      case "pack":
        optionsLabel = "Pack Size";
        break;
      case "size":
        optionsLabel = "Available Sizes";
        break;
      default:
        optionsLabel = "Available Options";
        break;
    }
  }

  const defaultOption = options[0] || "";

  const formatOption = (option: string | number): string => {
    const raw = String(option ?? "").trim();
    if (!raw) return "";
    if (unit === "size") return raw;

    const regex = new RegExp(`\\b(${unit})$`, "i");
    if (regex.test(raw)) return raw;

    if (/^\d+(\.\d+)?$/.test(raw)) {
      return `${raw}${unit}`;
    }
    return raw;
  };

  const formatSelectedDisplay = (option: string | number): string => {
    const formatted = formatOption(option);
    if (!formatted) return "";
    if (unit === "size") {
      if (/^size\s+/i.test(formatted)) return formatted;
      return `Size ${formatted}`;
    }
    return formatted;
  };

  const formatOrderSnippet = (selectedOption?: string | number, selectedColor?: string): string => {
    const cleanColor =
      selectedColor && selectedColor !== "Standard" ? String(selectedColor).trim() : "";
    const cleanOption = selectedOption ? formatSelectedDisplay(selectedOption) : "";

    if (cleanColor && cleanOption) {
      return `(${cleanColor}, ${cleanOption})`;
    }
    if (cleanOption) {
      return `(${cleanOption})`;
    }
    if (cleanColor) {
      return `(${cleanColor})`;
    }
    return "";
  };

  return {
    unit,
    optionsLabel,
    options,
    defaultOption,
    isMeasurement,
    formatOption,
    formatSelectedDisplay,
    formatOrderSnippet,
    colors,
    detailedColors,
    colorsLabel,
    defaultColor,
  };
}

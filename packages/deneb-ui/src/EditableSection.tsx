import React from "react";
import { BoxSpacing } from "./EditableBox";
import { useComponentStyle } from "./hooks/useComponentStyle";
import { RESPONSIVE_SECTION_PADDING } from "./utils/responsive";

const SECTION_PADDING_MAP: Record<string, string> = RESPONSIVE_SECTION_PADDING;

export interface EditableSectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;

  /**
   * Required fivora design section identifier (e.g. "home-hero", "home-features", "products", "testimonials").
   * Automatically sets `data-design-section`, `data-section-id`, and `id` for full editor targeting.
   */
  name?: string;

  /**
   * Alias for name (e.g. "hero", "services", "contact").
   */
  sectionId?: string;

  /**
   * Vertical section padding ("none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" or custom CSS).
   */
  padding?: BoxSpacing;

  /**
   * Background color or CSS variable.
   */
  bg?: string;

  /**
   * Text color for the section.
   */
  color?: string;

  /**
   * Max width for the section container content.
   */
  maxWidth?: string | number;

  /**
   * Section border style.
   */
  border?: string | boolean;

  /**
   * Content alignment: "left" | "center" | "right".
   */
  align?: "left" | "center" | "right";

  /**
   * Quick toggle to center all content and text horizontally.
   */
  center?: boolean;
  centered?: boolean;

  /**
   * Whether this section is hidden or deleted.
   */
  hidden?: boolean;

  /**
   * Visual flexbox order for section reordering (e.g. 1, 2, 3).
   */
  order?: number | string;

  /**
   * Whether to wrap children in a responsive inner container.
   */
  container?: boolean;

  /**
   * Class name for the inner container if container=true.
   */
  containerClassName?: string;
}

/**
 * EditableSection standardizes section spacing and automatically applies the required
 * `data-design-section` and `data-section-id` markers for 100% fivora contract compliance,
 * with first-class support for section deletion/hiding and instant centering.
 */
export function EditableSection({
  as: Component = "section",
  name,
  sectionId,
  padding = "lg",
  bg,
  color,
  maxWidth,
  border,
  align,
  center,
  centered,
  hidden,
  order,
  container,
  containerClassName = "",
  className = "",
  style,
  id,
  children,
  ...props
}: EditableSectionProps) {
  const resolvedSectionKey = sectionId || name || "section";
  const resolvedPadding =
    padding !== undefined ? (SECTION_PADDING_MAP[String(padding)] || String(padding)) : undefined;

  const resolvedBorder =
    border === true
      ? "1px solid var(--border-color, rgba(226, 232, 240, 0.8))"
      : typeof border === "string"
      ? border
      : undefined;

  const stylePath = `${resolvedSectionKey}.section`;
  const { cssVars: styleVars } = useComponentStyle(stylePath, "section");

  const isCentered = centered ?? center;
  const resolvedAlign = align || (isCentered ? "center" : undefined);

  const sectionStyle: React.CSSProperties = {
    ...(resolvedPadding ? { padding: resolvedPadding } : {}),
    ...(bg ? { background: bg } : {}),
    ...(color ? { color } : {}),
    ...(maxWidth !== undefined && !container ? { maxWidth, marginLeft: "auto", marginRight: "auto" } : {}),
    ...(resolvedBorder ? { borderBottom: resolvedBorder } : {}),
    ...(resolvedAlign ? { textAlign: resolvedAlign } : {}),
    ...(hidden ? { display: "none" } : {}),
    ...(order !== undefined && order !== "" ? { order: Number(order) } : {}),
    ...styleVars,
    ...style,
  };

  const content = container ? (
    <div
      className={`deneb-section-container ${containerClassName}`.trim()}
      style={{
        maxWidth: maxWidth !== undefined ? maxWidth : "1280px",
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: "1rem",
        paddingRight: "1rem",
        ...(resolvedAlign === "center" ? { display: "flex", flexDirection: "column", alignItems: "center" } : {}),
      }}
    >
      {children}
    </div>
  ) : (
    children
  );

  return (
    <Component
      id={id || resolvedSectionKey}
      data-design-section={resolvedSectionKey}
      data-section-id={resolvedSectionKey}
      data-section-visible={hidden ? "false" : "true"}
      data-preview-style-target={stylePath}
      data-preview-style-type="section"
      className={`deneb-section editable-section ${isCentered ? "is-centered" : ""} ${className}`.trim()}
      style={sectionStyle}
      {...(props as any)}
    >
      {content}
    </Component>
  );
}

export default EditableSection;

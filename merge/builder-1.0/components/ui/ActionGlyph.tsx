"use client";

/**
 * ActionGlyph — small distinct SVG mark per PoA activation type.
 *
 * Used in tab headers / rows to give each activation type an at-a-glance
 * shape, independent of color (color comes from `.poa-tag` variants or the
 * `color` prop). All glyphs draw in currentColor on a 24×24 viewBox.
 */
import type { ActivationType } from "./TagPill";

interface ActionGlyphProps {
  type: ActivationType;
  size?: number;
  color?: string;
  title?: string;
}

const PATHS: Record<ActivationType, React.ReactNode> = {
  // Passive — steady ring
  passive: <circle cx="12" cy="12" r="7" />,
  // Offensive — crossed strike
  offensive: (
    <>
      <path d="M5 5 L19 19" />
      <path d="M19 7 L7 19" />
    </>
  ),
  // Maneuver — directional chevrons
  maneuver: (
    <>
      <path d="M6 7 L12 12 L6 17" />
      <path d="M13 7 L19 12 L13 17" />
    </>
  ),
  // Utility — gear-like diamond
  utility: (
    <>
      <path d="M12 4 L20 12 L12 20 L4 12 Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  // Trigger — lightning
  trigger: <path d="M13 3 L6 13 L11 13 L10 21 L18 10 L13 10 Z" />,
  // Narrative — open book / pages
  narrative: (
    <>
      <path d="M12 6 C9 4 5 4 4 5 L4 18 C5 17 9 17 12 19" />
      <path d="M12 6 C15 4 19 4 20 5 L20 18 C19 17 15 17 12 19" />
    </>
  ),
};

export default function ActionGlyph({
  type,
  size = 16,
  color = "currentColor",
  title,
}: ActionGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {PATHS[type]}
    </svg>
  );
}

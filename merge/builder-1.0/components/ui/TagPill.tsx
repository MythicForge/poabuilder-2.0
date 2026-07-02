"use client";

/**
 * TagPill — trait / activation-type pill.
 *
 * Maps a PoA activation type (or free trait) to the `.poa-tag` color variants
 * defined in globals.css (R0). Unknown strings fall back to the neutral pill.
 */

export type ActivationType =
  | "passive"
  | "offensive"
  | "maneuver"
  | "utility"
  | "trigger"
  | "narrative";

const KNOWN: ActivationType[] = [
  "passive",
  "offensive",
  "maneuver",
  "utility",
  "trigger",
  "narrative",
];

/** Normalize a raw activation string to a known variant, or null. */
export function activationVariant(raw?: string | null): ActivationType | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  return KNOWN.find((k) => s.includes(k)) ?? null;
}

interface TagPillProps {
  /** Activation type → colored variant. */
  type?: ActivationType | null;
  /** Visible text. Defaults to the type label. */
  label?: string;
  className?: string;
  title?: string;
}

export default function TagPill({ type, label, className, title }: TagPillProps) {
  const variant = type ?? "";
  const text = label ?? (type ? type.toUpperCase() : "");
  return (
    <span
      className={`poa-tag ${variant} ${className ?? ""}`.trim()}
      title={title}
    >
      {text}
    </span>
  );
}

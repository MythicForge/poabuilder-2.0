// Normalizes dirty `trait` values from feat JSON ("Passive| Range Close",
// "Trigger | Range Engagement", "loud", "reload", "") into a fixed set.

export type NormalizedTrait =
  | "passive"
  | "trigger"
  | "utility"
  | "narrative"
  | "offensive"
  | "maneuver"
  | "support";

const KNOWN: ReadonlySet<string> = new Set([
  "passive",
  "trigger",
  "utility",
  "narrative",
  "offensive",
  "maneuver",
  "support",
]);

export function normalizeTrait(raw: string | null | undefined): NormalizedTrait | null {
  if (!raw) return null;
  const first = raw.split("|")[0]?.trim().toLowerCase();
  return first && KNOWN.has(first) ? (first as NormalizedTrait) : null;
}

// Category color for feat/combat source rails — five hues drawn from existing
// tokens (not per-profession) so the rail stays scannable on a gold/dark sheet.

import type { FeatSource } from "../core/types.ts";

export const SOURCE_COLOR: Record<FeatSource, string> = {
  profession: "var(--gold)",
  path: "var(--tag-maneuver)",
  origin: "var(--tag-utility)",
  vocation: "var(--vitality)",
  universal: "var(--text-muted)",
};

// Feat-granted expertise. Expressed as `proficiency` boons, not choice pickers:
//   { type:"proficiency", category:"expertise_points", value:"2" }
//     → +2 expertise points to the budget; the player spends them in Attributes.
//   { type:"proficiency", category:"expertise_gained", value:"vigor" }
//     → +1 expertise rank in that specific skill (free, no budget cost).
// Both are FREE: expertise_gained never counts against the tier expertise budget.

import type { ActiveBoon } from "./types.ts";
import { SKILLS } from "./types.ts";

const canonSkill = (v: unknown): string | null => {
  const s = String(v ?? "").toLowerCase();
  return SKILLS.find((k) => k.toLowerCase() === s) ?? null;
};

export interface FeatExpertiseGrants {
  /** extra expertise points added to the budget (spent in the Attributes step). */
  points: number;
  /** free expertise ranks per skill (does not touch the budget). */
  gained: Record<string, number>;
}

export function featExpertiseGrants(activeBoons: ActiveBoon[]): FeatExpertiseGrants {
  let points = 0;
  const gained: Record<string, number> = {};
  for (const { boon } of activeBoons) {
    if (boon.type !== "proficiency") continue;
    if (boon.category === "expertise_points") {
      const n = Number(boon.value);
      if (Number.isFinite(n)) points += n;
    } else if (boon.category === "expertise_gained") {
      const skill = canonSkill(boon.value);
      if (skill) gained[skill] = (gained[skill] ?? 0) + 1;
    }
  }
  return { points, gained };
}

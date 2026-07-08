// spellAccessible — is this spell choosable/knowable by this build's spellcasting?
// Used both as a hard gate in the builder's spell picker and as a soft warning
// in validateCharacter (existing characters keep spells that later fail the check).

import type { ComputedSpellcasting, Spell } from "./types.ts";

export interface SpellAccessResult {
  ok: boolean;
  reason?: string;
}

export function spellAccessible(spell: Spell, sc: ComputedSpellcasting | null): SpellAccessResult {
  if (!sc) return { ok: false, reason: "no spellcasting grant" };

  if (spell.sources.length === 0) return { ok: true, reason: "no source data" };

  if (spell.sources.includes("Universal")) return { ok: true };

  if (sc.sources.some((s) => spell.sources.includes(s))) return { ok: true };

  if (sc.spheres.length > 0 && spell.spheres.some((sp) => sc.spheres.includes(sp))) return { ok: true };

  return { ok: false, reason: `requires source ${spell.sources.join(" or ")}` };
}

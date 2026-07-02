// Rest actions: Respite / Long Rest / Daily Preparation.
// Applies recovery formulas from universal-resources.json + profession
// resource defs, resets limited-use counters by recharge tier, clears
// daily modes on daily preparation.

import type { ComputedCharacter, StoredCharacter } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { evalFormula, standardEnv } from "./formula.ts";

export type RestKind = "respite" | "long_rest" | "daily_preparation" | "full_rest";

// which recharge tags a rest kind refreshes
const RECHARGES: Record<RestKind, string[]> = {
  respite: ["respite"],
  long_rest: ["respite", "long_rest"],
  daily_preparation: ["daily_preparation"],
  full_rest: ["respite", "long_rest", "daily_preparation", "full_rest"],
};

export function applyRest(
  stored: StoredCharacter,
  computed: ComputedCharacter,
  reg: Registry,
  kind: RestKind,
): StoredCharacter {
  const next = structuredClone(stored);
  const env = standardEnv(computed.attributes, computed.tier);

  // ambition (universal)
  const amb = reg.universalResources.find((r) => r.id === "ambition");
  const ambRec = amb?.recovery?.[kind === "daily_preparation" ? "respite" : kind] ?? amb?.recovery?.[kind];
  if (ambRec !== undefined && kind !== "daily_preparation") {
    next.pools.ambition = restoreValue(next.pools.ambition, computed.ambition.max, ambRec, env);
  }

  // long/full rest: vitality to max, temp cleared
  if (kind === "long_rest" || kind === "full_rest") {
    next.pools.vitality = computed.vitality.max;
    next.pools.temp_vitality = 0;
  }

  // profession resources
  for (const r of computed.resources) {
    const rec = r.def.recovery?.[kind];
    if (rec !== undefined) {
      next.pools.resources[r.def.id] = restoreValue(
        next.pools.resources[r.def.id] ?? r.current, r.max, rec, env,
      );
    }
    if (kind === "full_rest") next.pools.resources[r.def.id] = r.max;
  }

  // reservoir follows its source resource if it is one; otherwise refill on long rest
  if (computed.spellcasting && (kind === "long_rest" || kind === "full_rest")) {
    next.pools.reservoir = computed.spellcasting.reservoirMax;
  }

  // limited-use counters: uses whose recharge matches reset (engine stores
  // REMAINING uses; deleting the key means "full")
  const tags = RECHARGES[kind];
  for (const card of computed.featCards) {
    const u = card.feat.uses;
    if (u && tags.includes(u.recharge)) delete next.pools.uses[card.feat.id];
  }
  // free-success counters keyed by boon context reset the same way
  for (const { boon } of computed.activeBoons) {
    if (boon.type === "grants_free_success" && typeof boon.context === "string") {
      const recharge = typeof boon.recharge === "string" ? boon.recharge : "daily_preparation";
      if (tags.includes(recharge)) delete next.pools.free_successes[boon.context];
    }
  }

  if (kind === "daily_preparation" || kind === "full_rest") {
    for (const k of Object.keys(next.daily_modes)) next.daily_modes[k] = null;
  }
  if (kind === "respite") next.play.respites_used += 1;
  if (kind === "long_rest" || kind === "full_rest") next.play.respites_used = 0;

  return next;
}

function restoreValue(
  current: number,
  max: number,
  rec: number | "max" | { formula: string; minimum?: number },
  env: Record<string, number>,
): number {
  if (rec === "max") return max;
  if (typeof rec === "number") return Math.min(max, current + rec);
  let amount = 0;
  try { amount = evalFormula(rec.formula, env); } catch { amount = 0; }
  if (rec.minimum !== undefined) amount = Math.max(amount, rec.minimum);
  return Math.min(max, current + amount);
}

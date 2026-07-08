// Rest actions: Respite / Long Rest (Daily Preparation folded in).
// Applies recovery formulas from universal-resources.json + profession
// resource defs, resets limited-use counters by recharge tier, clears
// daily modes on long rest.

import type { ComputedCharacter, PoolSnapshot, StoredCharacter } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { evalFormula, standardEnv } from "./formula.ts";

export type RestKind =
  "respite" | "long_rest" | "daily_preparation" | "full_rest";

// Max respites per Long Rest cycle: 3 at tier 1-2, 4 at tier 3-4, 5 at tier 5+.
export function maxRespites(tier: number): number {
  if (tier >= 5) return 5;
  if (tier >= 3) return 4;
  return 3;
}

// which recharge tags a rest kind refreshes
// Daily Preparation is rules-as-written folded into the Long Rest (it only ever
// happens after one), so long_rest also recharges daily_preparation-tagged uses
// and clears daily modes. The kind/tag stays for feats that recharge on it.
const RECHARGES: Record<RestKind, string[]> = {
  respite: ["respite"],
  long_rest: ["respite", "long_rest", "daily_preparation"],
  daily_preparation: ["daily_preparation"],
  full_rest: ["respite", "long_rest", "daily_preparation", "full_rest"],
};

export function applyRest(
  stored: StoredCharacter,
  computed: ComputedCharacter,
  reg: Registry,
  kind: RestKind,
): StoredCharacter {
  if (
    kind === "respite" &&
    stored.play.respites_used >= maxRespites(computed.tier)
  )
    return stored;

  const next = structuredClone(stored);
  const env = standardEnv(computed.attributes, computed.tier);
  const beforePools = snapshotPools(stored.pools);

  // vitality/ambition/reservoir recovery on respite & long/full rest
  // (Take_Respite / Take_Long_Rest, exmp/wounds-logic.md). "Regain a total
  // equal to X" is additive: add X to the current pool, capped at the pool's
  // computed max. Respite adds the flat stat; long/full rest adds 3× the stat
  // with a minimum of 10.
  //
  // Fortitude → Fortitude defense (8 + Brawn); Will → Will defense (8 + Will);
  // Spellcasting_Modifier → caster modifierValue (casters only).
  const regain = (current: number, amount: number, max: number) =>
    Math.min(max, current + amount);

  const fortitude = computed.defenses.Fortitude;
  const will = computed.defenses["Will Defense"];
  const spellMod = computed.spellcasting?.modifierValue ?? 0;

  if (kind === "respite") {
    // additive recovery — add the flat stat, capped at max
    next.pools.vitality = regain(
      next.pools.vitality,
      fortitude,
      computed.vitality.max,
    );
    next.pools.ambition = regain(
      next.pools.ambition,
      Math.round(will / 3),
      computed.ambition.max,
    );
    if (computed.spellcasting) {
      next.pools.reservoir = regain(
        next.pools.reservoir,
        Math.max(spellMod, 3),
        computed.spellcasting.reservoirMax,
      );
    }
  } else if (kind === "long_rest" || kind === "full_rest") {
    // additive recovery — add max(3× stat, 10), capped at max
    next.pools.vitality = regain(
      next.pools.vitality,
      Math.max(3 * fortitude, 10),
      computed.vitality.max,
    );
    next.pools.temp_vitality = 0;
    next.pools.ambition = regain(
      next.pools.ambition,
      Math.max(will, 10),
      computed.ambition.max,
    );
    if (computed.spellcasting) {
      next.pools.reservoir = regain(
        next.pools.reservoir,
        Math.max(3 * spellMod, 10),
        computed.spellcasting.reservoirMax,
      );
    }
  }

  // equipped shield repairs to full on a long/full rest (re-forge). The pool
  // lives on the inventory item's reduction_pool_current, keyed by item id.
  if ((kind === "long_rest" || kind === "full_rest") && computed.shield) {
    const { itemId, max } = computed.shield;
    next.inventory.items = next.inventory.items.map((it) =>
      it.id === itemId ? { ...it, reduction_pool_current: max } : it,
    );
  }

  // wounds heal on respite/long rest/full rest (exmp/wounds-logic.md)
  if (kind === "respite") {
    next.pools.wounds = Math.max(0, next.pools.wounds - computed.tier);
  } else if (kind === "long_rest" || kind === "full_rest") {
    next.pools.wounds = Math.max(
      0,
      next.pools.wounds - Math.max(3 * computed.tier, 10),
    );
  }

  // profession resources
  for (const r of computed.resources) {
    const rec = r.def.recovery?.[kind];
    if (rec !== undefined) {
      next.pools.resources[r.def.id] = restoreValue(
        next.pools.resources[r.def.id] ?? r.current,
        r.max,
        rec,
        env,
      );
    }
    if (kind === "full_rest") next.pools.resources[r.def.id] = r.max;
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
    if (
      boon.type === "grants_free_success" &&
      typeof boon.context === "string"
    ) {
      const recharge =
        typeof boon.recharge === "string" ? boon.recharge : "daily_preparation";
      if (tags.includes(recharge))
        delete next.pools.free_successes[boon.context];
    }
  }

  if (kind === "daily_preparation" || kind === "long_rest" || kind === "full_rest") {
    for (const k of Object.keys(next.daily_modes)) next.daily_modes[k] = null;
  }
  if (kind === "respite") {
    next.play.respites_used += 1;
    (next.play.respite_snapshots ??= []).push({
      before: beforePools,
      after: snapshotPools(next.pools),
    });
  }
  if (kind === "long_rest" || kind === "full_rest") {
    next.play.respites_used = 0;
    next.play.respite_snapshots = [];
  }

  return next;
}

// ── Respite undo (pip-driven) ────────────────────────────────────────────────

function snapshotPools(p: StoredCharacter["pools"]): PoolSnapshot {
  return {
    vitality: p.vitality,
    temp_vitality: p.temp_vitality,
    wounds: p.wounds,
    ambition: p.ambition,
    reservoir: p.reservoir,
    resources: { ...p.resources },
  };
}

function poolsEqual(a: PoolSnapshot, b: PoolSnapshot): boolean {
  if (
    a.vitality !== b.vitality ||
    a.temp_vitality !== b.temp_vitality ||
    a.wounds !== b.wounds ||
    a.ambition !== b.ambition ||
    a.reservoir !== b.reservoir
  )
    return false;
  const keys = new Set([...Object.keys(a.resources), ...Object.keys(b.resources)]);
  for (const k of keys) if (a.resources[k] !== b.resources[k]) return false;
  return true;
}

/** True when pools have moved since the most recent respite (undo would clobber
 *  those changes). The UI uses this to decide whether to confirm before undo. */
export function lastRespiteDrifted(stored: StoredCharacter): boolean {
  const snaps = stored.play.respite_snapshots;
  if (!snaps?.length) return false;
  return !poolsEqual(snapshotPools(stored.pools), snaps[snaps.length - 1].after);
}

/** Undo the most recent respite: restore the pre-respite pools and free the
 *  respite. Falls back to a counter-only decrement if no snapshot exists
 *  (e.g. saves from before snapshots were tracked). */
export function undoLastRespite(stored: StoredCharacter): StoredCharacter {
  if (stored.play.respites_used <= 0) return stored;
  const next = structuredClone(stored);
  next.play.respites_used -= 1;
  const snaps = next.play.respite_snapshots;
  if (snaps?.length) {
    const { before } = snaps.pop()!;
    next.pools = { ...next.pools, ...before, resources: { ...before.resources } };
  }
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
  try {
    amount = evalFormula(rec.formula, env);
  } catch {
    amount = 0;
  }
  if (rec.minimum !== undefined) amount = Math.max(amount, rec.minimum);
  return Math.min(max, current + amount);
}

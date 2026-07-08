// Damage application: hits Temp Vitality first, then Vitality. Damage that
// exceeds Vitality does NOT overflow into Wounds — Vitality simply bottoms
// out at 0. Wounds are only ever inflicted directly (rest recovery, armor
// swaps, or hand-set in the UI), never as spillover from ordinary damage.

import type { ActiveBoon, StoredCharacter } from "./types.ts";
import { evalFormula, type FormulaEnv } from "./formula.ts";
import { evalCondition, type ConditionCtx } from "./conditions.ts";

// ── Boon-driven combat bonuses (damage_bonus / attack_option / cantrip_upgrade) ─
// The damage layer consumes the formula-bearing combat boons the engine used to
// ignore. Formulas are evaluated against the character env (dice resolve to
// their rounded average, matching the rest of the engine); conditions gate
// whether a bonus is currently active (unknown/prose ⇒ shown but inactive).

export interface DamageBonus {
  formula: string;
  /** Rounded-average numeric value of `formula` (dice averaged). */
  value: number;
  damageType: string | null;
  appliesTo: string | null;
  condition: string | null;
  active: boolean;
  source: string;
}

export interface AttackOption {
  name: string;
  attackType: string | null;
  damageDice: string | null;
  damageModifier: string | null;
  targetsDefense: string | null;
  range: string | null;
  source: string;
}

export interface CantripUpgrade {
  bonus: string;
  count: number;
  minimumDieSize: string | null;
  source: string;
}

export interface CombatBonuses {
  damageBonuses: DamageBonus[];
  attackOptions: AttackOption[];
  cantripUpgrades: CantripUpgrade[];
}

function evalNum(v: unknown, env: FormulaEnv, warnings: string[], label: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      return evalFormula(v, env);
    } catch (e) {
      warnings.push(`bad formula "${v}" in ${label}: ${(e as Error).message}`);
    }
  }
  return 0;
}

/** Pick the dice string for the current tier from an attack_option tier_scaling table. */
function diceForTier(scaling: unknown, tier: number): string | null {
  if (!Array.isArray(scaling)) return null;
  let best: string | null = null;
  for (const row of scaling as Array<{ tier: number; dice: string }>) {
    if (typeof row?.tier === "number" && row.tier <= tier && typeof row.dice === "string")
      best = row.dice;
  }
  return best;
}

export function computeCombatBonuses(
  active: ActiveBoon[],
  env: FormulaEnv,
  tier: number,
  condCtx: ConditionCtx,
  warnings: string[],
): CombatBonuses {
  const damageBonuses: DamageBonus[] = [];
  const attackOptions: AttackOption[] = [];
  const cantripUpgrades: CantripUpgrade[] = [];

  for (const { boon, source } of active) {
    if (boon.type === "damage_bonus") {
      const formula = String(boon.formula ?? boon.amount ?? "0");
      const cond = boon.condition != null ? String(boon.condition) : null;
      damageBonuses.push({
        formula,
        value: evalNum(boon.formula ?? boon.amount, env, warnings, `${source.featId} damage_bonus`),
        damageType: typeof boon.damage_type === "string" ? boon.damage_type : null,
        appliesTo:
          typeof boon.applies_to === "string"
            ? boon.applies_to
            : typeof boon.application === "string"
              ? boon.application
              : null,
        condition: cond,
        active: cond ? evalCondition(cond, condCtx) === true : true,
        source: source.featId,
      });
    } else if (boon.type === "attack_option") {
      attackOptions.push({
        name: source.featName,
        attackType: typeof boon.attack_type === "string" ? boon.attack_type : null,
        damageDice: diceForTier(boon.tier_scaling, tier),
        damageModifier: typeof boon.damage_modifier === "string" ? boon.damage_modifier : null,
        targetsDefense: typeof boon.targets_defense === "string" ? boon.targets_defense : null,
        range: typeof boon.range === "string" ? boon.range : null,
        source: source.featId,
      });
    } else if (boon.type === "cantrip_upgrade") {
      cantripUpgrades.push({
        bonus: typeof boon.bonus === "string" ? boon.bonus : "damage_or_healing_die",
        count: typeof boon.count === "number" ? boon.count : 1,
        minimumDieSize: typeof boon.minimum_die_size === "string" ? boon.minimum_die_size : null,
        source: source.featId,
      });
    }
  }

  return { damageBonuses, attackOptions, cantripUpgrades };
}

export function applyDamage(
  stored: StoredCharacter,
  amount: number,
): StoredCharacter {
  if (amount <= 0) return stored;

  const absorbed = Math.min(stored.pools.temp_vitality, amount);
  const temp = stored.pools.temp_vitality - absorbed;
  const vitality = Math.max(0, stored.pools.vitality - (amount - absorbed));

  return { ...stored, pools: { ...stored.pools, temp_vitality: temp, vitality } };
}

// Swap_Armor wound handling (exmp/wounds-logic.md). At 0 wounds: threshold
// just moves, wounds stay 0 (no phantom wounds from swapping up). Threshold ↑:
// no free heal — wounds stay the same distance from the new max as from the old
// (buffer preserved). Threshold ↓ to at/below current wounds: drop to one
// below the new max instead of instant death. Otherwise: no change.
export function rescaleWoundsOnThresholdChange(
  stored: StoredCharacter,
  oldMax: number,
  newMax: number,
): StoredCharacter {
  const wounds = stored.pools.wounds;

  // Unwounded: no buffer to preserve. The threshold just moves; the player
  // stays at 0 wounds. (Buffer preservation only matters once wounded — this
  // stops swapping into higher-threshold armor from phantom-inflicting wounds.)
  if (wounds <= 0) return stored;

  if (newMax > oldMax) {
    const buffer = oldMax - wounds;
    const next = Math.max(0, Math.min(newMax, newMax - buffer));
    return next === wounds ? stored : { ...stored, pools: { ...stored.pools, wounds: next } };
  }

  if (newMax <= wounds) {
    const next = Math.max(0, newMax - 1);
    return next === wounds ? stored : { ...stored, pools: { ...stored.pools, wounds: next } };
  }

  return stored;
}

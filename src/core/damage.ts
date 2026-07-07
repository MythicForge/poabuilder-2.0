// Damage application: hits Temp Vitality first, then Vitality. Damage that
// exceeds Vitality does NOT overflow into Wounds — Vitality simply bottoms
// out at 0. Wounds are only ever inflicted directly (rest recovery, armor
// swaps, or hand-set in the UI), never as spillover from ordinary damage.

import type { StoredCharacter } from "./types.ts";

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

// Swap_Armor wound handling (exmp/wounds-logic.md). Threshold ↑: no free
// heal — wounds stay the same distance from the new max as from the old
// (buffer preserved). Threshold ↓ to at/below current wounds: drop to one
// below the new max instead of instant death. Otherwise: no change.
export function rescaleWoundsOnThresholdChange(
  stored: StoredCharacter,
  oldMax: number,
  newMax: number,
): StoredCharacter {
  const wounds = stored.pools.wounds;

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

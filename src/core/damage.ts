// Unified damage application: normal damage hits Vitality (and Temp
// Vitality) first; once Vitality is at 0, or when damage is flagged as
// direct Wound damage, the remainder is applied to Wounds. Wounds are never
// clamped to the threshold — exceeding it is what signals death/incapacity
// (see WoundsAmbitionRest's `dead` check).

import type { StoredCharacter } from "./types.ts";

export function applyDamage(
  stored: StoredCharacter,
  amount: number,
  isWoundDamage: boolean,
): StoredCharacter {
  if (amount <= 0) return stored;

  let temp = stored.pools.temp_vitality;
  let vitality = stored.pools.vitality;
  let wounds = stored.pools.wounds;
  let remaining = amount;

  if (!isWoundDamage && vitality > 0) {
    const absorbed = Math.min(temp, remaining);
    temp -= absorbed;
    remaining -= absorbed;

    const vitalityHit = Math.min(vitality, remaining);
    vitality -= vitalityHit;
    remaining -= vitalityHit;
  }

  wounds += remaining;

  return { ...stored, pools: { ...stored.pools, temp_vitality: temp, vitality, wounds } };
}

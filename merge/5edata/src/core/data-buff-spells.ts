import SPELL_BUFF_LIST from "./spell-buff-list.json";
import type { ComputedChar, StoredChar } from "./types";

// ── Schema types ──────────────────────────────────────────────────────────────

export interface SpellEffect {
  type: string;
  value: number | string;
  condition?: string;
  damageTypes?: string[];
  note: string;
}

export interface SlotScaling {
  base: number;
  valuePerSlot?: number;
  thresholds?: [number, number][];
  affectsTargets?: true;
  note: string;
}

export interface SpellBuffEntry {
  name: string;
  effects: SpellEffect[];
  scalesWithSlot?: SlotScaling;
}

export type SpellBuffList = Record<string, SpellBuffEntry[]>;

export const TYPED_BUFF_LIST = SPELL_BUFF_LIST as unknown as SpellBuffList;

export const BUFF_ENTRY_MAP: Record<string, SpellBuffEntry> = Object.fromEntries(
  Object.values(TYPED_BUFF_LIST)
    .flat()
    .map((e) => [e.name, e]),
);

// ── Scaling ───────────────────────────────────────────────────────────────────

function getScaledValue(
  baseValue: number | string,
  scaling: SlotScaling | undefined,
  castLevel: number,
): number | string {
  if (!scaling || typeof baseValue !== "number") return baseValue;

  if (scaling.thresholds) {
    const thr = [...scaling.thresholds]
      .reverse()
      .find(([lvl]) => castLevel >= lvl);
    return thr ? thr[1] : baseValue;
  }

  if (scaling.valuePerSlot) {
    return baseValue + Math.max(0, castLevel - scaling.base) * scaling.valuePerSlot;
  }

  return baseValue;
}

// ── Roll string helpers ───────────────────────────────────────────────────────

function addFlatToRoll(roll: string, bonus: number): string {
  if (!roll || bonus === 0) return roll;
  const m = roll.match(/^(.+?)([+-]\d+)$/);
  if (m) {
    const n = parseInt(m[2], 10) + bonus;
    return n === 0 ? m[1] : `${m[1]}${n > 0 ? "+" : ""}${n}`;
  }
  return bonus > 0 ? `${roll}+${bonus}` : bonus < 0 ? `${roll}${bonus}` : roll;
}

// ── Main applicator ───────────────────────────────────────────────────────────

export function applyBuffs(c: ComputedChar, stored: StoredChar): ComputedChar {
  const activeBuffs = stored.activeBuffs ?? {};
  if (Object.keys(activeBuffs).length === 0) {
    return { ...c, buffBonuses: null };
  }

  let ac = c.ac;
  let speedFt = c.speedFt;
  let hpMax = c.hp.max;
  let hpCurrent = c.hp.current;
  const resistances = [...c.damageResistances];

  let flatAttackBonus = 0;
  let attackDie: string | null = null;
  let flatSaveBonus = 0;
  let saveDie: string | null = null;
  let skillDie: string | null = null;
  let flatDamageBonus = 0;
  let damageDie: string | null = null;
  let dmgReductionDie: string | null = null;
  const advantages: string[] = [];

  for (const [name, buffState] of Object.entries(activeBuffs)) {
    const entry = BUFF_ENTRY_MAP[name];
    if (!entry) continue;

    const castLevel = buffState.castLevel ?? entry.scalesWithSlot?.base ?? 1;

    for (const effect of entry.effects) {
      const sv = getScaledValue(effect.value, entry.scalesWithSlot, castLevel);

      switch (effect.type) {
        case "ac_base": {
          if (effect.value === "13+DEX") {
            ac = Math.max(ac, 13 + c.abilities.DEX.mod);
          } else if (typeof effect.value === "number") {
            ac = Math.max(ac, effect.value);
          }
          break;
        }
        case "ac_bonus": {
          if (typeof sv === "number") ac += sv;
          break;
        }
        case "hp_max": {
          if (typeof sv === "number") {
            hpMax += sv;
            hpCurrent += sv;
          }
          break;
        }
        case "speed_bonus": {
          // Skip fly/climb speed bonuses — no separate speed fields on ComputedChar
          if (typeof sv === "number" && !effect.condition?.includes("fly")) {
            speedFt += sv;
          }
          break;
        }
        case "speed_multiply": {
          if (typeof sv === "number") speedFt = Math.round(speedFt * sv);
          break;
        }
        case "attack_bonus": {
          if (typeof sv === "number") flatAttackBonus += sv;
          else if (typeof sv === "string") attackDie = sv;
          break;
        }
        case "save_bonus": {
          if (typeof sv === "number") flatSaveBonus += sv;
          else if (typeof sv === "string") saveDie = sv;
          break;
        }
        case "skill_bonus": {
          // Dice skill bonus (Guidance) — not applicable to flat mod
          if (typeof sv === "string") skillDie = sv;
          // Flat skill bonuses applied per-skill below
          break;
        }
        case "damage_bonus": {
          if (typeof sv === "number") flatDamageBonus += sv;
          break;
        }
        case "damage_die": {
          if (typeof effect.value === "string") damageDie = effect.value;
          break;
        }
        case "damage_reduction": {
          if (typeof effect.value === "string") dmgReductionDie = effect.value;
          break;
        }
        case "resistance": {
          if (effect.damageTypes && effect.damageTypes[0] !== "all") {
            for (const dt of effect.damageTypes) {
              const key = dt.charAt(0).toUpperCase() + dt.slice(1);
              if (!resistances.some((r) => r.toLowerCase() === dt.toLowerCase()))
                resistances.push(key);
            }
          }
          break;
        }
        case "advantage": {
          if (effect.condition) advantages.push(`${effect.condition} — ${name}`);
          break;
        }
      }
    }
  }

  // Per-skill flat bonuses (e.g. Pass without Trace: +10 Stealth)
  const skillDeltas: Record<string, number> = {};
  for (const [name, buffState] of Object.entries(activeBuffs)) {
    const entry = BUFF_ENTRY_MAP[name];
    if (!entry) continue;
    const castLevel = buffState.castLevel ?? entry.scalesWithSlot?.base ?? 1;
    for (const effect of entry.effects) {
      if (effect.type === "skill_bonus" && typeof effect.value === "number" && effect.condition) {
        const sv = getScaledValue(effect.value, entry.scalesWithSlot, castLevel);
        if (typeof sv !== "number") continue;
        const cond = effect.condition.toLowerCase();
        for (const sk of c.skills) {
          if (cond.includes(sk.name.toLowerCase())) {
            skillDeltas[sk.name] = (skillDeltas[sk.name] ?? 0) + sv;
          }
        }
      }
    }
  }
  const updatedSkills =
    Object.keys(skillDeltas).length > 0
      ? c.skills.map((sk) =>
          skillDeltas[sk.name] != null
            ? { ...sk, mod: sk.mod + skillDeltas[sk.name] }
            : sk,
        )
      : c.skills;

  // Recalculate passives if perception/investigation/insight changed
  const perceptionSkill = updatedSkills.find((sk) => sk.name === "Perception");
  const investigationSkill = updatedSkills.find((sk) => sk.name === "Investigation");
  const insightSkill = updatedSkills.find((sk) => sk.name === "Insight");
  const updatedPassive =
    perceptionSkill || investigationSkill || insightSkill
      ? {
          perception: 10 + (perceptionSkill?.mod ?? c.passive.perception - 10),
          investigation: 10 + (investigationSkill?.mod ?? c.passive.investigation - 10),
          insight: 10 + (insightSkill?.mod ?? c.passive.insight - 10),
        }
      : c.passive;

  // Flat save bonus to all saves
  const updatedAbilities =
    flatSaveBonus !== 0
      ? (Object.fromEntries(
          Object.entries(c.abilities).map(([k, v]) => [
            k,
            { ...v, save: v.save + flatSaveBonus },
          ]),
        ) as typeof c.abilities)
      : c.abilities;

  // Flat attack + damage bonuses to all attacks
  const updatedAttacks =
    flatAttackBonus !== 0 || flatDamageBonus !== 0
      ? c.attacks.map((atk) => ({
          ...atk,
          bonus:
            typeof atk.bonus === "number"
              ? atk.bonus + flatAttackBonus
              : atk.bonus,
          dmg: addFlatToRoll(atk.dmg, flatDamageBonus),
        }))
      : c.attacks;

  const hasBonus =
    flatAttackBonus !== 0 ||
    attackDie !== null ||
    flatSaveBonus !== 0 ||
    saveDie !== null ||
    skillDie !== null ||
    flatDamageBonus !== 0 ||
    damageDie !== null ||
    dmgReductionDie !== null ||
    advantages.length > 0;

  return {
    ...c,
    ac,
    speedFt,
    speed: Math.round(speedFt * 0.3),
    hp: { ...c.hp, max: hpMax, current: Math.min(hpCurrent, hpMax) },
    abilities: updatedAbilities,
    skills: updatedSkills,
    passive: updatedPassive,
    attacks: updatedAttacks,
    damageResistances: resistances,
    buffBonuses: hasBonus
      ? {
          attackBonus: flatAttackBonus,
          attackDie,
          saveBonus: flatSaveBonus,
          saveDie,
          skillDie,
          damageBonus: flatDamageBonus,
          damageDie,
          dmgReductionDie,
          advantages,
        }
      : null,
  };
}

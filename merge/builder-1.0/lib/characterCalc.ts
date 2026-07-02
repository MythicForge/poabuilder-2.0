import type {
  Character,
  CharacterAttributes,
  AttributeKey,
  BuilderProfession,
  BuilderFeat,
  ChoiceFeature,
  CustomResourceDef,
} from "./characterTypes";

export const VITALS_SET = new Set([
  "Vigor",
  "Intuition",
  "Talent",
  "Awareness",
  "Lore",
  "Social",
]);

export const SPHERE_NAMES = new Set([
  "Aberration",
  "Augmentation",
  "Conjuration",
  "Decimation",
  "Divination",
  "Mortification",
  "Reclamation",
]);

/** Derives the set of spell-school spheres a character knows from their choiceSelections. */
export function computeKnownSpheres(
  choiceSelections: Record<string, string[]>,
  choiceFeatures: ChoiceFeature[],
): Set<string> {
  const known = new Set<string>();
  for (const [key, selections] of Object.entries(choiceSelections)) {
    const cf = choiceFeatures.find(
      (f) => `${f.entity_name}__${f.feature_name}` === key,
    );
    for (const sel of selections) {
      if (SPHERE_NAMES.has(sel)) {
        known.add(sel);
      }
      if (cf) {
        const opt = cf.options.find((o) => o.name === sel);
        if (opt) {
          const m = opt.effect_text.match(/gain\s+(\w+)\s+sphere/i);
          if (m && SPHERE_NAMES.has(m[1])) known.add(m[1]);
        }
      }
    }
  }
  return known;
}

export function computeExpertiseBumps(
  selectedFeatIds: string[],
  allFeats: BuilderFeat[],
  choiceFeatures: ChoiceFeature[],
  choiceSelections: Record<string, string[]>,
): Record<string, number> {
  const bumps: Record<string, number> = {};

  for (const id of selectedFeatIds) {
    const feat = allFeats.find((f) => f.id === id);
    if (!feat) continue;
    for (const skill of feat.fixedExpertise ?? []) {
      bumps[skill] = (bumps[skill] ?? 0) + 1;
    }
  }

  for (const [key, selections] of Object.entries(choiceSelections)) {
    const matchedCf = choiceFeatures.find(
      (cf) =>
        cf.grants_expertise && `${cf.entity_name}__${cf.feature_name}` === key,
    );
    if (matchedCf) {
      for (const skill of selections) {
        if (VITALS_SET.has(skill)) bumps[skill] = (bumps[skill] ?? 0) + 1;
      }
      continue;
    }
    const syntheticMatch = key.match(/Expertise ×(\d+)$/);
    if (syntheticMatch) {
      const bumpCount = parseInt(syntheticMatch[1], 10);
      for (const skill of selections) {
        if (VITALS_SET.has(skill))
          bumps[skill] = (bumps[skill] ?? 0) + bumpCount;
      }
    }
  }

  return bumps;
}

/** Remove primary and all synthetic follow-up keys for a feat from choiceSelections. */
export function clearFeatChoices(
  selections: Record<string, string[]>,
  ownerName: string,
  featName: string,
): Record<string, string[]> {
  const prefix = `${ownerName}__${featName}`;
  return Object.fromEntries(
    Object.entries(selections).filter(([k]) => !k.startsWith(prefix)),
  );
}

export function getTotalAttributes(char: Character): CharacterAttributes {
  const b = char.vocationAttributeBonus;
  const ba = char.baseAttributes as unknown as Record<string, number | undefined>;
  return {
    brawn:   (ba.brawn   ?? ba.body ?? 0) + (b.attribute === "brawn"   ? b.value : 0),
    finesse: (ba.finesse ?? 0)            + (b.attribute === "finesse" ? b.value : 0),
    mind:    (ba.mind    ?? 0)            + (b.attribute === "mind"    ? b.value : 0),
    will:    (ba.will    ?? 0)            + (b.attribute === "will"    ? b.value : 0),
  };
}

/** Parse "12 + Brawn" → { base: 12, attribute: 'brawn' }. Accepts legacy "Body" as alias for "brawn". */
export function parseStartingVitality(formula: string): {
  base: number;
  attribute: AttributeKey;
} {
  const m = formula.match(/(\d+)\s*\+\s*(Brawn|Finesse|Body|Mind|Will)/i);
  if (!m) return { base: 10, attribute: "brawn" };
  const raw = m[2].toLowerCase();
  const attribute = (raw === "body" ? "brawn" : raw) as AttributeKey;
  return { base: parseInt(m[1], 10), attribute };
}

export function calcStartingVitality(
  prof: Pick<BuilderProfession, "startingVitality">,
  attrs: CharacterAttributes,
): number {
  const { base, attribute } = parseStartingVitality(prof.startingVitality);
  return base + attrs[attribute];
}

/** Parse "+X maximum Vitality" bonus from a feat description. Returns 0 if none. */
export function parseFeatVitalityBonus(feat: BuilderFeat): number {
  const md = feat.descriptionMarkdown;
  const match =
    md.match(
      /\+\s*(\d+)\s*(?:maximum|[Mm]ax(?:imum)?)?[^a-z\n]*?\**[Vv]itality\**/i,
    ) || md.match(/\**\+(\d+)\s*[Mm]ax(?:imum)?\s*[Vv]itality\**/i);
  return match ? parseInt(match[1], 10) : 0;
}

/** Sum all vitality bonuses from the feats whose IDs are in selectedFeatIds.
 *  Each feat's raw bonus applies 2× per Tier: `bonus * tier * 2`. */
export function calcFeatVitalityBonus(
  selectedFeatIds: string[],
  allFeats: BuilderFeat[],
  tier: number = 1,
): number {
  return selectedFeatIds.reduce((sum, id) => {
    const feat = allFeats.find((f) => f.id === id);
    return sum + (feat ? parseFeatVitalityBonus(feat) * tier * 2 : 0);
  }, 0);
}

export function calcArmorDefense(
  equippedArmor: {
    armorBonus?: number;
    armorCategory?: string | null;
    masterworkBonus?: number;
    mediumArmorStat?: "brawn" | "finesse" | null;
  } | null,
  equippedShield: {
    armorBonus?: number;
    masterworkBonus?: number;
  } | null,
  attrs: CharacterAttributes,
  hasAgile: boolean,
  hasUnarmoredDefense?: boolean,
  tier?: number,
  spellArmorActive?: boolean,
  spellModValue?: number,
): number {
  const BASE = 8;
  const characterTier = tier ?? 1;
  const shieldBonus = equippedShield?.armorBonus ?? 0;
  const defenseBonus = equippedArmor?.armorBonus ?? 0;
  const masterwork = equippedArmor?.masterworkBonus ?? 0;
  const category = equippedArmor?.armorCategory ?? null;

  // Spell Armor
  if (spellArmorActive) {
    return BASE + characterTier + Math.min(9, spellModValue ?? 0);
  }

  // Berserker Unarmored
  if (hasUnarmoredDefense && !equippedArmor) {
    return BASE + characterTier + Math.min(9, attrs.brawn);
  }

  if (category === "Heavy") {
    const cap = 3 + masterwork;
    return BASE + defenseBonus + shieldBonus + Math.min(cap, attrs.brawn);
  }

  if (category === "Medium") {
    const cap = 3 + masterwork;
    const chosenStat = equippedArmor?.mediumArmorStat ?? "brawn";
    const statVal = chosenStat === "finesse" ? attrs.finesse : attrs.brawn;
    return BASE + defenseBonus + shieldBonus + Math.min(cap, statVal);
  }

  if (category === "Light") {
    const cap = 5 + masterwork;
    if (hasAgile) {
      return (
        BASE +
        characterTier +
        defenseBonus +
        shieldBonus +
        Math.min(cap, attrs.finesse)
      );
    }
    return BASE + defenseBonus + shieldBonus + Math.min(cap, attrs.finesse);
  }

  // Unarmored
  if (!equippedArmor) {
    if (hasAgile) {
      return BASE + characterTier + shieldBonus + attrs.finesse;
    }
    return BASE + shieldBonus + attrs.finesse;
  }

  return BASE + defenseBonus + shieldBonus;
}

export function calcFortitude(attrs: CharacterAttributes): number {
  return 8 + attrs.brawn;
}
export function calcMentalDefense(attrs: CharacterAttributes): number {
  return 8 + attrs.mind;
}
export function calcWillDefense(attrs: CharacterAttributes): number {
  return 8 + attrs.will;
}
export function calcMaxWounds(
  prof: Pick<BuilderProfession, "woundBonusPerTier">,
  attrs: CharacterAttributes,
  tier: number,
  armorWoundBonus: number = 0,
): number {
  return (
    1 +
    prof.woundBonusPerTier * tier +
    Math.ceil(attrs.brawn / 4) +
    armorWoundBonus
  );
}
export function calcCarryWeight(
  attrs: CharacterAttributes,
  tier: number,
): number {
  return 5 + attrs.brawn + tier;
}

export function calcReservoir(
  casterType: "full" | "half" | "limited" | null,
  tier: number,
  modifierValue: number,
): number | null {
  if (!casterType) return null;
  if (casterType === "full") return 2 * tier + modifierValue;
  if (casterType === "half") return tier + modifierValue;
  if (casterType === "limited") return Math.floor(tier / 2) + modifierValue;
  return null;
}

export function calcSpellDC(
  spellcastingTier: number,
  modifierValue: number,
): number {
  return 10 + spellcastingTier + modifierValue;
}

export const FEAT_ALLOWANCE: Record<number, number> = {
  1: 0,
  2: 3,
  3: 6,
  4: 8,
  5: 10,
};

export const TIER_TOTAL_SLOTS = [5, 9, 12, 14, 17];

/** Tier is determined by total feats purchased with Renown. */
export function calcTierFromFeatsPurchased(featsPurchased: number): number {
  if (featsPurchased >= 10) return 5;
  if (featsPurchased >= 8) return 4;
  if (featsPurchased >= 6) return 3;
  if (featsPurchased >= 3) return 2;
  return 1;
}

/** Spellcasting Threshold from total feats purchased. */
export function calcSpellcastingThreshold(featsPurchased: number): number {
  if (featsPurchased >= 16) return 7;
  if (featsPurchased >= 14) return 6;
  if (featsPurchased >= 12) return 5;
  if (featsPurchased >= 10) return 4;
  if (featsPurchased >= 8) return 3;
  if (featsPurchased >= 6) return 2;
  if (featsPurchased >= 3) return 1;
  return 0;
}

/** Spellcasting Tier from caster type and threshold. */
export function calcSpellcastingTier(
  casterType: "full" | "half" | "limited",
  threshold: number,
): number {
  if (casterType === "full") return Math.min(threshold + 1, 6);
  if (casterType === "half") return Math.min(Math.floor(threshold / 2) + 1, 5);
  /* limited */ return Math.min(Math.floor(threshold / 2) + 1, 3);
}

/** Known Spells from caster type and threshold. */
export function calcKnownSpells(
  casterType: "full" | "half" | "limited",
  threshold: number,
): number {
  if (casterType === "full") return 4 + 3 * threshold;
  if (casterType === "half") return 3 + 2 * threshold;
  /* limited */ return 2 + threshold;
}

/** Prepared Spells = Spell Modifier Attribute + Tier. */
export function calcPreparedSpells(
  modifierValue: number,
  characterTier: number,
): number {
  return modifierValue + characterTier;
}

export const BASE_SKILL_DIE_FACES = 6;

export type ProficiencyRank = "Untrained" | "Trained" | "Expert" | "Master";

export function calcBaseDiceFromAttr(attrValue: number): number {
  if (attrValue >= 12) return 4;
  if (attrValue >= 8) return 3;
  if (attrValue >= 4) return 2;
  return 1;
}

export function calcSkillAttrValue(
  skill: string,
  attrs: CharacterAttributes,
): number {
  switch (skill) {
    case "Vigor":
      return attrs.brawn;
    case "Intuition":
      return attrs.mind;
    case "Talent":
      return Math.max(attrs.finesse, attrs.mind);
    case "Awareness":
      return attrs.mind;
    case "Lore":
      return Math.max(attrs.mind, attrs.will);
    case "Social":
      return attrs.will;
    default:
      return 0;
  }
}

export function calcSkillRank(
  skill: string,
  vitalsProficiencies: string[],
  vitalsExpertiseBumps: Record<string, number>,
): ProficiencyRank {
  const bumps = vitalsExpertiseBumps?.[skill] ?? 0;
  const baseRank = vitalsProficiencies.includes(skill) ? 1 : 0;
  const total = baseRank + bumps;
  if (total >= 3) return "Master";
  if (total >= 2) return "Expert";
  if (total >= 1) return "Trained";
  return "Untrained";
}

export function calcProficiencyDieSize(rank: ProficiencyRank): number | null {
  if (rank === "Untrained") return null;
  if (rank === "Trained") return 8;
  if (rank === "Expert") return 10;
  return 12;
}

export interface SkillPoolInfo {
  rank: ProficiencyRank;
  baseDiceCount: number;
  profDieFaces: number | null;
  skillDiceCount: number;
  display: string;
}

export function calcSkillPool(
  skill: string,
  attrs: CharacterAttributes,
  vitalsProficiencies: string[],
  vitalsExpertiseBumps: Record<string, number>,
  skillPoints: Record<string, number>,
): SkillPoolInfo {
  const attrValue = calcSkillAttrValue(skill, attrs);
  const baseDiceCount = calcBaseDiceFromAttr(attrValue);
  const rank = calcSkillRank(skill, vitalsProficiencies, vitalsExpertiseBumps);
  const profDieFaces = calcProficiencyDieSize(rank);
  const skillDiceCount = skillPoints?.[skill] ?? 0;
  let display: string;
  if (profDieFaces !== null) {
    // Proficient: all dice upgrade to proficiency die size
    const total = baseDiceCount + skillDiceCount;
    display = `${total}d${profDieFaces}`;
  } else {
    const parts: string[] = [`${baseDiceCount}d${BASE_SKILL_DIE_FACES}`];
    if (skillDiceCount > 0)
      parts.push(`${skillDiceCount}d${BASE_SKILL_DIE_FACES}`);
    display = parts.join(" + ");
  }
  return { rank, baseDiceCount, profDieFaces, skillDiceCount, display };
}

/** Returns the Ambition dice type and max pool.
 *  Die is the higher of the Will-based or Tier-based die (spec: take higher when both apply). */
/** Parse "XdY" or "XdY + Z" or "XdY - Z" → average expected value (rounded). */
export function parseAvgDiceExpr(formula: string): number {
  const m = formula.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i);
  if (!m) return 0;
  const count = parseInt(m[1], 10);
  const faces = parseInt(m[2], 10);
  const flat = m[3] ? parseInt(m[3].replace(/\s/g, ""), 10) : 0;
  return Math.round((count * (faces + 1)) / 2 + flat);
}

/** Parse "XdY per N Attr" → average bonus given attr value. Accepts Brawn/Finesse/Body/Mind/Will. */
export function parseBodyModifierBonusValue(
  formula: string,
  attrs: CharacterAttributes,
): number {
  const m = formula.match(
    /(\d+)d(\d+)\s+per\s+(\d+)\s+(Brawn|Finesse|Body|Mind|Will)/i,
  );
  if (!m) return 0;
  const count = parseInt(m[1], 10);
  const faces = parseInt(m[2], 10);
  const perN = parseInt(m[3], 10);
  const raw = m[4].toLowerCase();
  // "body" is legacy alias for "brawn"
  const attrKey = (raw === "body" ? "brawn" : raw) as keyof CharacterAttributes;
  const groups = Math.floor((attrs[attrKey] ?? 0) / perN);
  return Math.round(((count * (faces + 1)) / 2) * groups);
}

/** Full max vitality: Tier 1 base + per-tier gains + body modifier bonus + feat bonus. */
export function calcFullMaxVitality(
  prof: {
    startingVitality: string;
    vitalityPerTier: string;
    bodyModifierBonus: string;
  },
  attrs: CharacterAttributes,
  tier: number,
  selectedFeatIds: string[],
  allFeats: BuilderFeat[],
): number {
  const base = calcStartingVitality(prof, attrs);
  const perTierAvg = parseAvgDiceExpr(prof.vitalityPerTier);
  const tierGain = (tier - 1) * perTierAvg;
  const modBonus = parseBodyModifierBonusValue(prof.bodyModifierBonus, attrs);
  const featBonus = calcFeatVitalityBonus(selectedFeatIds, allFeats, tier);
  return base + tierGain + modBonus + featBonus;
}

export function calcAmbition(
  will: number,
  tier: number = 1,
): { dice: string; max: number } {
  const DICE = ["d4", "d6", "d8", "d10", "d12"] as const;
  const willIdx = Math.min(Math.floor(will / 3), 4);
  const tierIdx = tier >= 4 ? 2 : tier >= 2 ? 1 : 0;
  return {
    dice: DICE[Math.max(willIdx, tierIdx)],
    max: 5 + Math.floor(will / 3) + tier,
  };
}

export function evalResourceMax(
  def: CustomResourceDef,
  attrs: CharacterAttributes,
  tier: number,
): number {
  if (def.max_formula === "tier") return tier;
  if (def.max_formula.startsWith("static:"))
    return parseInt(def.max_formula.slice(7), 10);
  if (def.max_formula === "attr + tier" && def.max_attr)
    return attrs[def.max_attr] + tier;
  return 0;
}

export function applyResourceRestore(
  customResources: Record<string, number>,
  def: CustomResourceDef,
  restoreType: "respite" | "long_rest" | "full_rest",
  max: number,
): number {
  const current = customResources[def.key] ?? max;
  const amount = def.restore[restoreType];
  if (amount === undefined) return current;
  if (amount === "max") return max;
  return Math.min(max, current + amount);
}

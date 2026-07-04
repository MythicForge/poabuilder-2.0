// computeCharacter — derives every displayed number from stored choices +
// content data. Nothing computed here is ever persisted.

import type {
  ActiveBoon, AttributeKey, Boon, CatalogItem, ComputedCharacter, ComputedResource,
  ComputedSpellcasting, DefenseKey, InventoryItem, ProficiencyRank, ResourceDef,
  SkillName, SkillPoolInfo, SpellcastingGrant, StoredCharacter,
} from "./types.ts";
import { ATTRIBUTES, SKILLS } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { collectFeats } from "./boon-resolver.ts";
import { canDualWield, isTwoHanded } from "./equip.ts";
import { evalFormula, parseAvgDiceExpr, standardEnv, type FormulaEnv } from "./formula.ts";

// ── Tier & budgets ───────────────────────────────────────────────────────────

export function calcTier(featsPurchased: number, reg: Registry): number {
  let tier = 1;
  for (const t of reg.tierProgression.tiers) {
    if (featsPurchased >= t.cumulative_feats_required) tier = Math.min(t.tier + 1, 5);
  }
  // cumulative_feats_required is the cost to ADVANCE past that tier;
  // reaching tier 5's requirement (16) still caps at tier 5
  const t5 = reg.tierProgression.tiers.find((t) => t.tier === 5);
  if (t5 && featsPurchased >= t5.cumulative_feats_required) tier = 5;
  return tier;
}

// ── Skills (ported verbatim from builder-1.0 characterCalc) ─────────────────

export function skillAttrValue(skill: SkillName, attrs: Record<AttributeKey, number>): number {
  switch (skill) {
    case "Vigor": return attrs.brawn;
    case "Intuition": return attrs.mind;
    case "Talent": return Math.max(attrs.finesse, attrs.mind);
    case "Awareness": return attrs.mind;
    case "Lore": return Math.max(attrs.mind, attrs.will);
    case "Social": return attrs.will;
  }
}

export function baseDiceFromAttr(attrValue: number): number {
  if (attrValue >= 12) return 4;
  if (attrValue >= 8) return 3;
  if (attrValue >= 4) return 2;
  return 1;
}

export function skillRank(skill: string, proficiencies: string[], bumps: Record<string, number>): ProficiencyRank {
  const total = (proficiencies.includes(skill) ? 1 : 0) + (bumps[skill] ?? 0);
  if (total >= 3) return "Master";
  if (total >= 2) return "Expert";
  if (total >= 1) return "Trained";
  return "Untrained";
}

export function profDieSize(rank: ProficiencyRank): number | null {
  if (rank === "Untrained") return null;
  if (rank === "Trained") return 8;
  if (rank === "Expert") return 10;
  return 12;
}

function skillPool(skill: SkillName, stored: StoredCharacter, attrs: Record<AttributeKey, number>): SkillPoolInfo {
  const s = stored.build.skills;
  const attrValue = skillAttrValue(skill, attrs);
  const baseDiceCount = baseDiceFromAttr(attrValue);
  const rank = skillRank(skill, s.proficiencies, s.expertise_bumps);
  const faces = profDieSize(rank);
  const skillDiceCount = s.points[skill] ?? 0;
  const display = `${baseDiceCount + skillDiceCount}d${faces ?? 6}`;
  return { skill, attrValue, rank, baseDiceCount, profDieFaces: faces, skillDiceCount, display };
}

// ── Equipment resolution ─────────────────────────────────────────────────────

export function resolveItem(it: InventoryItem, reg: Registry): CatalogItem | null {
  return it.custom ?? (it.catalog_item_id ? reg.items.get(it.catalog_item_id) ?? null : null);
}

function armorBonusOf(cat: CatalogItem): number {
  if (typeof cat.armor_bonus === "number") return cat.armor_bonus;
  if (cat.armor_bonus && typeof cat.armor_bonus === "object") return cat.armor_bonus.value ?? 0;
  if (cat.armor_bonus_range) return cat.armor_bonus_range.value ?? 0;
  return 0;
}

interface Equipped {
  armor: { cat: CatalogItem; item: InventoryItem } | null;
  shield: { cat: CatalogItem; item: InventoryItem } | null;
  weapons: { cat: CatalogItem; item: InventoryItem }[];
}

function equipped(stored: StoredCharacter, reg: Registry): Equipped {
  const items = stored.inventory.items;
  const bySlot = (s: string) => items.find((it) => it.slot === s);

  const bodyItem = bySlot("body");
  const bodyCat = bodyItem ? resolveItem(bodyItem, reg) : null;
  let armor = bodyItem && bodyCat?.category === "Armor" && !bodyCat.is_template ? { cat: bodyCat, item: bodyItem } : null;

  const mainItem = bySlot("main_hand");
  const mainCat = mainItem ? resolveItem(mainItem, reg) : null;
  const mainIsTwoHanded = isTwoHanded(mainCat);

  const offItem = bySlot("off_hand");
  const offCat = offItem ? resolveItem(offItem, reg) : null;

  let shield = offCat?.category === "Shield" ? { cat: offCat, item: offItem! } : null;
  if (shield && mainIsTwoHanded) shield = null; // 2H mainhand blocks the shield bonus

  const weapons: { cat: CatalogItem; item: InventoryItem }[] = [];
  if (mainCat?.category === "Weapon") weapons.push({ cat: mainCat, item: mainItem! });
  if (offCat?.category === "Weapon") weapons.push({ cat: offCat, item: offItem! });

  // back-compat: flag-only equipped items (no slot) for characters predating the slot system
  for (const item of items) {
    if (item.slot != null) continue;
    if (!item.equipped) continue;
    const cat = resolveItem(item, reg);
    if (!cat) continue;
    if (!armor && cat.category === "Armor" && !cat.is_template) armor = { cat, item };
    else if (!shield && !mainIsTwoHanded && cat.category === "Shield") shield = { cat, item };
    else if (cat.category === "Weapon") weapons.push({ cat, item });
  }

  return { armor, shield, weapons };
}

// ── Armor defense (per data/shared/equipment-rules.json) ────────────────────

function armorDefense(
  eq: Equipped,
  attrs: Record<AttributeKey, number>,
  tier: number,
  opts: { hasAgile: boolean; unarmoredDefense: boolean; spellArmorActive: boolean; spellMod: number },
  breakdown: string[],
): number {
  const BASE = 8;
  const shieldBonus = eq.shield ? armorBonusOf(eq.shield.cat) : 0;

  if (opts.spellArmorActive) {
    breakdown.push(`Spell Armor: 8 + Tier ${tier} + min(9, spell mod ${opts.spellMod})`);
    return BASE + tier + Math.min(9, opts.spellMod);
  }
  if (opts.unarmoredDefense && !eq.armor) {
    breakdown.push(`Unarmored Defense: 8 + Tier ${tier} + min(9, Brawn ${attrs.brawn})`);
    return BASE + tier + Math.min(9, attrs.brawn);
  }
  if (!eq.armor) {
    const agile = opts.hasAgile ? tier : 0;
    breakdown.push(`Unarmored: 8 + Finesse ${attrs.finesse}${shieldBonus ? ` + shield ${shieldBonus}` : ""}${agile ? ` + Agile ${agile}` : ""}`);
    return BASE + attrs.finesse + shieldBonus + agile;
  }

  const cat = eq.armor.cat;
  const bonus = armorBonusOf(cat);
  const masterwork = eq.armor.item.masterwork_bonus ?? 0;
  const type = String(cat.armor_type ?? "");

  if (type === "Heavy") {
    const cap = 3 + masterwork;
    breakdown.push(`Heavy: 8 + armor ${bonus} + shield ${shieldBonus} + min(${cap}, Brawn ${attrs.brawn})`);
    return BASE + bonus + shieldBonus + Math.min(cap, attrs.brawn);
  }
  if (type === "Medium") {
    const cap = 3 + masterwork;
    const statKey = eq.armor.item.medium_armor_stat ?? "brawn";
    const statVal = attrs[statKey];
    breakdown.push(`Medium: 8 + armor ${bonus} + shield ${shieldBonus} + min(${cap}, ${statKey} ${statVal})`);
    return BASE + bonus + shieldBonus + Math.min(cap, statVal);
  }
  // Light (and anything else with a bonus): finesse-capped
  const cap = 5 + masterwork;
  const agile = opts.hasAgile ? tier : 0;
  breakdown.push(`Light: 8 + armor ${bonus} + shield ${shieldBonus} + min(${cap}, Finesse ${attrs.finesse})${agile ? ` + Agile ${agile}` : ""}`);
  return BASE + bonus + shieldBonus + Math.min(cap, attrs.finesse) + agile;
}

// ── Boon appliers ────────────────────────────────────────────────────────────

function num(v: unknown, env: FormulaEnv): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try { return evalFormula(v, env); } catch { return 0; }
  }
  return 0;
}

function selfStatBonus(active: ActiveBoon[], stat: string, env: FormulaEnv): number {
  let total = 0;
  for (const { boon } of active) {
    if (boon.type !== "stat_bonus") continue;
    if (boon.stat !== stat && !(stat !== "All Defenses" && boon.stat === "All Defenses" && isDefense(stat))) continue;
    const target = (boon.target as string) ?? "self";
    if (target !== "self") continue;
    if (boon.condition && !isSheetKnowableTrue(boon)) continue; // conditional bonuses render on cards instead
    total += num(boon.amount, env);
  }
  return total;
}

const DEFENSES: DefenseKey[] = ["Armor", "Fortitude", "Mental", "Will Defense"];
const isDefense = (s: string) => (DEFENSES as string[]).includes(s);

// Conditions we can't evaluate on-sheet stay display-only. A handful ARE
// knowable (state/equipment gates resolved by the boon-resolver already).
function isSheetKnowableTrue(boon: Boon): boolean {
  const c = String(boon.condition ?? "");
  if (!c) return true;
  // resolver already gated state/choice/armor branches; remaining strings are prose
  return false;
}

// ── Spellcasting ─────────────────────────────────────────────────────────────

function spellcastingThreshold(featsPurchased: number): number {
  if (featsPurchased >= 16) return 7;
  if (featsPurchased >= 14) return 6;
  if (featsPurchased >= 12) return 5;
  if (featsPurchased >= 10) return 4;
  if (featsPurchased >= 8) return 3;
  if (featsPurchased >= 6) return 2;
  if (featsPurchased >= 3) return 1;
  return 0;
}

function spellcastingTier(casterType: "full" | "half" | "limited", threshold: number): number {
  if (casterType === "full") return Math.min(threshold + 1, 6);
  if (casterType === "half") return Math.min(Math.floor(threshold / 2) + 1, 5);
  return Math.min(Math.floor(threshold / 2) + 1, 3);
}

function knownSpellsAllowance(casterType: "full" | "half" | "limited", threshold: number): number {
  if (casterType === "full") return 4 + 3 * threshold;
  if (casterType === "half") return 3 + 2 * threshold;
  return 2 + threshold;
}

function computeSpellcasting(
  stored: StoredCharacter,
  active: ActiveBoon[],
  attrs: Record<AttributeKey, number>,
  tier: number,
  resources: ComputedResource[],
): ComputedSpellcasting | null {
  // find grant: boon first, then vocation
  let grant: SpellcastingGrant | null = null;
  for (const { boon } of active) {
    if (boon.type === "grants_spellcasting") { grant = boon as unknown as SpellcastingGrant; break; }
  }
  if (!grant) return null;

  const modName = (stored.build.spellcasting_modifier ??
    (typeof grant.modifier === "string" ? (grant.modifier.toLowerCase() as AttributeKey) : null));
  if (!modName || !ATTRIBUTES.includes(modName)) return null;
  const modValue = attrs[modName];

  const threshold = spellcastingThreshold(stored.build.feats_purchased);
  const casterType = grant.caster_type;
  const sTier = spellcastingTier(casterType, threshold);

  // reservoir: the granted resource (e.g. mana) if defined, else 2*Tier+mod style default
  const source = typeof grant.source === "string" ? grant.source : null;
  const pool = source ? resources.find((r) => r.def.id === source) : undefined;
  const reservoirMax = pool
    ? pool.max
    : casterType === "full" ? 2 * tier + modValue
    : casterType === "half" ? tier + modValue
    : Math.floor(tier / 2) + modValue;

  const spheres = new Set(stored.build.known_sphere_ids);
  for (const { boon } of active) {
    if (boon.type === "grants_sphere" && typeof boon.sphere === "string") spheres.add(boon.sphere);
  }

  const cantrips = grant.cantrips as { max?: number } | undefined;
  return {
    casterType,
    modifier: modName,
    modifierValue: modValue,
    reservoirMax,
    spellcastingTier: sTier,
    spellDC: 10 + sTier + modValue,
    knownAllowance: knownSpellsAllowance(casterType, threshold),
    preparedAllowance: modValue + tier,
    cantripAllowance: cantrips?.max ?? 0,
    spheres: [...spheres],
  };
}

// ── Resources ────────────────────────────────────────────────────────────────

function computeResources(
  stored: StoredCharacter,
  reg: Registry,
  env: FormulaEnv,
  tier: number,
): ComputedResource[] {
  const out: ComputedResource[] = [];
  const prof = reg.professions.get(stored.build.profession_id);
  for (const def of prof?.resources ?? []) {
    let max = 0;
    if (def.max === "tier_gated" && def.max_by_tier) {
      for (const row of def.max_by_tier) {
        if (row.tier <= tier) max = Math.max(max, row.value);
      }
    } else {
      try { max = evalFormula(def.max, env); } catch { max = 0; }
    }
    const current = Math.min(stored.pools.resources[def.id] ?? max, max);
    out.push({ def, max, current });
  }
  return out;
}

function ambitionDie(reg: Registry, will: number, tier: number): string {
  const amb = reg.universalResources.find((r) => r.id === "ambition");
  const key = Math.max(will, tier);
  for (const row of amb?.die_size?.rows ?? []) {
    if (key >= row.range[0] && key <= row.range[1]) return row.die;
  }
  return "1d4";
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function computeCharacter(stored: StoredCharacter, reg: Registry): ComputedCharacter {
  const warnings: string[] = [];
  const b = stored.build;
  const profession = reg.professions.get(b.profession_id);
  const vocation = reg.vocations.get(b.vocation_id);
  if (!profession) warnings.push(`unknown profession "${b.profession_id}"`);
  if (!vocation && b.vocation_id) warnings.push(`unknown vocation "${b.vocation_id}"`);

  const tier = calcTier(b.feats_purchased, reg);

  // attributes = allocated base + vocation bonus
  const attrs: Record<AttributeKey, number> = { ...b.attributes };
  if (vocation) attrs[vocation.attribute_bonus.attribute] += vocation.attribute_bonus.amount;

  const { cards, activeBoons } = collectFeats(stored, reg);
  const env = standardEnv(attrs, tier);

  // resources before spellcasting (reservoir may be a profession resource)
  const resources = computeResources(stored, reg, env, tier);

  // active states
  const activeStates = stored.states.active;

  // equipment
  const eq = equipped(stored, reg);
  if (eq.weapons.length >= 2 && !isTwoHanded(eq.weapons[0]?.cat ?? null) && !canDualWield(activeBoons)) {
    warnings.push("Dual-wielding without a boon that allows it");
  }
  const hasAgile = activeBoons.some(({ boon }) => boon.type === "equipment_rule_override" && boon.rule === "agile")
    || activeBoons.some(({ boon }) => boon.type === "proficiency" && String(boon.grants ?? "").toLowerCase().includes("agile"));
  const unarmoredDefense = activeBoons.some(({ boon }) => boon.type === "alternate_defense" && String(boon.name ?? "").toLowerCase().includes("unarmored"));
  const spellArmorActive = activeStates.includes("spell_armor");

  // defenses
  const breakdown: Record<DefenseKey, string[]> = { Armor: [], Fortitude: [], Mental: [], "Will Defense": [] };
  const defenses: Record<DefenseKey, number> = {
    Armor: armorDefense(eq, attrs, tier, { hasAgile, unarmoredDefense, spellArmorActive, spellMod: 0 }, breakdown.Armor),
    Fortitude: 8 + attrs.brawn,
    Mental: 8 + attrs.mind,
    "Will Defense": 8 + attrs.will,
  };
  breakdown.Fortitude.push(`8 + Brawn ${attrs.brawn}`);
  breakdown.Mental.push(`8 + Mind ${attrs.mind}`);
  breakdown["Will Defense"].push(`8 + Will ${attrs.will}`);
  for (const d of DEFENSES) {
    const bonus = selfStatBonus(activeBoons, d, env);
    if (bonus) {
      defenses[d] += bonus;
      breakdown[d].push(`+${bonus} from boons`);
    }
  }

  // vitality max: base ("12 + Brawn") + (tier-1) × avg(per_tier) + brawn_bonus + boons
  let vitalityMax = 0;
  if (profession) {
    try { vitalityMax += evalFormula(profession.vitality.base, env); } catch { warnings.push(`bad vitality base "${profession.vitality.base}"`); }
    vitalityMax += (tier - 1) * parseAvgDiceExpr(profession.vitality.per_tier);
    const bb = profession.vitality.brawn_bonus;
    if (bb) {
      const attrKey = (bb.attribute?.toLowerCase() === "body" ? "brawn" : bb.attribute?.toLowerCase() ?? "brawn") as AttributeKey;
      vitalityMax += Math.floor((attrs[attrKey] ?? 0) / bb.threshold) * parseAvgDiceExpr(bb.dice);
    }
  }
  vitalityMax += selfStatBonus(activeBoons, "Vitality Max", env);

  // wounds max: 1 + wound_per_tier×Tier + floor(Brawn/3) + armor wound bonus (universal-resources canon)
  const armorWoundBonus = eq.armor?.cat.wound_bonus ?? 0;
  const woundsMax = 1 + (profession?.wound_threshold_per_tier ?? 0) * tier + Math.floor(attrs.brawn / 3) + armorWoundBonus;

  // ambition: max 4 + Tier + floor(Will/3) (universal-resources canon) + boons
  const ambitionMax = 4 + tier + Math.floor(attrs.will / 3) + selfStatBonus(activeBoons, "Ambition Max", env);

  const spellcasting = computeSpellcasting(stored, activeBoons, attrs, tier, resources);

  // carry
  const carryCapacity = evalFormula(reg.itemsDoc.carry_rules.carry_capacity_formula, env);
  let carryUsed = 0;
  for (const item of stored.inventory.items) {
    const cat = resolveItem(item, reg);
    carryUsed += (cat?.weight ?? 0) * (item.quantity ?? 1);
  }

  // budgets
  const attrEarned =
    (reg.tierProgression.creation_attribute_points ?? 0) +
    b.feats_purchased * reg.tierProgression.attribute_point_per_purchased_feat;
  const attrSpent = ATTRIBUTES.reduce((s, a) => s + b.attributes[a], 0);
  const skillEarned =
    (reg.tierProgression.creation_skill_points ?? 0) +
    Math.floor(b.feats_purchased / 2) * reg.tierProgression.skill_point_per_even_feat;
  const skillSpent = Object.values(b.skills.points).reduce((s, n) => s + n, 0);
  const expertiseEarned = tier - 1;
  const expertiseSpent = Object.values(b.skills.expertise_bumps).reduce((s, n) => s + n, 0);

  // proficiencies
  const profs = {
    armaments: profession?.proficiencies.armaments ?? [],
    protection: profession?.proficiencies.protection ?? [],
    tools: Array.isArray(profession?.proficiencies.tools) ? profession.proficiencies.tools : [],
  };
  for (const { boon } of activeBoons) {
    if (boon.type === "proficiency" && typeof boon.grants === "string") profs.armaments = [...profs.armaments, boon.grants];
  }

  return {
    tier,
    attributes: attrs,
    attributeBudget: { earned: attrEarned, spent: attrSpent },
    skillPointBudget: { earned: skillEarned, spent: skillSpent },
    expertisePointBudget: { earned: expertiseEarned, spent: expertiseSpent },
    defenses,
    defenseBreakdown: breakdown,
    vitality: {
      max: vitalityMax,
      current: Math.min(stored.pools.vitality, vitalityMax),
      temp: stored.pools.temp_vitality,
    },
    wounds: { max: woundsMax, current: stored.pools.wounds },
    ambition: { max: ambitionMax, current: Math.min(stored.pools.ambition, ambitionMax), die: ambitionDie(reg, attrs.will, tier) },
    resources,
    spellcasting,
    skills: SKILLS.map((s) => skillPool(s, stored, attrs)),
    carry: { capacity: carryCapacity, used: Math.round(carryUsed * 10) / 10 },
    featCards: cards,
    activeBoons,
    activeStates,
    proficiencies: profs,
    warnings,
  };
}

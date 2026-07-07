// computeCharacter — derives every displayed number from stored choices +
// content data. Nothing computed here is ever persisted.

import type {
  ActiveBoon,
  AttributeKey,
  Boon,
  CatalogItem,
  ComputedCharacter,
  ComputedResource,
  ComputedSpellcasting,
  DefenseKey,
  InventoryItem,
  ProficiencyRank,
  ResourceDef,
  SkillName,
  SkillPoolInfo,
  SpellcastingGrant,
  StoredCharacter,
} from "./types.ts";
import { ATTRIBUTES, SKILLS } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { collectFeats } from "./boon-resolver.ts";
import { canDualWield, isTwoHanded, equipped, type Equipped } from "./equip.ts";
import { masterworkBonus } from "./masterwork.ts";
import { evalFormula, parseAvgDiceExpr, type FormulaEnv } from "./formula.ts";
import { evalCondition, type ConditionCtx } from "./conditions.ts";
import { computeCombatBonuses } from "./damage.ts";

// ── Tier & budgets ───────────────────────────────────────────────────────────

export function calcTier(featsPurchased: number, reg: Registry): number {
  let tier = 1;
  for (const t of reg.tierProgression.tiers) {
    if (featsPurchased >= t.cumulative_feats_required)
      tier = Math.min(t.tier + 1, 5);
  }
  // cumulative_feats_required is the cost to ADVANCE past that tier;
  // reaching tier 5's requirement (16) still caps at tier 5
  const t5 = reg.tierProgression.tiers.find((t) => t.tier === 5);
  if (t5 && featsPurchased >= t5.cumulative_feats_required) tier = 5;
  return tier;
}

// ── Skills (ported verbatim from builder-1.0 characterCalc) ─────────────────

export function skillAttrValue(
  skill: SkillName,
  attrs: Record<AttributeKey, number>,
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
  }
}

export function baseDiceFromAttr(attrValue: number): number {
  if (attrValue >= 12) return 4;
  if (attrValue >= 8) return 3;
  if (attrValue >= 4) return 2;
  return 1;
}

export function skillRank(
  skill: string,
  proficiencies: string[],
  bumps: Record<string, number>,
): ProficiencyRank {
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

function skillPool(
  skill: SkillName,
  stored: StoredCharacter,
  attrs: Record<AttributeKey, number>,
): SkillPoolInfo {
  const s = stored.build.skills;
  const attrValue = skillAttrValue(skill, attrs);
  const baseDiceCount = baseDiceFromAttr(attrValue);
  const rank = skillRank(skill, s.proficiencies, s.expertise_bumps);
  const faces = profDieSize(rank);
  const skillDiceCount = s.points[skill] ?? 0;
  const display = `${baseDiceCount + skillDiceCount}d${faces ?? 6}`;
  return {
    skill,
    attrValue,
    rank,
    baseDiceCount,
    profDieFaces: faces,
    skillDiceCount,
    display,
  };
}

// ── Equipment resolution ─────────────────────────────────────────────────────

export function resolveItem(
  it: InventoryItem,
  reg: Registry,
): CatalogItem | null {
  return (
    it.custom ??
    (it.catalog_item_id ? (reg.items.get(it.catalog_item_id) ?? null) : null)
  );
}

function armorBonusOf(cat: CatalogItem): number {
  if (typeof cat.armor_bonus === "number") return cat.armor_bonus;
  if (cat.armor_bonus && typeof cat.armor_bonus === "object")
    return cat.armor_bonus.value ?? 0;
  if (cat.armor_bonus_range) return cat.armor_bonus_range.value ?? 0;
  return 0;
}

// ── Armor defense (caps & flags sourced from data/shared/equipment-rules.json) ─

interface CatRule {
  stat_cap: number | null;
  shield_allowed: boolean;
  agile: boolean;
}
interface ArmorRules {
  base: number;
  categories: Record<string, CatRule>;
}

const DEFAULT_ARMOR_RULES: ArmorRules = {
  base: 8,
  categories: {
    Heavy: { stat_cap: 5, shield_allowed: true, agile: false },
    Medium: { stat_cap: 3, shield_allowed: true, agile: false },
    Light: { stat_cap: 5, shield_allowed: false, agile: true },
    Unarmored: { stat_cap: null, shield_allowed: true, agile: true },
  },
};

function parseArmorRules(reg: Registry): ArmorRules {
  const doc = (reg.equipmentRules as Record<string, unknown>)?.armor_defense as
    Record<string, unknown> | undefined;
  if (!doc) return DEFAULT_ARMOR_RULES;
  const base = typeof doc.base === "number" ? doc.base : 8;
  const cats: Record<string, CatRule> = { ...DEFAULT_ARMOR_RULES.categories };
  const raw = (doc.categories as Record<string, Record<string, unknown>>) ?? {};
  for (const [name, cfg] of Object.entries(raw)) {
    const fallback = DEFAULT_ARMOR_RULES.categories[name] ?? {
      stat_cap: null,
      shield_allowed: true,
      agile: false,
    };
    cats[name] = {
      stat_cap:
        cfg.stat_cap === null
          ? null
          : typeof cfg.stat_cap === "number"
            ? cfg.stat_cap
            : fallback.stat_cap,
      shield_allowed:
        typeof cfg.shield_allowed === "boolean"
          ? cfg.shield_allowed
          : fallback.shield_allowed,
      agile: cfg.agile_bonus != null ? true : fallback.agile,
    };
  }
  return { base, categories: cats };
}

/** Standard equipment-driven Armor defense (before alternate_defense boons). */
function armorDefense(
  eq: Equipped,
  attrs: Record<AttributeKey, number>,
  tier: number,
  hasAgile: boolean,
  rules: ArmorRules,
): { value: number; line: string } {
  const base = rules.base;
  const shieldBonus = eq.shield ? armorBonusOf(eq.shield.cat) : 0;

  if (!eq.armor) {
    const c = rules.categories.Unarmored;
    const agile = hasAgile && c.agile ? tier : 0;
    const shield = c.shield_allowed ? shieldBonus : 0;
    return {
      value: base + attrs.finesse + shield + agile,
      line: `Unarmored: ${base} + Finesse ${attrs.finesse}${shield ? ` + shield ${shield}` : ""}${agile ? ` + Agile ${agile}` : ""}`,
    };
  }

  const cat = eq.armor.cat;
  const bonus = armorBonusOf(cat);
  const masterwork = masterworkBonus(eq.armor.item, cat);
  const type = String(cat.armor_type ?? "Light");
  const c = rules.categories[type] ?? rules.categories.Light;

  const shield = c.shield_allowed ? shieldBonus : 0;
  const statKey: AttributeKey =
    type === "Heavy"
      ? "brawn"
      : type === "Medium"
        ? (eq.armor.item.medium_armor_stat ?? "brawn")
        : "finesse";
  const statVal = attrs[statKey];
  const capLabel = c.stat_cap == null ? "∞" : String(c.stat_cap + masterwork);
  const capped =
    c.stat_cap == null ? statVal : Math.min(c.stat_cap + masterwork, statVal);
  const agile = hasAgile && c.agile ? tier : 0;
  return {
    value: base + bonus + shield + capped + agile,
    line: `${type}: ${base} + armor ${bonus}${shield ? ` + shield ${shield}` : ""} + min(${capLabel}, ${statKey} ${statVal})${agile ? ` + Agile ${agile}` : ""}`,
  };
}

// ── Boon appliers ────────────────────────────────────────────────────────────

/** Evaluate a numeric/formula boon field; push a warning (and return 0) on failure. */
function num(
  v: unknown,
  env: FormulaEnv,
  warnings?: string[],
  label?: string,
): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      return evalFormula(v, env);
    } catch (e) {
      warnings?.push(
        `bad formula "${v}"${label ? ` in ${label}` : ""}: ${(e as Error).message}`,
      );
      return 0;
    }
  }
  return 0;
}

function selfStatBonus(
  active: ActiveBoon[],
  stat: string,
  env: FormulaEnv,
  condCtx: ConditionCtx,
  warnings: string[],
): number {
  let total = 0;
  for (const { boon, source } of active) {
    if (boon.type !== "stat_bonus") continue;
    if (
      boon.stat !== stat &&
      !(
        stat !== "All Defenses" &&
        boon.stat === "All Defenses" &&
        isDefense(stat)
      )
    )
      continue;
    const target = (boon.target as string) ?? "self";
    if (target !== "self") continue;
    if (boon.condition) {
      // conditional bonus: apply only when the condition is knowably true;
      // "unknown" (prose) stays display-only on the card, as before.
      if (evalCondition(String(boon.condition), condCtx) !== true) continue;
    }
    total += num(boon.amount, env, warnings, `${source.featId} stat_bonus`);
  }
  return total;
}

const DEFENSES: DefenseKey[] = ["Armor", "Fortitude", "Mental", "Will Defense"];
const isDefense = (s: string) => (DEFENSES as string[]).includes(s);

const ATTR_STAT: Record<string, AttributeKey> = {
  Brawn: "brawn",
  Finesse: "finesse",
  Mind: "mind",
  Will: "will",
};

// stat_bonus `stat` values the engine consumes (defenses + attributes handled
// elsewhere) plus ones knowingly left description-only. Anything outside these
// surfaces as a warning so new data vocabulary never silently vanishes.
const KNOWN_STATS = new Set([
  "Armor",
  "Fortitude",
  "Mental",
  "Will Defense",
  "All Defenses",
  "Vitality Max",
  "Ambition Max",
  "spell_dc",
  "spell_attack",
  "attack_roll",
  "AP",
  "Brawn",
  "Finesse",
  "Mind",
  "Will",
]);
const IGNORED_STATS = new Set(["size_category"]); // out of scope (see plan)

function warnUnknownStats(active: ActiveBoon[], warnings: string[]): void {
  const seen = new Set<string>();
  for (const { boon, source } of active) {
    if (boon.type !== "stat_bonus") continue;
    const stat = String(boon.stat ?? "");
    if (KNOWN_STATS.has(stat) || IGNORED_STATS.has(stat)) continue;
    const key = `${source.featId}:${stat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push(
      `stat_bonus targets unknown stat "${stat}" in ${source.featId}`,
    );
  }
}

/**
 * Apply `stat_bonus` boons that target an attribute, in place, before anything
 * derived. Amounts must be numeric or Tier-only formulas (evaluated against a
 * pre-attribute env of just {Tier}) — a formula that references an attribute
 * would be self-referential, so it is skipped with a warning.
 */
function applyAttributeBonuses(
  attrs: Record<AttributeKey, number>,
  active: ActiveBoon[],
  tier: number,
  condCtx: ConditionCtx,
  warnings: string[],
): void {
  const tierEnv: FormulaEnv = { Tier: tier };
  for (const { boon, source } of active) {
    if (boon.type !== "stat_bonus") continue;
    const key = ATTR_STAT[String(boon.stat)];
    if (!key) continue;
    if (((boon.target as string) ?? "self") !== "self") continue;
    if (
      boon.condition &&
      evalCondition(String(boon.condition), condCtx) !== true
    )
      continue;
    const amt = boon.amount;
    if (typeof amt === "number") {
      attrs[key] += amt;
    } else if (typeof amt === "string") {
      try {
        attrs[key] += evalFormula(amt, tierEnv);
      } catch {
        warnings.push(
          `attribute stat_bonus "${amt}" in ${source.featId} references a non-Tier identifier; skipped`,
        );
      }
    }
  }
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

function spellcastingTier(
  casterType: "full" | "half" | "limited",
  threshold: number,
): number {
  if (casterType === "full") return Math.min(threshold + 1, 6);
  if (casterType === "half") return Math.min(Math.floor(threshold / 2) + 1, 5);
  return Math.min(Math.floor(threshold / 2) + 1, 3);
}

function knownSpellsAllowance(
  casterType: "full" | "half" | "limited",
  threshold: number,
): number {
  if (casterType === "full") return 4 + 3 * threshold;
  if (casterType === "half") return 3 + 2 * threshold;
  return 2 + threshold;
}

function spellcastingGrant(active: ActiveBoon[]): SpellcastingGrant | null {
  for (const { boon } of active)
    if (boon.type === "grants_spellcasting")
      return boon as unknown as SpellcastingGrant;
  return null;
}

function spellcastingModName(
  stored: StoredCharacter,
  grant: SpellcastingGrant,
): AttributeKey | null {
  const modName =
    stored.build.spellcasting_modifier ??
    (typeof grant.modifier === "string"
      ? (grant.modifier.toLowerCase() as AttributeKey)
      : null);
  return modName && ATTRIBUTES.includes(modName) ? modName : null;
}

/**
 * Resolve the spellcasting modifier value early (feeds the formula env as
 * SpellMod). Independent of resources, so it can run before them — this breaks
 * the old ordering knot where resources needed SpellMod but the full
 * spellcasting object needed resources for its reservoir lookup.
 */
function resolveSpellMod(
  stored: StoredCharacter,
  active: ActiveBoon[],
  attrs: Record<AttributeKey, number>,
): number {
  const grant = spellcastingGrant(active);
  if (!grant) return 0;
  const modName = spellcastingModName(stored, grant);
  return modName ? attrs[modName] : 0;
}

function computeSpellcasting(
  stored: StoredCharacter,
  active: ActiveBoon[],
  attrs: Record<AttributeKey, number>,
  tier: number,
  resources: ComputedResource[],
  env: FormulaEnv,
  warnings: string[],
): ComputedSpellcasting | null {
  const grant = spellcastingGrant(active);
  if (!grant) return null;

  const modName = spellcastingModName(stored, grant);
  if (!modName) return null;
  const modValue = attrs[modName];

  const threshold = spellcastingThreshold(stored.build.feats_purchased);

  // upgrade_spellcasting: caster_type promotion + reservoir formula override.
  let casterType = grant.caster_type;
  let reservoirOverride: number | null = null;
  for (const { boon } of active) {
    if (boon.type !== "upgrade_spellcasting") continue;
    if (typeof boon.caster_type === "string")
      casterType = boon.caster_type as typeof casterType;
    if (boon.reservoir_formula != null)
      reservoirOverride = num(
        boon.reservoir_formula,
        env,
        warnings,
        "upgrade_spellcasting reservoir",
      );
    // any other fields the engine doesn't model surface on the card
    const modeled = new Set(["type", "caster_type", "reservoir_formula"]);
    for (const k of Object.keys(boon))
      if (!modeled.has(k))
        warnings.push(
          `upgrade_spellcasting field "${k}" not modeled (card-only)`,
        );
  }

  const sTier = spellcastingTier(casterType, threshold);

  // reservoir: override → granted resource pool → caster-type default
  const source = typeof grant.source === "string" ? grant.source : null;
  const pool = source ? resources.find((r) => r.def.id === source) : undefined;
  const reservoirMax =
    reservoirOverride ??
    (pool
      ? pool.max
      : casterType === "full"
        ? 2 * tier + modValue
        : casterType === "half"
          ? tier + modValue
          : Math.floor(tier / 2) + modValue);

  const spheres = new Set(stored.build.known_sphere_ids);
  for (const { boon } of active) {
    if (boon.type === "grants_sphere" && typeof boon.sphere === "string")
      spheres.add(boon.sphere);
  }

  // grants_cantrip — free cantrips (counts_against_known:false) raise the allowance
  const cantrips = grant.cantrips as { max?: number } | undefined;
  let cantripAllowance = cantrips?.max ?? 0;
  for (const { boon } of active) {
    if (boon.type !== "grants_cantrip") continue;
    if (boon.counts_against_known !== false) continue;
    cantripAllowance += typeof boon.count === "number" ? boon.count : 1;
  }

  // grants_known_spells — bonus known slots that don't count against knownAllowance
  const freeKnownSlots: ComputedSpellcasting["freeKnownSlots"] = [];
  for (const { boon, source: src } of active) {
    if (boon.type !== "grants_known_spells") continue;
    if (boon.counts_against_known === true) continue;
    const spellIds = Array.isArray(boon.spell_ids)
      ? (boon.spell_ids as string[])
      : undefined;
    const count =
      typeof boon.count === "number" ? boon.count : (spellIds?.length ?? 0);
    if (count <= 0) continue;
    const fromSphere =
      typeof boon.from_sphere === "string" ? boon.from_sphere : undefined;
    freeKnownSlots.push({
      count,
      tier: typeof boon.tier === "number" ? boon.tier : undefined,
      fromSphere,
      spellIds,
      sourceFeat: src.featId,
    });
  }
  const freeKnownCount = freeKnownSlots.reduce((s, f) => s + f.count, 0);

  // signature_spell — cost reduction + tier cap for the picked signature spell(s)
  let signature: ComputedSpellcasting["signature"] = null;
  for (const { boon } of active) {
    if (boon.type !== "signature_spell") continue;
    signature = {
      spellIds: stored.build.signature_spell_ids ?? [],
      costReduction: num(
        boon.cost_reduction,
        env,
        warnings,
        "signature_spell cost_reduction",
      ),
      tierMax:
        boon.tier_max_formula != null
          ? num(
              boon.tier_max_formula,
              env,
              warnings,
              "signature_spell tier_max_formula",
            )
          : null,
    };
  }

  return {
    casterType,
    modifier: modName,
    modifierValue: modValue,
    reservoirMax,
    spellcastingTier: sTier,
    spellDC: 10 + sTier + modValue,
    knownAllowance: knownSpellsAllowance(casterType, threshold),
    preparedAllowance: modValue + tier,
    cantripAllowance,
    spheres: [...spheres],
    freeKnownSlots,
    freeKnownCount,
    signature,
  };
}

// ── Resources ────────────────────────────────────────────────────────────────

function computeResources(
  stored: StoredCharacter,
  reg: Registry,
  env: FormulaEnv,
  tier: number,
  active: ActiveBoon[],
  warnings: string[],
): ComputedResource[] {
  const out: ComputedResource[] = [];
  const byId = new Map<string, ComputedResource>();
  const clamp = (id: string, max: number) =>
    Math.min(stored.pools.resources[id] ?? max, max);

  const prof = reg.professions.get(stored.build.profession_id);
  for (const def of prof?.resources ?? []) {
    let max = 0;
    if (def.max === "tier_gated" && def.max_by_tier) {
      for (const row of def.max_by_tier) {
        if (row.tier <= tier) max = Math.max(max, row.value);
      }
    } else {
      max = num(def.max, env, warnings, `resource "${def.id}" max`);
    }
    const r: ComputedResource = { def, max, current: clamp(def.id, max) };
    out.push(r);
    byId.set(def.id, r);
  }

  // grants_resource — inline pool defs (e.g. weaver threads). Boons that only
  // carry a resource_id reference an existing profession pool (already added).
  for (const { boon, source } of active) {
    if (boon.type !== "grants_resource") continue;
    const id = String(boon.resource_id ?? "");
    if (!id || boon.max === undefined) continue;
    const def: ResourceDef = {
      id,
      name: String(boon.name ?? id),
      max: boon.max as string | number,
      recovery: boon.recovery as ResourceDef["recovery"],
    };
    const max = num(boon.max, env, warnings, `resource "${id}" max`);
    const existing = byId.get(id);
    if (existing) {
      warnings.push(
        `resource "${id}" granted by ${source.featId} collides with an existing pool; boon wins`,
      );
      existing.def = def;
      existing.max = max;
      existing.current = clamp(id, max);
    } else {
      const r: ComputedResource = { def, max, current: clamp(id, max) };
      out.push(r);
      byId.set(id, r);
    }
  }

  // upgrade_resource — max_override (replace) then max_bonus (add), both formulas.
  for (const { boon } of active) {
    if (boon.type !== "upgrade_resource") continue;
    const id = String(boon.resource ?? "");
    const r = byId.get(id);
    if (!r) {
      warnings.push(`upgrade_resource targets unknown resource "${id}"`);
      continue;
    }
    if (boon.max_override != null)
      r.max = num(
        boon.max_override,
        env,
        warnings,
        `resource "${id}" max_override`,
      );
    if (boon.max_bonus != null)
      r.max += num(boon.max_bonus, env, warnings, `resource "${id}" max_bonus`);
    r.current = clamp(id, r.max);
  }

  return out;
}

// reduction_pool boons carry a max formula but no id/name — synthesize a stable
// id from the granting feat (indexed if a feat grants more than one). `current`
// persists in stored.pools.reduction_pools under that id.
function computeReductionPools(
  active: ActiveBoon[],
  stored: StoredCharacter,
  env: FormulaEnv,
  warnings: string[],
): ComputedCharacter["reductionPools"] {
  const out: ComputedCharacter["reductionPools"] = [];
  const counts = new Map<string, number>();
  for (const { boon, source } of active) {
    if (boon.type !== "reduction_pool") continue;
    if (boon.formula == null) continue; // non-pool variant (e.g. redirect)
    const n = counts.get(source.featId) ?? 0;
    counts.set(source.featId, n + 1);
    const id = n === 0 ? source.featId : `${source.featId}#${n}`;
    const max = num(
      boon.formula,
      env,
      warnings,
      `${source.featId} reduction_pool`,
    );
    const current = Math.min(stored.pools.reduction_pools[id] ?? max, max);
    out.push({
      id,
      name: source.featName,
      max,
      current,
      source: source.featId,
    });
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

export function computeCharacter(
  stored: StoredCharacter,
  reg: Registry,
): ComputedCharacter {
  const warnings: string[] = [];
  const b = stored.build;
  const profession = reg.professions.get(b.profession_id);
  const vocation = reg.vocations.get(b.vocation_id);
  if (!profession) warnings.push(`unknown profession "${b.profession_id}"`);
  if (!vocation && b.vocation_id)
    warnings.push(`unknown vocation "${b.vocation_id}"`);

  const tier = calcTier(b.feats_purchased, reg);

  // attributes = allocated base + vocation bonus (attribute stat_bonus applied below)
  const attrs: Record<AttributeKey, number> = { ...b.attributes };
  if (vocation)
    attrs[vocation.attribute_bonus.attribute] +=
      vocation.attribute_bonus.amount;

  const { cards, activeBoons } = collectFeats(stored, reg);
  const activeStates = stored.states.active;

  // equipment + condition context (slot-aware; independent of attributes)
  const eq = equipped(stored, reg);
  const armorRules = parseArmorRules(reg);
  const rawArmorType = eq.armor ? String(eq.armor.cat.armor_type ?? "") : "";
  const condCtx: ConditionCtx = {
    armorType:
      rawArmorType === "Light" ||
      rawArmorType === "Medium" ||
      rawArmorType === "Heavy"
        ? rawArmorType
        : null,
    hasShield: !!eq.shield,
    activeStates,
    wearingArmor: !!eq.armor,
  };

  // attribute stat_bonus boons apply before anything derived
  applyAttributeBonuses(attrs, activeBoons, tier, condCtx, warnings);

  // ── formula env, built in stages (later ids depend on earlier stages) ───────
  const env: FormulaEnv = {
    Brawn: attrs.brawn,
    Finesse: attrs.finesse,
    Mind: attrs.mind,
    Will: attrs.will,
    Tier: tier,
  };
  // Stage 2 — spell modifier (early; does not need resources)
  const spellMod = resolveSpellMod(stored, activeBoons, attrs);
  env.SpellMod = spellMod;
  env.spellMod = spellMod; // casing aliases for straggler data
  env.spell_modifier = spellMod;
  // Stage 3 — equipment-derived identifiers
  const armorBonusVal = eq.armor ? armorBonusOf(eq.armor.cat) : 0;
  const masterworkVal = eq.armor
    ? masterworkBonus(eq.armor.item, eq.armor.cat)
    : 0;
  const shieldBonusVal = eq.shield ? armorBonusOf(eq.shield.cat) : 0;
  env.armor_bonus = armorBonusVal;
  env.masterwork_bonus = masterworkVal;
  env.shield_armor_bonus = shieldBonusVal;
  env.light_armor_bonus =
    condCtx.armorType === "Light" ? armorBonusVal + masterworkVal : 0;

  if (
    eq.weapons.length >= 2 &&
    !isTwoHanded(eq.weapons[0]?.cat ?? null) &&
    !canDualWield(activeBoons)
  ) {
    warnings.push("Dual-wielding without a boon that allows it");
  }
  const hasAgile =
    activeBoons.some(
      ({ boon }) =>
        boon.type === "equipment_rule_override" && boon.rule === "agile",
    ) ||
    activeBoons.some(
      ({ boon }) =>
        boon.type === "proficiency" &&
        String(boon.grants ?? "")
          .toLowerCase()
          .includes("agile"),
    );

  // ── defenses ───────────────────────────────────────────────────────────────
  const breakdown: Record<DefenseKey, string[]> = {
    Armor: [],
    Fortitude: [],
    Mental: [],
    "Will Defense": [],
  };
  // Stage 4 — base Fortitude/Mental/Will (feed env before alternate_defense)
  const fortBonus = selfStatBonus(
    activeBoons,
    "Fortitude",
    env,
    condCtx,
    warnings,
  );
  const mentBonus = selfStatBonus(
    activeBoons,
    "Mental",
    env,
    condCtx,
    warnings,
  );
  const willBonus = selfStatBonus(
    activeBoons,
    "Will Defense",
    env,
    condCtx,
    warnings,
  );
  const fortitude = 8 + attrs.brawn + fortBonus;
  const mental = 8 + attrs.mind + mentBonus;
  const willDef = 8 + attrs.will + willBonus;
  env.fortitude = fortitude;
  env.mental = mental;
  env.will_defense = willDef;
  // casing aliases — data uses capitalized defense identifiers (e.g. "Fortitude + armor_bonus")
  env.Fortitude = fortitude;
  env.Mental = mental;
  env.WillDefense = willDef;

  // Armor: standard equipment defense vs active alternate_defense boons —
  // highest wins (P3, kills the old name-substring matching). Losers still
  // render on their feat cards.
  const std = armorDefense(eq, attrs, tier, hasAgile, armorRules);
  let armorVal = std.value;
  let armorLine = std.line;
  for (const { boon, source } of activeBoons) {
    if (boon.type !== "alternate_defense") continue;
    if (String(boon.replaces ?? "Armor") !== "Armor") continue;
    if (evalCondition(boon.condition as string, condCtx) !== true) continue;
    const v = num(
      boon.formula,
      env,
      warnings,
      `${source.featId} alternate_defense`,
    );
    if (v > armorVal) {
      armorVal = v;
      armorLine = `${String(boon.name ?? "Alternate Defense")}: ${String(boon.formula)} = ${v}`;
    }
  }
  const armorStatBonus = selfStatBonus(
    activeBoons,
    "Armor",
    env,
    condCtx,
    warnings,
  );

  const defenses: Record<DefenseKey, number> = {
    Armor: armorVal + armorStatBonus,
    Fortitude: fortitude,
    Mental: mental,
    "Will Defense": willDef,
  };
  breakdown.Armor.push(armorLine);
  if (armorStatBonus) breakdown.Armor.push(`+${armorStatBonus} from boons`);
  breakdown.Fortitude.push(`8 + Brawn ${attrs.brawn}`);
  if (fortBonus) breakdown.Fortitude.push(`+${fortBonus} from boons`);
  breakdown.Mental.push(`8 + Mind ${attrs.mind}`);
  if (mentBonus) breakdown.Mental.push(`+${mentBonus} from boons`);
  breakdown["Will Defense"].push(`8 + Will ${attrs.will}`);
  if (willBonus) breakdown["Will Defense"].push(`+${willBonus} from boons`);

  // resources + spellcasting (env is now complete; reservoir may reference a resource)
  const resources = computeResources(
    stored,
    reg,
    env,
    tier,
    activeBoons,
    warnings,
  );
  const reductionPools = computeReductionPools(
    activeBoons,
    stored,
    env,
    warnings,
  );
  const spellcasting = computeSpellcasting(
    stored,
    activeBoons,
    attrs,
    tier,
    resources,
    env,
    warnings,
  );
  if (spellcasting)
    spellcasting.spellDC += selfStatBonus(
      activeBoons,
      "spell_dc",
      env,
      condCtx,
      warnings,
    );

  // roll + AP bonuses from stat_bonus boons
  const rollBonuses = {
    spellAttack: selfStatBonus(
      activeBoons,
      "spell_attack",
      env,
      condCtx,
      warnings,
    ),
    attackRoll: selfStatBonus(
      activeBoons,
      "attack_roll",
      env,
      condCtx,
      warnings,
    ),
  };
  const apBonus = selfStatBonus(activeBoons, "AP", env, condCtx, warnings);
  warnUnknownStats(activeBoons, warnings);

  const combat = computeCombatBonuses(
    activeBoons,
    env,
    tier,
    condCtx,
    warnings,
  );

  // vitality max: base ("12 + Brawn") + (tier-1) × avg(per_tier) + brawn_bonus + boons
  let vitalityMax = 0;
  if (profession) {
    try {
      vitalityMax += evalFormula(profession.vitality.base, env);
    } catch {
      warnings.push(`bad vitality base "${profession.vitality.base}"`);
    }
    vitalityMax += (tier - 1) * parseAvgDiceExpr(profession.vitality.per_tier);
    const bb = profession.vitality.brawn_bonus;
    if (bb) {
      const attrKey = (
        bb.attribute?.toLowerCase() === "body"
          ? "brawn"
          : (bb.attribute?.toLowerCase() ?? "brawn")
      ) as AttributeKey;
      vitalityMax +=
        Math.floor((attrs[attrKey] ?? 0) / bb.threshold) *
        parseAvgDiceExpr(bb.dice);
    }
  }
  vitalityMax += selfStatBonus(
    activeBoons,
    "Vitality Max",
    env,
    condCtx,
    warnings,
  );

  // wounds max: 1 + wound_per_tier×Tier + floor(Brawn/3) + armor wound bonus (universal-resources canon)
  const armorWoundBonus = eq.armor?.cat.wound_bonus ?? 0;
  const woundsMax =
    1 +
    (profession?.wound_threshold_per_tier ?? 0) * tier +
    Math.floor(attrs.brawn / 3) +
    armorWoundBonus;

  // ambition: max 4 + Tier + floor(Will/3) (universal-resources canon) + boons
  const ambitionMax =
    4 +
    tier +
    Math.floor(attrs.will / 3) +
    selfStatBonus(activeBoons, "Ambition Max", env, condCtx, warnings);

  // carry
  const carryCapacity = evalFormula(
    reg.itemsDoc.carry_rules.carry_capacity_formula,
    env,
  );
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
    Math.floor(b.feats_purchased / 2) *
      reg.tierProgression.skill_point_per_even_feat;
  const skillSpent = Object.values(b.skills.points).reduce((s, n) => s + n, 0);
  const expertiseEarned = tier - 1;
  const expertiseSpent = Object.values(b.skills.expertise_bumps).reduce(
    (s, n) => s + n,
    0,
  );

  // proficiencies
  const profs = {
    armaments: profession?.proficiencies.armaments ?? [],
    protection: profession?.proficiencies.protection ?? [],
    tools: Array.isArray(profession?.proficiencies.tools)
      ? profession.proficiencies.tools
      : [],
  };
  for (const { boon } of activeBoons) {
    if (boon.type === "proficiency" && typeof boon.grants === "string")
      profs.armaments = [...profs.armaments, boon.grants];
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
    ambition: {
      max: ambitionMax,
      current: Math.min(stored.pools.ambition, ambitionMax),
      die: ambitionDie(reg, attrs.will, tier),
    },
    resources,
    reductionPools,
    spellcasting,
    rollBonuses,
    apBonus,
    combat,
    skills: SKILLS.map((s) => skillPool(s, stored, attrs)),
    carry: { capacity: carryCapacity, used: Math.round(carryUsed * 10) / 10 },
    featCards: cards,
    activeBoons,
    activeStates,
    proficiencies: profs,
    warnings,
  };
}

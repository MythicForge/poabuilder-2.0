// featEligibility — can this build take (or keep) a feat? Pure functions over
// stored choices + registry; the wizard uses it to disable/annotate picks and
// validate-character reuses the same slot math for warnings.
//
// Slot model: each tier row in tier-progression contributes its slots once the
// character reaches that tier; capacities pool by slot_type across tiers. The
// tier-4 flexible slot only exists once build.tier4_slot_choice is set.

import type { Feat, StoredCharacter } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { calcTier } from "./compute.ts";
import { collectFeats } from "./boon-resolver.ts";

export type SlotType = "tactical" | "narrative" | "passive";
export const SLOT_TYPES: SlotType[] = ["tactical", "narrative", "passive"];

export interface Eligibility {
  ok: boolean;
  reasons: string[];
}

export interface SlotState {
  capacity: Record<SlotType, number>;
  used: Record<SlotType, number>;
  /** Explicitly selected non-starting feats (what feats_purchased pays for). */
  purchasedSelected: number;
  /** Tier ≥ 4 but tier4_slot_choice not made yet. */
  tier4ChoicePending: boolean;
}

export interface Prereqs {
  feats: string[];
  exclude_feats: string[];
  path_investment: { path: string; count: number } | null;
  origin_investment: { origin: string; count: number } | null;
}

/** Every feat this build could legally reference by id (same pool as collectFeats). */
export function buildFeatPool(
  stored: StoredCharacter,
  reg: Registry,
): Map<string, { feat: Feat; owner: string }> {
  const b = stored.build;
  const pool = new Map<string, { feat: Feat; owner: string }>();
  const add = (feats: Feat[] | undefined, owner: string) => {
    for (const f of feats ?? []) pool.set(f.id, { feat: f, owner });
  };
  const profession = reg.professions.get(b.profession_id);
  add(profession?.feats, profession?.name ?? b.profession_id);
  for (const p of profession ? reg.pathsOf(profession.id) : [])
    add(p.feats, p.name);
  const origin = reg.origins.get(b.origin_id);
  add(origin?.feats, origin?.name ?? b.origin_id);
  const vocation = reg.vocations.get(b.vocation_id);
  add(vocation?.feats, vocation?.name ?? b.vocation_id);
  add(reg.universalOriginFeats, "Universal");
  return pool;
}

/** Prerequisites normalize: bare array = required feat ids; object = full shape. */
export function normalizePrereqs(raw: unknown): Prereqs {
  const out: Prereqs = {
    feats: [],
    exclude_feats: [],
    path_investment: null,
    origin_investment: null,
  };
  if (Array.isArray(raw)) {
    out.feats = raw.filter((x): x is string => typeof x === "string");
    return out;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.feats))
      out.feats = o.feats.filter((x): x is string => typeof x === "string");
    if (Array.isArray(o.exclude_feats))
      out.exclude_feats = o.exclude_feats.filter(
        (x): x is string => typeof x === "string",
      );
    const pi = o.path_investment as
      { path?: string; count?: number } | undefined;
    if (pi?.path) out.path_investment = { path: pi.path, count: pi.count ?? 0 };
    const oi = o.origin_investment as
      { origin?: string; count?: number } | undefined;
    if (oi?.origin)
      out.origin_investment = { origin: oi.origin, count: oi.count ?? 0 };
  }
  return out;
}

export function slotCapacity(
  tier: number,
  tier4Choice: "tactical" | "narrative" | null,
  reg: Registry,
): Record<SlotType, number> {
  const cap: Record<SlotType, number> = {
    tactical: 0,
    narrative: 0,
    passive: 0,
  };
  for (const row of reg.tierProgression.tiers) {
    if (row.tier > tier) continue;
    for (const t of SLOT_TYPES) {
      const n = row.slots[t];
      if (typeof n === "number") cap[t] += n;
    }
    const choice = row.slots.choice as
      { count: number; from: string[] } | undefined;
    if (choice && tier4Choice && choice.from.includes(tier4Choice))
      cap[tier4Choice] += choice.count;
  }
  return cap;
}

/** Selected purchased feats, resolved against the pool (tier-0 / unknown ids excluded). */
export function purchasedSelected(
  stored: StoredCharacter,
  pool: Map<string, { feat: Feat; owner: string }>,
): Feat[] {
  const out: Feat[] = [];
  for (const id of stored.build.feat_ids) {
    const entry = pool.get(id);
    if (entry && entry.feat.tier > 0) out.push(entry.feat);
  }
  return out;
}

export function slotState(stored: StoredCharacter, reg: Registry): SlotState {
  const tier = calcTier(stored.build.feats_purchased, reg);
  const pool = buildFeatPool(stored, reg);
  const selected = purchasedSelected(stored, pool);
  const used: Record<SlotType, number> = {
    tactical: 0,
    narrative: 0,
    passive: 0,
  };
  for (const f of selected) {
    if (f.slot_type) used[f.slot_type] += 1;
  }
  const hasChoiceRow = reg.tierProgression.tiers.some(
    (row) => row.tier <= tier && row.slots.choice,
  );
  return {
    capacity: slotCapacity(tier, stored.build.tier4_slot_choice, reg),
    used,
    purchasedSelected: selected.length,
    tier4ChoicePending: hasChoiceRow && !stored.build.tier4_slot_choice,
  };
}

/** Feat ids the character actually has on-sheet (starting + selected + feat_grant closure). */
export function ownedFeatIds(
  stored: StoredCharacter,
  reg: Registry,
): Set<string> {
  return new Set(collectFeats(stored, reg).cards.map((c) => c.feat.id));
}

function investmentCount(
  featIds: Feat[] | undefined,
  selected: Feat[],
): number {
  const ids = new Set((featIds ?? []).map((f) => f.id));
  return selected.filter((f) => ids.has(f.id)).length;
}

export interface PrereqPill {
  label: string;
  met: boolean;
}

/** Prerequisite pills for feat-inspect display — one per requirement, met/unmet. */
export function prereqPills(
  stored: StoredCharacter,
  feat: Feat,
  reg: Registry,
): PrereqPill[] {
  const pool = buildFeatPool(stored, reg);
  const owned = ownedFeatIds(stored, reg);
  const selected = purchasedSelected(stored, pool).filter(
    (f) => f.id !== feat.id,
  );
  const nameOf = (id: string) => pool.get(id)?.feat.name ?? id;
  const p = normalizePrereqs(feat.prerequisites);
  const out: PrereqPill[] = [];

  for (const id of p.feats)
    out.push({ label: `requires ${nameOf(id)}`, met: owned.has(id) });
  for (const id of p.exclude_feats)
    out.push({ label: `excludes ${nameOf(id)}`, met: !owned.has(id) });
  if (p.path_investment && p.path_investment.count > 0) {
    const path = reg.paths.get(p.path_investment.path);
    const have = investmentCount(path?.feats, selected);
    out.push({
      label: `${p.path_investment.count} ${path?.name ?? p.path_investment.path} feats (${have})`,
      met: have >= p.path_investment.count,
    });
  }
  if (p.origin_investment && p.origin_investment.count > 0) {
    const origin = reg.origins.get(p.origin_investment.origin);
    const have = investmentCount(origin?.feats, selected);
    out.push({
      label: `${p.origin_investment.count} ${origin?.name ?? p.origin_investment.origin} feats (${have})`,
      met: have >= p.origin_investment.count,
    });
  }
  if (feat.tier > 0) {
    const tier = calcTier(stored.build.feats_purchased, reg);
    out.push({ label: `Tier ${feat.tier}`, met: tier >= feat.tier });
  }

  return out;
}

export function featEligibility(
  stored: StoredCharacter,
  feat: Feat,
  reg: Registry,
): Eligibility {
  if (feat.tier === 0)
    return { ok: false, reasons: ["starting feat — granted automatically"] };

  const reasons: string[] = [];
  const tier = calcTier(stored.build.feats_purchased, reg);
  const pool = buildFeatPool(stored, reg);
  const owned = ownedFeatIds(stored, reg);
  const selected = purchasedSelected(stored, pool);
  const nameOf = (id: string) => pool.get(id)?.feat.name ?? id;

  if (feat.tier > tier)
    reasons.push(`requires Tier ${feat.tier} (currently Tier ${tier})`);

  const p = normalizePrereqs(feat.prerequisites);
  for (const id of p.feats) {
    if (!owned.has(id)) reasons.push(`requires ${nameOf(id)}`);
  }
  for (const id of p.exclude_feats) {
    if (owned.has(id)) reasons.push(`incompatible with ${nameOf(id)}`);
  }
  if (p.path_investment && p.path_investment.count > 0) {
    const path = reg.paths.get(p.path_investment.path);
    const have = investmentCount(
      path?.feats,
      selected.filter((f) => f.id !== feat.id),
    );
    if (have < p.path_investment.count) {
      reasons.push(
        `requires ${p.path_investment.count} ${path?.name ?? p.path_investment.path} feats (have ${have})`,
      );
    }
  }
  if (p.origin_investment && p.origin_investment.count > 0) {
    const origin = reg.origins.get(p.origin_investment.origin);
    const have = investmentCount(
      origin?.feats,
      selected.filter((f) => f.id !== feat.id),
    );
    if (have < p.origin_investment.count) {
      reasons.push(
        `requires ${p.origin_investment.count} ${origin?.name ?? p.origin_investment.origin} feats (have ${have})`,
      );
    }
  }

  // slot + purchase budget only gate ADDING; an already-selected feat can stay
  if (!stored.build.feat_ids.includes(feat.id)) {
    const s = slotState(stored, reg);
    if (s.purchasedSelected + 1 > stored.build.feats_purchased) {
      reasons.push(
        `all ${stored.build.feats_purchased} purchased feats are spent — raise Feats first`,
      );
    }
    if (
      feat.slot_type &&
      s.used[feat.slot_type] + 1 > s.capacity[feat.slot_type]
    ) {
      const pending =
        s.tier4ChoicePending &&
        (feat.slot_type === "tactical" || feat.slot_type === "narrative");
      reasons.push(
        `no ${feat.slot_type} slots left (${s.used[feat.slot_type]}/${s.capacity[feat.slot_type]})${pending ? " — pick your Tier-4 flexible slot" : ""}`,
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

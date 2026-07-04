// Collects a character's feats from all sources and flattens them into the
// list of ACTIVE boons, resolving choice/state/equipment conditionals against
// stored selections. Boon types the engine doesn't interpret numerically stay
// available on the feat cards as structured text.

import type { ActiveBoon, Boon, Feat, FeatCard, FeatSource, StoredCharacter } from "./types.ts";
import type { Registry } from "./data-registry.ts";

interface ResolveCtx {
  stored: StoredCharacter;
  equippedArmorType: string | null; // "Light" | "Medium" | "Heavy" | null
}

export interface CollectedFeats {
  cards: FeatCard[];
  activeBoons: ActiveBoon[];
}

export function collectFeats(stored: StoredCharacter, reg: Registry): CollectedFeats {
  const b = stored.build;
  const profession = reg.professions.get(b.profession_id);
  const origin = reg.origins.get(b.origin_id);
  const vocation = reg.vocations.get(b.vocation_id);

  // feat pool: everything this character could legally reference by id
  const pool = new Map<string, { feat: Feat; owner: string; source: FeatSource }>();
  const add = (feats: Feat[] | undefined, owner: string, source: FeatSource) => {
    for (const f of feats ?? []) pool.set(f.id, { feat: f, owner, source });
  };
  add(profession?.feats, profession?.name ?? b.profession_id, "profession");
  for (const p of profession ? reg.pathsOf(profession.id) : []) add(p.feats, p.name, "path");
  add(origin?.feats, origin?.name ?? b.origin_id, "origin");
  add(vocation?.feats, vocation?.name ?? b.vocation_id, "vocation");
  add(reg.universalOriginFeats, "Universal", "universal");

  const cards: FeatCard[] = [];
  const seen = new Set<string>();

  const push = (id: string, starting: boolean) => {
    if (seen.has(id)) return;
    const entry = pool.get(id);
    if (!entry) return;
    seen.add(id);
    cards.push({ feat: entry.feat, owner: entry.owner, source: entry.source, starting, activeBoons: [] });
    // feat_grant closure: granted feats join the sheet
    walkBoons(entry.feat.boons, (boon) => {
      if (boon.type === "feat_grant" && typeof boon.feat_id === "string") push(boon.feat_id, starting);
    });
  };

  // starting feats: tier 0 from profession + vocation (origin tier-0 base feats too)
  for (const f of profession?.feats ?? []) if (f.tier === 0) push(f.id, true);
  for (const f of vocation?.feats ?? []) if (f.tier === 0) push(f.id, true);
  for (const f of origin?.feats ?? []) if (f.tier === 0) push(f.id, true);
  // purchased feats
  for (const id of b.feat_ids) push(id, false);

  // resolve active boons per card
  const ctx: ResolveCtx = { stored, equippedArmorType: equippedArmorType(stored, reg) };
  const activeBoons: ActiveBoon[] = [];
  for (const card of cards) {
    card.activeBoons = resolveBoons(card.feat.boons, ctx);
    for (const boon of card.activeBoons) {
      activeBoons.push({ boon, source: { featId: card.feat.id, featName: card.feat.name, owner: card.owner } });
    }
  }
  return { cards, activeBoons };
}

function equippedArmorType(stored: StoredCharacter, reg: Registry): string | null {
  for (const it of stored.inventory.items) {
    if (!it.equipped) continue;
    const cat = it.custom ?? (it.catalog_item_id ? reg.items.get(it.catalog_item_id) : null);
    if (cat?.category === "Armor" && cat.armor_type) return String(cat.armor_type);
  }
  return null;
}

/** Visit every boon in a boon array, including wrapper children. */
export function walkBoons(boons: Boon[] | undefined, visit: (b: Boon) => void): void {
  for (const b of boons ?? []) {
    visit(b);
    if (Array.isArray(b.boons)) walkBoons(b.boons as Boon[], visit);
    if (b.effect && typeof b.effect === "object" && !Array.isArray(b.effect)) visit(b.effect as Boon);
    if (Array.isArray(b.options)) {
      for (const opt of b.options as Array<Record<string, unknown>>) {
        if (Array.isArray(opt.boons)) walkBoons(opt.boons as Boon[], visit);
        const grants = opt.grants as Record<string, unknown> | undefined;
        if (grants && Array.isArray(grants.boons)) walkBoons(grants.boons as Boon[], visit);
      }
    }
  }
}

/**
 * Flatten a feat's boons to the ACTIVE list given stored selections:
 *  - choice / multi_choice → selected option's boons/grants (plus the choice itself, for UI)
 *  - choice_conditional / by_choice → branch matching the stored choice
 *  - daily_mode_choice → selected mode's boons
 *  - activate_state → child boons only while the state is on (the state boon itself always returns, to render the toggle)
 *  - armor_type_conditional → branch for the equipped armor type
 *  - conditional_effect → kept as-is (display + uses counter; trigger fires manually)
 *  - multi_boon → flattened
 */
export function resolveBoons(boons: Boon[] | undefined, ctx: ResolveCtx): Boon[] {
  const out: Boon[] = [];
  for (const b of boons ?? []) out.push(...resolveOne(b, ctx));
  return out;
}

function optionBoons(opt: Record<string, unknown>): Boon[] {
  const list: Boon[] = [];
  if (Array.isArray(opt.boons)) list.push(...(opt.boons as Boon[]));
  const grants = opt.grants as Record<string, unknown> | undefined;
  if (grants) {
    if (Array.isArray(grants.boons)) list.push(...(grants.boons as Boon[]));
    // stance/maneuver style nesting (e.g. fighter signature school)
    for (const v of Object.values(grants)) {
      if (v && typeof v === "object" && !Array.isArray(v) && Array.isArray((v as Record<string, unknown>).boons)) {
        list.push(...((v as Record<string, unknown>).boons as Boon[]));
      }
    }
  }
  return list;
}

function resolveOne(b: Boon, ctx: ResolveCtx): Boon[] {
  const choices = ctx.stored.build.choices;
  switch (b.type) {
    case "multi_boon":
      return resolveBoons((b.boons as Boon[]) ?? [], ctx);

    case "choice":
    case "multi_choice": {
      const key = String(b.key ?? "");
      const sel = choices[key];
      const selected = Array.isArray(sel) ? sel : sel ? [sel] : [];
      const out: Boon[] = [b]; // keep the choice boon so the UI can render/edit the pick
      for (const opt of (b.options as Array<Record<string, unknown>>) ?? []) {
        if (selected.includes(String(opt.value))) out.push(...resolveBoons(optionBoons(opt), ctx));
      }
      return out;
    }

    case "daily_mode_choice": {
      const key = String(b.key ?? "");
      const mode = ctx.stored.daily_modes[key];
      const out: Boon[] = [b];
      for (const opt of (b.options as Array<Record<string, unknown>>) ?? []) {
        if (mode && String(opt.value) === mode) out.push(...resolveBoons(optionBoons(opt), ctx));
      }
      return out;
    }

    case "choice_conditional": {
      const key = String(b.choice_key ?? "");
      const sel = choices[key];
      const selected = Array.isArray(sel) ? sel : sel ? [sel] : [];
      const byChoice = (b.by_choice as Record<string, Boon[]>) ?? {};
      const out: Boon[] = [];
      for (const [value, branch] of Object.entries(byChoice)) {
        if (selected.includes(value)) out.push(...resolveBoons(branch, ctx));
      }
      return out;
    }

    case "armor_type_conditional": {
      const byType = (b.by_type as Record<string, Boon[]>) ?? {};
      const key = ctx.equippedArmorType?.toLowerCase() ?? "unarmored";
      const branch = byType[key] ?? byType[ctx.equippedArmorType ?? ""] ?? [];
      return resolveBoons(branch, ctx);
    }

    case "activate_state": {
      const state = String(b.state ?? "");
      const on = ctx.stored.states.active.includes(state);
      const out: Boon[] = [b];
      if (on && Array.isArray(b.boons)) out.push(...resolveBoons(b.boons as Boon[], ctx));
      return out;
    }

    default:
      return [b];
  }
}

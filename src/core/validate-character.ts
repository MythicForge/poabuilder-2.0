// validateCharacter — build-legality warnings the engine itself doesn't need
// to render a sheet (overspends, overflow, prerequisite violations). Returns
// plain strings; the builder shell appends them to computed.warnings for the
// footer badge and the summary step.

import type { ComputedCharacter, StoredCharacter } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { ATTRIBUTES } from "./types.ts";
import { SLOT_TYPES, buildFeatPool, featEligibility, purchasedSelected, slotState } from "./feat-eligibility.ts";

export function validateCharacter(stored: StoredCharacter, reg: Registry, computed: ComputedCharacter): string[] {
  const out: string[] = [];
  const b = stored.build;

  // ── attributes ──
  const { earned, spent } = computed.attributeBudget;
  if (spent > earned) out.push(`attributes overspent: ${spent} of ${earned} points`);
  for (const a of ATTRIBUTES) {
    if (b.attributes[a] < 0) out.push(`${a} is negative`);
  }

  // ── skill proficiency picks ──
  const prof = reg.professions.get(b.profession_id);
  const spec = prof?.proficiencies.skills;
  if (spec && !Array.isArray(spec)) {
    if (b.skills.proficiencies.length > spec.count) {
      out.push(`too many skill proficiencies: ${b.skills.proficiencies.length} of ${spec.count}`);
    }
    for (const s of b.skills.proficiencies) {
      if (!spec.from.includes(s)) out.push(`skill proficiency "${s}" is not offered by ${prof!.name}`);
    }
  }

  // ── skill points (dice picks + expertise bumps share the same budget) ──
  const pointsSpent = Object.values(b.skills.points).reduce((s, n) => s + n, 0);
  const bumpsSpent = Object.values(b.skills.expertise_bumps).reduce((s, n) => s + n, 0);
  const skillEarned = computed.skillPointBudget.earned;
  if (pointsSpent + bumpsSpent > skillEarned) {
    out.push(`skill points overspent: ${pointsSpent + bumpsSpent} of ${skillEarned} (dice + expertise)`);
  }
  for (const [skill, bumps] of Object.entries(b.skills.expertise_bumps)) {
    const total = (b.skills.proficiencies.includes(skill) ? 1 : 0) + bumps;
    if (total > 3) out.push(`${skill} expertise exceeds Master rank`);
  }

  // ── feat purchases & slots ──
  if (b.feats_purchased > reg.tierProgression.max_feats) {
    out.push(`feats purchased ${b.feats_purchased} exceeds the cap of ${reg.tierProgression.max_feats}`);
  }
  const pool = buildFeatPool(stored, reg);
  const selected = purchasedSelected(stored, pool);
  if (selected.length > b.feats_purchased) {
    out.push(`${selected.length} feats selected but only ${b.feats_purchased} purchased`);
  }
  const slots = slotState(stored, reg);
  for (const t of SLOT_TYPES) {
    if (slots.used[t] > slots.capacity[t]) {
      out.push(
        `${t} slots overfilled: ${slots.used[t]} of ${slots.capacity[t]}${slots.tier4ChoicePending && t !== "minor" ? " — pick your Tier-4 flexible slot" : ""}`,
      );
    }
  }
  for (const id of b.feat_ids) {
    if (!pool.has(id)) out.push(`unknown feat "${id}" for this build`);
  }
  for (const feat of selected) {
    const e = featEligibility(stored, feat, reg);
    // slot pressure is reported in aggregate above; per-feat we only surface prereq/tier failures
    for (const r of e.reasons) {
      if (!r.startsWith("no ") && !r.startsWith("all ")) out.push(`${feat.name}: ${r}`);
    }
  }

  // ── spell allowances ──
  const sc = computed.spellcasting;
  if (sc) {
    if (b.known_spell_ids.length > sc.knownAllowance) {
      out.push(`known spells overfilled: ${b.known_spell_ids.length} of ${sc.knownAllowance}`);
    }
    if (b.known_cantrip_ids.length > sc.cantripAllowance) {
      out.push(`cantrips overfilled: ${b.known_cantrip_ids.length} of ${sc.cantripAllowance}`);
    }
    if (b.prepared_spell_ids.length > sc.preparedAllowance) {
      out.push(`prepared spells overfilled: ${b.prepared_spell_ids.length} of ${sc.preparedAllowance}`);
    }
    const known = new Set(b.known_spell_ids);
    for (const id of b.prepared_spell_ids) {
      if (!known.has(id)) out.push(`prepared spell "${reg.spells.get(id)?.name ?? id}" is not known`);
    }
    for (const id of [...b.known_spell_ids, ...b.known_cantrip_ids]) {
      const spell = reg.spells.get(id);
      if (!spell) out.push(`unknown spell id "${id}"`);
      else if (spell.tier > sc.spellcastingTier && !spell.is_cantrip) {
        out.push(`${spell.name} is Tier ${spell.tier}, above your spellcasting Tier ${sc.spellcastingTier}`);
      }
    }
  } else if (b.known_spell_ids.length || b.known_cantrip_ids.length) {
    out.push("spells selected but this build has no spellcasting grant");
  }

  return out;
}

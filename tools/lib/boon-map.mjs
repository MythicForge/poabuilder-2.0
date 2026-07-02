// Retired-boon conversion rules, derived from data/shared/boon-schema.json `retired` map.
// Each merge transform returns the replacement boon; fields it can't map confidently
// get an `_review` note so the human pass can verify.

export function humanize(type) {
  return type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function pick(src, keys) {
  const out = {};
  for (const k of keys) if (src[k] !== undefined && src[k] !== null) out[k] = src[k];
  return out;
}

function review(boon, msg) {
  boon._review = boon._review || [];
  boon._review.push(msg);
  return boon;
}

// ctx = { featId, featName } of the nearest enclosing feat (may be null)
export const MERGE_TRANSFORMS = {
  armor_bonus: (o) => ({
    type: "stat_bonus",
    stat: "Armor",
    amount: o.amount,
    ...pick(o, ["target", "condition", "duration", "uses", "note"]),
  }),

  replace_stat: (o) => ({
    type: "stat_substitution",
    replace: o.replace,
    with: o.with,
    with_kind: "attribute",
    ...pick(o, ["context", "contexts", "condition", "note"]),
  }),

  attribute_swap: (o) => ({
    type: "stat_substitution",
    replace: o.key,
    with: o.can_use,
    with_kind: "attribute",
    ...pick(o, ["context", "contexts", "condition", "note"]),
  }),

  resource_as_stat: (o) => ({
    type: "stat_substitution",
    replace: o.replaces,
    with: o.resource,
    with_kind: "resource",
    ...pick(o, ["context", "contexts", "condition", "note"]),
  }),

  attribute_borrow: (o) => {
    const b = {
      type: "stat_substitution",
      replace: o.replaces ?? o.key ?? "UNMAPPED",
      with: o.with ?? o.source ?? "UNMAPPED",
      with_kind: "summon_stat",
      ...pick(o, ["context", "contexts", "condition", "note"]),
    };
    return review(b, "attribute_borrow had no explicit replace/with; verify mapping");
  },

  remove_trait: (o) => ({
    type: "equipment_rule_override",
    rule: "remove_trait",
    ...pick(o, ["trait", "restriction", "amount", "condition", "note"]),
  }),

  allow_dual_wield: (o) => ({
    type: "equipment_rule_override",
    rule: "allow_dual_wield",
    ...pick(o, ["trait", "restriction", "amount", "condition", "note"]),
  }),

  range_increase: (o) => ({
    type: "equipment_rule_override",
    rule: "range_increase",
    ...pick(o, ["trait", "categories", "restriction", "amount", "condition", "note"]),
  }),

  reduce_trait: (o) => ({
    type: "equipment_rule_override",
    rule: "reduce_trait",
    ...pick(o, ["trait", "restriction", "amount", "condition", "note"]),
  }),

  carry_weight_multiplier: (o) => ({
    type: "equipment_rule_override",
    rule: "carry_weight_multiplier",
    amount: o.amount,
    ...pick(o, ["condition", "note"]),
  }),

  spell_cost_reduction: (o) => ({
    type: "spell_cost_modifier",
    amount: -Math.abs(o.amount),
    ...pick(o, ["context", "condition", "note"]),
  }),

  apply_state: (o, ctx) => ({
    type: "activate_state",
    state: o.state ?? ctx.featId ?? "UNNAMED_STATE",
    ...(o.condition !== undefined && o.condition !== null ? { active_while: o.condition } : {}),
    ...pick(o, ["target", "range", "boons", "ends_when", "note"]),
  }),

  aura: (o, ctx) => {
    const b = {
      type: "activate_state",
      state: o.state ?? (ctx.featId ? `${ctx.featId}_aura` : "aura"),
      ...pick(o, ["active_while", "range", "ends_when", "note"]),
      target: o.target ?? "allies_in_range",
      ...(o.effects ? { boons: o.effects } : {}),
    };
    return review(b, "aura converted; verify state name and target");
  },

  bind_spells: (o) => spellEnchantment(o, "bind_spells", { target_item: null, max: o.max_bound }),
  inscribe_spell: (o) => spellEnchantment(o, "inscribe_spell", { target_item: null, max: o.max_inscribed }),
  store_spell: (o) => spellEnchantment(o, "store_spell", { target_item: o.into, max: 1 }),

  emulate_kit: (o) => {
    const b = {
      type: "grants_free_success",
      context: o.context ?? "kit_emulation",
      count: o.uses?.count ?? o.count ?? 1,
      ...(o.uses?.recharge ? { recharge: o.uses.recharge } : {}),
      ...pick(o, ["skill_choice_at", "note"]),
    };
    return review(b, "emulate_kit converted; skill is chosen in context — verify wording");
  },

  free_success: (o) => ({
    type: "grants_free_success",
    context: o.context,
    count: o.count ?? 1,
    ...pick(o, ["recharge", "note"]),
  }),
};

function spellEnchantment(o, oldType, { target_item, max }) {
  const effect = { type: "spell" };
  for (const [k, v] of Object.entries(o)) {
    if (k === "type" || v === undefined || v === null) continue;
    if (["max_bound", "max_inscribed", "into"].includes(k)) continue;
    effect[k] = v;
  }
  const b = {
    type: "enchantment_option",
    ...(target_item ? { target_item } : {}),
    ...(max !== undefined && max !== null ? { max_placements: max } : {}),
    options: [{ value: oldType, label: humanize(oldType), effect }],
  };
  return review(b, `${oldType} folded into enchantment_option; semantics need human verification`);
}

// Build a deterministic prose sentence from a dropped describe-boon.
export function describeProse(boon) {
  const parts = [];
  for (const [k, v] of Object.entries(boon)) {
    if (k === "type" || k === "note" || v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  let s = `${humanize(boon.type)}`;
  if (parts.length) s += ` — ${parts.join("; ")}`;
  if (boon.note) s += ` (${boon.note})`;
  return s + ".";
}

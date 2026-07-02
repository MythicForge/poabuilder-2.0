# R4 — Engine Coverage Upgrades

**Goal:** promote the highest-value "render-as-text" boon types to tracked UI. Not all 59 types —
only the ones that gate real play loops. Everything stays incremental: each upgrade = engine wiring
+ UI + unit test + (if needed) storage field already reserved in the character schema.

## Current interpreted set (see `src/core/compute.ts` + `boon-resolver.ts`)

stat_bonus (self), alternate_defense (unarmored heuristic), stat_substitution (partial),
equipment_rule_override (agile/carry only), proficiency (armaments), feat_grant, upgrade_feat (collection only),
choice/multi_choice/choice_conditional/daily_mode_choice, armor_type_conditional, activate_state,
multi_boon, grants_spellcasting, grants_sphere, spell_cost_modifier, resource maxima.

## Upgrade batches (do in order; each independently shippable)

### Batch 1 — counters & pools (cheap, high value)
- **reduction_pool** (character-level): compute max from `formula`/`source`, current from
  `pools.reduction_pools[sourceKey]`; chips on the Vitality card (schema + styles already
  anticipate this); damage input offers "absorb into pool" toggle.
- **grants_free_success**: counters surfaced on Feats tab + right rail; decrement button;
  rest.ts already resets them.
- **conditional_effect with `uses`**: track remaining triggers via `pools.uses` keyed
  `featId:trigger`; button "fired" on the feat card.
- **restore_resource / heal as buttons**: activated feats with these boons get a "use" button
  that applies the effect (restore N resource / heal formula) and decrements uses.

### Batch 2 — spell economy
- **upgrade_spellcasting**: apply deltas (extra known/prepared/cantrips, DC mods) on top of the
  grant in `computeSpellcasting`.
- **grants_known_spells / grants_cantrip**: granted ids auto-join known lists (display-tagged
  "granted", not stored — compute-time union with `build.known_spell_ids`).
- **signature_spell / free_recast**: signature list UI on Spells tab; free_recast = per-rest
  use counter on the spell row.

### Batch 3 — prep systems (uses `build.prep` Record<featId, json>)
- **bind_weapon / grants_weapon**: prep UI picks the bound weapon; combat tab renders conjured
  weapon rows (by_core weapon tables in kineticist are the template).
- **enchantment_option / apply_augmentation / grants_augment_slot**: prep UI to place
  enchantments/augments on inventory items; item rows show applied effects; slot counts enforced.
- **daily_mode_choice**: already resolved by engine — add explicit UI section on Feats tab
  ("Daily modes" card) instead of inline pickers.

### Batch 4 — companions & summons (biggest; only if user wants)
- **summon / grants_companion / summon_* / cast_through_summon / companion_autonomy**:
  companion card (stat block from boon json), vitality tracker per summon,
  `pools.resources`-style storage under a new `pools.summons` (schema addition → schema_version 2
  + migration in `src/core/export.ts` MIGRATIONS[1]).
- **crafting_pool / crafting_pool_extend / convert_item / craft_on_the_fly / grant_token**:
  crafting budget card on Inventory tab (alchemist loop).

## Procedure per upgrade
1. Grep data for the boon type to ground the real field shapes:
   `grep -rn '"type": "<boon>"' data/ | head`
2. Wire engine (compute/boon-resolver/rest) → unit test with a real data example →
   UI → Playwright smoke (extend the script pattern in git history, see Phase-2 commit).
3. `npm test && npm run validate && npx tsc --noEmit` → commit.

## Done criteria
- Batches 1–3 shipped (4 = user call), each with tests.
- No boon type silently dropped: anything still text-only renders its structured fields readably
  on the feat card (fallback JSON pretty-print is NOT acceptable end state for shipped batches).

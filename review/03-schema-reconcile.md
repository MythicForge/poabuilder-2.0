# R3 — Schema Reconcile (33 validator warnings → 0)

**Goal:** every warning resolved by either (a) extending `data/shared/boon-schema.json`
(enums/field kinds) or (b) fixing the data. Schema is the user's design — extending it is a
rules decision; prefer asking once, in one batch.

**Why first:** R1/R2 authoring writes boons against these enums. Settle vocabulary before authoring.

## Warning buckets (from `node tools/validate-data.mjs 2>&1 | grep '~'`)

### Bucket A — `stat_bonus.target` values not in `enums.targets` (~8)
Values in data: `allies_in_aura`, `ally_in_engagement`, `ally_in_zone`, `tethered_allies`,
`triggering_target`, `meditation_participants`, `self_or_willing_in_range`, `summoner`.
These are all *other-target* bonuses — per TRACKING-SCOPE they affect OTHERS, which the sheet
doesn't track. Engine already ignores non-`self` targets (renders on card only).

**Recommended:** add a generic `"other"` semantics note; extend `enums.targets` with the union
OR relax validator to warn-free when target ≠ self (display-only). Ask user which.

### Bucket B — `stat_bonus.stat` values not in `enums.stats` (~7)
Values: `spell_attack`, `spell_dc`, `chosen_defense`, `Brawn`, `Mind`, `Will`.
- `spell_attack`/`spell_dc`: real tracked quantities — engine could apply to computed spellcasting.
  Recommend ADD to `enums.stats` and wire in `compute.ts` (spellDC += bonus; attack line on cards).
- `Brawn/Mind/Will` (enchanter option 6): attribute bonuses — decide: allow attributes in
  `enums.stats` (engine adds to attribute) or model differently. Ask user.
- `chosen_defense`: needs a `choice_ref` mechanism or rewrite data to `choice_conditional`
  branches per defense. Recommend data rewrite (mesmer.json feats[0]).

### Bucket C — `conditional_effect.trigger` not in `enums.triggers` (~7)
Values: `spell_critical_hit`, `targeted_by_spell_or_magic`, `cast_conjuration_spell`,
`ally_in_close_would_gain_wounds`, `on_summon`, `cursed_souled_enemy_dies`, `arcane_shelter_resisted`.
Triggers are display-only (player fires manually). **Recommend:** extend `enums.triggers` with all 7
(cheap, no engine impact). Confirm with user in the same batch.

### Bucket D — formula strings in `number`-kind fields (5)
- `craft_on_the_fly.count = "any"` (alchemist)
- `enchantment_option.max_placements = "Mind"` (enchanter)
- `heal.max_targets = "Tier"` (commander)
- `summon.max_active = "Tier"` (spectre)
- `resistance.charges = "Will"` (anima)
**Recommend:** change these four fields' kind from `number` → `formula` in boon-schema
(engine's `num()` already evaluates formulas); `"any"` → special-case: allow literal `"any"` or
restructure. One user question.

### Bucket E — unknown resources (2)
- `upgrade_resource.resource = "threads"` (mesmer-weaver): `threads` resource never defined.
  Find its grant (grep mesmer files for `grants_resource`/`resources`) — if absent, author the
  resource def on mesmer.json or the granting feat. Likely data gap.
- `restore_resource.resource = "reservoir"` (oathbound-herald): reservoir is the casting pool.
  Options: register `reservoir` as a universal resource id, or teach validator+engine that
  `reservoir` is a valid alias for the spellcasting pool. Recommend the alias (engine already
  tracks `pools.reservoir`).

## Procedure

1. Reproduce full list: `node tools/validate-data.mjs 2>&1 | grep '~' > /tmp/warnings.txt`
2. ONE AskUserQuestion batch (4 questions): A (targets policy), B (attribute/spell stats),
   C+D combined (extend triggers enum + number→formula kinds), E (reservoir alias vs resource).
3. Apply schema edits to `boon-schema.json` (bump `$meta.version` minor).
4. Apply data rewrites (chosen_defense, threads).
5. If validator logic changes (e.g. non-self targets warn-free): edit `tools/validate-data.mjs`,
   document rule in a comment.
6. Wire any newly-tracked stats in `src/core/compute.ts` + add unit tests
   (e.g. spell_dc bonus fixture assertion).
7. Done when: `npm run validate` → GREEN, **0 warnings**, tests pass. Commit.

## Done criteria
- 0 warnings, 0 errors
- boon-schema version bumped + changelog note in `$meta`
- any engine wiring covered by a test

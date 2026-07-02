# JSON Schema Reference

## File Types

| File | Location | Purpose |
|---|---|---|
| `professionName.json` | `professions/` | Profession stats, pack, resources, starting feats |
| `profession-pathName.json` | `professions/` | Path feats organized by tier |
| `originName.json` | `origins/` | Origin pack, vocation list, tiered origin feat pool |
| `origin-vocationName.json` | `origins/` | Attribute bonus + vocation starting feat |
| `origin-feats.json` | `shared/` | Feats shared across multiple origins |
| `universal-resources.json` | `shared/` | Ambition, Vitality, Wounds — every character has these |
| `tier-progression.json` | `shared/` | Feat milestone thresholds, slot counts, attribute/skill point rates |
| `conditions.json` | `shared/` | Condition registry with 3-letter shorthand IDs |
| `damage-types.json` | `shared/` | Damage type registry — build later, reference by string ID for now |

Templates are prefixed with `_` in each folder.

---

## Attributes (Core Four Only)

`Brawn` `Finesse` `Mind` `Will`

> **Note:** `Body` anywhere in source documents is a typo — should be `Brawn` or `Finesse`. Flag on sight.

### Defense Stats (four, distinct from attributes)

| Defense | ID |
|---|---|
| Armor | `"Armor"` |
| Fortitude | `"Fortitude"` |
| Mental | `"Mental"` |
| Will | `"Will Defense"` |

Use `"Will Defense"` (not `"Will"`) in stat contexts to distinguish from the Will attribute.

### Roll Modifiers

- **Resolve** = Advantage on a roll
- **Strain** = Disadvantage on a roll

These are not conditions. Instant roll modifiers, not tracked state — write directly into the feat `description` (the boon types `resolve_on`/`strain_on` are retired, see **Description-Only (Retired)**).

---

## Universal Resources

Defined in `shared/universal-resources.json`. Every character has these regardless of profession.

| Resource | Formula |
|---|---|
| **Ambition** | `4 + Tier + floor(Will / 3)` |
| **Vitality** | `4 + profession_vitality + feat_vitality_bonus` |
| **Wounds** | `1 + (profession_wound_per_tier × Tier) + floor(Brawn / 3)` |

Ambition recovery uses formula strings — engine resolves against character's current Will:

| Rest | Formula | Minimum |
|---|---|---|
| Respite | `Will` | 3 |
| Long Rest | `Will * 2` | 8 |

Ambition die size scales by `max(Will, Tier)`:

| Range | Die |
|---|---|
| 0–3 | 1d4 |
| 4–7 | 1d6 |
| 8–9 | 1d8 |
| 10–11 | 1d10 |
| 12 | 1d12 |

### Shield Pools (tracked separately on character sheet)

Two shield pool types exist alongside regular Vitality:

| Pool | Stacking Rule |
|---|---|
| **Temp Vitality** | Multiple sources do NOT stack — take the highest value |
| **Reduction Pool** | Stacks with Temp Vitality; multiple sources stack with each other |

---

## Field Values

### `trait`
`"Passive"` `"Offensive"` `"Trigger"` `"Maneuver"` `"Narrative"` `"Utility"` `"Support"`

### `slot_type`
`null` `"tactical"` `"narrative"` `"minor"`
Use `null` for starting/profession feats with no slot restriction.

### `feat_dc`
`null` when feat has no DC. Otherwise a formula string:
```json
"feat_dc": "10 + Will + Tier"
"feat_dc": "10 + SpellTier + Mind"
```
Engine exposes this as the DC for any check triggered by this feat.

### `cost`
```json
null
{ "ap": 2 }
{ "resources": [{ "id": "energy", "amount": 2 }] }
{ "ap": 1, "resources": [{ "id": "adrenaline", "amount": 2 }] }
```

### `uses`
```json
null
{ "count": 1, "recharge": "skirmish" }
{ "count": 1, "recharge": "respite" }
{ "count": 1, "recharge": "long_rest" }
{ "count": 1, "recharge": "daily" }
```

### `prerequisites` (profession/path feats)
```json
[]
["feat_id_a", "feat_id_b"]
{ "feats": ["feat_id"], "path_investment": { "path": "sentinel", "count": 2 } }
```
`path_investment.count` = number of feats the character must have with that path tag.
`feats` = specific feat IDs required on top of the investment count.
Use the flat array form `["feat_id"]` when only specific feats are required and no path investment count is needed.

### `prerequisites` (origin feats)
```json
[]
{ "feats": [], "origin_investment": { "origin": "acolyte", "count": 1 } }
```

### `range`
`null` `"Touch"` `"Close"` `"Nearby"` `"Far"` `"Self"`

### `duration`
`null` `"Instant"` `"1 Round"` `"1 Minute"` `"1 Hour"` `"Until Dispelled"`

---

## Vitality Formula (Profession)

```json
"vitality": {
  "base": "10 + Brawn",
  "per_tier": "2d10",
  "brawn_bonus": { "dice": "1d6", "threshold": 5, "attribute": "Brawn" }
}
```
`brawn_bonus` = roll that dice once per `threshold` points of `attribute`.

---

## Profession Resources

```json
{
  "id": "energy",
  "name": "Energy",
  "max": "Will + Tier",
  "recovery": {
    "respite": 3,
    "long_rest": 9
  },
  "triggers": [
    { "event": "critical_hit_dealt", "amount": 1 },
    { "event": "critical_hit_taken", "amount": 1 }
  ]
}
```

### Formula variables
`Brawn` `Finesse` `Will` `Mind` `Tier`
Math: `+` `-` `*` `/` `ceil()` `floor()` `max()`

### Caster types
- Full-caster: `"(2 * Tier) + Mind"`
- Limited-caster: `"ceil(Tier / 2) + Mind"`

---

## Tier Progression

Defined in `shared/tier-progression.json`.

| Current Tier | Feats to Advance | Cumulative Purchased Feats |
|---|---|---|
| 1 | 3 | 3 |
| 2 | 3 | 6 |
| 3 | 2 | 8 |
| 4 | 2 | 10 |
| 5 | — | 16 (hard cap) |

- **Purchased feat** = any feat that is NOT a starting feat (`tier: 0` in profession feats array)
- **+1 attribute point** per purchased feat (max +16 total, hard cap of 12 per attribute)
- **+1 skill point** per every even purchased feat (2nd, 4th, 6th…)
- **Elemental Core tag** (e.g. `"Flame"`) on a feat = automatically available to characters with that core choice

### Feat Slots Per Tier

| Tier | Tactical | Narrative | Minor | Notes |
|---|---|---|---|---|
| 1 | 1 | 1 | 1 | |
| 2 | 1 | 1 | 1 | |
| 3 | 1 | 1 | 0 | |
| 4 | 0 | 0 | 1 | + 1 choice: Tactical or Narrative |
| 5 | 2 | 2 | 2 | |

---

## Spellcasting (vocation field)

Only populate on vocations that grant limited spellcasting conditionally.
```json
"spellcasting": {
  "condition": "missing_tag:Spellcasting",
  "caster_type": "limited",
  "source": "Primeval",
  "spellcasting_modifier": "Mind",
  "max": "ceil(Tier / 2) + Mind",
  "known_spells": { "start": 2, "tier": 1 },
  "prepared_spells": "Mind",
  "spell_dc": "10 + SpellTier + Mind",
  "recovery": { "respite": { "formula": "Mind", "minimum": 3 } },
  "cantrips": []
}
```

---

## Feat-Level Fields (additional)

### `tables`
Lookup tables embedded on a feat for core-conditional resolution. Engine reads these when a boon has a `damage_type_ref` or similar ref field.
```json
"tables": {
  "core_damage_type": {
    "flame": "Fire", "forest": "Corrosive", "land": "Blunt",
    "ocean": "Ice",  "sky": "Slash",        "tempest": "Electric"
  },
  "regal_damage_type": {
    "flame": "Spirit", "forest": "Poison", "land": "Void",
    "ocean": "Arcane", "sky": "Gravity",   "tempest": "Ether"
  }
}
```

### `damage_type_ref`
Used inside boons instead of a hardcoded `damage_type` string when the type depends on a character choice. Engine resolves by looking up `key` in the feat's `tables`.
```json
"damage_type_ref": { "source": "table", "table": "core_damage_type", "key": "elemental_core" }
```

---

## Boon Types

**58 live types.** Canonical since the `TRACKING-SCOPE.md` scope interview plus a full audit of every `type` string actually used across the 11 built professions — everything here passes the master rule (tracked quantity + sheet-knowable condition). Superseded/retired types are listed in **Description-Only (Retired)** below; do not use them in new feats — fold that effect into the feat `description` string instead.

> **amount fields** accept either a flat number `2` or a formula string `"3 + Will"`. Engine checks type at runtime.
> **`note`** — any boon object may optionally carry a free-text `note` field (design/verification flag for humans). Engine ignores it. Seen throughout real data; not part of any type's functional shape.

### Stat & Defense
```json
{ "type": "stat_bonus", "stat": "", "amount": 0, "target": "self", "condition": null, "duration": null, "uses": null }
```
`stat` values: `"Armor"` `"Fortitude"` `"Mental"` `"Will Defense"` `"All Defenses"` `"Vitality Max"` `"Ambition Max"` `"AP"` `"attack_roll"` `"size_category"`
`"Ambition Max"` raises max Ambition (e.g. Berserker rage feats). `"size_category"` takes a string value like `"Large"` (Giant Strength). `amount` may be a signed formula (`"Tier * -1"`). `condition` optional — e.g. `"unarmored"` (absorbs old `armor_bonus`, same shape). `duration`/`uses` optional for temporary or charge-limited bonuses (e.g. granted to an ally, once per turn).

### Alternate Defense
```json
{ "type": "alternate_defense",
  "name": "Agile Defense",
  "formula": "10 + light_armor_bonus + max(Brawn, Mind)",
  "replaces": "Armor",
  "condition": "light_or_no_armor AND no_shield" }
```
Replaces a defense's entire base formula (rather than adding to it) when `condition` holds — e.g. Agile Defense, the canonical equipment-gated example from `TRACKING-SCOPE.md`. Distinct from `stat_bonus`, which only adds an amount on top of the existing formula.

### Resistance
```json
{ "type": "resistance",
  "damage_type": "",
  "condition": "",
  "uses": { "count": 1, "recharge": "turn" } }
```
Use-counter-gated standing damage resistance/immunity.

### Stat Substitution
```json
{ "type": "stat_substitution",
  "context": "",
  "replace": "",
  "with": "",
  "with_kind": "attribute",
  "contexts": [] }
```
Merges old `replace_stat` + `attribute_swap` + `resource_as_stat` + `attribute_borrow` — all let one value stand in for another wherever a formula references it. `with_kind`: `"attribute"` (swap one attribute/stat for another, e.g. Finesse instead of Brawn for a context), `"resource"` (spend a resource pool in place of an attribute, e.g. Adrenaline instead of Ambition), or `"summon_stat"` (use a summoned creature's stat in place of your own, e.g. within engagement). `contexts` lists where the substitution applies (e.g. `["skill_check", "attack_roll"]`).

### Equipment Rule Override
```json
{ "type": "equipment_rule_override",
  "rule": "remove_trait",
  "trait": null,
  "categories": null,
  "restriction": null,
  "amount": null,
  "condition": "" }
```
Merges old `remove_trait` + `allow_dual_wield` + `range_increase` + `carry_weight_multiplier` + `reduce_trait` — standing passive tweaks to equipment rules. `rule` selects which sub-behavior applies, using only the matching fields:
- `"remove_trait"` — strips `trait` from an item when `condition` true (e.g. removes "loud").
- `"allow_dual_wield"` — grants dual-wield, `restriction: "no_light_trait_required"` bypasses the usual Light weapon requirement.
- `"range_increase"` — upgrades weapon range by `categories` range steps (Close → Nearby → Far).
- `"reduce_trait"` — reduces a numeric trait (e.g. `trait: "reload"`) by `amount`.
- `"carry_weight_multiplier"` — multiplies carry capacity by `amount`.

### Healing & Shield Pools
```json
{ "type": "heal",
  "formula": "",
  "target": "",
  "temporary": false,
  "max_targets": null,
  "trigger_condition": null,
  "uses": null }

{ "type": "reduction_pool",
  "formula": "",
  "charges": null,
  "target": null,
  "apply_to": null,
  "source": null,
  "on_charge_used": null }

{ "type": "cure_condition",
  "conditions": [],
  "choose": null,
  "choose_at_brew": null,
  "target": "" }

{ "type": "prevent_wounds",
  "amount": "" }
```
- `temporary: true` → grants Temp Vitality (highest source wins, does not stack)
- `reduction_pool` → stacks with Temp Vitality and other reduction pools
- `charges` → pool uses a charge counter instead of a flat value (e.g. Flame Shield's 3 charges); `formula` is the value per charge
- `trigger_condition` → on heal boon, delays execution until a condition occurs (e.g. `"marked_target_takes_damage"`)
- `on_charge_used` → nested effect that fires each time a charge is expended; use any boon object as the value
- `cure_condition` — heal's condition-side counterpart; removes a condition instead of restoring Vitality. `choose` = player picks at time of use; `choose_at_brew` = locked in when the item/effect was prepared (e.g. Alchemist concoctions).
- `prevent_wounds` — spends a tracked resource to reduce incoming Wounds (formula may reference the resource, e.g. `"spend_resonance_equal_up_to_gained"`).

### Targets
`"self"` `"ally"` `"enemy"` `"any"` `"engaged_enemies"` `"allies_in_range"` `"creatures_in_range"`

`"self"` = effect originates from and applies to the caster.

### Resources
```json
{ "type": "restore_resource", "resource": "", "amount": 0, "target": "self", "minimum": null, "trigger": null }
{ "type": "grants_resource",  "resource_id": "" }

{ "type": "upgrade_resource",
  "resource": "",
  "max_bonus": null,
  "max_override": null }

{ "type": "resource_conversion",
  "uses": { "count": 1, "recharge": "turn" },
  "cost": null,
  "modes": [
    { "spend": { "id": "", "amount": 0 }, "gain": { "id": "", "amount": 0 } }
  ] }
```
`upgrade_resource` — permanently raises a resource's max, either by `max_bonus` (additive) or `max_override` (replace the formula entirely, e.g. Shaman Vessels). `resource_conversion` — trade one resource pool for another at a fixed rate; `modes` lists the available spend/gain pairs (often bidirectional).

### Proficiency & Spell Grants
```json
{ "type": "proficiency", "category": "", "value": "" }

{ "type": "grants_spells",
  "spell_ids": [],
  "by_core": null,
  "cost_resource": null,
  "cost_method": null }

{ "type": "grants_free_success",
  "context": "",
  "count": 1,
  "recharge": null }
```
`grants_spells` — use either `spell_ids` (flat list) or `by_core` (`{ "core_id": ["spell_id_1", "spell_id_2"] }`, core-gated), not both. (Single canonical shape — this type previously had two conflicting definitions in this doc.)

`grants_free_success` — merges old `emulate_kit` + `free_success` (same mechanic, different names): a tracked count of automatic successes on a named check `context`, consumed on use. `recharge: null` = doesn't refresh (one-time); otherwise `"daily_preparation"` etc.

### Feat Grants & Upgrades
```json
{ "type": "feat_grant",   "feat_id": "", "condition": "" }
{ "type": "upgrade_feat", "target_feat": "", "patch": {} }
```

### Choices
```json
{ "type": "choice",
  "key": "",
  "prompt": "",
  "options": [
    { "value": "", "label": "", "grants": {} }
  ] }

{ "type": "multi_choice",
  "key": "",
  "count": 0,
  "expandable_by": [],
  "options": [
    { "value": "", "label": "", "description": "" }
  ] }
```
Some existing feats write `choice` with `multi_choice`'s fields (`count`/`from` instead of `key`/`prompt`/`options`) — that's author drift, not an intentional alternate shape. Normalize to the correct type during the redo pass rather than treating it as valid.

### Weapon & Art Grants
```json
{ "type": "grants_weapon",
  "attack_modifier": "Will + Tier",
  "damage_modifier": "Will",
  "by_core": {
    "core_id": {
      "name": "",
      "weapons": [],
      "choice": null,
      "passive": null,
      "crit_effect": []
    }
  } }

{ "type": "grants_arts",
  "attack_modifier": "Will",
  "extends_feat": null,
  "by_core": {
    "core_id": [
      {
        "id": "", "name": "", "cost": {}, "range": null,
        "condition": null, "description": "", "boons": []
      }
    ]
  } }
```
`extends_feat` — set to a feat ID (e.g. `"elemental_arts"`) when adding arts to an existing pool rather than creating a new one. What's granted (the weapon, the arts pool) is tracked; the weapon's attack/damage output is description-only per the usual rule.

```json
{ "type": "bind_weapon",
  "select_during": "daily_preparation",
  "max_bound": 1,
  "grants": { "attack_modifier": "", "damage_modifier": "", "traits": [], "proficient": true } }

{ "type": "action_option",
  "name": "",
  "cost": {},
  "condition": "",
  "description": "",
  "effect": null }
```
`bind_weapon` — player selects (at daily prep) which weapon is bound, granting the listed stats. Overlaps conceptually with `grants_weapon` + `signature_spell`'s select-during pattern; kept distinct for now since its shape differs (flat `grants` object, not `by_core`). `action_option` — a single standalone activatable ability (maneuver): the **cost is tracked** (sheet spends AP/resources on activation) even when the payoff is attack output, which stays prose in `description`. Set `effect` (a live boon) only when the payoff itself is a tracked mechanic. `condition` gates availability (e.g. `"wielding_school_weapon"`).

```json
{ "type": "grants_cords", "count": 0, "options": [ { "id": "", "name": "", "trait": "", "range": null, "description": "", "stitch": {}, "boons": [] } ] }
{ "type": "grants_spell_shapes", "known": 0, "prepared_per_day": 0, "activation": "", "options": [ { "id": "", "name": "", "cost": {}, "effect": "" } ] }
```
Profession-specific ability-pool grants (Mesmer Cords, Eidolon Spell Shapes) — same conceptual job as `grants_arts` (build selection + list of selectable abilities), kept as separate names since each carries profession-specific fields (`stitch` upgrade cost on Cords, `prepared_per_day` on Spell Shapes). Consider consolidating format in a later pass; for now both are live/tracked (the player's known + prepared selections).

#### Weapon definition fields (inside `grants_weapon`)
```json
{
  "type": "Javelin",
  "damage": "1d8",
  "damage_type": "Puncture",
  "flat_damage": { "amount": 2, "damage_type": "Puncture" },
  "range": "Close",
  "traits": ["returning", "Rend"]
}
```
`flat_damage` — fixed non-dice damage added on top of the rolled damage (e.g. Ice Knives' 2 Puncture).

#### Save inside crit effects
```json
"crit_effect": [
  {
    "condition_id": "PRN",
    "save": { "defense": "Fortitude", "dc_ref": "feat_dc" }
  }
]
```
Descriptive data only (target-side condition + save DC) — write the narrative effect in the feat's `description`; do not nest a boon-typed `apply_condition` here (retired, see below). `dc_ref: "feat_dc"` resolves to the feat's own `feat_dc` formula.

### Objects
```json
{ "type": "create_object",
  "object": {
    "name": "",
    "dimensions": null,
    "armor": null,
    "vitality": null,
    "capacity": null,
    "movement": null,
    "concentration": null
  } }
```
A summoned object stat block — tracked like any other summon.

```json
{ "type": "item_storage",
  "capacity": 1,
  "item_type": "",
  "wearer_only": false,
  "use_action": "free" }
```
A tracked inventory slot for a specific item type — parallel to `grants_augment_slot` but for general storage rather than an augment mount.

### Wrappers & Conditionals
```json
{ "type": "conditional_effect",
  "trigger": "",
  "condition": null,
  "uses": null,
  "effect": {} }

{ "type": "choice_conditional",
  "choice_key": "signature_school",
  "by_choice": {
    "option_value": [ { "type": "..." } ]
  } }

{ "type": "armor_type_conditional",
  "by_armor_type": {
    "light":  [ { "type": "..." } ],
    "medium": [ { "type": "..." } ],
    "heavy":  [ { "type": "..." } ]
  } }

{ "type": "multi_boon", "boons": [ { "type": "..." } ] }
```
- `conditional_effect` — `trigger` values: `"critical_success"` `"critical_hit_dealt"` `"critical_hit_taken"` `"on_hit"` `"on_damage_taken"` `"enemy_disengages_in_engagement"` `"enemy_enters_engagement"` `"targeted_by_melee_in_engagement"` `"attacker_critical_miss_melee"` `"grappled_target_turn_start"` `"ally_in_engagement_targeted"` `"melee_attack_misses_self"` `"melee_attack_critical_miss_self"` `"self_or_ally_targeted"` `"area_or_zone_damage"` `"after_attack"` `"after_weapon_strike"` `"on_spell_cast"` `"enemy_reduced_to_zero"` `"reduced_to_zero_vitality"` `"state_ends_or_downed"` `"target_critical_save_failure"`. **`effect` must itself be a live (non-retired) boon type** — e.g. `restore_resource` on crit is fine; wrapping a retired type like `damage_bonus` is not a boon, just write it in `description`.
- `choice_conditional` — engine reads the character's stored choice at `choice_key`, applies the matching boon array (e.g. Fighting Technique varies by Signature School).
- `armor_type_conditional` — engine reads currently equipped armor category, applies the matching array. Same "nested content must be live" caveat as `conditional_effect`.
- `multi_boon` — bundles an ordered array of boons as one effect; use inside a slot (like `conditional_effect.effect`) that only accepts a single boon object.

Additional formula variables for spell/summon contexts: `mana_spent` (mana spent on the triggering cast), `highest_known_spell_tier`, `summon_tier` (resolved at runtime).

### Spellcasting Grants
```json
{ "type": "grants_spellcasting",
  "caster_type": "full",
  "source": "mana",
  "modifier": "Mind",
  "known_spells": { "start": 4, "tier": 1 },
  "prepared_spells": "Mind",
  "spell_dc": "10 + SpellTier + Mind",
  "cantrips": { "max": 5, "from": ["cantrip_id"] } }
```
`caster_type`: `"full"` or `"limited"`. `source` links to a resource ID in the profession's `resources` array. The `Spellcasting` tag must also appear in the feat's `tags` array so vocation `condition: "missing_tag:Spellcasting"` checks work.

```json
{ "type": "upgrade_spellcasting",
  "caster_type": "full",
  "reservoir_formula": "" }
```
Upgrades an existing limited-caster grant to full caster (or otherwise patches the caster's formula) — e.g. Oathbound Herald's half→full upgrade.

### Cantrip Grants & Upgrades
```json
{ "type": "grants_cantrip",
  "cantrip_id": "",
  "from": null,
  "count": 1,
  "condition": "",
  "counts_against_known": false,
  "free_activation": false,
  "player_choice": false,
  "limit": null,
  "range_override": null,
  "upgrade": { "duration": "until_dispelled" } }

{ "type": "cantrip_upgrade",
  "bonus": "damage_or_healing_die",
  "count": 1,
  "minimum_die_size": null }
```
`from` — set to `"universal_tier_1_spells"` (or similar pool ID) when player picks from a category. `upgrade` — applies a property change to a cantrip already held (e.g., extend duration on `summon_familiar`).

### Spell Learning
```json
{ "type": "grants_known_spells",
  "count": 2,
  "tier": 1,
  "from_sphere": { "source": "choice", "key": "mage_sphere_primary" },
  "counts_against_known": false }

{ "type": "grants_sphere",
  "count": 1,
  "player_choice": true }
```

### Spell Cost & Signature
```json
{ "type": "spell_cost_modifier",
  "amount": 4,
  "context": ["direct_spell", "zone_spell"] }

{ "type": "signature_spell",
  "select_during": "daily_preparation",
  "count": 1,
  "tier_max_formula": "floor(Tier / 2)",
  "from": "known_spells",
  "cost_reduction": 3,
  "changeable_during": "downtime" }
```
`spell_cost_modifier` — signed `amount`: positive = cost increase, negative = cost reduction. (Absorbs old `spell_cost_reduction`, which was redundant — same effect, opposite-signed convention.)

```json
{ "type": "free_recast",
  "spell_tier_max": 1,
  "frequency": "once_per_turn",
  "duration": "end_of_skirmish",
  "restriction": "different_target_each_time",
  "no_reservoir_cost": true }
```
Tracked repeatable capability to recast a spell at no resource cost, gated by `frequency` (a use-counter in disguise) for `duration`.

### Augmentation
```json
{ "type": "apply_augmentation",
  "max_per_day": "Tier",
  "changeable_during": ["respite", "daily_preparation"],
  "options": [
    { "value": "", "label": "", "target_item": "weapon", "boons": [] }
  ] }

{ "type": "grants_augment_slot",
  "item_type": "clothing",
  "count": 1,
  "wearer_only": true }
```
`target_item`: `"weapon"` `"armor"` `"shield"` `"accessory"` `"clothing"` `"any"` — or an array of valid types. Augments are **slot-limited**: Armor 1–5 slots, Weapon cap 3, single-slot items (helmet, ring, belt, gloves, amulet…) cap 1 — bounded by `grants_augment_slot` counts. `apply_augmentation` may also carry `learn_count` (how many augment recipes/options are known) and `uses_no_slot` (bypasses the normal slot cost) on specific options.

### Enchantment
```json
{ "type": "enchantment_option",
  "target_item": "weapon",
  "max_placements": null,
  "options": [
    { "value": "", "label": "", "effect": {} }
  ] }
```
Contrast with `apply_augmentation`: enchantments place **any number of times** (some stack, restricted by ruling/mechanics — `max_placements` only if a specific cap applies), not bounded by a fixed slot count. `effect` is any live boon-shaped object, including the spell-payload form (absorbs old `bind_spells` and `inscribe_spell` — same underlying shape, a spell bound to an object and activated later):
```json
{ "type": "spell",
  "spell_id": "",
  "uses_caster_stats": true,
  "duration": "until_daily_preparation",
  "max_inscribed": "Mind",
  "release_trigger": null,
  "aoe_becomes": null,
  "expires": null }
```
`uses_caster_stats: true` — anyone can activate the bound spell using the caster's stats and Spell DC. `max_inscribed` — cap on simultaneous bound spells (formula, e.g. `"Mind"`). `release_trigger`/`aoe_becomes`/`expires` — absorbed from old `store_spell` (Warden's store-on-weapon, release-on-hit pattern): what fires the stored spell, how its area collapses on release, and when the binding expires if unused.

### Companion System
```json
{ "type": "grants_companion",
  "companion_id": "",
  "permanent": true,
  "uses_lore": { "source": "choice", "key": "" },
  "command_action": { "max_ap_cost": 1 },
  "on_destroy": "repairs_at_daily_preparation" }

{ "type": "companion_autonomy",
  "companion_id": "",
  "duration": "1_round",
  "uses": { "count": 1, "recharge": "skirmish" } }
```
`companion_id` = the specific companion this applies to (e.g. `"forgecast"`). Note: `companion_directive` is retired (see below) — Command-action grants are action economy, not tracked mechanics.

```json
{ "type": "cast_through_summon", "summon_id": "" }
```
Standing permission to cast spells through a named summon — a small tracked capability flag tied to an existing summon.

### Summons
```json
{ "type": "summon",
  "summon_id": "",
  "from_pool": null,
  "duration": null,
  "stat_block": {},
  "options": [
    { "value": "", "label": "", "boons": [] }
  ] }

{ "type": "summon_options_extend",
  "summon_id": "",
  "options": [] }

{ "type": "summon_vitality_bonus",
  "formula": "4 * Tier",
  "applies_to_sphere": "conjuration" }

{ "type": "summon_sphere_effect",
  "applies_to": "all_summoned_creatures",
  "reset_on": "resummon",
  "by_sphere": {
    "sphere_id": [ { "type": "..." } ]
  } }
```
`summon` — the core creature-summon grant: a full stat block plus a menu of selectable `options` (each granting its own boons to the summoned creature). Sibling to `create_object` (objects vs. creatures). `summon_options_extend` — adds more entries to an existing summon's `options` menu (parallel to `grants_augment_slot` extending a slot count, but for option-pool breadth). `by_sphere` map on `summon_sphere_effect` — parallel to `by_core` for Elementalist; engine reads which spheres the caster knows and applies each matching array to all active summons.

`summon_passive` — appears inside `choice` option `grants` objects in `tailored_conjuration`. Structure:
```json
"grants": {
  "summon_passive": {
    "id": "",
    "name": "",
    "trigger": "",
    "uses": null,
    "boons": []
  }
}
```

### Crafting Pool
```json
{ "type": "crafting_pool",
  "id": "",
  "budget": "",
  "craft_during": [],
  "expires": null,
  "recipes": [
    { "id": "", "name": "", "boons": [] }
  ] }

{ "type": "crafting_pool_extend",
  "target_pool": "",
  "recipes": [] }

{ "type": "convert_item",
  "from_pool": "" }

{ "type": "craft_on_the_fly",
  "from_pool": "",
  "count": 1 }
```
Agent-Alchemist-style subsystem: `crafting_pool` is a tracked resource (a spend budget plus a list of prepared `recipes`, each recipe's `boons` using only live types). `crafting_pool_extend` adds more recipe options to an existing pool. `convert_item` swaps which recipes are currently prepared (changes tracked list membership, parallel to `daily_mode_choice` reconfiguration). `craft_on_the_fly` is a use-counter allowing pool access outside the normal prep window.

### Token Grants
```json
{ "type": "grant_token",
  "token": "",
  "max_held_per_creature": 1,
  "per_day": null,
  "expires": null,
  "effect": {} }
```
A trackable held-token resource (count, cap, expiry) — e.g. Mesmer Spark tokens. `effect` fires when the token is spent; if `effect` is itself a retired/momentary type (e.g. old `add_to_roll`), that part is description-only even though holding the token is tracked.

### Daily Mode Choice
```json
{ "type": "daily_mode_choice",
  "key": "",
  "optional": true,
  "changeable_during": ["daily_preparation"],
  "deactivatable_during": ["respite"],
  "reactivatable_during": ["daily_preparation"],
  "options": [
    { "value": "", "label": "", "description": "", "boons": [] }
  ] }
```
Persistent mode the player selects at Daily Preparation. Active until deactivated or changed. `optional: true` = player may choose none.

### Activate State
```json
{ "type": "activate_state",
  "state": "rage",
  "inherits": null,
  "ends_when": [
    "turn_end_without_any_of: dealt_damage, took_damage, offensive_action_success, brawn_skill_check_success",
    "1_minute_outside_combat"
  ],
  "active_while": null,
  "range": null,
  "target": "self",
  "boons": [ /* boons applied while the state is active */ ] }
```
An activated, combat-toggled state (e.g. Berserker Rage). Costs are on the parent feat's `cost`. Differs from `daily_mode_choice` (persistent, chosen at daily prep) — a state is entered in combat, costs a resource, and can end mid-combat per `ends_when`. `inherits` names another state whose boons stack on top of this one (path rages inherit `"rage"`). The state is a tracked on/off flag; downstream feats gate on it with `condition: "state:<name>"` or `"state:rage_any"` (any rage variant active). Nested `boons` may only contain live, non-attack/damage types (its stat/defense/resource modifiers) — the state's attack/damage bonuses are description-only, shown while active.

`active_while`/`range`/`target` absorb old `apply_state` and `aura`: use `active_while` (a passive on/off condition, e.g. `"conscious"`) instead of `ends_when` for states that are automatically on whenever the condition holds rather than manually activated (e.g. Hidden while in dim light). Use `range`/`target: "allies_in_range"` for aura-style states whose nested `boons` buff others rather than the caster.

---

## Description-Only (Retired)

These types are **no longer valid boon types.** Each one always resolves to attack/damage output, momentary/target-side effects, action economy, narrative fluff, or a mechanic explicitly ruled non-trackable — write the effect into the feat's `description` string instead. Kept here so old feats can be identified and converted during the boon-refactor pass.

`resolve_on` `strain_on` — Resolve/Strain are instant roll modifiers, not tracked state.
`apply_condition` — conditions inflicted on a target live on the target/GM side (exception: use `activate_state` if the effect is genuinely a tracked self-toggle).
`reduce_action_cost` `free_action_grant` `restrict_action` — action economy / AP-cost changes.
`attack_option` `bonus_attack` `multi_attack` `damage_modifier` `damage_bonus` `dice_size_increase` `crit_range_expansion` `crit_bonus_by_weapon_type` `targets_defense_override` — attack-roll or damage-roll output.
`opposed_check` `negate_attack` `disarm_target` `redirect_attack` — momentary combat resolution.
`grants_cover` — situational, doesn't change a tracked quantity.
`skill_check_to_learn` — one-off learning procedure; if it succeeds, model the result as `grants_known_spells` instead.
`ambition_die_bonus` `add_to_roll` — momentary roll addition, not a persistent pool.
`companion_directive` — action economy on companions, not player-side mechanics.
`penetrate_resistance` — standing rule note; state it in `description` (e.g. "your Fire damage bypasses Resistant").
`animate_bound_weapon` — narrative (autonomous floating weapon), not mechanical.
`difficulty_modifier` — passive DC shift; same bucket as Resolve/Strain, state it in prose.
`divination_anchor` — pure narrative fact, no mechanical fields.
`forced_movement` `movement_bonus` `teleport` — momentary movement effects.
`sense_sharing` `shapechange` `shared_vitality` — narrative abilities (no formula/tracked quantity).
`zone_effect` — momentary battlefield/environmental effect, GM-side.

Retired-and-merged (functionality lives on in a surviving type, see above): `armor_bonus` → `stat_bonus`; `replace_stat`, `attribute_swap`, `resource_as_stat`, `attribute_borrow` → `stat_substitution`; `remove_trait`, `allow_dual_wield`, `range_increase`, `carry_weight_multiplier`, `reduce_trait` → `equipment_rule_override`; `spell_cost_reduction` → `spell_cost_modifier`; `bind_spells`, `inscribe_spell`, `store_spell` → `enchantment_option` (spell effect payload); `apply_state`, `aura` → `activate_state`; `emulate_kit`, `free_success` → `grants_free_success`.

---

## Condition IDs (3-letter shorthand)

`BLD` Bleeding · `BLN` Blinded · `BRN` Burning · `CHR` Charmed · `CMP` Compelled · `CRP` Crippled
`DAZ` Dazed · `DEF` Deafened · `DOM` Dominated · `ENR` Enraged · `FRT` Frightened · `IMM` Immobilized
`INT` Inert · `MMD` Maimed · `PRN` Prone · `PSN` Poisoned · `RST` Restrained · `SAP` Sapped
`SIL` Silenced · `STN` Stunned · `UNC` Unconscious · `WEK` Weakened

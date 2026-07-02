# Content Authoring Guide — Path of Ambition

Reference for adding professions, feats, and choice features so the character sheet auto-populates correctly.

---

## Files at a Glance

| File | Purpose |
|------|---------|
| `content/professions.json` | Profession definitions, custom resources |
| `content/profession_feats.json` | Profession feat cards |
| `content/origin_feats.json` | Origin feat cards |
| `content/choice_features.json` | Any feat/feature that requires a player pick |

---

## 1. Adding a Profession Feat

**File:** `content/profession_feats.json`

```json
{
  "id": "profession-feats-{profession}-{tier}-{slug}",
  "name": "Feat Name",
  "slug": "feat-name",
  "owner_type": "profession",
  "owner_id": "elementalist",
  "owner_name": "Elementalist",
  "tag": "Elementalist",
  "tier": 2,
  "trait_label": "Trait",
  "trait_raw": "Passive",
  "traits": ["Passive"],
  "activation": {
    "raw": "-",
    "resources": {},
    "properties": {},
    "notes": []
  },
  "description_markdown": "Your feat text here.",
  "raw_markdown": "**Required** *Some Prereq* | **Path Investment** -\n**Trait** Passive | **Cost** -\n\nYour feat text here.",
  "collection_type": "profession_feat",
  "required": "Some Prereq",
  "path_investment": null
}
```

### If the feat grants fixed expertise in a skill:

Add `fixed_expertise` — no entry in `choice_features.json` needed:

```json
"fixed_expertise": ["Vigor"]
```

Supported values: `"Vigor"`, `"Intuition"`, `"Talent"`, `"Awareness"`, `"Lore"`, `"Social"`

---

## 2. Adding a Choice Feature

Any time a feat/feature requires a player to pick something, add an entry to `content/choice_features.json` inside the `"features"` array.

### Minimal required fields

```json
{
  "entity_type": "profession",
  "entity_name": "Elementalist",
  "source_kind": "tier_feat",
  "feature_name": "Feat Name",
  "tier": 2,
  "path": "Elementalist",
  "choice_type": "permanent_choice",
  "selection_rule": "single",
  "min_choices": 1,
  "max_choices": 1,
  "selection_timing": "on_gain",
  "branches_from_feature": null,
  "notes": null,
  "options": [ ... ]
}
```

### Key field values

**`choice_type`**
| Value | When to use |
|-------|-------------|
| `"permanent_choice"` | Player picks when feat is gained; persists forever |
| `"prepared_choice"` | Player picks at start of day/prep |
| `"activation_menu"` | Player picks at moment of activating the ability |
| `"derived_branch"` | Automatically matches an earlier choice (e.g. uses your bloodline) |

**`selection_rule`**
| Value | When to use |
|-------|-------------|
| `"single"` | Pick exactly 1 |
| `"fixed_count"` | Pick exactly `max_choices` (e.g. 2) |
| `"grant_access"` | No pick needed; options are unlocked automatically |

**`selection_timing`**
| Value | When |
|-------|------|
| `"on_gain"` | Modal opens immediately when player selects the feat |
| `"on_activation"` | Shown in combat/activation flow |
| `"daily_preparation"` | Shown at rest/prep step |
| `"derived"` | Resolved automatically from another choice |

**`feature_name`** must exactly match the feat's `"name"` field in `profession_feats.json`.

**`entity_name`** must exactly match the feat's `"owner_name"` field.

---

## 3. Simple Options (no sub-choice)

```json
"options": [
  { "name": "Option A", "effect_text": "What it does." },
  { "name": "Option B", "effect_text": "What it does." }
]
```

Player picks one. Stored as `"Elementalist__Feat Name": ["Option A"]`.
Displayed on the feat card in the character sheet automatically.

---

## 4. Options with Sub-Choices (`follow_up`)

Use `follow_up` on an option when selecting it should open a second modal for another pick.

### Sub-choice from a custom inline list

```json
{
  "name": "Fragmented",
  "effect_text": "Gain access to a second Elemental Core.",
  "follow_up": {
    "count": 1,
    "pool": "inline",
    "options": [
      { "name": "Flame",   "effect_text": "Fire, Spirit (Combat)" },
      { "name": "Forest",  "effect_text": "Wood, Vitality (Support and Defense)" },
      { "name": "Land",    "effect_text": "Stone, Metal (Defense and Utility)" },
      { "name": "Ocean",   "effect_text": "Water, Ice (Control and Healing)" },
      { "name": "Sky",     "effect_text": "Air, Gravity (Stealth)" },
      { "name": "Tempest", "effect_text": "Electric, Light (Combat)" }
    ]
  }
}
```

### Sub-choice from V.I.T.A.L.S. skills (expertise)

```json
{
  "name": "Double Rank (1 skill)",
  "effect_text": "Choose 1 VITALS skill and gain 2 Expertise ranks in it.",
  "follow_up": {
    "count": 1,
    "pool": "vitals_skills",
    "grants_expertise": true,
    "bump_count": 2
  }
}
```

`grants_expertise: true` triggers the expertise recalculation on the character sheet.
`bump_count` = how many expertise ranks per skill (default 1 if omitted).

### `follow_up` field reference

| Field | Required | Description |
|-------|----------|-------------|
| `count` | Yes | How many options to pick in the sub-modal |
| `pool` | Yes | `"inline"` or `"vitals_skills"` |
| `options` | If `pool = "inline"` | Array of `{name, effect_text}` |
| `grants_expertise` | No | `true` if picks grant VITALS expertise ranks |
| `bump_count` | No | Expertise ranks per pick (default 1) |
| `label` | No | Custom label shown in sub-modal header |

### How sub-choices are stored and displayed

Primary pick stored as:
```
"Elementalist__Core Cultivation": ["Fragmented"]
```

Sub-pick stored as:
```
"Elementalist__Core Cultivation Core (Fragmented)": ["Flame"]
```

Feat card displays: **Fragmented → Flame**

---

## 5. Editing an Existing Choice

When a player clicks the edit (pencil) icon on a feat with choices:

1. Primary modal re-opens with current selection pre-filled
2. Player changes primary pick → clicks confirm
3. **All synthetic sub-choice keys for that feat are cleared automatically**
4. If new primary pick has a `follow_up`, sub-modal opens immediately

> **Important:** The player must re-pick sub-choices after editing the primary. There is no way to preserve sub-choices when the parent option changes — this is intentional.

The `clearFeatChoices()` function in `characterCalc.ts` handles clearing. It removes all keys matching `"EntityName__FeatName*"` from `choiceSelections`.

---

## 6. Tertiary Choices (sub-choice of a sub-choice)

**Currently not supported.** The system supports exactly one level of `follow_up`. If you need a third tier:

- Option A: Flatten it — combine the two sub-choice steps into one modal with more options
- Option B: Add a second `choice_features.json` entry with `branches_from_feature` pointing at the sub-choice feature

`branches_from_feature` is stored in the data but the UI derives it automatically for `derived_branch` type features. For permanent choices, multi-level branching would require code changes.

---

## 7. Adding a Profession with a Custom Resource

In `content/professions.json`, add `custom_resource` to the profession object:

```json
"custom_resource": {
  "key": "energy",
  "label": "Energy",
  "max_formula": "attr + tier",
  "max_attr": "will",
  "default_value": "max",
  "restore": {
    "respite": 3,
    "long_rest": 9,
    "full_rest": "max"
  }
}
```

### `max_formula` options

| Value | Result |
|-------|--------|
| `"attr + tier"` | `attrs[max_attr] + tier` — requires `max_attr` |
| `"tier"` | Equals character tier |
| `"static:6"` | Fixed value (replace `6` with any number) |

### `max_attr` options
`"brawn"`, `"finesse"`, `"mind"`, `"will"`

### `restore` values
Each rest type takes a number (flat restore) or `"max"` (restore to full).
Omit a key entirely if that rest type doesn't restore the resource.

### How it appears
Resource counter auto-renders in the header strip next to Reservoir (if caster) or standalone. Shows `current/max` with `+`/`−` buttons.

---

## 8. Quick Checklist

**Adding a new feat:**
- [ ] Entry in `profession_feats.json` with correct `owner_name`, `tier`, `id` slug
- [ ] If grants fixed expertise: add `"fixed_expertise": ["SkillName"]`
- [ ] If player must pick something: add entry in `choice_features.json`
- [ ] `feature_name` in choice_features must match `name` in feats exactly
- [ ] `entity_name` in choice_features must match `owner_name` in feats exactly

**Adding a new profession:**
- [ ] Entry in `professions.json` with `id`, `name`, `slug`, all required fields
- [ ] If custom resource: add `custom_resource` block
- [ ] Add starting features to `"features"` array
- [ ] Any features requiring player picks: add to `choice_features.json` with `source_kind: "base_feature"` and `tier: null`

**Adding sub-choices:**
- [ ] Add `follow_up` to the option, not a separate top-level entry
- [ ] Set `pool: "inline"` for custom option lists
- [ ] Set `pool: "vitals_skills"` + `grants_expertise: true` for skill expertise picks
- [ ] Test: gain feat → pick option → confirm sub-modal opens → check feat card shows `Option → SubPick`

# Homebrew JSON Format Reference

Upload homebrew JSON files via **Library → Homebrew → + Upload Homebrew JSON**. The app reads the file, detects what it contains, and merges it into the relevant tabs automatically.

---

## How Domain Detection Works

The app inspects the top-level keys of your JSON file and enables the correct tabs based on what it finds:

| Your top-level key | Tab activated |
|---|---|
| `"spells": [...]` | Spells tab |
| `"creatures": [...]` or `"monster": [...]` | Bestiary tab (Vassals) |
| `"item": [...]` or `"baseitem": [...]` | Items tab |
| `"classes": [...]` or `"class": [...]` | Classes (builder picker) |
| `"races": [...]` or `"race": [...]` | Books tab (ancestry picker) |
| `"feats": [...]` or `"feat": [...]` | Books tab (feat picker) |
| `"backgrounds": [...]` or `"background": [...]` | Books tab (background picker) |

**You can put multiple domains in a single file.** A file with `"classes"` and `"spells"` and `"classMechanics"` all at the root works fine — the app detects all of them.

### Required on every entry

Every object in every array needs at minimum:

```json
{
  "name": "My Thing",
  "source": "HB"
}
```

`source` is a short code you pick (no spaces, all caps recommended). It's used for deduplication and display. Use the same code consistently across your file.

---

## Spells

Root key: `"spells"`

### Minimal spell

```json
{
  "spells": [
    {
      "name": "Shadow Bolt",
      "source": "HB",
      "level": 1,
      "school": "N",
      "time": [{ "number": 1, "unit": "action" }],
      "range": {
        "type": "point",
        "distance": { "type": "feet", "amount": 60 }
      },
      "duration": [{ "type": "instant" }],
      "entries": [
        "You hurl a bolt of shadow energy at one creature within range. Make a ranged spell attack. On a hit, the target takes 2d8 necrotic damage."
      ]
    }
  ]
}
```

### School codes

| Code | School |
|---|---|
| `"A"` | Abjuration |
| `"C"` | Conjuration |
| `"D"` | Divination |
| `"E"` | Enchantment |
| `"I"` | Illusion |
| `"N"` | Necromancy |
| `"T"` | Transmutation |
| `"V"` | Evocation |

### Casting time units

`"action"`, `"bonus"`, `"reaction"`, `"minute"`, `"hour"`

```json
"time": [{ "number": 1, "unit": "bonus" }]
```

### Range types

```json
"range": { "type": "point", "distance": { "type": "feet", "amount": 30 } }
"range": { "type": "point", "distance": { "type": "self" } }
"range": { "type": "point", "distance": { "type": "touch" } }
"range": { "type": "point", "distance": { "type": "unlimited" } }
```

### Duration

```json
"duration": [{ "type": "instant" }]
"duration": [{ "type": "timed", "duration": { "type": "minute", "amount": 1 }, "concentration": true }]
"duration": [{ "type": "timed", "duration": { "type": "hour", "amount": 8 } }]
"duration": [{ "type": "permanent", "ends": ["dispel"] }]
```

### Optional spell fields

```json
"savingThrow": ["dex"],
"damageInflict": ["necrotic"],
"book_source": "My Homebrew Book",
"scalingLevelDice": {
  "label": "necrotic damage",
  "scaling": {
    "1": "2d8",
    "2": "3d8",
    "3": "4d8"
  }
}
```

`scalingLevelDice` is the upcast formula. Keys are slot levels; values are the dice at that level.

> **BG3 rule:** Only spells of level 0–6 are loaded. Levels 7–9 are ignored.

---

## Bestiary (Creatures / Vassals)

Root key: `"creatures"` (preferred) or `"monster"`

These appear in the Vassals tab as summonable minions.

### Minimal creature

```json
{
  "creatures": [
    {
      "name": "Shadow Hound",
      "source": "HB",
      "size": ["M"],
      "type": "beast",
      "ac": [13],
      "hp": { "average": 22, "formula": "4d8 + 4" },
      "speed": { "walk": 40 },
      "str": 14, "dex": 16, "con": 12,
      "int": 3,  "wis": 12, "cha": 6,
      "passive": 11,
      "cr": "1/2"
    }
  ]
}
```

### Size codes

`"T"` Tiny · `"S"` Small · `"M"` Medium · `"L"` Large · `"H"` Huge · `"G"` Gargantuan

### AC options

```json
"ac": [15]
"ac": [{ "ac": 16, "from": ["chain mail"] }]
"ac": [{ "ac": 13, "from": ["natural armor"] }]
```

### Optional creature fields

```json
"save": { "str": "+4", "con": "+3" },
"skill": { "perception": "+3", "stealth": "+5" },
"immune": ["poison"],
"conditionImmune": ["charmed", "frightened"],
"languages": ["Common"],
"trait": [
  {
    "name": "Shadow Step",
    "entries": ["While in dim light or darkness, the hound can teleport up to 40 ft. to an unoccupied space it can see."]
  }
],
"action": [
  {
    "name": "Bite",
    "entries": ["{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}2d6 + 2 piercing damage."]
  }
],
"book_source": "My Homebrew Book"
```

---

## Items

Two root keys: `"item"` for magic items, `"baseitem"` for mundane gear. Both can appear in the same file.

### Base equipment (weapons, armor, tools)

```json
{
  "baseitem": [
    {
      "name": "Shadow Blade",
      "source": "HB",
      "type": "M",
      "rarity": "none",
      "weight": 2,
      "value": 2500,
      "weaponCategory": "martial",
      "dmg1": "1d6",
      "dmgType": "P",
      "property": ["F", "L"],
      "weapon": true
    }
  ]
}
```

### Magic items

```json
{
  "item": [
    {
      "name": "Cloak of Shadows",
      "source": "HB",
      "type": "LA",
      "rarity": "rare",
      "reqAttune": true,
      "wondrous": false,
      "entries": [
        "While attuned to this cloak, you have advantage on Dexterity (Stealth) checks made in dim light or darkness."
      ],
      "book_source": "My Homebrew Book"
    }
  ]
}
```

### Item type codes

**Weapons**

| Code | Type |
|---|---|
| `"M"` | Melee weapon |
| `"R"` | Ranged weapon |
| `"A"` | Ammunition |

**Armor**

| Code | Type |
|---|---|
| `"LA"` | Light armor |
| `"MA"` | Medium armor |
| `"HA"` | Heavy armor |
| `"S"` | Shield |

**Other**

| Code | Type |
|---|---|
| `"SCF"` | Spellcasting focus |
| `"WD"` | Wand |
| `"RD"` | Rod |
| `"RG"` | Ring |
| `"P"` | Potion |
| `"SC"` | Scroll |
| `"AT"` | Artisan's tools |
| `"INS"` | Instrument |
| `"G"` | Adventuring gear |
| `"OTH"` | Other / wondrous |

### Rarity values

`"none"` · `"common"` · `"uncommon"` · `"rare"` · `"very rare"` · `"legendary"` · `"artifact"`

### Weapon fields

```json
"weaponCategory": "simple",    // or "martial"
"dmg1": "1d8",                 // one-handed damage
"dmg2": "1d10",                // two-handed damage (versatile weapons)
"dmgType": "S",                // damage type: S=slashing, P=piercing, B=bludgeoning
"property": ["V", "F"]
```

**Property codes:** `"F"` Finesse · `"L"` Light · `"T"` Thrown · `"V"` Versatile · `"H"` Heavy · `"R"` Reach · `"2H"` Two-handed · `"A"` Ammunition

### Magic item bonus fields

```json
"bonusWeapon": "+1",           // attack and damage bonus
"bonusAc": "+1",               // armor bonus
"bonusSpellAttack": "+1",
"bonusSpellSaveDc": "+1"
```

---

## Classes

Classes are the most complex domain. A class file has up to six top-level keys — four for the class data itself, one for class-specific options like invocations, and one new key for the BG3 sheet's mechanical behaviors.

```json
{
  "classes": [...],
  "classFeatures": [...],
  "subclasses": [...],
  "subclassFeatures": [...],
  "classOptions": [...],
  "classMechanics": [...]
}
```

### `classes` — the class entry

```json
{
  "classes": [
    {
      "name": "Shadowblade",
      "source": "HB",
      "hitDie": 8,
      "proficiency": ["dex", "int"],
      "startingProfs": {
        "armor": ["light"],
        "weapons": ["simple", "martial"],
        "skills": { "choose": { "from": ["Acrobatics","Deception","Insight","Perception","Stealth"], "count": 3 } }
      },
      "castingAbility": "int",
      "spellProgression": "full",
      "cantripsByLevel": [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
      "subclassTitle": "Shadow Tradition",
      "classFeatures": [
        "Shadow Step|Shadowblade|HB|2",
        "Umbral Form|Shadowblade|HB|6"
      ]
    }
  ]
}
```

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `hitDie` | number | Hit die size: `6`, `8`, `10`, or `12` |
| `proficiency` | string[] | Saving throw ability keys: `"str"` `"dex"` `"con"` `"int"` `"wis"` `"cha"` |
| `startingProfs` | object | See below |
| `castingAbility` | string | Spellcasting ability: `"int"` `"wis"` `"cha"` — omit if not a spellcaster |
| `spellProgression` | string | `"full"` `"half"` `"third"` `"pact"` — omit if not a spellcaster |
| `cantripsByLevel` | number[] | 20-element array of cantrips known at each level |
| `subclassTitle` | string | Label shown in the builder for the subclass picker |
| `classFeatures` | string[] | List of feature names in `"Name\|Class\|Source\|Level"` format |

**`startingProfs` shape:**
```json
"startingProfs": {
  "armor": ["light", "medium"],
  "weapons": ["simple"],
  "tools": ["thieves' tools"],
  "skills": { "choose": { "from": ["Stealth", "Deception", "Insight"], "count": 2 } }
}
```

### `classFeatures` — feature descriptions

Each entry links back to its parent class via `parentClass`.

```json
{
  "classFeatures": [
    {
      "name": "Shadow Step",
      "source": "HB",
      "level": 2,
      "parentClass": "Shadowblade",
      "classSource": "HB",
      "entries": [
        "Starting at 2nd level, while you are in dim light or darkness, as a bonus action you can teleport up to 60 feet to an unoccupied space you can see that is also in dim light or darkness."
      ]
    },
    {
      "name": "Umbral Form",
      "source": "HB",
      "level": 6,
      "parentClass": "Shadowblade",
      "classSource": "HB",
      "entries": [
        "At 6th level, you can use your action to become a shadow for 1 minute."
      ]
    }
  ]
}
```

**Required fields:** `name`, `source`, `level`, `parentClass`, `classSource`, `entries`

### `subclasses` — subclass definitions

```json
{
  "subclasses": [
    {
      "name": "Way of Shadows",
      "shortName": "Shadows",
      "source": "HB",
      "className": "Shadowblade",
      "classSource": "HB",
      "subclassFeatures": [
        "Shadow Arts|Shadowblade|HB|Shadows|HB|3"
      ]
    }
  ]
}
```

**`shortName`** is the display label used in the subclass picker. **`className`** must match the class `name` exactly.

### `subclassFeatures` — subclass feature descriptions

```json
{
  "subclassFeatures": [
    {
      "name": "Shadow Arts",
      "source": "HB",
      "level": 3,
      "parentClass": "Shadowblade",
      "classSource": "HB",
      "subclassId": "Shadows",
      "subclassSource": "HB",
      "entries": [
        "Starting at 3rd level when you choose this tradition, you learn the {@spell minor illusion} cantrip."
      ]
    }
  ]
}
```

**Required:** `name`, `source`, `level`, `parentClass`, `classSource`, `subclassId`, `entries`

`subclassId` must match the subclass's `shortName` exactly.

### `classOptions` — invocations, metamagic, maneuvers, and custom options

These appear in the builder's Feature Choices section for any class or feat that grants them.

```json
{
  "classOptions": [
    {
      "name": "Blade of Shadows",
      "source": "HB",
      "optionTypes": ["SB"],
      "prerequisite": [
        { "level": { "level": 5 } }
      ],
      "entries": [
        "You can use your bonus action to conjure a blade of pure shadow..."
      ]
    }
  ]
}
```

`optionTypes` is a list of type codes that determine which class's picker shows this option. Use the built-in codes to extend existing pools, or define your own code and reference it from `classMechanics.customChoices[].optionType`.

**Built-in `optionTypes` codes:**

| Code | Pool |
|---|---|
| `"EI"` | Eldritch Invocations (Warlock) |
| `"MM"` | Metamagic (Sorcerer) |
| `"MV:B"` | Battle Maneuvers (Fighter: Battle Master) |
| `"FS:F"` | Fighting Styles (Fighter) |
| `"FS:P"` | Fighting Styles (Paladin) |
| `"FS:R"` | Fighting Styles (Ranger) |
| `"FS:B"` | Fighting Styles (Bard) |
| `"AI"` | Artificer Infusions / Plans |
| `"ED"` | Elemental Disciplines (Monk) |
| `"AS"` | Artificer Specialist options |
| `"PB"` | Pact Boon options |

For a **custom class**, define your own code (e.g. `"SB"` for Shadowblade) and reference it from `classMechanics.customChoices[].optionType`.

---

### `classMechanics` — BG3 sheet behaviors (custom classes)

This is the key that makes custom classes feel like first-class citizens in the sheet. Without it, a class appears in the picker but has no resource trackers, no ASI schedule, and no builder sections. With it, all of those behaviors are driven by the JSON — no code needed.

```json
{
  "classMechanics": [
    {
      "className": "Shadowblade",

      "subclassGrantLevel": 3,
      "asiLevels": [4, 8, 12, 16, 19],
      "jackOfAllTrades": false,

      "spellcastingAbility": "int",
      "casterProgression": "full",
      "saveProficiencies": ["dex", "int"],

      "startingProfs": {
        "armor": ["light"],
        "weapons": ["simple", "martial"]
      },
      "multiclassProfs": {
        "armor": ["light"],
        "weapons": ["simple", "martial"],
        "skillCount": 1
      },

      "resourcePools": [
        {
          "name": "Shadow Fuel",
          "maxFormula": "level",
          "resetOn": "short"
        }
      ],

      "customChoices": [
        {
          "key": "shadowTricks",
          "label": "Shadow Tricks",
          "optionType": "SB",
          "slotsByLevel": [[3, 2], [7, 3], [11, 4], [15, 5]]
        }
      ],

      "fightingStyle": {
        "code": "FS:SB",
        "grantLevel": 2
      }
    }
  ]
}
```

#### `classMechanics` field reference

**Identity / spellcasting**

| Field | Type | Description |
|---|---|---|
| `className` | string | Must match the class `name` exactly |
| `spellcastingAbility` | `"str"` `"dex"` `"con"` `"int"` `"wis"` `"cha"` | Spell attack/DC ability |
| `casterProgression` | `"full"` `"half"` `"third"` `"pact"` `"artificer"` | Spell slot progression |
| `saveProficiencies` | string[] | Saving throw ability keys |

**Builder behavior**

| Field | Type | Default | Description |
|---|---|---|---|
| `subclassGrantLevel` | number | `3` | Level the subclass picker appears |
| `asiLevels` | number[] | `[4,8,12,16,19]` | Levels that grant an ASI slot |
| `jackOfAllTrades` | boolean | `false` | Adds half-proficiency to untrained skills |

**Proficiencies** (used for multiclassing and starting gear)

```json
"startingProfs": { "armor": ["light", "medium"], "weapons": ["simple"] },
"multiclassProfs": { "armor": ["light"], "weapons": ["simple"], "skillCount": 1 }
```

**Fighting style** (if your class grants one)

```json
"fightingStyle": {
  "code": "FS:SB",
  "grantLevel": 2
}
```

`code` must be unique — use `"FS:XX"` where `XX` is your class abbreviation. Options with this code in their `optionTypes` will appear in the picker. If you want your class to share the Fighter's fighting style pool, set `"code": "FS:F"`.

**Resource pools** — pip trackers that scale with class level

```json
"resourcePools": [
  {
    "name": "Shadow Fuel",
    "maxFormula": "level",
    "resetOn": "short"
  },
  {
    "name": "Umbral Charges",
    "maxFormula": "table",
    "maxTable": [[1,2],[5,3],[9,4],[13,5],[17,6]],
    "resetOn": "long"
  },
  {
    "name": "Soul Coins",
    "maxFormula": "flat",
    "maxValue": 3,
    "resetOn": "long"
  }
]
```

| `maxFormula` | How max is computed |
|---|---|
| `"level"` | `max = class level` (same as Monk ki points) |
| `"table"` | `maxTable` — array of `[minLevel, maxValue]`; highest matching row wins |
| `"flat"` | `max = maxValue` — fixed number regardless of level |

`resetOn` must be `"short"` or `"long"`. The pip tracker appears in the Features tab and resets automatically on rest.

Optional: add `"die": 6` (or `8`, `10`, `12`) to display a die size next to the tracker (like Bardic Inspiration).

**Custom choice sections** — multi-pick option lists in the builder

```json
"customChoices": [
  {
    "key": "shadowTricks",
    "label": "Shadow Tricks",
    "optionType": "SB",
    "slotsByLevel": [[3, 2], [7, 3], [11, 4], [15, 5]]
  },
  {
    "key": "signatureMoves",
    "label": "Signature Moves",
    "options": ["Unseen Strike", "Ghost Step", "Shadow Clone"],
    "slotsByLevel": [[6, 1], [14, 2]]
  }
]
```

Each entry becomes a MultiPicker section in the builder:

| Field | Description |
|---|---|
| `key` | Storage key — must be unique across all your classes |
| `label` | Section header shown in the builder |
| `optionType` | Pull options from `classOptions` entries with this `optionTypes` code |
| `options` | Explicit list of option names (used instead of `optionType`) |
| `slotsByLevel` | `[minLevel, slotCount]` pairs — the highest matching row determines how many picks are allowed |

`optionType` and `options` are mutually exclusive — use one or the other.

---

## Books (Races, Feats, Backgrounds)

These appear in the builder's ancestry, feat, and background pickers.

### Races

```json
{
  "races": [
    {
      "name": "Voidborn",
      "source": "HB",
      "size": ["M"],
      "speed": { "walk": 30 },
      "ability": [{ "int": 2, "dex": 1 }],
      "darkvision": 60,
      "languageProficiencies": [{ "common": true, "void speech": true }],
      "entries": [
        {
          "name": "Void Sight",
          "entries": ["You have darkvision out to 60 feet."]
        },
        {
          "name": "Phase Step",
          "entries": ["Once per short rest, you can take the Disengage action as a bonus action."]
        }
      ],
      "book_source": "My Homebrew Book"
    }
  ]
}
```

### Feats

```json
{
  "feats": [
    {
      "name": "Shadow Adept",
      "source": "HB",
      "prerequisite": [
        { "ability": [{ "dex": 13 }] }
      ],
      "entries": [
        "You have trained in the art of shadow manipulation:",
        { "type": "list", "items": [
          "You gain proficiency in the Stealth skill. If you are already proficient, you gain expertise instead.",
          "While in dim light or darkness, opportunity attacks against you have disadvantage."
        ]}
      ],
      "book_source": "My Homebrew Book"
    }
  ]
}
```

### Backgrounds

```json
{
  "backgrounds": [
    {
      "name": "Shadowrunner",
      "source": "HB",
      "skillGrants": ["Stealth", "Deception"],
      "entries": [
        "You spent years working in the shadows..."
      ],
      "book_source": "My Homebrew Book"
    }
  ]
}
```

> **Note:** The builder reads `skillGrants` (an array of skill names) for the two automatic background skill proficiencies. This is a simplified format used by this app — it does not use the full 5etools background skill schema.

---

## `book_source`

Any entry in any domain can include `"book_source": "My Book Name"`. This string is what appears in the Campaign filter tab in the Library, letting you enable/disable all content from a source at once.

---

## Complete Multi-Domain Example

```json
{
  "classes": [
    {
      "name": "Shadowblade",
      "source": "HB",
      "hitDie": 8,
      "proficiency": ["dex", "int"],
      "startingProfs": {
        "armor": ["light"],
        "weapons": ["simple", "martial"],
        "skills": { "choose": { "from": ["Acrobatics","Deception","Insight","Perception","Stealth"], "count": 3 } }
      },
      "castingAbility": "int",
      "spellProgression": "half",
      "subclassTitle": "Shadow Tradition",
      "classFeatures": ["Shadow Step|Shadowblade|HB|2"]
    }
  ],
  "classFeatures": [
    {
      "name": "Shadow Step",
      "source": "HB",
      "level": 2,
      "parentClass": "Shadowblade",
      "classSource": "HB",
      "entries": ["As a bonus action while in dim light or darkness, you teleport up to 60 feet to an unoccupied space you can see."]
    }
  ],
  "subclasses": [
    {
      "name": "Way of Shadows",
      "shortName": "Shadows",
      "source": "HB",
      "className": "Shadowblade",
      "classSource": "HB",
      "subclassFeatures": ["Shadow Arts|Shadowblade|HB|Shadows|HB|3"]
    }
  ],
  "subclassFeatures": [
    {
      "name": "Shadow Arts",
      "source": "HB",
      "level": 3,
      "parentClass": "Shadowblade",
      "classSource": "HB",
      "subclassId": "Shadows",
      "subclassSource": "HB",
      "entries": ["You learn the minor illusion cantrip."]
    }
  ],
  "classOptions": [
    {
      "name": "Blade of Shadows",
      "source": "HB",
      "optionTypes": ["SB"],
      "entries": ["You conjure a blade of pure shadow that lasts until the start of your next turn."]
    }
  ],
  "classMechanics": [
    {
      "className": "Shadowblade",
      "subclassGrantLevel": 3,
      "asiLevels": [4, 8, 12, 16, 19],
      "spellcastingAbility": "int",
      "casterProgression": "half",
      "saveProficiencies": ["dex", "int"],
      "startingProfs": { "armor": ["light"], "weapons": ["simple", "martial"] },
      "multiclassProfs": { "armor": ["light"], "weapons": ["simple"], "skillCount": 1 },
      "resourcePools": [
        {
          "name": "Shadow Fuel",
          "maxFormula": "level",
          "resetOn": "short"
        }
      ],
      "customChoices": [
        {
          "key": "shadowTricks",
          "label": "Shadow Tricks",
          "optionType": "SB",
          "slotsByLevel": [[3, 2], [7, 3], [11, 4]]
        }
      ]
    }
  ],
  "spells": [
    {
      "name": "Umbral Blade",
      "source": "HB",
      "level": 2,
      "school": "I",
      "time": [{ "number": 1, "unit": "bonus" }],
      "range": { "type": "point", "distance": { "type": "self" } },
      "duration": [{ "type": "timed", "duration": { "type": "minute", "amount": 1 }, "concentration": true }],
      "entries": ["You create a blade of shadow in your free hand. You can use it as a melee weapon dealing 2d6 psychic damage."],
      "book_source": "My Homebrew Book"
    }
  ],
  "feats": [
    {
      "name": "Shadow Adept",
      "source": "HB",
      "entries": ["You gain proficiency in Stealth. Once per turn when you hit a creature, you can spend 1 Shadow Fuel to deal an extra 1d6 necrotic damage."],
      "book_source": "My Homebrew Book"
    }
  ]
}
```

---

## Tips

- **Source code consistency** — use the same `source` value everywhere in a file. Mixing sources in one file works, but the Library's source toggle tracks by code.
- **After uploading** — close and reopen the builder tab to see new classes. The Library shows a note: *"Class and book changes take effect on page reload."*
- **Missing `classMechanics`** — a class without it still appears in the class picker and features tab, but won't have pip trackers, custom choice sections, or registry-driven ASI/subclass levels.
- **Explicit options vs optionType** — use `optionType` when you want to write the option details in `classOptions`. Use `options` (a plain name list) for quick choices that don't need descriptions in the builder.
- **Re-uploading** — each upload is stored as a separate entry. Remove the old one from Library → Homebrew first before uploading an updated file.

# BG3 × 5e Character Sheet — Architecture Reference

## Project Overview

Browser D&D 5e sheet + BG3 rule mods.
**Vite + React 18 + TypeScript.** Source in `src/`, built to `dist/`.
Dev server: `npm run dev` (port 7822). Build: `npm run build`.

---

## Folder Structure

```
5e-BG3-CharacterSheet/
├── CLAUDE.md                       ← this file
├── BG3-5e-Rules-Reference.md       ← BG3 hybrid rules (compressed)
├── BG3-5e-Data-Reference.md        ← BG3 data tables (compressed)
├── BG3 Class/Race/Rules/Spell Changes.md  ← raw rule change notes
├── index.html                      ← roster/hub entry point
├── sheet.html                      ← character sheet entry point
├── builder.html                    ← character builder entry point
├── vite.config.ts                  ← multi-page Vite config
├── data/                           ← 5etools JSON source files (read-only)
│   ├── skills.json                 ← skill→ability map
│   ├── races.json                  ← all races + subraces
│   ├── backgrounds.json            ← backgrounds + skill profs
│   ├── feats.json                  ← feats (standard 5etools schema)
│   ├── optionalfeatures.json       ← invocations, metamagic, maneuvers
│   ├── conditionsdiseases.json     ← conditions list
│   ├── items.json                  ← magic items
│   ├── items-base.json             ← base weapon/armor items
│   ├── class/
│   │   └── class-{name}.json       ← one per class (12 classes, no artificer)
│   └── spells/
│       └── spells-{phb,xge,tce,xphb}.json  ← spell sources used by registry
├── plugins/                        ← optional rule-variant plugins
│   └── index.ts                    ← registers all plugins via PluginRegistry
└── src/                            ← all app source (TypeScript/TSX)
    ├── core/                       ← data model, engine, registries, storage
    │   ├── types.ts                ← StoredChar + all interfaces
    │   ├── data-5e.ts              ← StoredChar schema + computeCharacter()
    │   ├── data-registry.ts        ← async data loader → REGISTRY / REGISTRY_PROMISE
    │   ├── data-ki.ts              ← ki point data tables
    │   ├── data-actions.ts         ← action/bonus action data
    │   ├── storage.ts              ← localStorage roster helpers (named exports)
    │   ├── item-resolve.ts         ← resolveItem() — custom item override → registry fallback
    │   ├── tag-renderer.tsx        ← renderEntries() — 5etools tag → JSX
    │   ├── spell-restrictions.ts   ← multiclass spell slot rules
    │   ├── campaign-rules.ts       ← campaign-level rule overrides
    │   ├── sane-prices.ts          ← item price normalization
    │   ├── conditions-calc.tsx     ← conditions calculator component
    │   └── conditions-calc-data.json  ← conditions reference data
    ├── shared/                     ← UI primitives + global style (no business logic)
    │   ├── primitives.tsx          ← Spinner, Pill, StatCard, Icon, ScoreBox
    │   ├── styles.css              ← all CSS, dark theme, CSS variables
    │   ├── vite-env.d.ts           ← Vite client type shims
    │   └── gis.d.ts               ← Google Identity Services type shims
    ├── features/                   ← optional cross-cutting features
    │   ├── drive-sync.ts           ← Google Drive sync logic
    │   ├── drive-sync-ui.tsx       ← Drive sync UI components
    │   ├── drive-client-id.ts      ← OAuth client ID constant
    │   ├── tweaks-panel.tsx        ← TweaksPanel/TweakSection/TweakToggle/useTweaks
    │   ├── plugin-api.ts           ← plugin API surface
    │   ├── plugin-panel.tsx        ← plugin panel UI
    │   └── plugin-registry.ts      ← plugin registration and lookup
    ├── tabs/                       ← sheet tab components
    │   ├── tabs-5e.tsx             ← barrel re-exporter for all tabs
    │   ├── combat-tab-5e.tsx       ← Combat tab
    │   ├── feat-tab-5e.tsx         ← Features tab
    │   ├── invt-tab-5e.tsx         ← Inventory tab
    │   ├── spell-tab-5e.tsx        ← Spellcasting tab
    │   ├── notes-tab-5e.tsx        ← Notes tab
    │   └── minion-tab-5e.tsx       ← Vassals/minions tab
    ├── views/                      ← full-page app shells and layout
    │   ├── app-5e.tsx              ← App5e root component
    │   ├── sidebars-5e.tsx         ← LeftRail5e, RightRail5e
    │   ├── builder-5e.tsx          ← AppBuilder character creation form
    │   └── my-characters.tsx       ← AppMyChars roster UI
    └── pages/                      ← Vite entry point renderers
        ├── sheet.tsx               ← mounts App5e → sheet.html
        ├── builder.tsx             ← mounts AppBuilder → builder.html
        └── roster.tsx              ← mounts AppMyChars → index.html
```

---

## Data Architecture

### Two-Layer State Pattern

**Layer 1 — Stored state** (`STORED_5E` schema): What char chose.
Persisted to `localStorage` via `CharStorage`. No computed values.

**Layer 2 — Computed character** (`computeCharacter(stored)`): All derived.
Called in `App5e` via `React.useMemo`. Result `c` used by all components.

### Stored State Schema (`STORED_5E`)
```js
{
  id, name, player, campaign, image,
  race: { name, subrace, source, asiChoices:[{stat,bonus}], darkvision },
  background: { name, source, skillProficiencies:[] },
  classes: [{ name, subclass, source, level }],  // array for multiclass, sum ≤ 12
  abilityScores: { str,dex,con,int,wis,cha },    // point-buy base only (8–15)
  levelASI: [{ stat, bonus }],                    // one entry per ASI bonus applied
  hp: { current, temp },
  hitDiceRemaining: { d6,d8,d10,d12 },
  proficiencies: { skills:[], weapons:[], armor:[], tools:[], languages:[] },
  expertise: [],
  jackOfAllTrades: bool,
  equipment: {
    meleeSet:{mainhand,offhand}, rangedSet:{mainhand},
    armor, helmet, gloves, boots, cloak, ring1, ring2, amulet,
    inventory: [{ key, qty, wt, equipped, notes }],
  },
  spellcasting: { slotsUsed:{1:N,...}, cantrips:[], prepared:[], known:[] },
  resources: {
    bardicInspiration: {current} | null,
    rages: N | null,         // raw current count
    kiPoints: N | null,
    sorceryPoints: N | null,
    pactSlots: {used:N} | null,
    custom: [{ name, current, max, resetOn }],
  },
  feats: [],
  conditions: [],
  deathSaves: { successes, failures },
  inspiration: bool,
  exhaustion: 0,
  notes: { personality, ideals, bonds, flaws, backstory },
}
```

### Computed Output (`computeCharacter(s)`)
Key fields on `c`:
- `totalLevel`, `proficiencyBonus`, `ac`, `initiative`, `speed`, `speedFt`
- `abilities.STR.score/mod/save/prof` (and DEX/CON/INT/WIS/CHA)
- `skills[]` — `{name, abil, mod, prof:"none"|"prof"|"expert"}`
- `hp.{current,temp,max}`, `hitDiceDisplay`
- `passive.{perception,investigation,insight}`
- `spellcasting.{ability,saveDC,attackBonus,cantripTier,slots[],pactSlots,cantrips[],spells[]}`
- `resources.{bardicInspiration,rages,kiPoints,sorceryPoints}` — full `{current,max,resetOn}` objects
- `attacks[]`, `equipment`, `conditionsList[]`, `raceFeatures[]`, `classFeatures[]`
- `carryCapacityKg`, `totalWeightKg`, `encumberedAt`, `heavilyEncAt`

---

## Registry (`REGISTRY` / `REGISTRY_PROMISE`)

Exported from `src/core/data-registry.ts`. Async-loaded on start. Loading screen until resolved.

```ts
REGISTRY = {
  skills:           { "Acrobatics": "dex", ... },       // skill→ability key map
  classes:          { "Bard": { hitDie, startingProfs, spellcastingAbility,
                                subclasses[], features[] }, ... },
  races:            [{ name, subrace:[], ...rawData }],  // Variant Human filtered out; deduped by source priority
  backgrounds:      [{ name, skillProficiencies:[] }],   // first 2 skills only; deduped by source priority
  feats:            [{ name, prerequisite, ability[], entries[] }],
  optionalFeatures: [...],   // invocations, metamagic, maneuvers (no Onomancy Rites)
  spells:           null,    // lazy-loaded on Spellcasting tab open
  items:            null,    // lazy-loaded on Inventory tab open
  conditions:       null,    // lazy-loaded via loadConditions()
}
```

Source dedup priority: `XPHB > MPMM > VGM > ERLW > EFA > PHB > EEPC > DMG`

Lazy loaders (named exports): `loadSpells()`, `loadItems()`, `loadConditions()`

---

## Storage (`src/core/storage.ts`)

Named exports. Multi-char roster in `localStorage`.

```
localStorage['bg3_roster']  = JSON array of StoredChar objects (with _lastModified)
localStorage['bg3_active']  = id string of active character
```

Key exports:
- `getRoster()` → `StoredChar[]`
- `getActiveChar()` → active `StoredChar` (migrates legacy `bg3_character` key)
- `saveChar(stored)` → upsert by `stored.id`
- `setActiveId(id)` → set active
- `deleteChar(id)` → remove from roster

---

## Navigation Flow

```
index.html (roster)          ← hub entry point
  "OPEN →"               → sheet.html  (sets active ID)
  "+ BUILD NEW CHARACTER" → builder.html?new=1  (blank)

builder.html
  "← MY CHARACTERS"      → index.html
  "VIEW SHEET →"         → saves+activates → sheet.html

sheet.html
  "← MY CHARACTERS"      → index.html
  "EDIT IN BUILDER →"    → builder.html (loads active char)
```

---

## BG3 Rule Overrides (key deviations from standard 5e)

| Rule | BG3 |
|---|---|
| Initiative | d4 roll (not d20+DEX); flat bonuses added |
| Leveling | Story-based, no XP |
| Level cap | 12 |
| Ability Score Increase | Flexible +2/+1 to any stats (not fixed racial) |
| HP per level | Fixed: d6→4, d8→5, d10→6, d12→7 (not avg/roll) |
| Max spell level | 6 |
| Cantrip tiers | Level 1 / 5 / 10 (not 1/5/11) |
| Short rest HP | Restore ½ max HP |
| Components | None (no V/S/M) |
| Attunement | None |
| Tools/Languages | Present for TTRPG completeness (not BG3 mechanic) |
| Alignment | Removed |
| Darkvision caps | 40ft (standard), 80ft (superior) |
| Carry capacity (kg) | 40 + (10 × STR score) |
| Encumbered at | 80% capacity |
| Heavily encumbered at | 93.33% capacity |

---

## CSS Variables (key)

```css
--gold, --gold-bright, --gold-dim   /* gold text hierarchy */
--vitality                          /* green (HP, success) */
--danger                            /* red (damage, fail) */
--card, --card-2                    /* dark surface layers */
--border, --border-faint            /* border colors */
--text, --text-muted, --text-faint, --text-dim  /* text hierarchy */
--serif: Cormorant Garamond
--sans:  IBM Plex Sans
--mono:  JetBrains Mono
```

---

## Adding Features — Checklist

**New stored field** → add to `StoredChar` in `src/core/types.ts` + `blankChar()` in `src/views/builder-5e.tsx` + `src/core/data-5e.ts` passthrough
**New computed value** → add to `computeCharacter()` return in `src/core/data-5e.ts`
**New registry data** → add fetch to `loadRegistry()` in `src/core/data-registry.ts` + type to `Registry` in `src/core/types.ts`
**New interactive element** → read from `stored`, write via `setStored(s => ({...s, field: newVal}))`
**New tab** → add to `TABS_5E` array in `src/views/app-5e.tsx`, create `src/tabs/{name}-tab-5e.tsx`, re-export from `src/tabs/tabs-5e.tsx`

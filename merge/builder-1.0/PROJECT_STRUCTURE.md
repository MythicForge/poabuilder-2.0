# Path of Ambition — Project Structure
> Front-end designers. Data flow, file ownership.

---

## Stack

| Thing | What |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript + React 19 |
| Styling | Inline styles + CSS vars in `globals.css`. No Tailwind in components. |
| Storage | Browser `localStorage` — no database, no backend |
| Icons | SVG files in `icons/` (8300+ from game-icons.net) |

---

## How Data Flows

```
content/*.json          — raw game rules data (read-only, static)
       ↓
lib/data.ts             — reads JSON, exports typed arrays
lib/builderData.ts      — reshapes data for the character builder UI
       ↓
app/*/page.tsx          — Next.js page: loads data server-side, passes as props
       ↓
components/*.tsx        — React client components: render UI, handle interaction
       ↓
lib/characterCalc.ts    — pure math functions: compute derived stats from character state
lib/characterStorage.ts — read/write character objects to localStorage
```

---

## Folder Map

```
pathofambition_dev_nf/
│
├── app/                        ← Next.js pages (URL routes)
│   ├── layout.tsx              ← Root shell: Sidebar + ThemeProvider wrap every page
│   ├── globals.css             ← CSS vars (--bg, --gold, --font-heading), base resets, fonts
│   ├── page.tsx                ← Home dashboard: links to all sections
│   │
│   ├── characters/
│   │   ├── page.tsx            ← Lists all saved characters (reads localStorage)
│   │   ├── new/page.tsx        ← Character creation wizard (CharacterBuilder component)
│   │   └── [id]/page.tsx       ← Full character sheet for one character (CharacterSheet component)
│   │
│   ├── professions/
│   │   ├── page.tsx            ← All professions list (like D&D classes)
│   │   └── [slug]/page.tsx     ← Single profession detail: features, feats, spells
│   │
│   ├── origins/
│   │   ├── page.tsx            ← All origins list (like D&D backgrounds)
│   │   └── [slug]/page.tsx     ← Single origin detail
│   │
│   ├── spells/
│   │   ├── page.tsx            ← Spell compendium
│   │   └── [slug]/page.tsx     ← Single spell detail
│   │
│   ├── feats/page.tsx          ← Feat browser (filterable)
│   ├── equipment/page.tsx      ← Item/equipment catalog
│   ├── actions/page.tsx        ← Combat action reference
│   ├── rules/page.tsx          ← Rules reference (rendered from JSON)
│   ├── search/page.tsx         ← Global search across all content
│   └── not-found.tsx           ← 404 page
│
├── components/                 ← Reusable React components (all "use client")
│   ├── CharacterSheet.tsx      ← ~9400 lines. The full interactive character sheet.
│   │                             3-column grid layout. Owns all sheet state via useState.
│   │                             Calls characterCalc.ts for derived numbers.
│   │                             Calls characterStorage.ts to save.
│   ├── CharacterBuilder.tsx    ← Multi-step character creation wizard.
│   │                             Guides: profession → origin → feats → spells → equipment.
│   │                             On finish, saves new character to localStorage.
│   ├── CharacterList.tsx       ← Grid of character cards on /characters.
│   │                             Reads localStorage, renders portrait + name + profession.
│   ├── Sidebar.tsx             ← Left nav. Collapses on mobile. Links to all routes.
│   ├── PageHeader.tsx          ← Reusable page title + subtitle block.
│   ├── ThemeProvider.tsx       ← Sets data-theme attr on <html>. Reads localStorage pref.
│   ├── ThemeToggle.tsx         ← Light/dark toggle button.
│   ├── GameIcon.tsx            ← Renders SVG icons from /icons/ folder by name.
│   ├── MarkdownContent.tsx     ← Renders markdown strings (rules text, descriptions).
│   ├── TraitBadge.tsx          ← Pill badge for trait tags (e.g. "Martial", "Spell").
│   ├── FeatsClient.tsx         ← Client-side feat browser with filter/search.
│   ├── SpellsClient.tsx        ← Client-side spell browser with filter/search.
│   ├── SearchClient.tsx        ← Powers the /search page (uses fuse.js fuzzy search).
│   ├── ExportButton.tsx        ← Triggers JSON export of a character.
│   ├── ImportButton.tsx        ← Handles JSON import, runs schema migrations.
│   └── ProfessionRemapModal.tsx← Modal shown when imported character profession changed.
│
├── lib/                        ← Pure logic, no UI
│   ├── data.ts                 ← Reads content/*.json, exports typed game data arrays.
│   │                             Used server-side in page.tsx files.
│   ├── builderData.ts          ← Reshapes lib/data.ts output into builder-friendly shapes.
│   ├── characterTypes.ts       ← TypeScript types for the Character object stored in localStorage.
│   ├── types.ts                ← Shared types for game content (Profession, Spell, Feat, etc.)
│   ├── characterCalc.ts        ← All game math. Pure functions: input character state → output number.
│   │                             e.g. calcBodyDefense(c), calcMaxVitality(c), calcSpellDC(c)
│   ├── characterStorage.ts     ← CRUD for characters in localStorage.
│   │                             getCharacter(id), updateCharacter(id, patch), deleteCharacter(id)
│   ├── featLogic.ts            ← Resolves feat choices and their cascading effects.
│   └── character-export/
│       ├── types.ts            ← Types for the export JSON schema.
│       ├── export.ts           ← Serializes a character to a portable JSON blob.
│       ├── import.ts           ← Parses import JSON, validates, writes to localStorage.
│       ├── profession-resolver.ts ← Matches imported profession name to current data.
│       └── schema-migrations/
│           └── index.ts        ← Upgrades old export formats to current schema version.
│
├── content/                    ← Static game data (JSON). Never changes at runtime.
│   ├── professions.json        ← All professions: name, features, tier progression.
│   ├── origins.json            ← All origins: name, origin feats, bonuses.
│   ├── profession_feats.json   ← Feats tied to professions.
│   ├── origin_feats.json       ← Feats tied to origins.
│   ├── choice_features.json    ← Feats with selectable sub-options.
│   ├── spells.json             ← Full spell list: name, sphere, cost, effect.
│   ├── items.json              ← Equipment catalog: weapons, armor, tools.
│   ├── actions.json            ← Combat actions reference.
│   └── rules_sections.json     ← Rules text organized into sections for /rules page.
│
├── icons/                      ← 8300+ SVG icons from game-icons.net.
│   └── darkmode_game-icons.net.svg/
│       └── {author}/{icon-name}.svg   ← Referenced by GameIcon.tsx by author+name.
│
├── public/                     ← Static files served at root URL.
│   ├── logo.svg                ← Site logo (used in browser tab).
│   └── icons/                  ← Any public SVGs needed by <img> tags.
│
├── redesign/
│   └── PoA Character Sheet/    ← Design reference files for CharacterSheet v2 redesign.
│       ├── app.jsx             ← Layout skeleton mock.
│       ├── tabs.jsx            ← Tab component designs.
│       ├── sidebars.jsx        ← Left/right rail designs.
│       ├── styles.css          ← Reference CSS vars and design tokens.
│       ├── data.jsx            ← Mock character data used in design.
│       └── primitives.jsx      ← Reusable UI primitive mock components.
│
└── docs/                       ← Internal design notes and changelogs.
    ├── FEATURES.md             ← Feature log.
    ├── BUG_FIXES.md            ← Bug fix history.
    ├── AMENDMENTS.md           ← Rule change notes.
    ├── ERRORS.md               ← Known issues.
    ├── character-sheet-redesign-spec.md ← Current redesign spec.
    └── CharacterSheet_V1.tsx   ← Archived original sheet (reference only).
```

---

## Key Concepts for Designers

### Character Object (localStorage)
Single character = one JSON object. Fields:
- `c.attributes` — core stats (Might, Finesse, Intellect, etc.)
- `c.vitality` / `c.tempVitality` — HP tracking
- `c.wounds` — injury pips
- `c.feats[]` — purchased feats
- `c.inventory[]` — carried items
- `c.profession` / `c.origin` — build choices

### Derived Stats (never stored, always computed)
`characterCalc.ts` recomputes every render from character state:
- `armorDefense`, `bodyDef`, `mindDef`, `willDef`
- `derivedMaxVitality`, `carryWeight`, `spellDC`
- `currentRespites`, `maxWounds`, `currentReservoir`

### Theme System
CSS vars on `html[data-theme="dark"]` / `html[data-theme="light"]`.
All colors reference vars (`var(--bg)`, `var(--gold)`, `var(--text-primary)`).
Defined in `app/globals.css`. Toggle stored in localStorage key `poa-theme`.

### CharacterSheet Layout (3-column grid)
```
┌─────────────┬──────────────────────┬───────────────┐
│  Left Rail  │    Center Column     │  Right Rail   │
│  250px      │    1fr               │  280px        │
│             │                      │               │
│ Attributes  │ Defense stat row     │ Portrait      │
│ Defense     │ Vitality / Wounds /  │ Char details  │
│ VITALS      │   Ambition / Carry   │ Proficiencies │
│ Armaments   │ Reduction + Rest     │ Quick Ref     │
│             │ Resources strip      │ Details       │
│             │ Class resource       │               │
│             │ Tab nav → tab panels │               │
└─────────────┴──────────────────────┴───────────────┘
```
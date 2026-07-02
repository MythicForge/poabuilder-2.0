# Merge Bundle — Path of Ambition Character Sheet (Site export)

This folder answers **MERGE-INTAKE.md** from the *sheet-owning* side. It is a
self-contained copy of the character sheet + its data model + the definition
data it reads, with original folder paths preserved so it drops back into a
Next.js repo unchanged.

- **Source repo:** `pathofambition_dev_nf`
- **Framework:** Next.js (App Router) + React + TypeScript. Modified/pinned Next
  — see `AGENTS.md` (APIs differ from stock; read `node_modules/next/dist/docs/`
  before editing).
- **Package manager / build:** npm (see `package.json`).
- **Rule system:** homebrew **Path of Ambition** (the merge core). Not 5e.
- **Path alias:** `@/*` → repo root (see `tsconfig.json`). So `@/lib/...` = `lib/`,
  `@/conditions` = root `conditions.js`, `@/components/...` = `components/`.

---

## Phase 0 answers (orientation)

- This site = **the character sheet worth reusing**. Full interactive play sheet,
  ~4400 lines (`components/CharacterSheet.tsx`).
- The sheet is homebrew Path of Ambition → **migrate**, not reference-only.
- Character *creation* (separate from the sheet) lives in
  `components/CharacterBuilder.tsx` — a step wizard that outputs a `Character`
  the sheet then reads. Included for completeness of the data flow.

---

## Phase 1 answers — DATA (the important part)

### Character schema (stored shape)
`lib/characterTypes.ts` → `interface Character`. This IS the save format. Key notes:

- **Ids, not objects.** A character stores *which* things it took by id:
  `professionId`, `originId`, `vocationId`, `selectedFeatIds[]`, `knownSpellIds[]`,
  `activeFeedSpellIds[]`. These resolve against the JSON in `content/` (feat/spell/
  item ids are stable). A few display names are cached alongside ids
  (`professionName`, etc.) for offline render.
- **Attributes:** `baseAttributes` = { brawn, finesse, mind, will } (base points;
  vocation bonus applied on top via `vocationAttributeBonus`).
- **Inventory** is a structured table (`InventoryItem[]`), not free text — all
  rules logic uses structured fields (`armamentTags`, `modifierStat`,
  `damageDiceCount/Size`, `armorBonus/Category/Tier`, shield `reductionPool*`).
  Never parse display strings.
- **Choice features:** `choiceSelections` keyed `"EntityName__FeatureName"` →
  selected option names. Definitions in `content/choice_features.json`.

### Resources — current + max, how tracked
- **Stored current values:** `currentVitality`, `tempHp`, `currentWounds`,
  `currentAmbition`, `currentReservoir` (casters), `currentRespites`, `renown`,
  and generic per-profession pools in `customResources` (data-driven, see
  `CustomResourceDef` in `characterTypes.ts`; legacy `currentAdrenaline` /
  `currentResonance` migrated into it).
- **Max values:** mostly **derived** (see below). `maxVitality` is stored as an
  override (`number | null`; null = use derived). `maxAmbition` / `ambitionDice`
  stored.
- Reduction pools (FEATURE-02): `spellReductionPool`, `featReductionPool` on the
  character; shield pool lives on the shield `InventoryItem`.

### Derived vs. stored
`lib/characterCalc.ts` = all the compute. Derived at render (NOT stored):
armor/body/mind/will defense, spell DC, carry weight, derived max vitality,
known spheres, proficiency tiers, feat allowance effects. Rule of thumb: current
pool values + choices are stored; every *max* and *modifier* is recomputed from
tier + attributes + profession/feat data.

### Save / load
`lib/characterStorage.ts`:
- Persistence = browser **localStorage**, key `poa_characters`, a JSON array of
  `Character`. `load/save/update/delete/getCharacter`.
- `getCharacter()` also runs **inline backfill/migration** (body→brawn/finesse
  split, currency string→{gold,silver,copper}, notes→journal, armor overhaul,
  shield pools, named resource→customResources map). Read this to see every
  legacy field ever persisted.

### Portable export format (better than raw localStorage for migration)
`lib/character-export/`:
- `types.ts` — `CharacterExportEnvelope { schemaVersion, exportedAt,
  professionSnapshot[], character }`. `CURRENT_SCHEMA_VERSION = 1`.
- `export.ts` / `import.ts` — serialize/deserialize + validate.
- `profession-resolver.ts` — remaps profession ids on import when a definition is
  missing/renamed (`ProfessionRemapModal.tsx` is its UI).
- `schema-migrations/index.ts` — versioned migration pipeline.

### ⚠ Sample characters — NOT included
The intake asks for 3–5 real saved characters. **None exist as files** — they
only live in a browser's `poa_characters` localStorage at runtime. To hand them
over: open the running app, DevTools → Application → Local Storage → copy the
`poa_characters` value, OR use the in-app Export button (`ExportButton.tsx`,
produces the envelope above). `content/olddata.zip` is *definition* JSON only, no
characters.

---

## Phase 2 answers — STYLE / LAYOUT / FUNCTION

### Components (the sheet + everything it imports)
- `components/CharacterSheet.tsx` — the sheet. Recently redesigned to a 3-column
  grid (`250px 1fr 280px`). Layout landmarks + key variables documented in the
  repo's `CLAUDE.md` (redesign session context).
- Rails: `components/rails/LeftRail.tsx` (attributes, defence, V.I.T.A.L.S.
  proficiencies, armaments), `RightRail.tsx` (portrait, character details,
  proficiencies, quick reference).
- Tabs: `components/tabs/{Combat,Feats,Inventory,Notes,Spells}Tab.tsx`.
- Trackers/widgets: `components/ConditionsBar.tsx` (+ root `conditions.js` data),
  `components/ui/{StatCard,PipRow,TagPill,ActionGlyph,Icon}.tsx`.
- Import/export UI: `ExportButton.tsx`, `ImportButton.tsx`,
  `ProfessionRemapModal.tsx`. Misc: `SettingsPanel.tsx`, `MarkdownContent.tsx`
  (remark-gfm), `PageHeader.tsx`, `ThemeProvider.tsx`, `CharacterList.tsx`.
- Creation flow (optional): `components/CharacterBuilder.tsx`.

### Styling / theme tokens
- `app/globals.css` — dark theme CSS vars, fonts (Lexend + Source Sans 3; redesign
  adds Cormorant Garamond + JetBrains Mono), color palette, spacing.
- `app/layout.tsx` — root layout (maxWidth widened to 1400px for the 3-col sheet).

### Interactive widgets worth keeping
Resource +/- steppers, clickable wound/ambition/respite pips, conditions bar,
rest buttons (Respite/Long/Full), inline temp-HP/temp-modifier editing,
JSON import/export with profession remap.

---

## Definition data (what the ids resolve to)
`content/*.json` — the shared catalog the sheet reads by id:
`professions.json`, `origins.json`, `profession_feats.json`, `origin_feats.json`,
`spells.json`, `items.json`, `actions.json`, `choice_features.json`,
`rules_sections.json`. `CONTENT_GUIDE.md` documents their shape.

Server-side loaders that read `content/` and build the typed `Builder*` objects
the client uses: `lib/data.ts` (+ `lib/types.ts`) and `lib/builderData.ts`.

---

## Routes (App Router)
- `app/characters/page.tsx` — character list.
- `app/characters/[id]/page.tsx` — the sheet route (loads builder data, renders
  `CharacterSheet`).
- `app/characters/new/page.tsx` — creation (renders `CharacterBuilder`).

---

## Dependency map (import closure)

```
CharacterSheet.tsx
├─ rails/{LeftRail,RightRail}.tsx
├─ tabs/{Combat,Feats,Inventory,Notes,Spells}Tab.tsx
├─ ConditionsBar.tsx ──────────────→ @/conditions (root conditions.js)
├─ Export/Import/SettingsPanel/MarkdownContent
│    └─ ProfessionRemapModal.tsx, ThemeProvider.tsx
│    └─ lib/character-export/{export,import,profession-resolver,types,
│         schema-migrations/index}.ts
├─ lib/characterTypes.ts   (schema — the save format)
├─ lib/characterCalc.ts    (all derived values)
├─ lib/characterStorage.ts (localStorage + migrations)
├─ lib/featLogic.ts, lib/useTweaks.ts
└─ lib/builderData.ts → lib/data.ts → lib/types.ts → content/*.json
```

## Not included (intentionally)
- Boon Forge / data-authoring tool (out of merge scope per intake).
- `app/rules|spells|feats|origins|professions|search|equipment|actions` browse
  pages (content site, not the sheet).
- `node_modules`, `.next`, build artifacts.
- Sample character instances — see Phase 1 note above (localStorage only).

## To run this bundle standalone
It's path-preserving but not a full app — missing `next.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`, `public/`, `icons/`, and the browse
routes. Either drop these files over a fresh Next.js App-Router project (npm),
or copy them back into the original repo. `tsconfig.json` (with the `@/*` alias)
and `package.json` are included so deps + path resolution are known.

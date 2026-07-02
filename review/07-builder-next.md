# Builder — What's Next & Where Data Goes

Companion to the builder framework shipped in commit `709f8ba`. Split into two halves:
**(A) what Claude builds next** (code) and **(B) where you place data** (content JSON).
The builder reads everything through `src/core/data-registry.ts` (`REGISTRY`) and runs the
existing `computeCharacter` engine live — so any correctly-shaped JSON you drop in the
`data/` tree shows up in the wizard with no code change.

Entry: `builder.html` → `src/pages/builder.tsx` → `src/views/builder/builder.tsx`.
Steps live in `src/views/builder/steps/`. Open it from the roster ("New Character" or a
card's "Build").

---

## Current state (per step)

| # | Step | File | State | Reads |
|---|------|------|-------|-------|
| 1 | Identity | `steps/identity.tsx` | ✅ functional | — |
| 2 | Profession | `steps/profession.tsx` | ✅ functional | `REGISTRY.professions` |
| 3 | Origin & Vocation | `steps/origin.tsx` | ✅ functional | `REGISTRY.origins`, `vocationsOf` |
| 4 | Feats & Tier | `steps/feats.tsx` | 🟡 skeleton picker (no budget/prereq gating) | profession/path/origin/vocation `.feats` + universal |
| 5 | Attributes & Skills | `steps/attributes.tsx` | ✅ functional (budget shown; no cap enforcement) | `proficiencies.skills` |
| 6 | Choices & Spells | `steps/choices.tsx` | 🟡 allowances readout only | `computed.spellcasting` |
| 7 | Starting Pack | `steps/pack.tsx` | 🟡 read-only manifest | `starting_pack`, `pack` |
| 8 | Summary | `steps/summary.tsx` | ✅ functional | `computeCharacter` output |

🟡 = wired shell that renders whatever data exists but doesn't yet fully edit/validate it.

---

## A. Claude's task queue (next code work)

Ordered; each is independent unless noted. Ground rules: `npx tsc --noEmit` clean,
`npm test` green, and drive the change in a browser (Playwright) before committing.

### A1 — Feat eligibility + slot budgets (step 4 hard part)
- New `src/core/feat-eligibility.ts`: `featEligibility(stored, feat, reg)` → `{ ok, reasons[] }`.
  Checks slot budget per tier (`REGISTRY.tierProgression.tiers[].slots`, incl. tier-4
  `tier4_slot_choice`), prerequisites (`path_investment` / `origin_investment` counts),
  and tier gating.
- Wire into `steps/feats.tsx`: disable/annotate ineligible feats, show remaining slots.
- Unit-test the pure function. **Blocked on:** feat `prerequisites` + `slot_type` being
  populated in profession JSON (see B).

### A2 — `validate-character.ts`
- New `src/core/validate-character.ts`: attribute overspend, skill-pick overflow, slot
  overflow, allowance overflow, prereq violations → `string[]` (feeds `computed.warnings`
  and the footer badge). Unit-test. Shared by wizard + a future fixture check.

### A3 — Choices & Spells pickers (step 6)
- Replace the readout with real pickers: walk the draft's active feat boons for
  unresolved `choice` / `multi_choice`, render selectors that write `build.choices`.
- Sphere / known-spell / cantrip pickers filtered by `computed.spellcasting.spheres` and
  capped by `knownAllowance` / `cantripAllowance` / `preparedAllowance`.
  Reuse sheet pickers from `src/tabs/spells-tab.tsx` / `feats-tab.tsx` where possible.
- **Blocked on:** spells carrying real `spheres` + feats carrying `choice` boons (see B).

### A4 — Starting-pack → inventory (step 7)
- Map `starting_pack` / `pack` entries to catalog items: exact/fuzzy name match against
  `REGISTRY.items`; category tokens (e.g. `"melee_weapon"`) become catalog-category
  pickers; `{type:"choice"}` honored; unmatched → free-text `custom` item.
- Writes `draft.inventory.items` (`InventoryItem` shape, `src/core/types.ts`).

### A5 — Attribute/skill cap enforcement (step 5 polish)
- Clamp attribute +/- to `attributeBudget.earned`; enforce skill `count`; expertise bumps
  against `skillPointBudget`. Currently free-form (budget shown, not enforced).

### A6 — Sheet ↔ builder crumb
- Add "EDIT IN BUILDER →" to `src/views/char-bar.tsx` → `builder.html?id=<active>`.

**Recommended order:** A2 → A1 → A5 → A4 → A3 → A6.
None of these require touching old `merge/` data.

---

## B. Where you place data (content JSON)

All content is new-format JSON under `data/`. Naming decides how the registry classifies a
file. Files starting with `_` are templates and skipped. After any edit run `npm run validate`.

### Professions & paths → `data/professions/`
- **Base profession:** `<id>.json` — **no** `profession` field. Example: `fighter.json`.
- **Path:** `profession-<profId>-<pathId>.json` — **has** `profession: "<profId>"`.
  Example: `profession-fighter-sentinel.json`.
- Builder reads: `name`, `description`, `favored_attributes[]`, `paths[]`,
  `proficiencies.skills` (`{ type:"choice", count, from[] }` or `string[]`),
  `resources[]`, `starting_pack`, and `feats[]`.
- **Feats** (`feats[]`, shape = `Feat` in `src/core/types.ts`): for the builder to gate
  them (A1) each feat needs `tier`, `trait`, `slot_type` (`tactical|narrative|minor|null`),
  and `prerequisites`. Mechanics go in `boons[]` (validated against
  `data/shared/boon-schema.json`). `choice` / `multi_choice` boons drive step 6.

### Origins & vocations → `data/origins/`
- **Base origin:** `<id>.json` — no `origin` field.
- **Vocation:** `origin-<originId>-<vocationId>.json` — has `origin: "<originId>"`,
  plus `attribute_bonus { attribute, amount }`, optional `spellcasting`, and `feats[]`.
- Builder reads origin `pack`, vocation `attribute_bonus` / `spellcasting` / `feats`.

### Spells → `data/spells/spells.json`
- Shape: `{ "spells": [ Spell ] }` (`Spell` in `types.ts`). Step 6 filters by `spheres[]`,
  `is_cantrip`, `tier`. **To make spell pickers work, spells need real `spheres`.**

### Items → `data/items/items.json`
- Shape: `{ "catalog": { "<category>": [ CatalogItem ] }, ... }`. Step 7 matches pack
  strings against item `name` / `id` / `category`.

### Universal origin feats → `data/shared/origin-feats.json`
- `{ "feats": [ Feat ] }`. Offered in step 4 under "Origin (universal)".

### Shared references (rarely edited)
- `data/shared/boon-schema.json` (v1.2.0) — the boon vocabulary feats/spells write against.
- `data/shared/tier-progression.json` — slot budgets A1 reads.
- `data/shared/universal-resources.json` — ambition/vitality/wounds/reservoir.
- `data/shared/_character-template.json` — the blank `StoredCharacter` a new build clones.

### Adding a whole new profession — checklist
1. `data/professions/<id>.json` (base) + one `profession-<id>-<path>.json` per path.
2. Fill `favored_attributes`, `proficiencies`, `resources`, `starting_pack`.
3. Author `feats[]` with `tier`/`trait`/`slot_type`/`prerequisites` + `boons[]`.
4. `npm run validate` → GREEN. It appears in the builder immediately.

---

## Invariants & commands
- `npm run validate` → GREEN (0 errors). `npx tsc --noEmit` clean. `npm test` green.
- `npm run dev` (port 7901) — roster → "Build" opens the wizard.
- Do **not** touch `merge/builder-1.0/` — old data, unused by the builder.
- Note: 16 `data/professions/*.json` carry an uncommitted `_review`-marker strip from an
  earlier pass; unrelated to the builder. `git restore data/professions/` to discard.

# TODO

Snapshot of what's shipped and what's open. Invariants for every change:
`npm run validate` GREEN · `npx tsc --noEmit` clean · `npm test` green.
Dev: `npm run dev` (port 7901).

## Done

- **R3** — schema reconcile, 33 validator warnings → 0 (boon-schema v1.2.0).
- **R1** — `_review` marker strip (committed by parallel session).
- **Builder** (`builder.html`) — all 8 steps functional:
  Identity · Profession · Origin+Vocation · Feats (eligibility + slot budgets +
  tier-4 flex slot) · Attributes+Skills (budget/cap enforced) · Choices+Spells
  (feat choice resolution + cantrip/known/prepared pickers) · Pack→inventory ·
  Summary (live validation).
- **Engine adds** — `feat-eligibility.ts`, `validate-character.ts`,
  `pack-mapping.ts`; `creation_attribute_points` folded into attribute budget.
- **R6 (B-lite)** — `packages/ui` shared design system (`@ui`); second PoA skin
  ("Codex", editable play-view); unified view switcher (Roster/Sheet/Codex/Builder).
- **Data** — spell `spheres` normalized to `string[]` at load; amp
  `stackable`/`stack_max` documented in spell-schema + validated. `Load Samples`
  seeds the Bren/Selene fixtures.

## Done (cont.)

- **`creation_attribute_points` set to 5** (real rule, not the old Bren-inferred
  7) — Bren fixture attrs trimmed to fit (`brawn 5, finesse 1, mind 1, will 1`);
  hardcoded test expectations in `engine.test.ts` updated to match.
- **Expertise decoupled from skill dice points** — expertise is now its own
  budget, 1 point per tier gained (`tier - 1`, max 4 at tier 5), spent to bump
  skill rank Trained→Expert→Master. Skill dice points keep the old feats-based
  budget (`floor(feats_purchased/2)`). Fixes a builder bug where a fresh
  character (0 feats purchased) couldn't spend any skill points because dice
  and expertise shared one budget that starts at 0. New
  `computed.expertisePointBudget` field; UI shows two separate meters.
- **Sphere vocab normalized to lowercase** (matches the profession
  `grants_sphere`/`sphere` boon keys) — `spells.json`'s 138 Title-case
  `spheres` values lowercased; Selene's fixture `"Mana"` (a `sources` value,
  not a real sphere) replaced with `"conjuration"`. `spell-schema.json` doc
  was also wrong — it documented a nonexistent `school` field with the sphere
  list and mislabeled the real `spheres` field with the `sources` vocab;
  fixed. Builder UI capitalizes sphere names for display only.
- **`.gitignore` `*.tsbuildinfo`** — untracked and ignored.
- **`creation_skill_points` added (4)** — skill dice points now grant a
  creation baseline like attribute points do (`creation_skill_points +
  floor(feats_purchased/2) * skill_point_per_even_feat`), instead of starting
  at 0 for a fresh character. Verified live in the browser: T1/0-feats now
  shows 4/4, T3/6-feats shows 7/7.

- **Skill dice display bug** — untrained skills showed base + skill dice as
  separate terms (`1d6 + 3d6`) instead of one pool (`4d6`); `skillPool()`'s
  display formula now always combines them.
- **Sheet description rendering** — feat/spell `description` text is
  authored Markdown (`spell-schema.json` says so) but was rendered as a raw
  string, so `**bold**`, bullet lists, and pipe tables showed as literal
  asterisks/pipes. Added a shared `<Markdown>` component (`packages/ui`,
  using `marked`) and wired it into Combat/Feats/Spells tabs, plus `.md`
  styling matching the sheet's dark theme. Also found and rewrote 2 feat
  descriptions (Elementalist's Primordial Strike, Alchemist's Explosive
  Workings) that had raw `attack_option` JSON hand-transcribed into the
  prose as a stopgap for an unported boon type — now clean prose/tables;
  the structured data is still preserved in `_review` for when
  `attack_option` gets ported into the engine.

## Open / needs a call

(none currently)

## Next candidates (unblocked)

- [ ] Surface amp `stackable`/`stack_max` in the sheet's spell UI (stack counter).
- [ ] Codex skin: expose inventory / notes if wanted (currently sheet/builder only).
- [ ] Feat-choice sub-grants: some `choice` options grant nested spheres/spells —
  wire those into the Choices step's spell pools.
- [ ] Sphere-scoped spell filtering is now vocab-consistent — could be made a
  real gate (character needs a known sphere to pick a spell) instead of the
  current convenience-only dropdown filter, if that's the intended rule.

## Deferred (out of current scope)

- [ ] **R6 full 5e port** — porting the `merge/5edata` app + ~100MB 5etools
  dataset (see `review/06-5e-sheet.md`). Needs the external dataset + storage-key
  decision. Not started; B-lite skin covers the shared-UI groundwork.

See `review/07-builder-next.md` for the data-placement contract (where new-format
profession/origin/spell/item JSON goes).

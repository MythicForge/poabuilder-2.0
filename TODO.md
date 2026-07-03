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

## Open / needs a call

- [ ] **Confirm `creation_attribute_points = 7`** in `tier-progression.json` —
  inferred from the Bren fixture, not a cited rule. Set the real number.
- [ ] **Sphere vocab is inconsistent** in the data (spells Title-case
  `"Conjuration"`, `grants_sphere` lowercase, Selene's sphere `"Mana"`). The
  builder's spell sphere filter is convenience-only because of this. Normalize
  the vocabulary if sphere-scoped filtering should be a real gate.
- [ ] **`.gitignore` `tsconfig.tsbuildinfo`** — build-cache artifact currently tracked.

## Next candidates (unblocked)

- [ ] Surface amp `stackable`/`stack_max` in the sheet's spell UI (stack counter).
- [ ] Codex skin: expose inventory / notes if wanted (currently sheet/builder only).
- [ ] Feat-choice sub-grants: some `choice` options grant nested spheres/spells —
  wire those into the Choices step's spell pools.

## Deferred (out of current scope)

- [ ] **R6 full 5e port** — porting the `merge/5edata` app + ~100MB 5etools
  dataset (see `review/06-5e-sheet.md`). Needs the external dataset + storage-key
  decision. Not started; B-lite skin covers the shared-UI groundwork.

See `review/07-builder-next.md` for the data-placement contract (where new-format
profession/origin/spell/item JSON goes).

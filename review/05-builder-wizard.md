# R5 — Builder Wizard (`builder.html`)

**Goal:** guided character creation/edit producing a valid `StoredCharacter`. The engine already
computes budgets and validation warnings — the wizard is UI over existing rules. Old wizard
reference: `merge/builder-1.0/components/CharacterBuilder.tsx` (step flow only; don't port code).

## Scaffold

- New Vite entry: `builder.html` + `src/pages/builder.tsx` + `src/views/builder/` (step components).
- Add input to `vite.config.ts` rollupOptions + entry HTML (copy sheet.html head).
- Roster gains "Edit in builder" per card + char-bar crumb "EDIT IN BUILDER →" (5edata pattern,
  nav via `CharStorage.setActive(id)` + `location.href`).
- Wizard state = a draft `StoredCharacter` (same two-layer discipline); "Save" writes to roster.

## Steps (each = component, left stepper nav, free back-navigation)

1. **Identity** — name, pronouns, portrait, tags.
2. **Profession** — card grid from `REGISTRY.professions` (description, favored attrs, resources,
   starting feats preview). Sets `profession_id`.
3. **Origin + Vocation** — origin cards → vocation sub-select (`REGISTRY.vocationsOf`);
   show pack contents + vocation attribute bonus + tier-0 feats.
4. **Feats & Tier** — `feats_purchased` spinner drives tier (show progression table);
   feat picker across profession + paths + origin pools filtered by:
   slot budgets per tier (`tierProgression.tiers[].slots` incl. tier-4 choice → `tier4_slot_choice`),
   prerequisites (`path_investment` / `origin_investment` counts — implement check in
   `src/core/` as `featEligibility(stored, feat)`, unit-tested; engine currently lacks this).
5. **Attributes & Skills** — point allocation against computed budgets
   (`attributeBudget`/`skillPointBudget` from `computeCharacter`), V.I.T.A.L.S. proficiency picks
   from profession `proficiencies.skills.from` (count-limited), expertise bumps.
6. **Choices & Spells** — render unresolved `choice`/`multi_choice` boons (reuse Feats-tab
   picker components), sphere/cantrip/known-spell selection against allowances
   (`spellcasting.knownAllowance` etc.), filtered by spheres.
7. **Starting pack** — profession `starting_pack` + origin `pack` → inventory items; pack slots
   like `"melee_weapon"` are catalog-category pickers; `misc {type:"choice"}` honored.
   Map pack strings → catalog: fuzzy name match, else free-text item; keep a
   `tools/`-style mapping table if matches are poor.
8. **Summary** — computed sheet preview (reuse rails read-only), warnings list must be empty
   (or explicitly acknowledged) before Save.

## Validation model

- Live `computeCharacter` on the draft each step; step badge shows warnings.
- New `src/core/validate-character.ts`: budget overspend, slot overflow, prereq violations,
  allowance overflow — shared by wizard + (later) validator fixture checks. Unit-test it.

## Verify

- Playwright: full create flow → land on sheet → numbers match hand-computed tier-1 character;
  edit existing character → change feat → sheet reflects.
- `npm test` includes `featEligibility` + `validate-character` suites.

## Notes

- Steps 4–6 are the only hard parts; 1–3, 7–8 are card grids + pickers.
- Don't block wizard on R4; text-only feats pick fine.
- Keep every step skippable (partial saves legal — sheet already tolerates empty build ids,
  proven by roster new-character flow).

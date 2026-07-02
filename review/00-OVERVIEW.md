# Post-Merge Work Plan — Overview

Roadmap for everything after the shipped Phases 0–3 (data foundation, engine, sheet UI, roster).
Each phase file in this folder is **self-contained**: a fresh agent session can open one file and
execute without re-deriving context. Execute phases in order unless noted independent.

## Ground rules (every phase)

1. **Invariants after every commit:**
   - `npm run validate` → GREEN (errors = 0; warning count may only go DOWN)
   - `npm test` → all pass (add tests when engine behavior changes)
   - `npx tsc --noEmit` → clean
2. **Data edits:** never edit generated content by re-running converters blindly —
   `npm run convert` re-reads `merge/builder-1.0/` and will OVERWRITE hand-edits to
   spells/items/origins/conditions. After Phase R2 begins (hand-edits in origins),
   do NOT re-run `convert-origins.mjs`. Retired-boon converter is idempotent and safe.
3. **User rulings:** batch questions per phase into ONE AskUserQuestion call (max 4 questions);
   put remaining rulings in a checklist file and let the user edit answers inline.
4. **Commit per phase step**, message explains why, not just what.
5. Update `review/STATUS.md` checkbox when a phase completes.

## Phase index

| Phase | File | What | Depends on | User input needed |
|---|---|---|---|---|
| R1 | `01-review-markers.md` | Review 96 `_review` markers (generated prose from retired-boon drops) | — | Low: spot rulings only |
| R2 | `02-origin-boons.md` | Author boons for 92 `_todo: port-boons` origin feats + 12 body→brawn rulings | — | **High: rulings batch** |
| R3 | `03-schema-reconcile.md` | Clear 33 validator warnings (enum drift, formula-in-number fields, resources) | — | Medium: schema-vs-data calls |
| R4 | `04-engine-coverage.md` | Upgrade render-as-text boon types to tracked UI (pools, counters, prep) | R3 helps | Low |
| R5 | `05-builder-wizard.md` | Character creation wizard (`builder.html`) | R2, R3 | Low |
| R6 | `06-5e-sheet.md` | 5e sheet skin reusing layout (MASTER-CONTEXT phase 3) | R5 optional | Medium: scope |

Recommended order: **R3 → R1 → R2 → R4 → R5 → R6.**
R3 first because it settles the schema vocabulary (enums, formula fields) that R1/R2 authoring
must write against — authoring before vocabulary is settled creates rework.

## Quick state audit commands

```bash
npm run validate                                   # error/warning counts + marker totals
node tools/validate-data.mjs 2>&1 | grep '~'       # each warning
grep -rl '_todo' data/ | wc -l                     # files still carrying port-boons TODOs
grep -c '_review' data/professions/*.json | grep -v ':0'   # review markers per profession file
```

## Key reference files

- `data/shared/boon-schema.json` — 59 live boon types, enums, retired map
- `data/shared/REFERENCE.md` — schema grammar + formulas (canon)
- `data/shared/TRACKING-SCOPE.md` — THE rule for boon vs description (read before any authoring)
- `src/core/boon-resolver.ts` + `src/core/compute.ts` — what the engine actually interprets
- `merge/builder-1.0/` — old project (read-only reference; source for converters)
- Memory: `poa-merge-plan-decisions` (locked user rulings — never re-ask those)

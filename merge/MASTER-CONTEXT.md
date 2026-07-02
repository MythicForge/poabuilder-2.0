# MASTER CONTEXT — Character System Merge

Single source of truth for the merge across all projects. If you're an AI assistant launched in any of the involved folders, read this first. Portable: this file can be copied into the other project folders to orient a fresh session.

---

## The goal

Merge three projects into one product. The **homebrew system ("Path of Ambition") is the core.** Build a character sheet for it, and a **5e sheet that reuses the layout only** (own rules, separate).

- **Homebrew is the system.** 5e is a second sheet skin reusing layout/components, NOT a merge of rules.
- **Reuse from old projects what's useful; starting from scratch is fine.** No obligation to port old code.

## The three projects

| Project | Role in the merge |
|---|---|
| `json-formating` (this repo) | **Merge target + data core.** Holds the homebrew content definitions and is where the merged product is built. |
| Old site A | _[fill: path + one-line role — e.g. the character sheet UI to reuse]_ |
| Old site B | _[fill: path + one-line role — e.g. holds old character data]_ |

Both old sites are **framework-based** (React/Vue/etc — confirm).

## What exists in the data core now (`json-formating`)

- **Content definitions only** — profession/path/origin JSON under `data/`, boon catalog (`data/shared/boon-schema.json`, 59 live / 53 retired), shared rules (`data/shared/REFERENCE.md` = schema grammar, `TRACKING-SCOPE.md` = tracked-vs-description rule).
- **Boon Forge** (`app/index.html`) — a **data-authoring tool. NOT part of the merged product.** Stays separate; it builds the definition JSON.
- **No character-instance schema and no character sheet UI yet.** These are what the merge adds.
- A copy of the runtime data the sheets consume is staged in `merge/data/` (see `merge/README.md`).

## Target structure (proposed)

```
/data              # single source of truth
  /shared /professions /origins
  /characters      # NEW — saved character instances
/app
  /boon-forge      # UNCHANGED — authoring tool, not part of the merge
  /character-sheet # NEW — homebrew sheet (reuse old or scratch)
  /sheet-5e        # NEW — 5e sheet, reuses layout, own rules
/packages/ui       # shared style tokens + components both sheets import
```

## Order of work

1. **DATA (blocking).** Define `character-schema.json` (+ `_character-template.json`), keyed by existing feat/boon `id`s. Needs the *shape* of an old saved character first → pull 3–5 real old characters + the old data model. Produce an old→new migration map.
2. **Sheet.** Build the homebrew character sheet (reuse old UI or scratch).
3. **5e sheet.** Reuse the layout, wire 5e data + rules.

## Open decisions

- No-build/single-file (like Boon Forge, runs from `file://`) **or** framework app (Vite + old sites' framework)? Given "open to scratch," a fresh Vite app is the clean default — confirm framework.
- Monorepo (one repo, shared data + apps) or keep repos separate and share only the data schema?
- Reuse Boon Forge's "midnight ledger" aesthetic (slate ink / vellum / ambition gold / rust; Zilla Slab + IBM Plex) or bring an old site's look?

## Intake checklist

What to pull from the old sites, in detail, is in `data/shared/MERGE-INTAKE.md`. **Minimum to start real work:** the three projects' roles above + 3–5 old saved characters + the old character schema.

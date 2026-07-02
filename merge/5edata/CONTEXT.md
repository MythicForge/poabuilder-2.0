# Merge Handoff — 5e Sheet Package

This folder is the handoff bundle answering `MERGE-INTAKE.md`. It is **Site B: the 5e character sheet** (Vite + React 18 + TypeScript, BG3 × 5e rule mods). Everything the intake doc asks for from this side is collected here, folder structure preserved.

> Source repo: `5e-sheet` (this repo). This is the sheet UI + character schema worth reusing for layout. It uses **5e rules** (with BG3 overrides), not the homebrew "Path of Ambition" system — so for the homebrew merge it is **layout/architecture reference**, and it stands as its own 5e sheet (Phase 3 target).

---

## Folder map (this bundle)

```
merge/
  CONTEXT.md          ← you are here
  src/                ← full sheet source tree (copied verbatim, structure intact)
  entry/              ← Vite multi-page HTML entry points
  config/             ← package.json, vite.config.ts, tsconfig*, CLAUDE.md (architecture ref)
  data-samples/       ← small schema-shaping data + one sample definition
  reference/          ← homebrew-format.md, src-restructure.md
```

Not copied (too large — reference in source repo): `data/` is ~100MB of 5etools SRD JSON (bestiary 17M, book 20M, adventure 45M, spells 2.2M, items 2.7M). Only the small schema-shaping files were pulled. Wire the full set from the source repo's `data/` or the upstream 5etools dataset.

---

## Phase 0 — Orientation

- **Tech:** Vite (multi-page) + React 18 + TypeScript. npm. Dev port 7822.
- **What it does:** browser D&D 5e character sheet with BG3 hybrid rules. Roster hub → builder → sheet, plus a GM view.
- **Rule system:** 5e + BG3 overrides (level cap 12, flat HP/level, d4 initiative, no attunement/components, kg carry). Not the homebrew system → migrate = N/A; this is layout + architecture reference and the standalone 5e sheet.
- **Character data:** stored in `localStorage` (roster array), no per-character files on disk.

---

## Phase 1 — DATA (character schema + save/load)

The two-layer state pattern is the core idea worth stealing.

- **Stored schema (what the user chose, persisted):** `src/core/types.ts` → `StoredChar` interface + all sub-interfaces. Also documented in `config/CLAUDE.md` → "Stored State Schema (STORED_5E)".
- **Computed model (all derived numbers):** `src/core/data-5e.ts` → `computeCharacter(stored)`. Returns AC, saves, skills, spell slots, resources, attacks — none of it stored. Key output fields listed in `config/CLAUDE.md` → "Computed Output".
- **Save/load (the persistence path):** `src/core/storage.ts` — `getRoster()`, `getActiveChar()`, `saveChar()`, `setActiveId()`, `deleteChar()`. Roster lives in `localStorage['bg3_roster']` (JSON array of `StoredChar` w/ `_lastModified`); active id in `localStorage['bg3_active']`.
- **Derived-vs-stored answer:** **stored = choices only** (race, classes+levels, point-buy base scores 8–15, ASI picks, chosen skills/feats, resource *current* counts, HP current/temp). **Everything numeric is recomputed** each render via `computeCharacter()` inside a `React.useMemo`. E.g. Vitality-equivalent (max HP) is NOT stored — recomputed from class hit die + level + CON.
- **Resources at runtime:** stored as raw **current** counts (`rages: N`, `kiPoints: N`, `sorceryPoints: N`, `pactSlots:{used}`, `custom:[{name,current,max,resetOn}]`); **max is computed** and merged back into full `{current,max,resetOn}` objects in the computed layer.
- **Ids / stable keys:** feats & content are keyed by 5etools `{name, source}` pairs (source dedup priority in `config/CLAUDE.md`). Items resolve via `src/core/item-resolve.ts` (custom override → registry fallback). Data loads through `src/core/data-registry.ts` (`REGISTRY` / `REGISTRY_PROMISE`).
- **No real saved-character file exists** (localStorage only). To get sample instances: run the app, build chars, dump `localStorage['bg3_roster']`. `data-samples/sample-class-def.json` is a *class definition* (5etools schema), included to show the definition shape the sheet consumes — NOT a character instance.

---

## Phase 2 — STYLE / LAYOUT / FUNCTION

Full component tree in `src/` (structure preserved). Highlights:

- **Page shells / layout:** `src/views/app-5e.tsx` (root, tab host, `TABS_5E` array), `src/views/sidebars-5e.tsx` (left/right rails), `src/views/builder-5e.tsx` (creation form + `blankChar()`), `src/views/my-characters.tsx` (roster UI), `src/views/gm-view.tsx`.
- **Tabs (the sheet regions):** `src/tabs/` — `combat-tab-5e.tsx`, `feat-tab-5e.tsx`, `invt-tab-5e.tsx`, `spell-tab-5e.tsx`, `notes-tab-5e.tsx`, `minion-tab-5e.tsx`. Barrel: `tabs-5e.tsx`.
- **Styling / design tokens:** `src/shared/styles.css` — ALL css, dark theme, CSS variables (gold text hierarchy, `--vitality` green, `--danger` red, card/border/text layers; fonts: Cormorant Garamond serif, IBM Plex Sans, JetBrains Mono). Reconcile against Boon Forge's "midnight ledger" (slate/vellum/ambition gold + Zilla Slab/IBM Plex) — both lean dark + gold, close enough to unify.
- **UI primitives / widgets:** `src/shared/primitives.tsx` (Spinner, Pill, StatCard, Icon, ScoreBox), `src/shared/condition-bar.tsx`. Resource +/- steppers, collapsible feat cards, inline edit live inside the tab components.
- **Interactivity pattern:** components read from `stored`, write via `setStored(s => ({...s, field: newVal}))`; computed `c` is read-only.

---

## Phase 3 — 5e SHEET (this repo IS the target)

- **5e data:** full 5etools SRD JSON in the source repo's `data/` (not copied — see above). Schema-shaping samples here: `data-samples/skills.json` (skill→ability map), `data-samples/backgrounds.json`.
- **Sheet regions + priority:** ability scores, skills, combat/attacks, spellcasting (slots/prepared), inventory, features — all already built (see Phase 2 tabs).
- **Ruleset:** 5e core with BG3 overrides (trimmed — level cap 12, max spell level 6, cantrip tiers 1/5/10). Override table in `config/CLAUDE.md`.

---

## Phase 4 — MERGE STRUCTURE notes

- Build type: **framework app (Vite + React + TS)** — matches intake's "fresh Vite" default. Multi-page config in `entry/` + `config/vite.config.ts`.
- Shared data core fits cleanly: this sheet already centralizes definitions through `data-registry.ts`; point it at the monorepo `/data`.
- Class mechanics are modular in `src/core/classes/*` (one file per class) via `class-mechanics-registry.ts` — good template for per-profession/path modules in the homebrew system.

---

## Start-here reading order

1. `config/CLAUDE.md` — full architecture (schema, computed model, registry, nav flow).
2. `src/core/types.ts` — `StoredChar` shape.
3. `src/core/data-5e.ts` — `computeCharacter()` (stored → derived).
4. `src/core/storage.ts` — persistence.
5. `src/views/app-5e.tsx` + `src/tabs/*` — layout to reuse.
6. `src/shared/styles.css` — design tokens.

# merge/ — data pulled from json-formating for the merged product

Copy of the **runtime data** the merged character sheet + 5e sheet will consume from this repo. This is the homebrew ("Path of Ambition") core the merge is built on.

## What's here (`merge/data/`)

- `shared/` — rules + catalogs the sheet reads:
  - `boon-schema.json` — boon type catalog (59 live / 53 retired), drives validation
  - `conditions.json`, `active-states.json` — status/toggle definitions
  - `universal-resources.json` — Ambition, Vitality, Wounds
  - `tier-progression.json` — tier thresholds / slots
  - `origin-feats.json` — origin feat pool
  - `REFERENCE.md` — human-readable schema grammar (field + boon reference)
  - `TRACKING-SCOPE.md` — the tracked-vs-description master rule
- `professions/` — 11 professions × (profession + 2 paths) + templates
- `origins/` — origin + vocation templates

## Intentionally NOT copied (stay in main repo)

- **Boon Forge** (`app/`) — data-authoring tool, not part of the merged product
- Authoring/tracking docs — `CONVERSION-PLAYBOOK.md`, `rule-check.md`, `to-do-list.md`, `.original.md` backups
- Profession `.md` sources at repo root — conversion inputs, not runtime data

## Still missing (not from this repo — bring from old sites)

- **`character-schema.json`** — no character-instance schema exists yet; must be designed
- Old saved characters (3–5 real) + old data model, for the schema + migration
- Sheet UI / style to reuse (or scratch)

See main-repo memory `merge-project` for the full plan.

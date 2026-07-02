# R1 — `_review` Marker Cleanup (96 → 0)

**Goal:** every `_review` marker resolved. Markers were written by `tools/convert-retired-boons.mjs`
(profession files) and `tools/convert-origins.mjs` (origin files). Each holds
`{ dropped_type, original, generated }` — the original boon is preserved losslessly, so nothing
is unrecoverable.

## Marker classes

1. **Dropped-to-prose** (majority): a retired describe-type boon was removed and a generated
   sentence appended to the nearest `description`. Task per marker:
   - Read the feat description; the generated sentence is machine-shaped
     (e.g. `Crit range expansion — rolls: [19,20]; condition: wielding_school_weapon.`).
   - Rewrite into natural rules text matching the surrounding voice
     (check `merge/builder-1.0/content/profession_feats.json` for the original wording —
     search by feat name; usually the old `description_markdown` already contains the rule
     in prose, so often the generated sentence can just be DELETED as redundant).
   - **Redundancy check first**: if the description already states the rule, delete the
     generated sentence + marker, done.
2. **Merge-transform flags** (6): aura/attribute_borrow/emulate_kit/bind_spells/inscribe_spell/
   store_spell conversions — verify field mapping is sane against boon-schema fields, fix state
   names (`aura` → meaningful state id), then delete marker.
3. **Origin `body` bonuses** (12, in `data/origins/origin-*.json`): DO NOT resolve here — they
   move to R2's ruling batch. Leave markers until R2.

## File worklist (marker counts)

```
18 data/professions/profession-elementalist-conduit.json
16 data/professions/elementalist.json
 9 data/professions/profession-agent-alchemist.json
 8 data/professions/profession-mage-artificer.json
 8 data/professions/profession-elementalist-kineticist.json
 4 data/professions/shaman.json
 4 data/professions/profession-mage-enchanter.json
 3 data/professions/profession-shaman-anima.json
 3 data/professions/profession-mercenary-freelancer.json
 2 data/professions/profession-warden-vanguard.json
 2 data/professions/profession-oathbound-arbiter.json
 2 data/professions/profession-berserker-frenzied.json
 1 each: mesmer, mage, mercenary, profession-fighter-reaver, profession-mesmer-weaver
(origin files: 12 body-ruling markers — R2 scope)
```

## Procedure (batch per file, biggest first)

1. `python3 - <<'EOF'` helper to list markers with context, or just open the file and search `_review`.
2. For each marker: apply class-1/class-2 treatment above. Delete the `_review` entry once
   resolved; delete the whole `_review` key when the array empties.
3. Where a ruling is genuinely ambiguous (rule text contradicts original boon fields), collect
   into `review/rulings-needed.md` under an R1 heading instead of guessing — continue working.
4. After each file: `npm run validate` (marker count must drop, no new errors). Commit per
   2–3 files: `data: resolve _review markers in <files>`.
5. End state: `validate` reports `_review markers: 12` (the origin body markers only), then R2
   takes them to 0.

## Efficiency notes

- The old prose is the ground truth for wording — `merge/builder-1.0/content/profession_feats.json`
  (grep feat name). Faster than inventing phrasing.
- Do NOT re-run `node tools/convert-retired-boons.mjs` after hand-editing: it is idempotent for
  boon types but will not restore deleted markers — safe, but pointless. Never `git checkout`
  a profession file without checking for hand-edits.
- Sub-agent parallelism: this phase is safely parallelizable per-file (no cross-file deps).
  3 agents × ~7 files each if speed matters; verify with a single validate run after merge.

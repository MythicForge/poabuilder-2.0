# R2 — Origin Boon Authoring (92 `_todo: port-boons` → 0) + 12 Body Rulings

**Goal:** every origin/vocation/universal feat either (a) gets authored `boons[]` for its tracked
effects, or (b) is confirmed description-only (delete `_todo`, leave `boons: []`). Plus resolve
the 12 `body → brawn?` attribute-bonus rulings.

## The rule (read first, always)

`data/shared/TRACKING-SCOPE.md`. Boon ONLY if BOTH:
1. changes a tracked quantity (stat/defense/resource/pool max/proficiency/spell list/use counter/
   state toggle/build selection), AND
2. condition is sheet-knowable (passive, equipment-gated, or active-state-gated).

Everything else stays description-only → just delete the `_todo` key. **Expect most origin feats
to be description-only** (Resolve/Strain grants, situational rerolls, narrative abilities) —
authoring restraint is correct behavior, not laziness.

## Step 1 — Body rulings (user input, do first)

12 vocations carry `_review` "+1 Body mapped to brawn; verify Brawn vs Finesse":

```
acolyte-pilgrim, apprentice-builder, boroughborn-city-watch, chosen-starborn,
commonfolk-mariner, cursed-exile, farmhand-fieldhand, guildmate-courier,
nobility-warfare, nomad-hunter, outlaw-brute, soldier-infantry
```

AskUserQuestion supports 4 questions max → do NOT ask 12 questions. Instead:
1. Propose defaults from flavor (physical-labor/martial → brawn; agility/stealth → finesse).
   Suggested defaults: brawn for builder, city-watch, fieldhand, warfare, brute, infantry, mariner;
   finesse for courier, hunter, pilgrim; judgment call: starborn, exile.
2. Write the 12 proposals into `review/rulings-needed.md` as a checklist; ask the user ONE
   question: "accept defaults / edit the file / walk through them".
3. Apply, delete those `_review` markers.

## Step 2 — Authoring pass (file by file)

Worklist (counts): acolyte 12, soldier 8, shared/origin-feats.json 6, chosen 5, cursed 4,
boroughborn 4, magic-initiate 4, nomad 3, commonfolk 3, then ~1–2 per remaining origin/vocation
file (see `grep -rc '_todo' data/origins/ | grep -v ':0'`).

Per feat:
1. Read `description`. Identify tracked effects per THE RULE.
2. Common patterns you WILL find and their boon shapes:
   - "+X maximum Vitality" → `{ "type": "stat_bonus", "stat": "Vitality Max", "amount": X }`
   - "gain proficiency with X" → `{ "type": "proficiency", ... }` (check boon-schema fields)
   - "learn spell/cantrip X" → `grants_known_spells` / `grants_cantrip` (verify spell id exists
     in `data/spells/spells.json`; missing spell = add to `review/rulings-needed.md`)
   - "start with 1 success on X checks" → `grants_free_success`
   - "once per respite/day ..." with tracked effect → feat-level `uses` field
     `{ "count": N, "recharge": "respite" | "daily_preparation" }` (NOT a boon)
   - "choose one of ..." at character build → `choice` boon with `key` (kebab-case, globally
     unique — grep existing keys first: `grep -rho '"key": "[a-z_-]*"' data/ | sort -u`)
   - Resolve/Strain on checks → description-only. Conditions inflicted on enemies →
     description-only. Movement/action economy → description-only.
3. Old `choice_features.json` cross-check: `merge/builder-1.0/content/choice_features.json`
   holds the old structured choices for origin features (search `entity_name`). If a feature had
   a choice there, port it as a `choice`/`multi_choice` boon (options + follow-up expertise
   grants; expertise → the skills system: note in rulings file if unclear).
4. Delete `_todo` when the feat is done (authored or confirmed description-only).

## Step 3 — Verify

- `npm run validate` → GREEN, `TODO port-boons: 0`, warnings not increased.
- Spot-render: `npm run dev`, open fixture Bren (origin soldier) + create a quick Acolyte
  character via roster → sheet must show new origin feats with working choice pickers/counters.
- Add 1 unit test: a character with an origin feat granting a tracked bonus (e.g. Vitality Max)
  asserts the computed number.

## Efficiency notes

- Parallelizable per-origin AFTER step 1 rulings land. Origin file + its vocation files = one
  work unit (shared flavor context).
- Commit per origin: `data: author boons for <origin> feats (N tracked, M description-only)`.
- When unsure tracked-vs-not: TRACKING-SCOPE quick test — "would the sheet store a value, flip a
  toggle, change a computed stat, or update a list, using only info it already has?" No → description.

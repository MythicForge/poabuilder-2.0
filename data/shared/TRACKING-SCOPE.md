# Tracking Scope — What Goes in `boons[]` vs `description`

**Canonical rule this database.** All feat data feed interactive character sheet. Sheet only compute/store *trackable* things. Rest show as text.

> Confirmed with designer via scope interview. Overrides earlier looser guidance.

---

## Master Rule

Effect belong in `boons[]` (TRACKED) only if **BOTH** true:

1. **Change tracked quantity** — one of:
   - core stat (attribute) or **defense** (Armor, Fortitude, Mental, Will Defense, or computed defense like Agile Defense)
   - **resource / pool** (reservoir, adrenaline, vessels, threads, etc.) or **resource max** (Vitality Max, Ambition Max)
   - **proficiency / spell / sphere / cantrip** list entry
   - **use-counter** (per skirmish / respite / day)
   - **active-state toggle** (see registry below)
   - **build selection** (Creed, Bloodline, Signature School, chosen Spell Shapes / Cords / Mantle / Manuscript, chosen Nemesis…) — store *which option picked*
   - granted **summon** stat block (planned/future, keep data)

2. **Condition sheet-knowable** — one of:
   - always-on / passive
   - equipment-based (e.g. light/no armor + no shield → Agile Defense)
   - gated on **tracked active-state** (e.g. +5 Fortitude *while Hidden*, because Hidden tracked state)

## Always Description-Only (never boon — fold into `description`)

- **Attack rolls** and **damage / healing output** (all dice/formulas player rolls). *Even inside tracked toggle-state:* Rage tracked toggle, but its "extra weapon die" is description.
- **Momentary / target-based conditions**: "on critical hit…", "vs Magical targets", "when attacking with Ambition", "vs your studied enemy".
- **Conditions inflicted on others** (Bleeding, Frightened, Dazed on target) — live on target / GM side.
- **Resolve / Strain** (advantage / disadvantage) — applied at instant of roll.
- **Information reveals / senses** (learn target resistances, probe thoughts, sense bloodline kin).
- **Action economy / AP-cost changes** (reduce Hide by 1 AP, free Disengage on crit, +1 AP from Adrenaline Rush).
- **Narrative abilities** (comprehend languages, can't be surprised, detect defiled places, autonomous floating weapon).
- **One-shot mitigation** ("reduce this hit by your Ambition die"). *Contrast:* granted **Reduction Pool / Temp Vitality** is persistent pool → TRACKED.

## Toggle-State Internals

Tracked active-state (Rage, Aura) store:
- **on/off** toggle, and
- its **defense / core-stat / resource modifiers** (tracked).

Its **attack/damage bonuses description-only**, shown while active.

## Build / Choice Feats

**Selection tracked** even when effects description. Example: Avowed Nemesis — player must know *current Nemesis* (changes how they apply feat description), so chosen Nemesis is tracked selection; Marked effects themselves description (enemy-side). Cursed (Shaman) fully enemy/GM-side → description.

## Data Shape

`boons[]` hold **only trackable mechanics**. Description-only effects written into feat `description` string, do **not** appear as boon objects. Keep boons array clean for sheet engine.

---

## Quick test

> "Would interactive sheet store value, flip toggle, change computed stat, or update list because of this — using only info sheet already has?"
> Yes → boon. No → description.
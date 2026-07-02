import React, { useState, useEffect, useMemo } from "react";
import {
  REGISTRY,
  REGISTRY_PROMISE,
  loadSpells,
  loadItems,
} from "../core/data-registry";
import type { RegistryItem } from "../core/types";
import { renderEntries, stripTags } from "../core/tag-renderer";
import { CharStorage } from "../core/storage";
import { loadRules } from "../core/campaign-rules";
import { PluginRegistry } from "../features/plugin-registry";
import {
  TweaksPanel,
  TweakSection,
  TweakToggle,
  TweakStepper,
  useTweaks,
} from "../features/tweaks-panel";
import { PluginSection } from "../features/plugin-panel";
import type {
  StoredChar,
  ASISlotChoice,
  RegistryOptionalFeature,
  RegistrySpell,
} from "../core/types";
import {
  recomputeArmorWeaponProfs,
  MULTICLASS_PROFS,
  REPLICATE_PLANS,
} from "../core/data-5e";

// ── Constants ─────────────────────────────────────────────────────────────────

const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type StatKey = (typeof STAT_KEYS)[number];

const STAT_SHORT: Record<StatKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};
const POINT_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
const HIT_DIE_FB: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  "Paladin (BG3)": 10,
  Ranger: 10,
  "Ranger (BG3)": 10,
  Monk: 8,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
  Artificer: 8,
  "Champion (TLotRR)": 10,
  "Captain (TLotRR)": 10,
  "Messenger (TLotRR)": 8,
  "Scholar (TLotRR)": 8,
  "Treasure Hunter (TLotRR)": 8,
  "Warden (TLotRR)": 10,
  "Apothecary (SCGtD)": 8,
  "Illrigger (IllR)": 10,
};
const HD_FIXED: Record<number, number> = { 6: 4, 8: 5, 10: 6, 12: 7 };
const SUBCLASS_LVL: Record<string, number> = {
  Cleric: 1,
  Sorcerer: 1,
  Warlock: 1,
  "Paladin (BG3)": 1,
  "Apothecary (SCGtD)": 1,
  Wizard: 2,
  Druid: 2,
  Barbarian: 3,
  Bard: 3,
  Fighter: 3,
  Monk: 3,
  Paladin: 3,
  Ranger: 3,
  "Ranger (BG3)": 3,
  Rogue: 3,
  Artificer: 3,
};

const ASI_LEVELS: Record<string, number[]> = {
  Fighter: [4, 6, 8, 12, 14, 16, 19],
  Rogue: [4, 8, 10, 12, 16, 18],
};
const ASI_LEVELS_DEFAULT = [4, 8, 12, 16, 19];

// Get max allowed darkvision (in BG3 ft) for a race/subrace — 0 = none, 40 = standard, 80 = superior
function getRaceMaxDarkvision(
  raceName: string,
  subraceName: string | null,
): number {
  const races = REGISTRY?.races ?? [];
  const raceObj = races.find((r) => r.name === raceName) as
    | Record<string, unknown>
    | undefined;
  if (!raceObj) return 0;
  let dv5e = (raceObj.darkvision as number | undefined) ?? 0;
  if (subraceName) {
    const sr = ((raceObj.subrace ?? []) as Record<string, unknown>[]).find(
      (s) => s.name === subraceName,
    );
    const srDv = (sr?.darkvision as number | undefined) ?? 0;
    if (srDv > dv5e) dv5e = srDv;
  }
  if (dv5e >= 120) return 80;
  if (dv5e >= 60) return 40;
  return 0;
}

// Returns true if the race/subrace grants a free feat (any)
function getRaceGrantsFeat(
  raceName: string,
  subraceName: string | null,
): boolean {
  const races = REGISTRY?.races ?? [];
  const raceObj = races.find((r) => r.name === raceName) as
    | Record<string, unknown>
    | undefined;
  if (!raceObj) return false;
  const raceFeats = raceObj.feats as Array<Record<string, unknown>> | undefined;
  if (raceFeats?.some((f) => f.any !== undefined)) return true;
  if (subraceName) {
    const sr = ((raceObj.subrace ?? []) as Record<string, unknown>[]).find(
      (s) => s.name === subraceName,
    );
    const srFeats = sr?.feats as Array<Record<string, unknown>> | undefined;
    if (srFeats?.some((f) => f.any !== undefined)) return true;
  }
  return false;
}

// Compute available ASI slots given current class selections
function getASISlots(classes: StoredChar["classes"]): { label: string }[] {
  const slots: { label: string }[] = [];
  for (const cls of classes) {
    const levels = ASI_LEVELS[cls.name] ?? ASI_LEVELS_DEFAULT;
    for (const lvl of levels) {
      if (cls.level >= lvl) slots.push({ label: `${cls.name} Lv ${lvl}` });
    }
  }
  return slots;
}

// ── Feature choice constants ──────────────────────────────────────────────────

// Fighting style featureType code per class
const FS_CLASS_CODE: Record<string, string> = {
  Fighter: "FS:F",
  Paladin: "FS:P",
  "Paladin (BG3)": "FS:P",
  Ranger: "FS:R",
  "Ranger (BG3)": "FS:R",
  Bard: "FS:B",
};
// Level at which class gains fighting style
const FS_GRANT_LEVEL: Record<string, number> = {
  Fighter: 1,
  Paladin: 2,
  "Paladin (BG3)": 2,
  Ranger: 2,
  "Ranger (BG3)": 2,
  Bard: 2,
};

// BG3 Ranger Favoured Enemy / Natural Explorer options
const BG3_FAVOURED_ENEMIES = [
  {
    value: "Bounty Hunter",
    label:
      "Bounty Hunter — Investigation prof; Ensnaring Strike targets have Disadvantage on save",
  },
  {
    value: "Keeper of the Veil",
    label:
      "Keeper of the Veil — Arcana prof; Protection from Evil and Good 1×/long rest",
  },
  {
    value: "Mage Breaker",
    label: "Mage Breaker — Arcana prof; True Strike cantrip",
  },
  {
    value: "Ranger Knight",
    label: "Ranger Knight — History prof + Heavy Armour prof",
  },
  {
    value: "Sanctified Stalker",
    label:
      "Sanctified Stalker — Religion prof; Sacred Flame cantrip (1d8 Radiant, WIS)",
  },
];
const BG3_NATURAL_EXPLORER = [
  { value: "Beast Tamer", label: "Beast Tamer — Find Familiar 1×/short rest" },
  { value: "Urban Tracker", label: "Urban Tracker — Sleight of Hand prof" },
  {
    value: "Wasteland Wanderer: Cold",
    label: "Wasteland Wanderer: Cold — Cold resistance",
  },
  {
    value: "Wasteland Wanderer: Fire",
    label: "Wasteland Wanderer: Fire — Fire resistance",
  },
  {
    value: "Wasteland Wanderer: Poison",
    label: "Wasteland Wanderer: Poison — Poison resistance",
  },
];
// Levels at which BG3 Ranger gains Favoured Enemy / Natural Explorer picks
const BG3_RANGER_PICK_LEVELS = [1, 6, 10];

// Invocation count by warlock level (BG3 lvl cap 12)
const INVOCATION_COUNT = (lvl: number) =>
  lvl >= 12 ? 6 : lvl >= 9 ? 5 : lvl >= 7 ? 4 : lvl >= 5 ? 3 : 2;

// Metamagic count by sorcerer level (BG3 lvl cap 12)
const METAMAGIC_COUNT = (lvl: number) => (lvl >= 10 ? 3 : 2);

// Elemental Discipline count by Monk level (Way of 4 Elements)
const ELEMENTAL_DISCIPLINE_COUNT = (lvl: number) =>
  lvl >= 11 ? 4 : lvl >= 6 ? 3 : 2;

// Maneuver count by Battle Master level (BG3 lvl cap 12)
const MANEUVER_COUNT = (lvl: number) => (lvl >= 10 ? 7 : lvl >= 7 ? 5 : 3);

// ── State helpers ─────────────────────────────────────────────────────────────

function loadSaved(): StoredChar | null {
  if (new URLSearchParams(window.location.search).get("new") === "1")
    return null;
  return CharStorage.getActiveChar();
}

function blankChar(): StoredChar {
  return {
    id: String(Date.now()),
    name: "",
    player: "",
    campaign: "",
    image: null,
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    startingEquipmentApplied: false,
    race: {
      name: "",
      subrace: null,
      source: "PHB",
      asiChoices: [
        { stat: "str", bonus: 2 },
        { stat: "dex", bonus: 1 },
      ],
      darkvision: 0,
      feat: undefined,
      variableTrait: undefined,
      variableSkill: undefined,
    },
    background: { name: "", source: "PHB", skillProficiencies: [] },
    classes: [{ name: "Fighter", subclass: null, source: "PHB", level: 1 }],
    abilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    levelASI: [],
    hp: { current: 0, temp: 0 },
    hitDiceRemaining: { d6: 0, d8: 0, d10: 0, d12: 0 },
    proficiencies: {
      skills: [],
      weapons: ["simple", "martial"],
      armor: ["light", "medium", "heavy", "shields"],
      tools: [],
      languages: ["Common"],
    },
    expertise: [],
    jackOfAllTrades: false,
    equipment: {
      meleeSet: { mainhand: null, offhand: null },
      rangedSet: { mainhand: null },
      armor: null,
      helmet: null,
      gloves: null,
      boots: null,
      cloak: null,
      ring1: null,
      ring2: null,
      amulet: null,
      inventory: [],
    },
    spellcasting: {
      slotsUsed: {} as Record<number, number>,
      cantrips: [],
      prepared: [],
      known: [],
    },
    resources: {
      rages: null,
      bardicInspiration: null,
      kiPoints: null,
      sorceryPoints: null,
      pactSlots: null,
      custom: [],
    },
    feats: [],
    asiSlots: [],
    conditions: {},
    vassals: [],
    activeInfusions: [],
    armorerModel: undefined,
    deathSaves: { successes: 0, failures: 0 },
    inspiration: false,
    exhaustion: 0,
    shortRestsUsed: 0,
    concentratingOn: null,
    featureChoices: {
      fightingStyles: [],
      featFightingStyleChoices: [],
      invocations: [],
      metamagic: [],
      maneuvers: [],
      favouredEnemies: [],
      naturalExplorer: [],
      elementalDisciplines: [],
      multiclassSkills: [],
      infusions: [],
    },
    notes: {
      personality: "",
      ideals: "",
      bonds: "",
      flaws: "",
      backstory: "",
      journal: [],
    },
    pluginData: PluginRegistry.getDefaultPluginData(),
  };
}

// ── Preview compute ───────────────────────────────────────────────────────────

function computePreview(s: StoredChar) {
  const hitDie = (n: string) =>
    REGISTRY?.classes?.[n]?.hitDie ?? HIT_DIE_FB[n] ?? 8;
  const totalLevel = s.classes.reduce((t, c) => t + (c.level ?? 0), 0);
  const prof = totalLevel <= 4 ? 2 : totalLevel <= 8 ? 3 : 4;
  const featASIList = [
    ...(s.asiSlots?.length
      ? s.asiSlots.flatMap((slot) =>
          slot.type === "feat" && slot.featAbilityChoice
            ? [{ stat: slot.featAbilityChoice, bonus: 1 }]
            : [],
        )
      : []),
    ...(s.race.featAbilityChoice
      ? [{ stat: s.race.featAbilityChoice, bonus: 1 }]
      : []),
  ];
  const effectiveLevelASI = [
    ...(s.asiSlots?.length
      ? s.asiSlots.flatMap((slot) =>
          slot.type === "bonus" ? (slot.bonuses ?? []) : [],
        )
      : (s.levelASI ?? [])),
    ...featASIList,
  ];
  const featBonus = (stat: StatKey) =>
    featASIList.filter((a) => a.stat === stat).reduce((t, a) => t + a.bonus, 0);
  const finalScore = (stat: StatKey) => {
    const base = s.abilityScores[stat] ?? 10;
    const race =
      (s.race?.asiChoices ?? []).find((a) => a.stat === stat)?.bonus ?? 0;
    const lvl = effectiveLevelASI
      .filter((a) => a.stat === stat)
      .reduce((t, a) => t + a.bonus, 0);
    return base + race + lvl;
  };
  const mod = (stat: StatKey) => Math.floor((finalScore(stat) - 10) / 2);
  const maxHP = s.classes
    .flatMap((c) => {
      const d = hitDie(c.name);
      return Array.from(
        { length: c.level ?? 0 },
        (_, i) => (i === 0 ? d : (HD_FIXED[d] ?? 5)) + mod("con"),
      );
    })
    .reduce((t, n) => t + n, 0);
  const pointsSpent = STAT_KEYS.reduce(
    (t, k) => t + (POINT_COST[s.abilityScores[k]] ?? 0),
    0,
  );
  return { totalLevel, prof, maxHP, mod, finalScore, featBonus, pointsSpent };
}

function getClassSkills(className: string): { from: string[]; count: number } {
  const cls = REGISTRY?.classes?.[className];
  if (!cls) return { from: [], count: 2 };
  type SkillProfs = {
    skills?: Array<{
      choose?: { from?: string[]; count?: number };
      any?: number;
    }>;
  };
  const skills = (cls.startingProfs as SkillProfs).skills ?? [];
  const entry = skills[0];
  if (!entry) return { from: [], count: 2 };
  // XPHB Bard (and possibly others) use {"any": N} — pick any N skills
  if (entry.any) {
    const allSkills = Object.keys(REGISTRY?.skills ?? {}).map((s) =>
      s.replace(/\b\w/g, (l) => l.toUpperCase()),
    );
    return { from: allSkills, count: entry.any };
  }
  const choose = entry.choose ?? {};
  const from = (choose.from ?? []).map((s) =>
    s.replace(/\b\w/g, (l) => l.toUpperCase()),
  );
  return { from, count: choose.count ?? 2 };
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function BLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.12em",
        color: "var(--text-faint)",
        marginBottom: 4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function BInput({
  value,
  onChange,
  placeholder = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        background: "var(--card-2)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "6px 8px",
        color: "var(--text)",
        fontFamily: "var(--sans)",
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function BSelect({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: Array<string | { value: string | number; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: "var(--card-2)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "6px 8px",
        color: "var(--text)",
        fontFamily: "var(--sans)",
        fontSize: 13,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : String(o.value);
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

function BSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      <div style={{ padding: "4px 0" }}>{children}</div>
    </div>
  );
}

function BRow({
  label,
  children,
  style,
}: {
  label?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <BLabel>{label}</BLabel>}
      {children}
    </div>
  );
}

function BGrid({
  cols = 2,
  children,
}: {
  cols?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

// ── Section: Identity ─────────────────────────────────────────────────────────

function SectionIdentity({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  return (
    <BSection title="Identity">
      <BRow label="Character Name">
        <BInput
          value={s.name}
          onChange={(v) => set({ name: v })}
          placeholder="Enter character name…"
        />
      </BRow>
      <BGrid>
        <BRow label="Player">
          <BInput
            value={s.player}
            onChange={(v) => set({ player: v })}
            placeholder="Player name"
          />
        </BRow>
        <BRow label="Campaign">
          <BInput
            value={s.campaign}
            onChange={(v) => set({ campaign: v })}
            placeholder="Campaign name"
          />
        </BRow>
      </BGrid>
    </BSection>
  );
}

// ── Section: Race ─────────────────────────────────────────────────────────────

/** Returns { classFilter, abilityKey } if the race+subrace combo grants a chooseable cantrip. */
function getRacialCantripGrant(
  raceName: string,
  subraceName: string | null,
): { classFilter: string; abilityKey: string } | null {
  if (!REGISTRY) return null;
  const raceObj = REGISTRY.races.find((r) => r.name === raceName);
  if (!raceObj) return null;

  // Check subrace additionalSpells
  if (subraceName) {
    const srObj = raceObj.subrace.find((sr) => sr.name === subraceName);
    if (srObj?.additionalSpells) {
      for (const asp of srObj.additionalSpells) {
        const known = asp.known ?? {};
        for (const lvlKey of Object.keys(known)) {
          const choices = (known as Record<string, unknown>)[lvlKey];
          if (
            choices &&
            typeof choices === "object" &&
            "_" in (choices as object)
          ) {
            for (const c of (choices as Record<string, unknown[]>)["_"] ?? []) {
              if (typeof c === "object" && c !== null && "choose" in c) {
                const choose = (c as { choose: string }).choose;
                const ability =
                  typeof asp.ability === "string" ? asp.ability : "int";
                return { classFilter: choose, abilityKey: ability };
              }
            }
          }
        }
      }
    }
  }

  // Check race-level additionalSpells (XPHB style with named variants)
  if (raceObj.additionalSpells) {
    for (const asp of raceObj.additionalSpells) {
      // Match variant to subrace name (e.g., asp.name="High Elf" vs subrace="High Elf")
      if (
        asp.name &&
        subraceName &&
        asp.name.toLowerCase() !== subraceName.toLowerCase()
      )
        continue;
      const known = asp.known ?? {};
      for (const lvlKey of Object.keys(known)) {
        const choices = (known as Record<string, unknown>)[lvlKey];
        if (
          choices &&
          typeof choices === "object" &&
          "_" in (choices as object)
        ) {
          for (const c of (choices as Record<string, unknown[]>)["_"] ?? []) {
            if (typeof c === "object" && c !== null && "choose" in c) {
              const choose = (c as { choose: string }).choose;
              const ability =
                typeof asp.ability === "string"
                  ? asp.ability
                  : ((asp.ability as { choose?: string[] })?.choose?.[0] ??
                    "int");
              return { classFilter: choose, abilityKey: ability };
            }
          }
        }
      }
    }
  }

  return null;
}

// ── Race Info Panel ───────────────────────────────────────────────────────────

function RaceInfoPanel({
  raceName,
  subraceName,
}: {
  raceName: string;
  subraceName: string | null;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [openFeature, setOpenFeature] = React.useState<string | null>(null);

  const races = REGISTRY?.races ?? [];
  const raceObj = races.find((r) => r.name === raceName) as
    | Record<string, unknown>
    | undefined;
  if (!raceObj) return null;

  // Stats header
  const speedRaw = raceObj.speed;
  const speedFt =
    typeof speedRaw === "number"
      ? speedRaw
      : speedRaw && typeof speedRaw === "object"
        ? ((speedRaw as Record<string, number>).walk ?? 30)
        : 30;
  const sizeArr = raceObj.size as string[] | undefined;
  const sizeLabel =
    sizeArr
      ?.map((s) =>
        s === "M" ? "Medium" : s === "S" ? "Small" : s === "L" ? "Large" : s,
      )
      .join("/") ?? "Medium";

  // Race features from entries
  interface RaceFeat {
    name: string;
    entries?: unknown[];
  }
  const raceEntries = (
    (raceObj.entries ?? []) as Record<string, unknown>[]
  ).filter(
    (e) => e.name && e.type !== "inset" && (e.entries || e.items),
  ) as unknown as RaceFeat[];

  // Subrace features
  const subraceObj = subraceName
    ? (((raceObj.subrace ?? []) as Record<string, unknown>[]).find(
        (sr) => sr.name === subraceName,
      ) as Record<string, unknown> | undefined)
    : undefined;
  const subraceEntries = subraceObj
    ? (((subraceObj.entries ?? []) as Record<string, unknown>[]).filter(
        (e) => e.name && (e.entries || e.items),
      ) as unknown as RaceFeat[])
    : [];

  if (raceEntries.length === 0 && subraceEntries.length === 0) return null;

  const toggleFeature = (key: string) =>
    setOpenFeature((prev) => (prev === key ? null : key));

  const renderFeatureBtn = (f: RaceFeat, keyPrefix: string) => {
    const key = `${keyPrefix}-${f.name}`;
    const isOpen = openFeature === key;
    const descEntries = (f.entries ?? []) as unknown[];
    const desc =
      isOpen && descEntries.length ? renderEntries(descEntries) : null;
    return (
      <span
        key={key}
        style={{ display: "inline-block", marginRight: 4, marginBottom: 4 }}
      >
        <button
          onClick={() => toggleFeature(key)}
          style={{
            padding: "2px 6px",
            borderRadius: 3,
            background: isOpen ? "var(--gold-dim)" : "var(--card-2)",
            border: `1px solid ${isOpen ? "var(--gold)" : "var(--border)"}`,
            color: isOpen ? "var(--gold-bright)" : "var(--text-muted)",
            fontFamily: "var(--sans)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {f.name}
        </button>
        {isOpen && desc && (
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 4,
              marginBottom: 4,
              lineHeight: 1.5,
              padding: "6px 8px",
              background: "var(--card-2)",
              borderRadius: 4,
              borderLeft: "2px solid var(--gold-dim)",
            }}
          >
            {desc}
          </div>
        )}
      </span>
    );
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      {/* Stats header */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--gold-dim)",
          letterSpacing: "0.08em",
          lineHeight: 1.8,
        }}
      >
        Speed: {speedFt}ft · Size: {sizeLabel}
        {raceEntries.length > 0 &&
          ` · ${raceEntries.length} trait${raceEntries.length !== 1 ? "s" : ""}`}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          marginTop: 6,
          padding: "2px 8px",
          background: "none",
          border: "1px solid var(--border-faint)",
          borderRadius: 4,
          color: "var(--text-faint)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          cursor: "pointer",
          letterSpacing: "0.1em",
        }}
      >
        {expanded ? "▲ HIDE TRAITS" : "▼ RACIAL TRAITS"}
      </button>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {raceEntries.map((f) => renderFeatureBtn(f, "race"))}
          {subraceEntries.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--gold-dim)",
                  letterSpacing: "0.1em",
                  marginBottom: 4,
                }}
              >
                {subraceName?.toUpperCase()} TRAITS
              </div>
              {subraceEntries.map((f) => renderFeatureBtn(f, "subrace"))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionRace({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const [spellsLoaded, setSpellsLoaded] = React.useState<
    RegistrySpell[] | null
  >(REGISTRY?.spells ?? null);
  const races = REGISTRY?.races ?? [];
  const raceObj = races.find((r) => r.name === s.race.name);
  const subraces = raceObj?.subrace ?? [];

  const cantripGrant = getRacialCantripGrant(s.race.name, s.race.subrace);
  const isCustomLineage = s.race.name === "Custom Lineage";
  const maxDarkvision = getRaceMaxDarkvision(s.race.name, s.race.subrace);
  const grantsFeat = getRaceGrantsFeat(s.race.name, s.race.subrace);

  // All skills for variable trait skill picker
  const allSkillNames = Object.keys(REGISTRY?.skills ?? {}).sort();

  // Lazy-load spells when cantrip grant is detected
  React.useEffect(() => {
    if (cantripGrant && !spellsLoaded) {
      loadSpells().then((sp) => setSpellsLoaded(sp));
    }
  }, [cantripGrant, spellsLoaded]);

  // All cantrips from loaded spells
  const allCantrips: RegistrySpell[] =
    spellsLoaded?.filter((sp) => sp.level === 0) ?? [];

  const allFeats = (REGISTRY?.feats ?? []) as Array<{
    name: string;
    entries?: unknown[];
  }>;

  const setAsi = (idx: number, stat: string) => {
    const choices = s.race.asiChoices.map((a, i) =>
      i === idx ? { ...a, stat } : a,
    );
    set({ race: { ...s.race, asiChoices: choices } });
  };

  const changeRace = (name: string) => {
    const newMaxDv = getRaceMaxDarkvision(name, null);
    set({
      race: {
        ...s.race,
        name,
        subrace: null,
        feat: undefined,
        featAbilityChoice: undefined,
        variableTrait: undefined,
        variableSkill: undefined,
        darkvision: Math.min(s.race.darkvision, newMaxDv),
      },
    });
  };

  const changeSubrace = (v: string) => {
    const newSub = v || null;
    const newMaxDv = getRaceMaxDarkvision(s.race.name, newSub);
    set({
      race: {
        ...s.race,
        subrace: newSub,
        darkvision: Math.min(s.race.darkvision, newMaxDv),
      },
    });
  };

  const setVariableTrait = (choice: "darkvision" | "skill") => {
    const newDv = choice === "darkvision" ? 40 : 0;
    set({
      race: {
        ...s.race,
        variableTrait: choice,
        darkvision: newDv,
        variableSkill:
          choice === "skill" ? (s.race.variableSkill ?? "") : undefined,
      },
    });
  };

  // When cantrip is chosen in the picker, add it to spellcasting.cantrips
  const toggleRacialCantrip = (key: string) => {
    const cur = s.spellcasting.cantrips;
    if (cur.includes(key)) {
      set({
        spellcasting: {
          ...s.spellcasting,
          cantrips: cur.filter((c) => c !== key),
        },
      });
    } else {
      set({ spellcasting: { ...s.spellcasting, cantrips: [...cur, key] } });
    }
  };

  // Darkvision options filtered to what the race can have
  const dvOptions = [
    { value: 0, label: "None" },
    ...(maxDarkvision >= 40
      ? [{ value: 40, label: "Standard — 40ft (12m)" }]
      : []),
    ...(maxDarkvision >= 80
      ? [{ value: 80, label: "Superior — 80ft (24m)" }]
      : []),
  ];

  return (
    <BSection title="Race">
      <BRow label="Race">
        <BSelect
          value={s.race.name}
          onChange={changeRace}
          options={[
            { value: "", label: "— Select Race —" },
            ...races.map((r) => r.name).sort(),
          ]}
        />
      </BRow>
      {subraces.length > 0 && (
        <BRow label="Subrace">
          <BSelect
            value={s.race.subrace ?? ""}
            onChange={changeSubrace}
            options={[
              { value: "", label: "— None —" },
              ...subraces.map((sr) => sr.name),
            ]}
          />
        </BRow>
      )}
      <BRow label="Flexible ASI — BG3: +2 to one · +1 to another">
        <BGrid>
          <div>
            <BLabel>+2 to</BLabel>
            <BSelect
              value={s.race.asiChoices[0]?.stat ?? "str"}
              onChange={(v) => setAsi(0, v)}
              options={STAT_KEYS.map((k) => ({
                value: k,
                label: STAT_SHORT[k],
              }))}
            />
          </div>
          <div>
            <BLabel>+1 to</BLabel>
            <BSelect
              value={s.race.asiChoices[1]?.stat ?? "dex"}
              onChange={(v) => setAsi(1, v)}
              options={STAT_KEYS.map((k) => ({
                value: k,
                label: STAT_SHORT[k],
              }))}
            />
          </div>
        </BGrid>
      </BRow>
      {/* Darkvision — only shown when race can have it, hidden for Custom Lineage (handled via Variable Trait) */}
      {!isCustomLineage && maxDarkvision > 0 && (
        <BRow label="Darkvision">
          <BSelect
            value={s.race.darkvision}
            onChange={(v) =>
              set({ race: { ...s.race, darkvision: Number(v) } })
            }
            options={dvOptions}
          />
        </BRow>
      )}
      {/* Custom Lineage Variable Trait: darkvision OR skill proficiency */}
      {isCustomLineage && (
        <BRow label="Variable Trait">
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {(["darkvision", "skill"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setVariableTrait(opt)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  background:
                    s.race.variableTrait === opt
                      ? "var(--gold-dim)"
                      : "var(--card-2)",
                  border: `1px solid ${s.race.variableTrait === opt ? "var(--gold)" : "var(--border)"}`,
                  color:
                    s.race.variableTrait === opt
                      ? "var(--gold-bright)"
                      : "var(--text-muted)",
                }}
              >
                {opt === "darkvision" ? "Darkvision 40ft" : "Skill Proficiency"}
              </button>
            ))}
          </div>
          {s.race.variableTrait === "skill" && (
            <BSelect
              value={s.race.variableSkill ?? ""}
              onChange={(v) => set({ race: { ...s.race, variableSkill: v } })}
              options={[
                { value: "", label: "— Choose Skill —" },
                ...allSkillNames.map((sk) => ({ value: sk, label: sk })),
              ]}
            />
          )}
        </BRow>
      )}
      {/* Race Feat picker for Human (Variant), Custom Lineage, etc. */}
      {grantsFeat && (
        <BRow label="Race Feat">
          <BSelect
            value={s.race.feat ?? ""}
            onChange={(v) =>
              set({
                race: {
                  ...s.race,
                  feat: v || undefined,
                  featAbilityChoice: undefined,
                },
              })
            }
            options={[
              { value: "", label: "— Select Feat —" },
              ...allFeats.map((f) => f.name).sort(),
            ]}
          />
          {s.race.feat &&
            (() => {
              const feat = allFeats.find((f) => f.name === s.race.feat);
              const desc = feat?.entries?.length
                ? renderEntries(feat.entries as unknown[])
                : null;
              const featAbilityFrom =
                ((
                  feat as unknown as {
                    ability?: Array<{ choose?: { from?: string[] } }>;
                  }
                )?.ability ?? [])[0]?.choose?.from ?? [];
              return (
                <>
                  {featAbilityFrom.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--text-faint)",
                          letterSpacing: "0.1em",
                          marginBottom: 4,
                        }}
                      >
                        ABILITY SCORE INCREASE (+1)
                      </div>
                      <BSelect
                        value={s.race.featAbilityChoice ?? ""}
                        onChange={(stat) =>
                          set({
                            race: {
                              ...s.race,
                              featAbilityChoice: stat || undefined,
                            },
                          })
                        }
                        options={[
                          { value: "", label: "— Choose stat —" },
                          ...featAbilityFrom.map((k) => ({
                            value: k,
                            label: k.toUpperCase(),
                          })),
                        ]}
                      />
                    </div>
                  )}
                  {desc ? (
                    <div
                      style={{
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        color: "var(--text-muted)",
                        marginTop: 6,
                        lineHeight: 1.5,
                        padding: "6px 8px",
                        background: "var(--card-2)",
                        borderRadius: 4,
                        borderLeft: "2px solid var(--gold-dim)",
                      }}
                    >
                      {desc}
                    </div>
                  ) : null}
                </>
              );
            })()}
        </BRow>
      )}
      {cantripGrant && (
        <BRow
          label={`Racial Cantrip — ${cantripGrant.abilityKey.toUpperCase()} is spellcasting ability`}
        >
          {allCantrips.length === 0 ? (
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--text-faint)",
              }}
            >
              Loading spells…
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                Choose 1 cantrip:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {allCantrips
                  .filter(
                    (sp, idx, arr) =>
                      arr.findIndex((x) => x.name === sp.name) === idx,
                  )
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((sp) => {
                    const key = `${sp.name.toLowerCase().replace(/ /g, " ")}|${sp.source.toLowerCase()}`;
                    const isOn = s.spellcasting.cantrips.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleRacialCantrip(key)}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontFamily: "var(--sans)",
                          fontSize: 13,
                          background: isOn
                            ? "var(--gold-dim)"
                            : "var(--card-2)",
                          border: `1px solid ${isOn ? "var(--gold)" : "var(--border)"}`,
                          color: isOn ? "var(--gold-bright)" : "var(--text)",
                        }}
                      >
                        {sp.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </BRow>
      )}
      {s.race.name && (
        <RaceInfoPanel raceName={s.race.name} subraceName={s.race.subrace} />
      )}
    </BSection>
  );
}

// ── Section: Class ────────────────────────────────────────────────────────────

function SectionClass({
  s,
  set,
  levelCap = 12,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
  levelCap?: number;
}) {
  const classNames = REGISTRY
    ? Object.keys(REGISTRY.classes).sort()
    : Object.keys(HIT_DIE_FB).sort();
  const totalLevel = s.classes.reduce((t, c) => t + (c.level ?? 0), 0);

  const changeClass = (idx: number, name: string) => {
    const classes = s.classes.map((c, i) =>
      i === idx ? { ...c, name, subclass: null } : c,
    );
    const { armor, weapons } = recomputeArmorWeaponProfs(classes);
    const primaryName = idx === 0 ? name : s.classes[0].name;
    const { from: primaryPool } = getClassSkills(primaryName);
    const bgSkills = s.background.skillProficiencies;
    const keptSkills = s.proficiencies.skills.filter(
      (sk) => bgSkills.includes(sk) || primaryPool.includes(sk),
    );
    // Secondary class change: clear multiclass skill picks (player must repick for new class)
    const mcSkills = idx > 0 ? [] : (s.featureChoices?.multiclassSkills ?? []);
    set({
      classes,
      proficiencies: { ...s.proficiencies, skills: keptSkills, armor, weapons },
      ...(idx === 0 && { jackOfAllTrades: ["Bard", "Rogue"].includes(name) }),
      featureChoices: {
        ...(s.featureChoices ?? {
          fightingStyles: [],
          featFightingStyleChoices: [],
          invocations: [],
          metamagic: [],
          maneuvers: [],
          favouredEnemies: [],
          naturalExplorer: [],
          elementalDisciplines: [],
          multiclassSkills: [],
        }),
        multiclassSkills: mcSkills,
      },
    });
  };

  const changeLevel = (idx: number, delta: number) => {
    const newLevel = (s.classes[idx].level ?? 1) + delta;
    if (newLevel < 1) return;
    if (delta > 0 && totalLevel >= levelCap) return;
    const classes = s.classes.map((c, i) =>
      i === idx ? { ...c, level: newLevel } : c,
    );
    set({ classes });
  };

  const changeSubclass = (idx: number, subclass: string) => {
    const classes = s.classes.map((c, i) =>
      i === idx ? { ...c, subclass: subclass || null } : c,
    );
    set({ classes });
  };

  const addClass = () => {
    if (totalLevel >= levelCap || s.classes.length >= 3) return;
    const newClasses = [
      ...s.classes,
      { name: "Fighter", subclass: null, source: "PHB", level: 1 },
    ];
    const { armor, weapons } = recomputeArmorWeaponProfs(newClasses);
    set({
      classes: newClasses,
      proficiencies: { ...s.proficiencies, armor, weapons },
    });
  };

  const removeClass = () => {
    if (s.classes.length <= 1) return;
    const newClasses = s.classes.slice(0, -1);
    const { armor, weapons } = recomputeArmorWeaponProfs(newClasses);
    set({
      classes: newClasses,
      proficiencies: { ...s.proficiencies, armor, weapons },
      featureChoices: {
        ...(s.featureChoices ?? {
          fightingStyles: [],
          featFightingStyleChoices: [],
          invocations: [],
          metamagic: [],
          maneuvers: [],
          favouredEnemies: [],
          naturalExplorer: [],
          elementalDisciplines: [],
          multiclassSkills: [],
        }),
        multiclassSkills: [],
      },
    });
  };

  return (
    <BSection title="Class">
      {s.classes.map((c, idx) => {
        const subclasses = (REGISTRY?.classes?.[c.name]?.subclasses ??
          []) as Array<{ name: string; source?: string }>;
        const unlockAt = SUBCLASS_LVL[c.name] ?? 3;
        const showSub = c.level >= unlockAt;
        return (
          <div
            key={idx}
            style={{ marginBottom: idx < s.classes.length - 1 ? 20 : 8 }}
          >
            {s.classes.length > 1 && <BLabel>Class {idx + 1}</BLabel>}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <BSelect
                value={c.name}
                onChange={(v) => changeClass(idx, v)}
                options={classNames}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => changeLevel(idx, -1)}
                  style={{
                    width: 26,
                    height: 30,
                    background: "var(--card-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 15,
                    color: "var(--gold)",
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {c.level}
                </span>
                <button
                  onClick={() => changeLevel(idx, 1)}
                  style={{
                    width: 26,
                    height: 30,
                    background: "var(--card-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  +
                </button>
              </div>
            </div>
            {showSub && subclasses.length > 0 && (
              <BRow label={`Subclass (unlocks at ${unlockAt})`}>
                <BSelect
                  value={c.subclass ?? ""}
                  onChange={(v) => changeSubclass(idx, v)}
                  options={[
                    { value: "", label: "— Not yet chosen —" },
                    ...subclasses.map((sc) => ({
                      value: sc.name,
                      label:
                        sc.source === "XPHB" ? `${sc.name} ('24)` : sc.name,
                    })),
                  ]}
                />
              </BRow>
            )}
            {idx > 0 &&
              (() => {
                const mcCount = MULTICLASS_PROFS[c.name]?.skillCount ?? 0;
                if (mcCount === 0) return null;
                const { from: mcPool } = getClassSkills(c.name);
                const mcChosen = s.featureChoices?.multiclassSkills ?? [];
                const toggleMcSkill = (skill: string) => {
                  const curr = s.featureChoices?.multiclassSkills ?? [];
                  const next = curr.includes(skill)
                    ? curr.filter((x) => x !== skill)
                    : curr.length < mcCount
                      ? [...curr, skill]
                      : curr;
                  set({
                    featureChoices: {
                      ...(s.featureChoices ?? {
                        fightingStyles: [],
                        featFightingStyleChoices: [],
                        invocations: [],
                        metamagic: [],
                        maneuvers: [],
                        favouredEnemies: [],
                        naturalExplorer: [],
                        elementalDisciplines: [],
                        multiclassSkills: [],
                      }),
                      multiclassSkills: next,
                    },
                  });
                };
                return (
                  <div style={{ marginTop: 8 }}>
                    <BLabel>
                      Multiclass skill — pick {mcCount} ({mcChosen.length}/
                      {mcCount})
                    </BLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {mcPool.map((skill) => {
                        const isOn = mcChosen.includes(skill);
                        const maxed = !isOn && mcChosen.length >= mcCount;
                        return (
                          <button
                            key={skill}
                            onClick={() => toggleMcSkill(skill)}
                            style={{
                              padding: "3px 9px",
                              borderRadius: 4,
                              cursor: maxed ? "default" : "pointer",
                              fontFamily: "var(--sans)",
                              fontSize: 14,
                              background: isOn
                                ? "var(--vitality)"
                                : "var(--card-2)",
                              border: `1px solid ${isOn ? "var(--vitality)" : "var(--border)"}`,
                              color: isOn ? "var(--bg)" : "var(--text)",
                              opacity: maxed ? 0.35 : 1,
                            }}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            <ClassInfoPanel
              className={c.name}
              subclassName={c.subclass}
              currentLevel={c.level}
            />
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {s.classes.length < 3 && totalLevel < levelCap && (
          <button
            onClick={addClass}
            style={{
              padding: "4px 10px",
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            + MULTICLASS
          </button>
        )}
        {s.classes.length > 1 && (
          <button
            onClick={removeClass}
            style={{
              padding: "4px 10px",
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--danger)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            − REMOVE LAST
          </button>
        )}
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-faint)",
            marginLeft: "auto",
          }}
        >
          {totalLevel} / {levelCap} levels
        </span>
      </div>
    </BSection>
  );
}

// ── Class Info Panel ──────────────────────────────────────────────────────────

function ClassInfoPanel({
  className,
  subclassName,
  currentLevel,
}: {
  className: string;
  subclassName: string | null;
  currentLevel: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [openFeature, setOpenFeature] = React.useState<string | null>(null);

  const regCls = REGISTRY?.classes?.[className];
  if (!regCls) return null;

  // Stats header
  const hitDie = regCls.hitDie ?? 8;
  const saves =
    (regCls.saveProficiencies ?? []).map((s) => s.toUpperCase()).join(" / ") ||
    "—";
  const profs = regCls.startingProfs as Record<string, unknown> | undefined;
  const armorList =
    (profs?.armor as string[] | undefined)?.join(", ") || "none";
  const weaponList =
    (profs?.weapons as string[] | undefined)
      ?.slice(0, 3)
      .map((w) => stripTags(w))
      .join(", ") || "simple";
  const spellAbil = regCls.spellcastingAbility
    ? regCls.spellcastingAbility.toUpperCase()
    : null;

  // Class features grouped by level
  const features = (regCls.features ?? []) as Array<{
    name: string;
    level: number;
    entries?: unknown[];
  }>;
  const byLevel = new Map<number, typeof features>();
  for (const f of features) {
    if (!byLevel.has(f.level)) byLevel.set(f.level, []);
    byLevel.get(f.level)!.push(f);
  }
  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);

  // Subclass features
  const scData = subclassName
    ? (
        regCls.subclasses as Array<{
          name: string;
          shortName?: string;
          source?: string;
        }>
      )?.find((sc) => sc.name === subclassName)
    : null;
  const scShortName = scData?.shortName ?? subclassName;
  const scSource = scData?.source;
  const scFeatures = subclassName
    ? (regCls.subclassFeatures ?? []).filter(
        (f: {
          subclassShortName: string;
          source?: string;
          entries?: unknown[];
          level: number;
          isClassFeatureVariant?: boolean;
        }) =>
          f.subclassShortName === scShortName &&
          (!scSource || f.source === scSource) &&
          f.entries?.length &&
          !f.isClassFeatureVariant &&
          f.level <= currentLevel,
      )
    : [];

  const toggleFeature = (key: string) =>
    setOpenFeature((prev) => (prev === key ? null : key));

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      {/* Stats header */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--gold-dim)",
          letterSpacing: "0.08em",
          lineHeight: 1.8,
        }}
      >
        d{hitDie} · Saves: {saves} · Armor: {armorList} · Weapons: {weaponList}
        {spellAbil && <span> · Spells: {spellAbil}</span>}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          marginTop: 6,
          padding: "2px 8px",
          background: "none",
          border: "1px solid var(--border-faint)",
          borderRadius: 4,
          color: "var(--text-faint)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          cursor: "pointer",
          letterSpacing: "0.1em",
        }}
      >
        {expanded ? "▲ HIDE FEATURES" : "▼ CLASS FEATURES"}
      </button>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {sortedLevels.map((lvl) => {
            const locked = lvl > currentLevel;
            return (
              <div
                key={lvl}
                style={{ marginBottom: 4, opacity: locked ? 0.4 : 1 }}
              >
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--text-faint)",
                    marginRight: 6,
                  }}
                >
                  LV {lvl}
                  {locked && " 🔒"}
                </span>
                {byLevel.get(lvl)!.map((f) => {
                  const key = `${lvl}-${f.name}`;
                  const isOpen = openFeature === key;
                  const desc =
                    isOpen && f.entries?.length
                      ? renderEntries(f.entries as unknown[])
                      : null;
                  return (
                    <span
                      key={f.name}
                      style={{
                        display: "inline-block",
                        marginRight: 4,
                        marginBottom: 2,
                      }}
                    >
                      <button
                        onClick={() => !locked && toggleFeature(key)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: isOpen
                            ? "var(--gold-dim)"
                            : "var(--card-2)",
                          border: `1px solid ${isOpen ? "var(--gold)" : "var(--border)"}`,
                          color: isOpen
                            ? "var(--gold-bright)"
                            : "var(--text-muted)",
                          fontFamily: "var(--sans)",
                          fontSize: 13,
                          cursor: locked ? "default" : "pointer",
                        }}
                      >
                        {f.name}
                      </button>
                      {isOpen && desc && (
                        <div
                          style={{
                            fontFamily: "var(--sans)",
                            fontSize: 13,
                            color: "var(--text-muted)",
                            marginTop: 4,
                            marginBottom: 4,
                            lineHeight: 1.5,
                            padding: "6px 8px",
                            background: "var(--card-2)",
                            borderRadius: 4,
                            borderLeft: "2px solid var(--gold-dim)",
                          }}
                        >
                          {desc}
                        </div>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}

          {/* Subclass features */}
          {scFeatures.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--gold-dim)",
                  letterSpacing: "0.1em",
                  marginBottom: 4,
                }}
              >
                {subclassName?.toUpperCase()} FEATURES
              </div>
              {(
                scFeatures as Array<{
                  name: string;
                  level: number;
                  entries?: unknown[];
                }>
              ).map((f) => {
                const key = `sc-${f.level}-${f.name}`;
                const isOpen = openFeature === key;
                const desc =
                  isOpen && f.entries?.length
                    ? renderEntries(f.entries as unknown[])
                    : null;
                return (
                  <span
                    key={key}
                    style={{
                      display: "inline-block",
                      marginRight: 4,
                      marginBottom: 2,
                    }}
                  >
                    <button
                      onClick={() => toggleFeature(key)}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: isOpen
                          ? "var(--gold-dim)"
                          : "var(--card-2)",
                        border: `1px solid ${isOpen ? "var(--gold)" : "var(--border)"}`,
                        color: isOpen
                          ? "var(--gold-bright)"
                          : "var(--text-muted)",
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {f.name}{" "}
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        Lv{f.level}
                      </span>
                    </button>
                    {isOpen && desc && (
                      <div
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          marginTop: 4,
                          marginBottom: 4,
                          lineHeight: 1.5,
                          padding: "6px 8px",
                          background: "var(--card-2)",
                          borderRadius: 4,
                          borderLeft: "2px solid var(--gold-dim)",
                        }}
                      >
                        {desc}
                      </div>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section: Feature Choices ──────────────────────────────────────────────────

function MultiPicker({
  label,
  items,
  chosen,
  max,
  onToggle,
}: {
  label: string;
  items: RegistryOptionalFeature[];
  chosen: string[];
  max: number;
  onToggle: (name: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const [activeInfo, setActiveInfo] = React.useState<string | null>(null);
  if (items.length === 0) return null;

  const cleanDesc = (item: RegistryOptionalFeature) =>
    typeof item.entries[0] === "string"
      ? (item.entries[0] as string).replace(
          /\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g,
          "$1",
        )
      : "";

  const activeItem = activeInfo
    ? items.find((f) => f.name === activeInfo)
    : null;
  const activeDesc = activeItem ? cleanDesc(activeItem) : "";

  return (
    <BRow label={`${label} — pick ${max} (${chosen.length}/${max})`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          marginBottom: 6,
          padding: "2px 8px",
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--text-faint)",
          fontFamily: "var(--mono)",
          fontSize: 11,
          cursor: "pointer",
          letterSpacing: "0.1em",
        }}
      >
        {expanded ? "▲ COLLAPSE" : "▼ EXPAND"}
      </button>
      {expanded && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {items.map((item) => {
              const isOn = chosen.includes(item.name);
              const maxed = !isOn && chosen.length >= max;
              const isInfoActive = activeInfo === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (!maxed) onToggle(item.name);
                    setActiveInfo((prev) =>
                      prev === item.name ? null : item.name,
                    );
                  }}
                  title={cleanDesc(item)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 4,
                    cursor: maxed && !isInfoActive ? "default" : "pointer",
                    fontFamily: "var(--sans)",
                    fontSize: 14,
                    background: isOn ? "var(--gold-dim)" : "var(--card-2)",
                    border: `1px solid ${isOn ? "var(--gold)" : isInfoActive ? "var(--gold-dim)" : "var(--border)"}`,
                    color: isOn ? "var(--gold-bright)" : "var(--text)",
                    opacity: maxed && !isInfoActive ? 0.35 : 1,
                  }}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
          {activeDesc && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "var(--card)",
                border: "1px solid var(--border-faint)",
                borderRadius: 4,
                fontFamily: "var(--sans)",
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--gold)",
                  marginRight: 8,
                }}
              >
                {activeInfo}
              </span>
              {activeDesc}
            </div>
          )}
        </>
      )}
    </BRow>
  );
}

function SectionFeatureChoices({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const fc = s.featureChoices ?? {
    fightingStyles: [],
    featFightingStyleChoices: [],
    invocations: [],
    metamagic: [],
    maneuvers: [],
    favouredEnemies: [],
    naturalExplorer: [],
    elementalDisciplines: [],
  };
  const optFeats = REGISTRY?.optionalFeatures ?? [];

  const setFC = (update: Partial<StoredChar["featureChoices"]>) => {
    set({ featureChoices: { ...fc, ...update } });
  };

  const toggleList = (
    list: keyof StoredChar["featureChoices"],
    name: string,
    max: number,
  ) => {
    const cur = (fc[list] as string[]) ?? [];
    const next = cur.includes(name)
      ? cur.filter((x) => x !== name)
      : cur.length < max
        ? [...cur, name]
        : cur;
    setFC({ [list]: next });
  };

  // Pre-compute max counts from classes (feat bonuses applied after)
  let mmMax = 0,
    eiMax = 0,
    maneuverMax = 0,
    edMax = 0,
    infusionMax = 0,
    efaLevel = 0;
  for (const cls of s.classes) {
    if (cls.name === "Sorcerer" && cls.level >= 3)
      mmMax = METAMAGIC_COUNT(cls.level);
    if (cls.name === "Warlock" && cls.level >= 2)
      eiMax = INVOCATION_COUNT(cls.level);
    if (
      cls.name === "Fighter" &&
      cls.subclass === "Battle Master" &&
      cls.level >= 3
    )
      maneuverMax = MANEUVER_COUNT(cls.level);
    if (
      cls.name === "Monk" &&
      (cls.subclass === "Way of the Four Elements" ||
        cls.subclass === "Warrior of the Elements") &&
      cls.level >= 3
    )
      edMax = ELEMENTAL_DISCIPLINE_COUNT(cls.level);
    if (cls.name === "Artificer" && cls.level >= 2) {
      efaLevel = cls.level;
      infusionMax = cls.level >= 10 ? 6 : cls.level >= 6 ? 5 : 4;
    }
  }

  // Collect all feat names from every source (ASI slots, race, background)
  const bgEntry = (
    REGISTRY?.backgrounds as
      | Array<{ name: string; backgroundFeat?: string }>
      | undefined
  )?.find((b) => b.name === s.background.name);
  const bgFeatName = bgEntry?.backgroundFeat?.replace(/\s*\(.*\)$/, "");
  const allFeatNames: string[] = [
    ...s.feats, // already includes all ASI-slot feats (synced by updateSlot)
    ...(s.race.feat ? [s.race.feat] : []),
    ...(bgFeatName ? [bgFeatName] : []),
  ];
  const countFeat = (name: string) =>
    allFeatNames.filter((n) => n === name).length;

  // Apply feat bonuses to max counts
  mmMax += 2 * countFeat("Metamagic Adept");
  eiMax += countFeat("Eldritch Adept");
  maneuverMax += 2 * countFeat("Martial Adept");
  const fightingInitiateCount = countFeat("Fighting Initiate");

  // Determine which feature choices apply
  const sections: React.ReactNode[] = [];

  for (const cls of s.classes) {
    const fsCode = FS_CLASS_CODE[cls.name];
    const fsLevel = FS_GRANT_LEVEL[cls.name];

    // Fighting Style (class-granted)
    if (fsCode && cls.level >= fsLevel) {
      const available = optFeats.filter((f) => f.featureType.includes(fsCode));
      const chosen = fc.fightingStyles ?? [];
      const classIdx = s.classes
        .filter(
          (c) =>
            FS_CLASS_CODE[c.name] && c.level >= (FS_GRANT_LEVEL[c.name] ?? 99),
        )
        .indexOf(cls);
      const currentChoice = chosen[classIdx] ?? "";
      const maxStyles = s.classes.filter(
        (c) =>
          FS_CLASS_CODE[c.name] && c.level >= (FS_GRANT_LEVEL[c.name] ?? 99),
      ).length;
      if (
        available.length > 0 &&
        sections.every(
          (n) =>
            typeof n !== "string" || !String(n).startsWith(`fs-${cls.name}`),
        )
      ) {
        sections.push(
          <BRow
            key={`fs-${cls.name}-${cls.level}`}
            label={`${cls.name} Fighting Style (Lvl ${fsLevel}+)`}
          >
            <BSelect
              value={currentChoice}
              onChange={(v) => {
                const newStyles = [
                  ...Array(maxStyles)
                    .fill("")
                    .map((_, i) => fc.fightingStyles?.[i] ?? ""),
                ];
                newStyles[classIdx] = v;
                setFC({ fightingStyles: newStyles.filter(Boolean) });
              }}
              options={[
                { value: "", label: "— Choose Fighting Style —" },
                ...available.map((f) => f.name),
              ]}
            />
            {currentChoice &&
              (() => {
                const f = available.find((x) => x.name === currentChoice);
                const desc = f
                  ? typeof f.entries[0] === "string"
                    ? (f.entries[0] as string).replace(
                        /\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g,
                        "$1",
                      )
                    : ""
                  : "";
                return desc ? (
                  <div
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 13,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {desc}
                  </div>
                ) : null;
              })()}
          </BRow>,
        );
      }
    }

    // BG3 Ranger — Favoured Enemy & Natural Explorer picks
    if (cls.name === "Ranger (BG3)") {
      const numPicks = BG3_RANGER_PICK_LEVELS.filter(
        (l) => cls.level >= l,
      ).length;
      for (let i = 0; i < numPicks; i++) {
        const pickLevel = BG3_RANGER_PICK_LEVELS[i];
        const chosenFE = fc.favouredEnemies ?? [];
        const chosenNE = fc.naturalExplorer ?? [];
        sections.push(
          <BRow
            key={`fe-${i}`}
            label={`Favoured Enemy ${i + 1} (Lvl ${pickLevel})`}
          >
            <BSelect
              value={chosenFE[i] ?? ""}
              onChange={(v) => {
                const next = [...chosenFE];
                next[i] = v;
                setFC({ favouredEnemies: next });
              }}
              options={[
                { value: "", label: "— Choose Favoured Enemy —" },
                ...BG3_FAVOURED_ENEMIES.filter(
                  (o) => !chosenFE.includes(o.value) || chosenFE[i] === o.value,
                ),
              ]}
            />
          </BRow>,
        );
        sections.push(
          <BRow
            key={`ne-${i}`}
            label={`Natural Explorer ${i + 1} (Lvl ${pickLevel})`}
          >
            <BSelect
              value={chosenNE[i] ?? ""}
              onChange={(v) => {
                const next = [...chosenNE];
                next[i] = v;
                setFC({ naturalExplorer: next });
              }}
              options={[
                { value: "", label: "— Choose Natural Explorer —" },
                ...BG3_NATURAL_EXPLORER.filter(
                  (o) => !chosenNE.includes(o.value) || chosenNE[i] === o.value,
                ),
              ]}
            />
          </BRow>,
        );
      }
    }

    // Way of the Four Elements / Warrior of the Elements — Elemental Disciplines
    if (
      cls.name === "Monk" &&
      (cls.subclass === "Way of the Four Elements" ||
        cls.subclass === "Warrior of the Elements") &&
      cls.level >= 3
    ) {
      sections.push(
        <MultiPicker
          key={`elementaldisciplines-${cls.level}`}
          label={`Elemental Disciplines (${cls.subclass})`}
          items={optFeats.filter((f) => f.featureType.includes("ED"))}
          chosen={fc.elementalDisciplines ?? []}
          max={edMax}
          onToggle={(name) => toggleList("elementalDisciplines", name, edMax)}
        />,
      );
    }
  }

  // ── Eldritch Invocations (Warlock class + Eldritch Adept feat) ────────────────
  if (eiMax > 0) {
    const available = optFeats.filter((f) => f.featureType.includes("EI"));
    const label =
      eiMax >
      INVOCATION_COUNT(s.classes.find((c) => c.name === "Warlock")?.level ?? 0)
        ? `Eldritch Invocations (incl. Eldritch Adept)`
        : `Eldritch Invocations`;
    sections.push(
      <MultiPicker
        key="invocations"
        label={label}
        items={available}
        chosen={fc.invocations ?? []}
        max={eiMax}
        onToggle={(name) => toggleList("invocations", name, eiMax)}
      />,
    );
  }

  // ── Metamagic (Sorcerer class + Metamagic Adept feat) ────────────────────────
  if (mmMax > 0) {
    const available = optFeats.filter((f) => f.featureType.includes("MM"));
    const label =
      mmMax >
      METAMAGIC_COUNT(s.classes.find((c) => c.name === "Sorcerer")?.level ?? 0)
        ? `Metamagic (incl. Metamagic Adept)`
        : `Metamagic`;
    sections.push(
      <MultiPicker
        key="metamagic"
        label={label}
        items={available}
        chosen={fc.metamagic ?? []}
        max={mmMax}
        onToggle={(name) => toggleList("metamagic", name, mmMax)}
      />,
    );
  }

  // ── Battle Maneuvers (Battle Master + Martial Adept feat) ────────────────────
  if (maneuverMax > 0) {
    const available = optFeats.filter((f) =>
      f.featureType.some((t) => t.startsWith("MV")),
    );
    const label =
      maneuverMax >
      MANEUVER_COUNT(
        s.classes.find(
          (c) => c.name === "Fighter" && c.subclass === "Battle Master",
        )?.level ?? 0,
      )
        ? `Battle Maneuvers (incl. Martial Adept)`
        : `Battle Maneuvers (Battle Master)`;
    sections.push(
      <MultiPicker
        key="maneuvers"
        label={label}
        items={available}
        chosen={fc.maneuvers ?? []}
        max={maneuverMax}
        onToggle={(name) => toggleList("maneuvers", name, maneuverMax)}
      />,
    );
  }

  // ── Artificer Plans Known (EFA "Replicate Magic Item") ────────────────────────
  if (infusionMax > 0 && efaLevel > 0) {
    const available = REPLICATE_PLANS.filter((p) => p.minLevel <= efaLevel);
    const tiers = ([2, 6, 10] as const).filter((t) =>
      available.some((p) => p.minLevel === t),
    );
    const chosen = fc.infusions ?? [];
    const infusionBtn = (p: { name: string; isAttachment: boolean }) => {
      const isOn = chosen.includes(p.name);
      const maxed = !isOn && chosen.length >= infusionMax;
      return (
        <button
          key={p.name}
          onClick={() => !maxed && toggleList("infusions", p.name, infusionMax)}
          style={{
            padding: "3px 9px",
            borderRadius: 4,
            cursor: maxed ? "default" : "pointer",
            fontFamily: "var(--sans)",
            fontSize: 13,
            background: isOn ? "var(--gold-dim)" : "var(--card-2)",
            border: `1px solid ${isOn ? "var(--gold)" : "var(--border)"}`,
            color: isOn ? "var(--gold-bright)" : "var(--text)",
            opacity: maxed ? 0.35 : 1,
          }}
        >
          {p.name}
        </button>
      );
    };
    const infSubHead = (label: string) => (
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "var(--text-faint)",
          marginBottom: 3,
          marginTop: 4,
          textTransform: "uppercase",
          borderBottom: "1px solid var(--border-faint)",
          paddingBottom: 2,
        }}
      >
        {label}
      </div>
    );
    sections.push(
      <BRow
        key="plans"
        label={`Plans Known (${infusionMax} max) — ${chosen.length}/${infusionMax}`}
      >
        {tiers.map((tier) => {
          const tierPlans = available.filter((p) => p.minLevel === tier);
          const enhancements = tierPlans.filter((p) => p.isAttachment);
          const items = tierPlans.filter((p) => !p.isAttachment);
          return (
            <div key={tier} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: "var(--gold-dim)",
                  marginBottom: 3,
                  textTransform: "uppercase",
                }}
              >
                Level {tier}+
              </div>
              {enhancements.length > 0 && (
                <>
                  {infSubHead("Enhancements & Attachments")}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 5,
                      marginBottom: 4,
                    }}
                  >
                    {enhancements.map(infusionBtn)}
                  </div>
                </>
              )}
              {items.length > 0 && (
                <>
                  {infSubHead("Item Creations")}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {items.map(infusionBtn)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </BRow>,
    );
  }

  // ── Fighting Initiate feat — one style per feat instance ─────────────────────
  if (fightingInitiateCount > 0) {
    const allFsOptions = optFeats.filter((f) =>
      f.featureType.some((t) => t.startsWith("FS:")),
    );
    const chosenFeatFS = fc.featFightingStyleChoices ?? [];
    for (let i = 0; i < fightingInitiateCount; i++) {
      const currentChoice = chosenFeatFS[i] ?? "";
      sections.push(
        <BRow
          key={`fi-${i}`}
          label={`Fighting Initiate Style${fightingInitiateCount > 1 ? ` ${i + 1}` : ""} (Feat)`}
        >
          <BSelect
            value={currentChoice}
            onChange={(v) => {
              const next = [
                ...Array(fightingInitiateCount)
                  .fill("")
                  .map((_, j) => chosenFeatFS[j] ?? ""),
              ];
              next[i] = v;
              setFC({ featFightingStyleChoices: next.filter(Boolean) });
            }}
            options={[
              { value: "", label: "— Choose Fighting Style —" },
              ...allFsOptions.map((f) => f.name),
            ]}
          />
          {currentChoice &&
            (() => {
              const f = allFsOptions.find((x) => x.name === currentChoice);
              const desc = f
                ? typeof f.entries[0] === "string"
                  ? (f.entries[0] as string).replace(
                      /\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g,
                      "$1",
                    )
                  : ""
                : "";
              return desc ? (
                <div
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {desc}
                </div>
              ) : null;
            })()}
        </BRow>,
      );
    }
  }

  if (sections.length === 0) return null;

  return <BSection title="Feature Choices">{sections}</BSection>;
}

// ── Section: ASI & Feats ──────────────────────────────────────────────────────

function SectionASI({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const slots = getASISlots(s.classes);
  if (slots.length === 0) return null;

  const allFeats = (REGISTRY?.feats ?? []) as Array<{
    name: string;
    entries?: unknown[];
    skillToolLanguageProficiencies?: unknown[];
  }>;
  const asiSlots: ASISlotChoice[] =
    s.asiSlots?.length === slots.length
      ? s.asiSlots
      : slots.map((_, i) => s.asiSlots?.[i] ?? { type: "none" });

  const allSkillNames = Object.keys(REGISTRY?.skills ?? {}).sort();
  const TOOL_NAMES = [
    "Alchemist's Supplies",
    "Brewer's Supplies",
    "Calligrapher's Supplies",
    "Carpenter's Tools",
    "Cartographer's Tools",
    "Cobbler's Tools",
    "Cook's Utensils",
    "Disguise Kit",
    "Forgery Kit",
    "Glassblower's Tools",
    "Herbalism Kit",
    "Jeweler's Tools",
    "Leatherworker's Tools",
    "Mason's Tools",
    "Navigator's Tools",
    "Painter's Supplies",
    "Poisoner's Kit",
    "Potter's Tools",
    "Smith's Tools",
    "Thieves' Tools",
    "Tinker's Tools",
    "Weaver's Tools",
    "Woodcarver's Tools",
  ].sort();
  const profChoiceOptions = [
    ...allSkillNames.map((n) => ({ value: n, label: `${n} (Skill)` })),
    ...TOOL_NAMES.map((n) => ({ value: n, label: `${n} (Tool)` })),
  ];

  const updateSlot = (idx: number, update: ASISlotChoice) => {
    const next = asiSlots.map((sl, i) => (i === idx ? update : sl));
    const levelASI = next.flatMap((sl) => {
      if (sl.type === "bonus") return sl.bonuses ?? [];
      if (sl.type === "feat" && sl.featAbilityChoice)
        return [{ stat: sl.featAbilityChoice, bonus: 1 }];
      return [];
    });
    const feats = next
      .filter((sl) => sl.type === "feat")
      .map((sl) => sl.feat!)
      .filter(Boolean);
    // Sync feat proficiency choices (e.g. Skilled) into stored proficiencies
    const skillSet = new Set(allSkillNames);
    const allFeatProfs = next
      .flatMap((sl) => (sl.type === "feat" ? (sl.featProfChoices ?? []) : []))
      .filter(Boolean);
    const oldFeatProfs = new Set(
      asiSlots.flatMap((sl) =>
        sl.type === "feat" ? (sl.featProfChoices ?? []) : [],
      ),
    );
    const baseSkills = s.proficiencies.skills.filter(
      (sk) => !oldFeatProfs.has(sk),
    );
    const baseTools = s.proficiencies.tools.filter((t) => !oldFeatProfs.has(t));
    const newSkills = [
      ...new Set([
        ...baseSkills,
        ...allFeatProfs.filter((p) => skillSet.has(p)),
      ]),
    ];
    const newTools = [
      ...new Set([
        ...baseTools,
        ...allFeatProfs.filter((p) => !skillSet.has(p)),
      ]),
    ];
    set({
      asiSlots: next,
      levelASI,
      feats,
      proficiencies: { ...s.proficiencies, skills: newSkills, tools: newTools },
    });
  };

  return (
    <BSection title="Ability Score Improvements & Feats">
      {slots.map((slot, idx) => {
        const choice = asiSlots[idx] ?? { type: "none" };
        const bonuses = choice.bonuses ?? [];
        const firstBonus = bonuses[0];
        const secondBonus = bonuses[1];
        const totalBonusAssigned = bonuses.reduce((t, b) => t + b.bonus, 0);

        return (
          <div
            key={idx}
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              background: "var(--card-2)",
              border: `1px solid ${choice.type === "none" ? "var(--border)" : "var(--gold-dim)"}`,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--text-faint)",
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}
            >
              SLOT {idx + 1} — {slot.label.toUpperCase()}
            </div>

            {/* Type toggle */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: choice.type === "none" ? 0 : 10,
              }}
            >
              {(["none", "bonus", "feat"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateSlot(idx, { type: t })}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    background:
                      choice.type === t ? "var(--gold-dim)" : "var(--card)",
                    border: `1px solid ${choice.type === t ? "var(--gold)" : "var(--border)"}`,
                    color:
                      choice.type === t
                        ? "var(--gold-bright)"
                        : "var(--text-faint)",
                  }}
                >
                  {t === "none" ? "— SKIP" : t === "bonus" ? "+STAT" : "FEAT"}
                </button>
              ))}
            </div>

            {/* Bonus picker */}
            {choice.type === "bonus" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <BSelect
                      value={firstBonus?.stat ?? ""}
                      onChange={(stat) => {
                        const amount = firstBonus?.bonus ?? 1;
                        const newBonuses: typeof bonuses = [
                          { stat, bonus: amount },
                        ];
                        if (amount === 1 && secondBonus)
                          newBonuses.push(secondBonus);
                        updateSlot(idx, { type: "bonus", bonuses: newBonuses });
                      }}
                      options={[
                        { value: "", label: "— Stat —" },
                        ...STAT_KEYS.map((k) => ({
                          value: k,
                          label: k.toUpperCase(),
                        })),
                      ]}
                    />
                    <BSelect
                      value={String(firstBonus?.bonus ?? 1)}
                      onChange={(v) => {
                        const amount = Number(v);
                        const stat = firstBonus?.stat ?? "str";
                        const newBonuses: typeof bonuses = [
                          { stat, bonus: amount },
                        ];
                        if (amount === 1 && secondBonus)
                          newBonuses.push(secondBonus);
                        updateSlot(idx, { type: "bonus", bonuses: newBonuses });
                      }}
                      options={[
                        { value: "1", label: "+1" },
                        { value: "2", label: "+2" },
                      ]}
                    />
                  </div>

                  {/* Second stat if first is +1 */}
                  {firstBonus?.bonus === 1 && (
                    <div
                      style={{ display: "flex", gap: 4, alignItems: "center" }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--text-faint)",
                        }}
                      >
                        +
                      </span>
                      <BSelect
                        value={secondBonus?.stat ?? ""}
                        onChange={(stat) => {
                          const newBonuses: typeof bonuses = [
                            firstBonus,
                            { stat, bonus: 1 },
                          ];
                          updateSlot(idx, {
                            type: "bonus",
                            bonuses: newBonuses,
                          });
                        }}
                        options={[
                          { value: "", label: "— Stat —" },
                          ...STAT_KEYS.filter(
                            (k) => k !== firstBonus?.stat,
                          ).map((k) => ({ value: k, label: k.toUpperCase() })),
                        ]}
                      />
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--text-faint)",
                        }}
                      >
                        +1
                      </span>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    marginTop: 6,
                    color:
                      totalBonusAssigned === 2
                        ? "var(--vitality)"
                        : "var(--text-faint)",
                  }}
                >
                  {totalBonusAssigned}/2 assigned{" "}
                  {totalBonusAssigned === 2 ? "✓" : ""}
                </div>
              </div>
            )}

            {/* Feat picker */}
            {choice.type === "feat" && (
              <div>
                <BSelect
                  value={choice.feat ?? ""}
                  onChange={(name) => {
                    updateSlot(idx, { type: "feat", feat: name || undefined });
                  }}
                  options={[
                    { value: "", label: "— Select Feat —" },
                    ...allFeats.map((f) => f.name).sort(),
                  ]}
                />
                {choice.feat &&
                  (() => {
                    const feat = allFeats.find((f) => f.name === choice.feat);
                    const desc = feat?.entries?.length
                      ? renderEntries(feat.entries as unknown[])
                      : null;
                    const profChooseCount = (() => {
                      const stlp = feat?.skillToolLanguageProficiencies as
                        | Array<{
                            choose?: Array<{ from?: string[]; count?: number }>;
                          }>
                        | undefined;
                      const choose = stlp?.[0]?.choose?.[0];
                      if (!choose) return 0;
                      const from = choose.from ?? [];
                      if (from.includes("anySkill") || from.includes("anyTool"))
                        return choose.count ?? 0;
                      return 0;
                    })();
                    const featAbilityFrom =
                      ((
                        feat as unknown as {
                          ability?: Array<{ choose?: { from?: string[] } }>;
                        }
                      )?.ability ?? [])[0]?.choose?.from ?? [];
                    return (
                      <>
                        {desc && (
                          <div
                            style={{
                              fontFamily: "var(--sans)",
                              fontSize: 13,
                              color: "var(--text-muted)",
                              marginTop: 6,
                              lineHeight: 1.5,
                            }}
                          >
                            {desc}
                          </div>
                        )}
                        {featAbilityFrom.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 11,
                                color: "var(--text-faint)",
                                letterSpacing: "0.1em",
                                marginBottom: 4,
                              }}
                            >
                              ABILITY SCORE INCREASE (+1)
                            </div>
                            <BSelect
                              value={choice.featAbilityChoice ?? ""}
                              onChange={(stat) =>
                                updateSlot(idx, {
                                  ...choice,
                                  featAbilityChoice: stat || undefined,
                                })
                              }
                              options={[
                                { value: "", label: "— Choose stat —" },
                                ...featAbilityFrom.map((s) => ({
                                  value: s,
                                  label: s.toUpperCase(),
                                })),
                              ]}
                            />
                          </div>
                        )}
                        {profChooseCount > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 11,
                                color: "var(--text-faint)",
                                letterSpacing: "0.1em",
                                marginBottom: 4,
                              }}
                            >
                              CHOOSE {profChooseCount} SKILLS / TOOLS
                            </div>
                            {Array.from(
                              { length: profChooseCount },
                              (_, pi) => (
                                <div key={pi} style={{ marginBottom: 4 }}>
                                  <BSelect
                                    value={choice.featProfChoices?.[pi] ?? ""}
                                    onChange={(val) => {
                                      const next = [
                                        ...(choice.featProfChoices ?? []),
                                      ];
                                      next[pi] = val;
                                      updateSlot(idx, {
                                        ...choice,
                                        featProfChoices: next,
                                      });
                                    }}
                                    options={[
                                      {
                                        value: "",
                                        label: "— Choose skill or tool —",
                                      },
                                      ...profChoiceOptions,
                                    ]}
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
              </div>
            )}
          </div>
        );
      })}
    </BSection>
  );
}

// ── Section: Background ───────────────────────────────────────────────────────

function SectionBackground({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const backgrounds = REGISTRY?.backgrounds ?? [];

  const setBg = (name: string) => {
    const bg = backgrounds.find((b) => b.name === name);
    const oldChoices = s.background.featProfChoices ?? [];
    const cleanSkills = s.proficiencies.skills.filter(
      (sk) => !oldChoices.includes(sk),
    );
    const cleanTools = s.proficiencies.tools.filter(
      (t) => !oldChoices.includes(t),
    );
    set({
      background: {
        name,
        source: bg?.source ?? "XPHB",
        skillProficiencies: bg?.skillProficiencies ?? [],
      },
      proficiencies: {
        ...s.proficiencies,
        skills: cleanSkills,
        tools: cleanTools,
      },
    });
  };

  const selectedBg = (
    backgrounds as Array<{
      name: string;
      skillProficiencies: string[];
      backgroundFeat?: string;
    }>
  ).find((b) => b.name === s.background.name);

  const allFeats = (REGISTRY?.feats ?? []) as Array<{
    name: string;
    entries?: unknown[];
    skillToolLanguageProficiencies?: unknown[];
  }>;
  const bgFeatName = selectedBg?.backgroundFeat?.replace(/\s*\(.*\)$/, "");
  const bgFeatData = bgFeatName
    ? allFeats.find((f) => f.name === bgFeatName)
    : undefined;
  const bgFeatDesc = bgFeatData?.entries?.length
    ? renderEntries(bgFeatData.entries as unknown[])
    : null;

  const bgProfChooseCount = (() => {
    const stlp = bgFeatData?.skillToolLanguageProficiencies as
      | Array<{ choose?: Array<{ from?: string[]; count?: number }> }>
      | undefined;
    const choose = stlp?.[0]?.choose?.[0];
    if (!choose) return 0;
    const from = choose.from ?? [];
    return from.includes("anySkill") || from.includes("anyTool")
      ? (choose.count ?? 0)
      : 0;
  })();

  const allSkillNames = Object.keys(REGISTRY?.skills ?? {}).sort();
  const TOOL_NAMES = [
    "Alchemist's Supplies",
    "Brewer's Supplies",
    "Calligrapher's Supplies",
    "Carpenter's Tools",
    "Cartographer's Tools",
    "Cobbler's Tools",
    "Cook's Utensils",
    "Disguise Kit",
    "Forgery Kit",
    "Glassblower's Tools",
    "Herbalism Kit",
    "Jeweler's Tools",
    "Leatherworker's Tools",
    "Mason's Tools",
    "Navigator's Tools",
    "Painter's Supplies",
    "Poisoner's Kit",
    "Potter's Tools",
    "Smith's Tools",
    "Thieves' Tools",
    "Tinker's Tools",
    "Weaver's Tools",
    "Woodcarver's Tools",
  ].sort();
  const profChoiceOptions = [
    ...allSkillNames.map((n) => ({ value: n, label: `${n} (Skill)` })),
    ...TOOL_NAMES.map((n) => ({ value: n, label: `${n} (Tool)` })),
  ];

  const updateBgProfChoice = (pi: number, val: string) => {
    const oldChoices = s.background.featProfChoices ?? [];
    const next = [...oldChoices];
    next[pi] = val;
    const skillSet = new Set(allSkillNames);
    const baseSkills = s.proficiencies.skills.filter(
      (sk) => !oldChoices.includes(sk),
    );
    const baseTools = s.proficiencies.tools.filter(
      (t) => !oldChoices.includes(t),
    );
    const newSkills = [
      ...new Set([...baseSkills, ...next.filter((p) => p && skillSet.has(p))]),
    ];
    const newTools = [
      ...new Set([...baseTools, ...next.filter((p) => p && !skillSet.has(p))]),
    ];
    set({
      background: { ...s.background, featProfChoices: next },
      proficiencies: { ...s.proficiencies, skills: newSkills, tools: newTools },
    });
  };

  return (
    <BSection title="Background">
      <BRow label="Background">
        <BSelect
          value={s.background.name}
          onChange={setBg}
          options={[
            { value: "", label: "— Select Background —" },
            ...backgrounds.map((b) => b.name).sort(),
          ]}
        />
      </BRow>
      {selectedBg && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {selectedBg.skillProficiencies.length > 0 && (
            <span>SKILLS: {selectedBg.skillProficiencies.join(", ")}</span>
          )}
          {selectedBg.backgroundFeat && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "var(--gold)" }}>
                FEAT: {selectedBg.backgroundFeat}
              </span>
              {bgFeatDesc && (
                <span style={{ color: "var(--text-faint)", lineHeight: 1.5 }}>
                  {bgFeatDesc}
                </span>
              )}
              {bgProfChooseCount > 0 && (
                <div>
                  <div style={{ letterSpacing: "0.1em", marginBottom: 4 }}>
                    CHOOSE {bgProfChooseCount} SKILLS / TOOLS
                  </div>
                  {Array.from({ length: bgProfChooseCount }, (_, pi) => (
                    <div key={pi} style={{ marginBottom: 4 }}>
                      <BSelect
                        value={s.background.featProfChoices?.[pi] ?? ""}
                        onChange={(val) => updateBgProfChoice(pi, val)}
                        options={[
                          { value: "", label: "— Choose skill or tool —" },
                          ...profChoiceOptions,
                        ]}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </BSection>
  );
}

// ── Section: Skills & Expertise ───────────────────────────────────────────────

function SectionSkills({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const primaryClass = s.classes[0]?.name ?? "Fighter";
  const { from: pool, count } = getClassSkills(primaryClass);
  const bgSkills = s.background.skillProficiencies;

  // Skills from feats (Skilled, background feats, etc.) — must not count against class pick limit
  const featSkills = new Set([
    ...(s.asiSlots ?? []).flatMap((sl) =>
      sl.type === "feat" ? (sl.featProfChoices ?? []) : [],
    ),
    ...(s.background.featProfChoices ?? []),
  ]);

  const classSelected = s.proficiencies.skills.filter(
    (sk) => !bgSkills.includes(sk) && !featSkills.has(sk),
  );

  const toggleClassSkill = (skill: string) => {
    if (featSkills.has(skill)) return;
    const isOn = classSelected.includes(skill);
    if (isOn) {
      set({
        proficiencies: {
          ...s.proficiencies,
          skills: s.proficiencies.skills.filter((sk) => sk !== skill),
        },
      });
    } else if (classSelected.length < count) {
      set({
        proficiencies: {
          ...s.proficiencies,
          skills: [...s.proficiencies.skills, skill],
        },
      });
    }
  };

  const hasExpertise = ["Bard", "Rogue"].includes(primaryClass);
  const allProf = [...new Set([...bgSkills, ...classSelected, ...featSkills])];

  const toggleExpertise = (skill: string) => {
    const curr = s.expertise ?? [];
    if (curr.includes(skill)) {
      set({ expertise: curr.filter((x) => x !== skill) });
    } else if (curr.length < 2) {
      set({ expertise: [...curr, skill] });
    }
  };

  if (pool.length === 0 && bgSkills.length === 0) {
    return (
      <BSection title="Skills">
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--text-faint)",
          }}
        >
          Select a class and background to see skill options.
        </span>
      </BSection>
    );
  }

  return (
    <BSection title="Skills & Expertise">
      {pool.length > 0 && (
        <BRow
          label={`${primaryClass} skills — pick ${count} (${classSelected.length}/${count})`}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {pool.map((skill) => {
              const isBg = bgSkills.includes(skill);
              const isFeat = featSkills.has(skill);
              const isOn = s.proficiencies.skills.includes(skill);
              const locked = isBg || isFeat;
              const maxed = !isOn && !locked && classSelected.length >= count;
              return (
                <button
                  key={skill}
                  onClick={() => !locked && toggleClassSkill(skill)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 4,
                    cursor: locked ? "default" : "pointer",
                    fontFamily: "var(--sans)",
                    fontSize: 14,
                    background: isBg
                      ? "var(--gold-dim)"
                      : isFeat
                        ? "var(--card-2)"
                        : isOn
                          ? "var(--vitality)"
                          : "var(--card-2)",
                    border: `1px solid ${isBg ? "var(--gold-dim)" : isFeat ? "var(--gold-dim)" : isOn ? "var(--vitality)" : "var(--border)"}`,
                    color: isBg
                      ? "var(--bg)"
                      : isFeat
                        ? "var(--gold)"
                        : isOn
                          ? "var(--bg)"
                          : "var(--text)",
                    opacity: maxed ? 0.35 : 1,
                  }}
                >
                  {skill}
                  {isBg ? " ★" : isFeat ? " ✦" : ""}
                </button>
              );
            })}
          </div>
        </BRow>
      )}
      {bgSkills.length > 0 && pool.length === 0 && (
        <BRow label="Background skills">
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 14,
              color: "var(--text-muted)",
            }}
          >
            {bgSkills.join(", ")}
          </span>
        </BRow>
      )}
      {hasExpertise && allProf.length > 0 && (
        <BRow label={`Expertise — pick 2 (${(s.expertise ?? []).length}/2)`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {allProf.map((skill) => {
              const isOn = (s.expertise ?? []).includes(skill);
              const maxed = !isOn && (s.expertise ?? []).length >= 2;
              return (
                <button
                  key={skill}
                  onClick={() => toggleExpertise(skill)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "var(--sans)",
                    fontSize: 14,
                    background: isOn ? "var(--gold)" : "var(--card-2)",
                    border: `1px solid ${isOn ? "var(--gold)" : "var(--border)"}`,
                    color: isOn ? "var(--bg)" : "var(--text)",
                    opacity: maxed ? 0.35 : 1,
                  }}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </BRow>
      )}
    </BSection>
  );
}

// ── Starting Equipment helpers ────────────────────────────────────────────────

type SEItemEntry =
  | string
  | {
      item?: string;
      quantity?: number;
      equipmentType?: string;
      special?: string;
      value?: number;
      containsValue?: number;
      displayName?: string;
    };

function parseItemKey(
  entry: SEItemEntry,
):
  | { type: "item"; key: string; qty: number }
  | { type: "weapon"; wtype: string }
  | { type: "special"; name: string }
  | { type: "gold"; cp: number }
  | null {
  if (typeof entry === "string") {
    return {
      type: "item",
      key:
        entry.toLowerCase().replace(/\s*\|.*$/, "") +
        "|" +
        (entry.split("|")[1] ?? "phb").toLowerCase(),
      qty: 1,
    };
  }
  if (entry.equipmentType)
    return { type: "weapon", wtype: entry.equipmentType };
  if (entry.special) return { type: "special", name: entry.special };
  if (entry.value != null) return { type: "gold", cp: entry.value };
  if (entry.containsValue != null)
    return { type: "gold", cp: entry.containsValue };
  if (entry.item) {
    const raw = entry.item;
    const key =
      raw.toLowerCase().replace(/\s*\|.*$/, "") +
      "|" +
      (raw.split("|")[1] ?? "phb").toLowerCase();
    return { type: "item", key, qty: entry.quantity ?? 1 };
  }
  return null;
}

function avgGoldFromDice(goldAlt: string | undefined): number {
  if (!goldAlt) return 0;
  const m = goldAlt.match(/(\d+)d(\d+)\s*[×x*]\s*(\d+)/i);
  if (!m) return 0;
  const count = parseInt(m[1]),
    sides = parseInt(m[2]),
    mult = parseInt(m[3]);
  return Math.floor(((count * (sides + 1)) / 2) * mult);
}

function expandPack(key: string, allItems: RegistryItem[]): SEItemEntry[] {
  const [name] = key.split("|");
  const pack = allItems.find(
    (i) =>
      i.name.toLowerCase() === name.toLowerCase() &&
      (i as unknown as { packContents?: unknown[] }).packContents,
  );
  if (!pack) return [key];
  return (
    (pack as unknown as { packContents: SEItemEntry[] }).packContents ?? []
  );
}

function resolveEntries(
  entries: SEItemEntry[],
  allItems: RegistryItem[],
  depth = 0,
): Array<
  | { type: "item"; key: string; qty: number }
  | { type: "weapon"; wtype: string }
  | { type: "special"; name: string }
  | { type: "gold"; cp: number }
> {
  if (depth > 3) return [];
  const out: ReturnType<typeof resolveEntries> = [];
  for (const entry of entries) {
    const parsed = parseItemKey(entry);
    if (!parsed) continue;
    if (parsed.type === "item") {
      const [name] = parsed.key.split("|");
      const isPackEntry = allItems.some(
        (i) =>
          i.name.toLowerCase() === name.toLowerCase() &&
          (i as unknown as { packContents?: unknown[] }).packContents,
      );
      if (isPackEntry) {
        const expanded = expandPack(parsed.key, allItems);
        out.push(...resolveEntries(expanded, allItems, depth + 1));
      } else {
        out.push(parsed);
      }
    } else {
      out.push(parsed);
    }
  }
  return out;
}

function itemWeight(key: string, allItems: RegistryItem[]): number {
  const [name, src = ""] = key.split("|");
  const found = allItems.find(
    (i) =>
      i.name.toLowerCase() === name.toLowerCase() &&
      (src ? i.source.toLowerCase() === src : true),
  );
  return found?.weight ?? 0;
}

// ── Section: Starting Equipment ───────────────────────────────────────────────

function SectionStartingEquipment({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const [allItems, setAllItems] = React.useState<RegistryItem[] | null>(null);
  const [classMode, setClassMode] = React.useState<"gear" | "gold">("gear");
  // choiceMap: `${source}-${groupIdx}` → 'a' | 'b'
  const [choiceMap, setChoiceMap] = React.useState<Record<string, "a" | "b">>(
    {},
  );
  // weaponPicks: `${source}-${groupIdx}-${option}-${slotIdx}` → item key
  const [weaponPicks, setWeaponPicks] = React.useState<Record<string, string>>(
    {},
  );
  const [applied, setApplied] = React.useState(false);

  React.useEffect(() => {
    loadItems().then(setAllItems);
  }, []);

  if (s.startingEquipmentApplied) return null;

  const primaryClass = s.classes[0]?.name ?? "";
  const regClass = REGISTRY?.classes?.[primaryClass];
  const classSE = regClass?.startingEquipment;
  const classGoldAvg = avgGoldFromDice(classSE?.goldAlternative);

  const bgData = (
    REGISTRY?.backgrounds as
      | Array<{ name: string; startingEquipment?: unknown[] }>
      | undefined
  )?.find((b) => b.name === s.background.name);
  const bgGroups = (bgData?.startingEquipment ?? []) as Record<
    string,
    SEItemEntry[]
  >[];

  const classGroups = (classSE?.defaultData ?? []) as Record<
    string,
    SEItemEntry[]
  >[];

  // BG3 class fallback: parse @item tags from default text when no defaultData
  const classDefaultText =
    classGroups.length === 0
      ? ((classSE as { default?: string[] } | null)?.default ?? [])
      : [];
  const parsedDefaultItems: string[] = classDefaultText.flatMap((line) => {
    const matches = [...line.matchAll(/\{@item ([^|}]+)(?:\|[^}]*)?\}/g)];
    const parsed = matches.map((m) => m[1].trim());
    // Also extract plain text items (not @item tagged)
    const plain = line
      .replace(/\{@[^}]+\}/g, "")
      .replace(/,/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plain && matches.length === 0) parsed.push(plain);
    return parsed;
  });

  const martialWeapons =
    allItems?.filter(
      (i) =>
        (i as unknown as { weaponCategory?: string }).weaponCategory ===
          "martial" && i._base,
    ) ?? [];
  const simpleWeapons =
    allItems?.filter(
      (i) =>
        (i as unknown as { weaponCategory?: string }).weaponCategory ===
          "simple" && i._base,
    ) ?? [];

  const getWeaponList = (wtype: string) => {
    const t = wtype.toLowerCase();
    if (t.includes("martial")) return martialWeapons;
    if (t.includes("simple")) return simpleWeapons;
    return martialWeapons;
  };

  const getOption = (
    groups: Record<string, SEItemEntry[]>[],
    groupIdx: number,
    source: "class" | "bg",
  ): "a" | "b" | "_" => {
    const g = groups[groupIdx];
    if (!g) return "_";
    if (g._) return "_";
    return choiceMap[`${source}-${groupIdx}`] ?? "a";
  };

  const getEntries = (
    g: Record<string, SEItemEntry[]>,
    opt: "a" | "b" | "_",
  ): SEItemEntry[] => {
    if (opt === "_") return (g._ as SEItemEntry[]) ?? [];
    return (g[opt] as SEItemEntry[]) ?? [];
  };

  const renderEntryLabel = (
    entry: SEItemEntry,
    source: string,
    groupIdx: number,
    option: string,
    slotIdx: number,
  ): React.ReactNode => {
    const parsed = parseItemKey(entry);
    if (!parsed) return null;
    if (parsed.type === "weapon") {
      const wList = getWeaponList(parsed.wtype);
      const pickKey = `${source}-${groupIdx}-${option}-${slotIdx}`;
      return (
        <select
          key={pickKey}
          value={weaponPicks[pickKey] ?? ""}
          onChange={(e) =>
            setWeaponPicks((p) => ({ ...p, [pickKey]: e.target.value }))
          }
          style={{
            background: "var(--card-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text)",
            fontFamily: "var(--sans)",
            fontSize: 12,
            padding: "2px 6px",
            marginLeft: 4,
          }}
        >
          <option value="">— Pick weapon —</option>
          {wList.map((w) => (
            <option
              key={`${w.name}|${w.source}`}
              value={`${w.name.toLowerCase()}|${w.source.toLowerCase()}`}
            >
              {w.name}
            </option>
          ))}
        </select>
      );
    }
    if (parsed.type === "gold")
      return (
        <span style={{ color: "var(--gold)" }}>
          {Math.floor(parsed.cp / 100)} gp
        </span>
      );
    if (parsed.type === "special") return <span>{parsed.name}</span>;
    const [name] = parsed.key.split("|");
    const displayName =
      typeof entry === "object" &&
      (entry as { displayName?: string }).displayName
        ? (entry as { displayName: string }).displayName
        : name.replace(/\b\w/g, (l) => l.toUpperCase());
    return (
      <span>
        {parsed.qty > 1 ? `${displayName} ×${parsed.qty}` : displayName}
      </span>
    );
  };

  const applyGear = () => {
    if (!allItems) return;
    const newInventory = [...s.equipment.inventory];
    let extraGp = s.currency?.gp ?? 0;

    const addItems = (
      entries: SEItemEntry[],
      source: string,
      groupIdx: number,
      option: string,
    ) => {
      const resolved = resolveEntries(entries, allItems);
      let slotIdx = 0;
      for (const entry of entries) {
        const parsed = parseItemKey(entry);
        if (!parsed) continue;
        if (parsed.type === "weapon") {
          const pickKey = `${source}-${groupIdx}-${option}-${slotIdx}`;
          const chosenKey = weaponPicks[pickKey];
          if (chosenKey) {
            const existing = newInventory.find((i) => i.key === chosenKey);
            if (existing) existing.qty += 1;
            else
              newInventory.push({
                key: chosenKey,
                qty: 1,
                wt: itemWeight(chosenKey, allItems),
                equipped: false,
                notes: "",
              });
          }
          slotIdx++;
        }
      }
      for (const r of resolved) {
        if (r.type === "gold") {
          extraGp += Math.floor(r.cp / 100);
          continue;
        }
        if (r.type === "special") {
          const key = `${r.name.toLowerCase().slice(0, 30)}|custom`;
          const existing = newInventory.find((i) => i.key === key);
          if (existing) existing.qty += 1;
          else
            newInventory.push({
              key,
              qty: 1,
              wt: 0,
              equipped: false,
              notes: r.name,
            });
          continue;
        }
        if (r.type === "item") {
          const existing = newInventory.find((i) => i.key === r.key);
          if (existing) existing.qty += r.qty;
          else
            newInventory.push({
              key: r.key,
              qty: r.qty,
              wt: itemWeight(r.key, allItems),
              equipped: false,
              notes: "",
            });
        }
      }
    };

    if (classMode === "gold") {
      extraGp += classGoldAvg;
    } else if (classGroups.length > 0) {
      for (let gi = 0; gi < classGroups.length; gi++) {
        const g = classGroups[gi];
        const opt = getOption(classGroups, gi, "class");
        addItems(getEntries(g, opt), "class", gi, opt);
      }
    } else if (parsedDefaultItems.length > 0 && allItems) {
      // BG3 class fallback: add items parsed from default text
      for (const name of parsedDefaultItems) {
        const key = `${name.toLowerCase()}|custom`;
        const registryMatch = allItems.find(
          (ri) => ri.name.toLowerCase() === name.toLowerCase(),
        );
        const finalKey = registryMatch
          ? `${registryMatch.name.toLowerCase()}|${registryMatch.source.toLowerCase()}`
          : key;
        const existing = newInventory.find((i) => i.key === finalKey);
        if (existing) existing.qty += 1;
        else
          newInventory.push({
            key: finalKey,
            qty: 1,
            wt: registryMatch?.weight ?? 0,
            equipped: false,
            notes: "",
          });
      }
    }

    for (let gi = 0; gi < bgGroups.length; gi++) {
      const g = bgGroups[gi];
      const opt = getOption(bgGroups, gi, "bg");
      addItems(getEntries(g, opt), "bg", gi, opt);
    }

    set({
      equipment: { ...s.equipment, inventory: newInventory },
      currency: {
        pp: s.currency?.pp ?? 0,
        gp: extraGp,
        sp: s.currency?.sp ?? 0,
        cp: s.currency?.cp ?? 0,
      },
      startingEquipmentApplied: true,
    });
    setApplied(true);
  };

  if (applied) return null;

  const renderGroup = (
    g: Record<string, SEItemEntry[]>,
    groupIdx: number,
    source: "class" | "bg",
  ) => {
    const hasMandatory = !!g._;
    const hasChoice = !!(g.a || g.b);

    if (hasMandatory && !hasChoice) {
      const entries = (g._ as SEItemEntry[]) ?? [];
      return (
        <div
          key={`${source}-${groupIdx}`}
          style={{
            marginBottom: 8,
            padding: "6px 8px",
            background: "var(--card-2)",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-faint)",
              marginBottom: 4,
            }}
          >
            INCLUDED
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {entries.map((e, si) => (
              <span
                key={si}
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  color: "var(--text)",
                }}
              >
                {renderEntryLabel(e, source, groupIdx, "_", si)}
              </span>
            ))}
          </div>
        </div>
      );
    }

    const chosen = choiceMap[`${source}-${groupIdx}`] ?? "a";
    const optA = (g.a as SEItemEntry[]) ?? [];
    const optB = (g.b as SEItemEntry[]) ?? [];

    return (
      <div key={`${source}-${groupIdx}`} style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["a", "b"] as const).map((opt) => {
            const entries = opt === "a" ? optA : optB;
            if (!entries.length) return null;
            const isChosen = chosen === opt;
            return (
              <div
                key={opt}
                onClick={() =>
                  setChoiceMap((m) => ({
                    ...m,
                    [`${source}-${groupIdx}`]: opt,
                  }))
                }
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 5,
                  cursor: "pointer",
                  background: isChosen ? "var(--card-2)" : "transparent",
                  border: `1px solid ${isChosen ? "var(--gold)" : "var(--border)"}`,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: isChosen ? "var(--gold)" : "var(--text-faint)",
                    marginBottom: 4,
                  }}
                >
                  {opt === "a" ? "OPTION A" : "OPTION B"} {isChosen ? "●" : "○"}
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  {entries.map((e, si) => (
                    <span
                      key={si}
                      style={{
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      {renderEntryLabel(e, source, groupIdx, opt, si)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasClassGear = classGroups.length > 0;
  const hasBgGear = bgGroups.length > 0;

  return (
    <BSection title="Starting Equipment">
      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 13,
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        Choose your starting gear — this is a one-time selection and cannot be
        changed after applying. You can take gear (individual items) or gold and
        buy your own.
      </div>

      {hasClassGear && (
        <>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--gold)",
              marginBottom: 8,
            }}
          >
            {primaryClass.toUpperCase()} EQUIPMENT
          </div>
          {classGoldAvg > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["gear", "gold"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setClassMode(m)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    background:
                      classMode === m ? "var(--gold-dim)" : "var(--card-2)",
                    border: `1px solid ${classMode === m ? "var(--gold)" : "var(--border)"}`,
                    color:
                      classMode === m
                        ? "var(--gold-bright)"
                        : "var(--text-faint)",
                  }}
                >
                  {m === "gear"
                    ? "TAKE GEAR"
                    : `TAKE GOLD (${classGoldAvg} gp avg)`}
                </button>
              ))}
            </div>
          )}
          {classMode === "gear" &&
            classGroups.map((g, gi) => renderGroup(g, gi, "class"))}
          {classMode === "gold" && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--card-2)",
                borderRadius: 4,
                fontFamily: "var(--sans)",
                fontSize: 13,
                color: "var(--gold)",
              }}
            >
              +{classGoldAvg} gp will be added to your gold pouch.
            </div>
          )}
        </>
      )}

      {hasBgGear && (
        <>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--gold)",
              margin: "12px 0 8px",
            }}
          >
            {(s.background.name || "BACKGROUND").toUpperCase()} EQUIPMENT
          </div>
          {bgGroups.map((g, gi) => renderGroup(g, gi, "bg"))}
        </>
      )}

      {!hasClassGear && parsedDefaultItems.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--gold)",
              marginBottom: 8,
            }}
          >
            {primaryClass.toUpperCase()} STARTING GEAR
          </div>
          <div
            style={{
              padding: "8px 10px",
              background: "var(--card-2)",
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text-faint)",
                marginBottom: 6,
              }}
            >
              ALL INCLUDED
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {parsedDefaultItems.map((name, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  {name.replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {!hasClassGear && parsedDefaultItems.length === 0 && !hasBgGear && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--text-faint)",
          }}
        >
          No starting equipment data found for this class/background.
        </div>
      )}

      {!allItems && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-faint)",
            marginBottom: 8,
          }}
        >
          Loading item data…
        </div>
      )}

      <div
        style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}
      >
        <button
          onClick={applyGear}
          disabled={!allItems}
          style={{
            padding: "8px 18px",
            background: "var(--gold-dim)",
            border: "1px solid var(--gold)",
            borderRadius: 6,
            color: "var(--gold-bright)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            letterSpacing: "0.1em",
            cursor: allItems ? "pointer" : "default",
            opacity: allItems ? 1 : 0.5,
          }}
        >
          APPLY STARTING GEAR
        </button>
        <button
          onClick={() => set({ startingEquipmentApplied: true })}
          style={{
            padding: "8px 12px",
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-faint)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          SKIP
        </button>
      </div>
    </BSection>
  );
}

// ── Section: Notes ────────────────────────────────────────────────────────────

function SectionNotes({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  type NoteTextField =
    | "personality"
    | "ideals"
    | "bonds"
    | "flaws"
    | "backstory";
  const field = (key: NoteTextField, label: string) => (
    <BRow key={key} label={label}>
      <textarea
        value={s.notes[key]}
        onChange={(e) => set({ notes: { ...s.notes, [key]: e.target.value } })}
        rows={3}
        style={{
          width: "100%",
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "6px 8px",
          color: "var(--text)",
          fontFamily: "var(--sans)",
          fontSize: 14,
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </BRow>
  );
  return (
    <BSection title="Notes & Backstory">
      {field("personality", "Personality")}
      {field("ideals", "Ideals")}
      {field("bonds", "Bonds")}
      {field("flaws", "Flaws")}
      {field("backstory", "Backstory")}
    </BSection>
  );
}

// ── Builder side panel (sticky left column) ───────────────────────────────────

function BuilderSidePanel({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const p = computePreview(s);
  const classLine = s.classes.map((c) => `${c.name} ${c.level}`).join(" / ");
  const pointsLeft = 27 - p.pointsSpent;

  const changeScore = (stat: StatKey, delta: number) => {
    const cur = s.abilityScores[stat] ?? 10;
    const next = cur + delta;
    if (next < 8 || next > 15) return;
    const newScores = { ...s.abilityScores, [stat]: next };
    if (STAT_KEYS.reduce((t, k) => t + (POINT_COST[newScores[k]] ?? 0), 0) > 27)
      return;
    set({ abilityScores: newScores });
  };

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      {/* Name + identity */}
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--gold)",
          fontStyle: "italic",
          lineHeight: 1.2,
          marginBottom: 2,
        }}
      >
        {s.name || "Unnamed"}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--text-faint)",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        {s.race.name || "—"} · {classLine || "—"}
      </div>

      {/* Quick stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 5,
          marginBottom: 14,
        }}
      >
        {(
          [
            { l: "Level", v: p.totalLevel || "—" },
            { l: "Prof", v: p.totalLevel ? `+${p.prof}` : "—" },
            { l: "HP", v: p.maxHP || "—" },
          ] as { l: string; v: string | number }[]
        ).map(({ l, v }) => (
          <div
            key={l}
            style={{
              background: "var(--card-2)",
              borderRadius: 5,
              padding: "5px 4px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--text-faint)",
                letterSpacing: "0.1em",
                marginBottom: 1,
              }}
            >
              {l.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 15,
                color: "var(--gold)",
              }}
            >
              {v}
            </div>
          </div>
        ))}
      </div>

      {/* Point buy header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "var(--text-faint)",
          }}
        >
          ABILITY SCORES
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            fontWeight: 600,
            color:
              pointsLeft < 0
                ? "var(--danger)"
                : pointsLeft === 0
                  ? "var(--vitality)"
                  : "var(--gold)",
          }}
        >
          {pointsLeft} pts left
        </div>
      </div>

      {/* Interactive stat block */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 5,
        }}
      >
        {STAT_KEYS.map((stat) => {
          const base = s.abilityScores[stat] ?? 10;
          const final = p.finalScore(stat);
          const m = p.mod(stat);
          const racial =
            (s.race?.asiChoices ?? []).find((a) => a.stat === stat)?.bonus ?? 0;
          const featB = p.featBonus(stat);
          return (
            <div
              key={stat}
              style={{
                background: "var(--card-2)",
                border: "1px solid var(--border)",
                borderRadius: 5,
                padding: "6px 4px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: "var(--text-faint)",
                  marginBottom: 2,
                }}
              >
                {STAT_SHORT[stat]}
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 18,
                  color: "var(--gold)",
                  lineHeight: 1,
                }}
              >
                {m >= 0 ? `+${m}` : m}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: "2px 0 5px",
                }}
              >
                {final}
                {racial > 0 && (
                  <span style={{ color: "var(--gold-dim)", fontSize: 9 }}>
                    {" "}
                    +{racial}r
                  </span>
                )}
                {featB > 0 && (
                  <span style={{ color: "var(--vitality)", fontSize: 9 }}>
                    {" "}
                    +{featB}f
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <button
                  onClick={() => changeScore(stat, -1)}
                  style={{
                    width: 18,
                    height: 18,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 13,
                    minWidth: 14,
                    textAlign: "center",
                    color: "var(--text)",
                  }}
                >
                  {base}
                </span>
                <button
                  onClick={() => changeScore(stat, 1)}
                  style={{
                    width: 18,
                    height: 18,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Proficient skills */}
      {s.proficiencies.skills.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--text-faint)",
              margin: "14px 0 5px",
            }}
          >
            PROFICIENT SKILLS
          </div>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            {[
              ...new Set([
                ...s.background.skillProficiencies,
                ...s.proficiencies.skills,
              ]),
            ].join(", ")}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

// ── Section: Free Feats (CampaignRules.freeFeatsAtLevel1) ─────────────────────

function SectionFreeFeats({
  s,
  set,
  count,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
  count: number;
}) {
  const feats = (REGISTRY?.feats ?? []) as Array<{ name: string }>;
  const available = feats.map((f) => f.name).sort();

  const setFeat = (idx: number, val: string) => {
    const next = [...(s.feats ?? [])];
    next[idx] = val;
    set({ feats: next });
  };

  return (
    <BSection title={`Level 1 Bonus Feats (${count})`}>
      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 13,
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        Campaign rule grants {count} free feat{count !== 1 ? "s" : ""} at
        character creation.
      </div>
      {Array.from({ length: count }, (_, i) => (
        <BRow key={i} label={`Feat ${i + 1}`}>
          <BSelect
            value={s.feats?.[i] ?? ""}
            onChange={(v) => setFeat(i, v)}
            options={[
              { value: "", label: "— Choose feat —" },
              ...available.map((n) => ({ value: n, label: n })),
            ]}
          />
        </BRow>
      ))}
    </BSection>
  );
}

// ── Section: Plugin extras ────────────────────────────────────────────────────

function SectionPluginExtras({
  s,
  set,
}: {
  s: StoredChar;
  set: (u: Partial<StoredChar>) => void;
}) {
  const extras = PluginRegistry.getBuilderExtras();
  if (extras.length === 0) return null;

  return (
    <>
      {extras.map((extra) => {
        // Find which plugin owns this step
        const plugin = PluginRegistry.getAll().find((p) =>
          (p.builderExtras ?? []).some((e) => e.stepId === extra.stepId),
        );
        const pluginId = plugin?.id ?? extra.stepId;
        const data = s.pluginData?.[pluginId] ?? {};

        const setField = (key: string, val: unknown) =>
          set({
            pluginData: {
              ...s.pluginData,
              [pluginId]: { ...data, [key]: val },
            },
          });

        return (
          <BSection key={extra.stepId} title={extra.stepLabel}>
            {extra.description && (
              <div
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                {extra.description}
              </div>
            )}
            {extra.fields.map((field) => (
              <BRow key={field.key} label={field.label}>
                {field.hint && (
                  <div
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 12,
                      color: "var(--text-faint)",
                      marginBottom: 4,
                    }}
                  >
                    {field.hint}
                  </div>
                )}
                {field.type === "boolean" ? (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        data[field.key] ?? field.default ?? false,
                      )}
                      onChange={(e) => setField(field.key, e.target.checked)}
                    />
                    <span
                      style={{
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      Enabled
                    </span>
                  </label>
                ) : field.type === "select" ? (
                  <BSelect
                    value={String(data[field.key] ?? field.default ?? "")}
                    onChange={(v) => setField(field.key, v)}
                    options={field.options ?? []}
                  />
                ) : (
                  <BInput
                    value={String(data[field.key] ?? field.default ?? "")}
                    onChange={(v) =>
                      setField(
                        field.key,
                        field.type === "number" ? Number(v) : v,
                      )
                    }
                  />
                )}
              </BRow>
            ))}
          </BSection>
        );
      })}
    </>
  );
}

export function AppBuilder() {
  const [ready, setReady] = useState(REGISTRY !== null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tweaks, setTweak] = useTweaks({
    levelCap: 12 as number,
    lightMode: false as boolean,
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "light",
      tweaks.lightMode as boolean,
    );
  }, [tweaks.lightMode]);

  const [s, setS] = useState<StoredChar>(() => {
    const saved = loadSaved() ?? blankChar();
    return {
      ...saved,
      currency: {
        pp: saved.currency?.pp ?? 0,
        gp: saved.currency?.gp ?? 0,
        sp: saved.currency?.sp ?? 0,
        cp: saved.currency?.cp ?? 0,
      },
      startingEquipmentApplied: saved.startingEquipmentApplied ?? true,
    };
  });
  const rules = useMemo(() => loadRules(), []);
  const [pluginTick, setPluginTick] = useState(0);

  useEffect(() => {
    const handler = () => setPluginTick((t) => t + 1);
    window.addEventListener("bg3:plugin-changed", handler);
    return () => window.removeEventListener("bg3:plugin-changed", handler);
  }, []);

  // Suppress lint — pluginTick triggers re-render so SectionPluginExtras refreshes
  void pluginTick;

  useEffect(() => {
    if (ready) return;
    REGISTRY_PROMISE.then(() => setReady(true));
  }, [ready]);

  // Forward-fill pluginData for any newly registered plugins
  useEffect(() => {
    if (!ready) return;
    setS((prev) => ({
      ...prev,
      pluginData: PluginRegistry.hydratePluginData(prev.pluginData),
    }));
  }, [ready]);

  useEffect(() => {
    CharStorage.saveChar(s);
  }, [s]);

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 28,
            color: "var(--gold)",
            fontStyle: "italic",
          }}
        >
          Loading data…
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 13,
            color: "var(--text-faint)",
            letterSpacing: "0.12em",
          }}
        >
          FETCHING 5E SOURCE FILES
        </div>
      </div>
    );
  }

  const set = (updates: Partial<StoredChar>) =>
    setS((prev) => ({ ...prev, ...updates }));

  const openSheet = () => {
    const p = computePreview(s);
    const toSave: StoredChar = {
      ...s,
      hp: { ...s.hp, current: s.hp.current || p.maxHP },
    };
    CharStorage.saveChar(toSave);
    CharStorage.setActiveId(toSave.id);
    window.location.href = "sheet.html";
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.name || "character"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const newChar = () => {
    if (!confirm("Clear this character and start fresh?")) return;
    setS(blankChar());
  };

  return (
    <div
      className="builder-wrap"
      style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 60px" }}
    >
      <button
        onClick={() => {
          window.location.href = "index.html";
        }}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-faint)",
          fontFamily: "var(--mono)",
          fontSize: 12,
          letterSpacing: "0.1em",
          cursor: "pointer",
          padding: "0 0 16px",
          display: "block",
        }}
      >
        ← MY CHARACTERS
      </button>

      <div
        className="builder-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 30,
              color: "var(--gold)",
              fontStyle: "italic",
            }}
          >
            Character Builder
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--text-faint)",
              letterSpacing: "0.14em",
            }}
          >
            Create your Adventurer
          </div>
        </div>
        <div
          className="builder-header-actions"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <button
            onClick={newChar}
            style={{
              padding: "8px 12px",
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-faint)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            NEW
          </button>
          <button
            onClick={exportJSON}
            style={{
              padding: "8px 14px",
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            EXPORT JSON
          </button>
          <button
            onClick={openSheet}
            style={{
              padding: "8px 20px",
              background: "var(--gold-dim)",
              border: "1px solid var(--gold)",
              borderRadius: 6,
              color: "var(--gold-bright)",
              fontFamily: "var(--mono)",
              fontSize: 13,
              letterSpacing: "0.12em",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            VIEW SHEET →
          </button>
          <button
            className={`char-bar-settings${settingsOpen ? " open" : ""}`}
            onClick={() => setSettingsOpen((v) => !v)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      <div
        className="builder-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div
          className="builder-side"
          style={{ position: "sticky", top: 16, alignSelf: "start" }}
        >
          <BuilderSidePanel s={s} set={set} />
        </div>
        <div className="builder-section">
          <SectionIdentity s={s} set={set} />
          <SectionRace s={s} set={set} />
          <SectionClass s={s} set={set} levelCap={tweaks.levelCap as number} />
          <SectionFeatureChoices s={s} set={set} />
          <SectionASI s={s} set={set} />
          {rules.freeFeatsAtLevel1 > 0 && (
            <SectionFreeFeats s={s} set={set} count={rules.freeFeatsAtLevel1} />
          )}
          <SectionBackground s={s} set={set} />
          <SectionSkills s={s} set={set} />
          <SectionNotes s={s} set={set} />
          <SectionStartingEquipment s={s} set={set} />
          <SectionPluginExtras s={s} set={set} />
        </div>
      </div>
      <TweaksPanel
        title="Settings"
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
        <TweakSection label="Character">
          <TweakStepper
            label="Level cap"
            value={tweaks.levelCap as number}
            min={1}
            max={20}
            onChange={(v) => setTweak("levelCap", v)}
          />
        </TweakSection>
        <TweakSection label="Display">
          <TweakToggle
            label="Light mode"
            value={tweaks.lightMode as boolean}
            onChange={(v) => setTweak("lightMode", v)}
          />
        </TweakSection>
        <TweakSection label="Plugins">
          <PluginSection />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

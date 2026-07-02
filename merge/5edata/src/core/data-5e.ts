import "./classes/index"; // populates ClassMechanicsRegistry before any compute runs
import { CharStorage } from "./storage";
import { REGISTRY } from "./data-registry";
import { DEFAULT_CAMPAIGN_RULES } from "./campaign-rules";
import { PluginRegistry } from "../features/plugin-registry";
import { computeActions } from "./data-actions";
import {
  MONK_KI_DEFS,
  METAMAGIC_COSTS,
  METAMAGIC_COST_AMOUNTS,
} from "./data-ki";
import type {
  StoredChar,
  ComputedChar,
  FeatureEntry,
  RegistryItem,
} from "./types";
import { resolveItem, isItemProficient } from "./item-resolve";
import type { CampaignRules } from "./campaign-rules";
import { ClassMechanicsRegistry } from "./class-mechanics-registry";
import { REPLICATE_PLANS } from "./classes/artificer";
export { REPLICATE_PLANS };

// ── Default / fallback character ─────────────────────────────────────────────

export const DEFAULT_STORED: StoredChar = {
  id: "lyra-001",
  name: "Lyra Nightwhisper",
  player: "Alex",
  campaign: "Shadows of the Crimson Lyre",
  image: null,
  currency: { pp: 0, gp: 87, sp: 0, cp: 0 },
  startingEquipmentApplied: true,

  race: {
    name: "Half-Elf",
    subrace: null,
    source: "PHB",
    asiChoices: [
      { stat: "cha", bonus: 2 },
      { stat: "dex", bonus: 1 },
    ],
    darkvision: 40,
  },

  background: {
    name: "Entertainer",
    source: "PHB",
    skillProficiencies: ["Performance", "Acrobatics"],
  },

  classes: [
    { name: "Bard", subclass: "College of Lore", source: "PHB", level: 7 },
  ],

  abilityScores: { str: 10, dex: 14, con: 14, int: 12, wis: 13, cha: 15 },

  levelASI: [
    { stat: "cha", bonus: 1 },
    { stat: "cha", bonus: 1 },
  ],

  hp: { current: 49, temp: 0 },
  hitDiceRemaining: { d6: 0, d8: 5, d10: 0, d12: 0 },

  proficiencies: {
    skills: [
      "Arcana",
      "Deception",
      "History",
      "Insight",
      "Investigation",
      "Performance",
      "Persuasion",
      "Acrobatics",
    ],
    weapons: ["simple", "hand crossbow", "longsword", "rapier", "shortsword"],
    armor: ["light"],
    tools: ["Disguise Kit", "Flute", "Lute"],
    languages: ["Common", "Elvish", "Halfling"],
  },
  expertise: ["Performance", "Persuasion"],
  jackOfAllTrades: true,

  equipment: {
    meleeSet: { mainhand: "rapier|phb", offhand: null },
    rangedSet: { mainhand: "shortbow|phb" },
    armor: "leather armor|phb",
    helmet: null,
    gloves: null,
    boots: null,
    cloak: null,
    ring1: null,
    ring2: null,
    amulet: null,
    inventory: [
      { key: "rapier|phb", qty: 1, wt: 2, equipped: true, notes: "Finesse" },
      {
        key: "shortbow|phb",
        qty: 1,
        wt: 2,
        equipped: true,
        notes: "Range 80/320",
      },
      { key: "arrows|phb", qty: 20, wt: 1, equipped: false, notes: "" },
      {
        key: "leather armor|phb",
        qty: 1,
        wt: 10,
        equipped: true,
        notes: "AC 11 + Dex",
      },
      { key: "lute|phb", qty: 1, wt: 2, equipped: false, notes: "" },
      {
        key: "entertainer's pack|phb",
        qty: 1,
        wt: 38,
        equipped: false,
        notes: "Costume, perfume, etc.",
      },
      {
        key: "potion of healing|phb",
        qty: 2,
        wt: 0.5,
        equipped: false,
        notes: "2d4+2 HP",
      },
      { key: "gold pieces", qty: 87, wt: 0, equipped: false, notes: "" },
    ],
  },

  spellcasting: {
    slotsUsed: { 1: 1, 2: 1 },
    cantrips: ["vicious mockery|phb", "minor illusion|phb", "mage hand|phb"],
    prepared: [
      "healing word|phb",
      "faerie fire|phb",
      "dissonant whispers|phb",
      "suggestion|phb",
      "hold person|phb",
      "hypnotic pattern|phb",
      "counterspell|phb",
      "polymorph|phb",
    ],
    known: [
      "healing word|phb",
      "faerie fire|phb",
      "dissonant whispers|phb",
      "charm person|phb",
      "suggestion|phb",
      "hold person|phb",
      "invisibility|phb",
      "hypnotic pattern|phb",
      "counterspell|phb",
      "plant growth|phb",
      "polymorph|phb",
      "greater invisibility|phb",
    ],
  },

  resources: {
    rages: null,
    bardicInspiration: { current: 3 },
    kiPoints: null,
    sorceryPoints: null,
    pactSlots: null,
    custom: [],
  },

  feats: [],
  conditions: {},
  deathSaves: { successes: 0, failures: 0 },
  inspiration: true,
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
    personality:
      "Lyra speaks in melodies — every sentence half-sung, even when ordering breakfast.",
    ideals:
      "Beauty. The world is a stage, and every story deserves to be told with grace.",
    bonds: "The Crimson Lyre, an ancient instrument inherited from her mentor.",
    flaws:
      "She cannot resist an audience. Even a single hostile guard becomes a captive crowd of one.",
    backstory:
      "Born to a human troubadour and an elven scribe, Lyra grew up in the green rooms of three kingdoms.",
    journal: [],
  },
};

// ── Lookup tables ────────────────────────────────────────────────────────────

const HIT_DIE_FIXED: Record<number, number> = { 6: 4, 8: 5, 10: 6, 12: 7 };

const SKILL_ABILITY_FALLBACK: Record<string, string> = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "int",
  Athletics: "str",
  Deception: "cha",
  History: "int",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "int",
  Medicine: "wis",
  Nature: "int",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "int",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
};

const MULTICLASS_SLOTS: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

// Artificer own slot table — delayed half-caster (2nd-level slots at lvl 5, 3rd at lvl 9)
const ARTIFICER_SLOTS: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  6: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  8: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  9: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  10: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  11: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  12: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  13: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  14: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  15: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  16: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  17: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  18: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  19: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  20: [4, 3, 3, 3, 2, 0, 0, 0, 0],
};

// Single-class Paladin/Ranger (half-caster) own slot table — differs from multiclass formula at odd levels
const HALF_CASTER_SLOTS: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [3, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  14: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  15: [4, 3, 3, 3, 3, 0, 0, 0, 0],
  16: [4, 3, 3, 3, 3, 0, 0, 0, 0],
  17: [4, 3, 3, 3, 3, 0, 0, 0, 0],
  18: [4, 3, 3, 3, 3, 0, 0, 0, 0],
  19: [4, 3, 3, 3, 3, 0, 0, 0, 0],
  20: [4, 3, 3, 3, 3, 0, 0, 0, 0],
};

// Single-class EK/AT (third-caster) own slot table — spells begin at subclass level 3
const THIRD_CASTER_SLOTS: Record<number, number[]> = {
  3: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  5: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  6: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  7: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  8: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  9: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  10: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  11: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  12: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  13: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  14: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  15: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  16: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  17: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  18: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  19: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  20: [4, 3, 3, 3, 0, 0, 0, 0, 0],
};

const ARMOR_TABLE: Record<
  string,
  { base: number; dex: boolean; maxDex?: number }
> = {
  "padded armor": { base: 11, dex: true },
  "leather armor": { base: 11, dex: true },
  "studded leather armor": { base: 12, dex: true },
  "hide armor": { base: 12, dex: true, maxDex: 2 },
  "chain shirt": { base: 13, dex: true, maxDex: 2 },
  "scale mail": { base: 14, dex: true, maxDex: 2 },
  breastplate: { base: 14, dex: true, maxDex: 2 },
  "half plate armor": { base: 15, dex: true, maxDex: 2 },
  "ring mail": { base: 14, dex: false },
  "chain mail": { base: 16, dex: false },
  "splint armor": { base: 17, dex: false },
  "plate armor": { base: 18, dex: false },
};

const LIGHT_WEAPONS = new Set([
  "dagger",
  "handaxe",
  "shortsword",
  "scimitar",
  "light hammer",
  "sickle",
]);

const MELEE_TWO_HANDED_WEAPONS = new Set([
  "greataxe",
  "greatsword",
  "maul",
  "halberd",
  "glaive",
  "pike",
  "lance",
]);

const WEAPON_TABLE: Record<
  string,
  { dmg: string; type: string; finesse?: boolean; ranged?: boolean }
> = {
  dagger: { dmg: "1d4", type: "Piercing", finesse: true },
  handaxe: { dmg: "1d6", type: "Slashing" },
  javelin: { dmg: "1d6", type: "Piercing" },
  mace: { dmg: "1d6", type: "Bludgeoning" },
  quarterstaff: { dmg: "1d6", type: "Bludgeoning" },
  shortsword: { dmg: "1d6", type: "Piercing", finesse: true },
  scimitar: { dmg: "1d6", type: "Slashing", finesse: true },
  rapier: { dmg: "1d8", type: "Piercing", finesse: true },
  longsword: { dmg: "1d8", type: "Slashing" },
  warhammer: { dmg: "1d8", type: "Bludgeoning" },
  greataxe: { dmg: "1d12", type: "Slashing" },
  greatsword: { dmg: "2d6", type: "Slashing" },
  maul: { dmg: "2d6", type: "Bludgeoning" },
  "hand crossbow": { dmg: "1d6", type: "Piercing", ranged: true },
  shortbow: { dmg: "1d6", type: "Piercing", ranged: true },
  longbow: { dmg: "1d8", type: "Piercing", ranged: true },
  "light crossbow": { dmg: "1d8", type: "Piercing", ranged: true },
  "heavy crossbow": { dmg: "1d10", type: "Piercing", ranged: true },
};

const RACE_SKIP_ENTRIES = new Set([
  "Age",
  "Size",
  "Languages",
  "Alignment",
  "Ability Score Increase",
  "Speed",
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDmgFlat(dmg: string, flat: number): string {
  return dmg.replace(/^(\d+d\d+)([+-]\d+)?/, (_, dice, mod) => {
    const total = (mod ? parseInt(mod, 10) : 0) + flat;
    return total >= 0 ? `${dice}+${total}` : `${dice}${total}`;
  });
}

function entriesToDesc(
  entries: unknown[] | undefined | null,
  depth = 0,
): string {
  if (!entries?.length || depth > 5) return "";
  const clean = (s: string) =>
    s.replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, "$1");
  const parts: string[] = [];
  for (const e of entries) {
    if (typeof e === "string") {
      parts.push(clean(e));
      continue;
    }
    if (!e || typeof e !== "object") continue;
    const obj = e as Record<string, unknown>;
    const type = obj.type as string | undefined;
    if (type === "refOptionalfeature") {
      const name = (obj.optionalfeature as string | undefined)?.split("|")[0];
      if (name) parts.push(`• ${clean(name)}`);
    } else if (
      type === "refSubclassFeature" ||
      type === "statblock" ||
      type === "quote"
    ) {
      // skip — cross-references and flavor
    } else if (type === "table") {
      // skip — too complex for plain text
    } else if (type === "list") {
      const sub = entriesToDesc(obj.items as unknown[], depth + 1);
      if (sub) parts.push(sub);
    } else if (type === "item") {
      const name = obj.name ? clean(obj.name as string) : null;
      const sub = entriesToDesc(obj.entries as unknown[], depth + 1);
      if (name && sub) parts.push(`${name}: ${sub}`);
      else if (name) parts.push(name);
      else if (sub) parts.push(sub);
    } else if ("entries" in obj) {
      if (obj.name && type !== "entries") parts.push(clean(obj.name as string));
      const sub = entriesToDesc(obj.entries as unknown[], depth + 1);
      if (sub) parts.push(sub);
    }
  }
  return parts.join("\n\n");
}

// ── Racial spell grant helper ─────────────────────────────────────────────────

function spellGrantDesc(asp: Record<string, unknown>): string {
  const clean = (s: string) =>
    s
      .split("|")[0]
      .split("#")[0]
      .replace(/\b\w/g, (l) => l.toUpperCase());
  const parts: string[] = [];

  const known = (asp.known ?? {}) as Record<string, unknown>;
  for (const lvl of Object.keys(known).sort()) {
    const val = known[lvl];
    let spells: string[] = [];
    if (Array.isArray(val)) spells = (val as string[]).map(clean);
    else if (val && typeof val === "object" && "_" in (val as object)) {
      // chooseable entry — skip (handled by cantrip picker)
      continue;
    }
    if (spells.length)
      parts.push(
        lvl === "1"
          ? `Cantrip: ${spells.join(", ")}`
          : `Known lvl ${lvl}: ${spells.join(", ")}`,
      );
  }

  const innate = (asp.innate ?? {}) as Record<
    string,
    Record<string, Record<string, string[]>>
  >;
  for (const charLvl of Object.keys(innate).sort(
    (a, b) => Number(a) - Number(b),
  )) {
    const daily = innate[charLvl]?.daily?.["1"] ?? [];
    const spells = daily.map((s: string) => clean(s));
    if (spells.length)
      parts.push(`At char lvl ${charLvl}: ${spells.join(", ")} (1/day)`);
  }

  return parts.join(" · ");
}

// ── Class proficiency tables — derived from ClassMechanicsRegistry ────────────
// MULTICLASS_PROFS stays exported (consumed by builder-5e.tsx for skillCount).
export const MULTICLASS_PROFS: Record<
  string,
  { armor: string[]; weapons: string[]; skillCount?: number }
> = Object.fromEntries(
  ClassMechanicsRegistry.keys().map((n) => [
    n,
    ClassMechanicsRegistry.get(n)!.multiclassProfs ?? {
      armor: [],
      weapons: [],
    },
  ]),
);

export function recomputeArmorWeaponProfs(classes: StoredChar["classes"]): {
  armor: string[];
  weapons: string[];
} {
  const armor = new Set<string>();
  const weapons = new Set<string>();
  for (let i = 0; i < classes.length; i++) {
    const name = classes[i].name;
    const m = ClassMechanicsRegistry.get(name);
    const src =
      i === 0
        ? (m?.startingProfs ?? { armor: [], weapons: [] })
        : (m?.multiclassProfs ?? { armor: [], weapons: [] });
    for (const a of src.armor) armor.add(a);
    for (const w of src.weapons) weapons.add(w);
  }
  return { armor: [...armor], weapons: [...weapons] };
}

// ── Core compute ─────────────────────────────────────────────────────────────

export function computeCharacter(
  s: StoredChar,
  rules?: CampaignRules,
): ComputedChar {
  const effectiveRules = rules ?? DEFAULT_CAMPAIGN_RULES;
  const reg = REGISTRY;
  const classHitDie = (n: string) =>
    reg?.classes?.[n]?.hitDie ?? ClassMechanicsRegistry.get(n)?.hitDie ?? 8;
  const skillAbility = (n: string) =>
    reg?.skills?.[n] ?? SKILL_ABILITY_FALLBACK[n] ?? "str";

  // Per-class mechanics helpers (read from ClassMechanicsRegistry)
  const getClassMechanics = (cls: StoredChar["classes"][number]) =>
    ClassMechanicsRegistry.get(cls.name);
  const getCasterProgression = (
    cls: StoredChar["classes"][number],
  ): string | null => {
    const m = getClassMechanics(cls);
    return (
      m?.subclassCasterProgression?.[cls.subclass ?? ""] ??
      m?.casterProgression ??
      reg?.classes?.[cls.name]?.casterProgression ??
      null
    );
  };
  const getSpellcastingAbility = (
    cls: StoredChar["classes"][number],
  ): string | null => {
    const m = getClassMechanics(cls);
    return (
      m?.subclassSpellcastingAbility?.[cls.subclass ?? ""] ??
      m?.spellcastingAbility ??
      reg?.classes?.[cls.name]?.spellcastingAbility ??
      null
    );
  };

  const totalLevel = s.classes.reduce((sum, c) => sum + c.level, 0);
  const baseProf =
    totalLevel <= 4
      ? 2
      : totalLevel <= 8
        ? 3
        : totalLevel <= 12
          ? 4
          : totalLevel <= 16
            ? 5
            : 6;

  // ── Magic-item bonuses from equipped gear (ALL items + infusion overlays) ──
  // Reads 5etools `bonus*`/effect fields off every worn/wielded item. Artificer
  // attachment infusions overlay synthetic bonus fields onto their host item so
  // they flow through this same pipeline. Computed early so `bonusProficiencyBonus`
  // can fold into `prof` before saves/skills/attacks consume it.
  const resolveRegItem = (key: string | null | undefined) =>
    resolveItem(s.equipment.inventory, reg?.items ?? null, key);
  const parseFlatBonus = (v: unknown) => {
    const n = parseInt(String(v ?? "").replace("+", ""), 10);
    return Number.isFinite(n) ? n : 0;
  };
  // Two-handed mainhand → no shield in offhand (gates shield bonusAc).
  const _regMh = resolveRegItem(s.equipment.meleeSet?.mainhand);
  const mhIsTwoHanded =
    (_regMh?.property ?? [])
      .map((p: string) => p.split("|")[0])
      .includes("2H") ||
    MELEE_TWO_HANDED_WEAPONS.has(
      (s.equipment.meleeSet?.mainhand?.split("|")[0] ?? "")
        .toLowerCase()
        .trim(),
    );
  // Attachment infusions → synthetic bonus overlay keyed by host item key.
  const infusionOverlay = new Map<string, Partial<RegistryItem>>();
  for (const inf of s.activeInfusions ?? []) {
    if (!inf.targetItemKey || !inf.infusionName) continue;
    const plan = REPLICATE_PLANS.find(
      (p: { name: string }) => p.name === inf.infusionName,
    );
    if (plan?.isAttachment && plan.grant)
      infusionOverlay.set(inf.targetItemKey, {
        ...infusionOverlay.get(inf.targetItemKey),
        ...plan.grant,
      });
  }
  // Effective item = registry data merged with any infusion overlay (overlay wins).
  const effectiveItem = (
    key: string | null | undefined,
  ): RegistryItem | undefined => {
    const base = resolveRegItem(key);
    const ov = key ? infusionOverlay.get(key) : undefined;
    if (!base && !ov) return undefined;
    return { ...(base ?? {}), ...(ov ?? {}) } as RegistryItem;
  };

  const equippedKeys = new Set<string>();
  const addEqKey = (k?: string | null) => {
    if (k) equippedKeys.add(k);
  };
  addEqKey(s.equipment.armor);
  addEqKey(s.equipment.helmet);
  addEqKey(s.equipment.gloves);
  addEqKey(s.equipment.boots);
  addEqKey(s.equipment.cloak);
  addEqKey(s.equipment.ring1);
  addEqKey(s.equipment.ring2);
  addEqKey(s.equipment.amulet);
  addEqKey(s.equipment.meleeSet?.mainhand);
  addEqKey(s.equipment.rangedSet?.mainhand);
  if (!mhIsTwoHanded) addEqKey(s.equipment.meleeSet?.offhand);
  for (const inv of s.equipment.inventory)
    if (inv.equipped) equippedKeys.add(inv.key);

  let magicAc = 0;
  let magicSave = 0;
  let magicSpellAttack = 0;
  let magicSpellSaveDc = 0;
  let magicAbilityCheck = 0;
  let magicProfBonus = 0;
  let magicConcentration = 0;
  const magicAcSources: string[] = [];
  const resistSet = new Set<string>();
  const speedMods: NonNullable<RegistryItem["modifySpeed"]>[] = [];
  for (const key of equippedKeys) {
    const r = effectiveItem(key);
    if (!r) continue;
    const a = parseFlatBonus(r.bonusAc);
    if (a) {
      magicAc += a;
      magicAcSources.push(r.name);
    }
    magicSave += parseFlatBonus(r.bonusSavingThrow);
    magicSpellAttack += parseFlatBonus(r.bonusSpellAttack);
    magicSpellSaveDc += parseFlatBonus(r.bonusSpellSaveDc);
    magicAbilityCheck += parseFlatBonus(r.bonusAbilityCheck);
    magicProfBonus += parseFlatBonus(r.bonusProficiencyBonus);
    magicConcentration += parseFlatBonus(r.bonusSavingThrowConcentration);
    for (const dt of r.resist ?? []) resistSet.add(dt.toLowerCase());
    if (r.modifySpeed) speedMods.push(r.modifySpeed);
  }
  const prof = baseProf + magicProfBonus;

  // ASI derivation — use structured asiSlots if present, fall back to flat levelASI
  // Also include race feat ability choice (Human Variant / Custom Lineage free feat)
  const raceFeatASI = s.race.featAbilityChoice
    ? [{ stat: s.race.featAbilityChoice, bonus: 1 }]
    : [];
  const effectiveLevelASI = [
    ...(s.asiSlots?.length
      ? s.asiSlots.flatMap((slot) => {
          if (slot.type === "bonus") return slot.bonuses ?? [];
          if (slot.type === "feat" && slot.featAbilityChoice)
            return [{ stat: slot.featAbilityChoice, bonus: 1 }];
          return [];
        })
      : (s.levelASI ?? [])),
    ...raceFeatASI,
  ];
  // effectiveFeats — all active feat names (level ASI slots + race-granted feat)
  const effectiveFeats = [
    ...(s.asiSlots?.length
      ? s.asiSlots
          .filter((sl) => sl.type === "feat")
          .map((sl) => sl.feat!)
          .filter(Boolean)
      : (s.feats ?? [])),
    ...(s.race.feat ? [s.race.feat] : []),
  ];
  const hasFeat = (name: string) =>
    effectiveFeats.some((f) => f.toLowerCase() === name.toLowerCase());

  const finalScore = (stat: string): number => {
    const base = s.abilityScores[stat as keyof typeof s.abilityScores] ?? 10;
    const racial = s.race.asiChoices.find((a) => a.stat === stat)?.bonus ?? 0;
    const lvlAsi = effectiveLevelASI
      .filter((a) => a.stat === stat)
      .reduce((sum, a) => sum + a.bonus, 0);
    return base + racial + lvlAsi;
  };
  const abilMod = (stat: string) => Math.floor((finalScore(stat) - 10) / 2);

  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  const STAT_LABEL: Record<string, string> = {
    str: "STR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "WIS",
    cha: "CHA",
  };

  // Saving throws — primary class (index 0) determines save proficiencies
  const saveProfClass = s.classes[0]?.name ?? "";
  const saveProfs =
    reg?.classes?.[saveProfClass]?.saveProficiencies ??
    ClassMechanicsRegistry.get(saveProfClass)?.saveProficiencies ??
    [];

  const abilities: ComputedChar["abilities"] = {};
  for (const stat of stats) {
    const mod = abilMod(stat);
    const hasSaveProf = saveProfs.includes(stat);
    abilities[STAT_LABEL[stat]] = {
      score: finalScore(stat),
      mod,
      prof: hasSaveProf,
      save: hasSaveProf ? mod + prof : mod,
    };
  }

  // Choice-driven per-class effects (e.g. BG3 Ranger Favoured Enemy / Natural Explorer)
  // Each class may declare choiceEffects in its ClassMechanics object.
  const bg3ExtraSkillProfs = new Set<string>();
  const bg3ExtraArmorProfs: string[] = [];
  const bg3GrantedCantrips: string[] = [];
  const bg3GrantedSpells: { name: string; usage: string }[] = [];
  const bg3DamageResistances: string[] = [];

  for (const cls of s.classes) {
    const m = ClassMechanicsRegistry.get(cls.name);
    for (const ce of m?.choiceEffects ?? []) {
      const chosen =
        (s.featureChoices as Record<string, string[]>)[ce.featureChoicesKey] ??
        [];
      for (const choice of chosen) {
        const eff = ce.effects[choice];
        if (!eff) continue;
        for (const sk of eff.skills ?? []) bg3ExtraSkillProfs.add(sk);
        for (const ap of eff.armorProfs ?? []) {
          if (!bg3ExtraArmorProfs.includes(ap)) bg3ExtraArmorProfs.push(ap);
        }
        for (const ct of eff.cantrips ?? []) {
          if (!bg3GrantedCantrips.includes(ct)) bg3GrantedCantrips.push(ct);
        }
        for (const sp of eff.spells ?? []) bg3GrantedSpells.push(sp);
        for (const res of eff.resistances ?? []) {
          if (!bg3DamageResistances.includes(res))
            bg3DamageResistances.push(res);
        }
      }
    }
  }

  // Skills — include Custom Lineage variable skill if chosen
  const raceVariableSkill =
    s.race.variableTrait === "skill" && s.race.variableSkill
      ? s.race.variableSkill
      : null;
  const skillNames = reg?.skills
    ? Object.keys(reg.skills)
    : Object.keys(SKILL_ABILITY_FALLBACK);
  const bgSkillSet = new Set(
    s.background.skillProficiencies.map((sk) => sk.toLowerCase()),
  );
  const multiclassSkillSet = new Set(s.featureChoices?.multiclassSkills ?? []);
  const hasSkillProf = (name: string) =>
    s.proficiencies.skills.includes(name) ||
    bgSkillSet.has(name.toLowerCase()) ||
    name === raceVariableSkill ||
    bg3ExtraSkillProfs.has(name) ||
    multiclassSkillSet.has(name);
  const skillBonus = (name: string): number => {
    const mod = abilMod(skillAbility(name)) + magicAbilityCheck;
    if (s.expertise.includes(name)) return mod + prof * 2;
    if (hasSkillProf(name)) return mod + prof;
    if (s.jackOfAllTrades) return mod + Math.floor(prof / 2);
    return mod;
  };
  const skillProfLevel = (name: string): "none" | "prof" | "expert" => {
    if (s.expertise.includes(name)) return "expert";
    if (hasSkillProf(name)) return "prof";
    return "none";
  };
  const skills: ComputedChar["skills"] = skillNames.map((name) => ({
    name,
    abil: STAT_LABEL[skillAbility(name)],
    mod: skillBonus(name),
    prof: skillProfLevel(name),
  }));

  // Max HP (base + campaign bonus HP per level)
  const maxHP =
    s.classes
      .flatMap((c) => {
        const die = classHitDie(c.name);
        return Array.from(
          { length: c.level },
          (_, i) => (i === 0 ? die : HIT_DIE_FIXED[die]) + abilMod("con"),
        );
      })
      .reduce((sum, n) => sum + n, 0) +
    effectiveRules.bonusHPPerLevel * totalLevel;

  // Spell slots
  // Single-class half/third casters use their own class table (not the multiclass formula,
  // which rounds down fractions and gives wrong results for single-class characters).
  const nonPactCasterClasses = s.classes.filter((c) => {
    const prog = getCasterProgression(c);
    return prog && prog !== "pact";
  });
  let slotMaxes: number[];
  if (nonPactCasterClasses.length === 0) {
    slotMaxes = [0, 0, 0, 0, 0, 0];
  } else if (nonPactCasterClasses.length === 1) {
    const cls = nonPactCasterClasses[0];
    const prog = getCasterProgression(cls);
    if (prog === "half")
      slotMaxes = HALF_CASTER_SLOTS[cls.level] ?? [0, 0, 0, 0, 0, 0];
    else if (prog === "third")
      slotMaxes = THIRD_CASTER_SLOTS[cls.level] ?? [0, 0, 0, 0, 0, 0];
    else if (prog === "artificer")
      slotMaxes = ARTIFICER_SLOTS[cls.level] ?? [0, 0, 0, 0, 0, 0];
    else slotMaxes = MULTICLASS_SLOTS[cls.level] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
  } else {
    const spellLevel = nonPactCasterClasses.reduce((sum, c) => {
      const prog = getCasterProgression(c);
      if (prog === "full") return sum + c.level;
      if (prog === "half") return sum + Math.floor(c.level / 2);
      if (prog === "third") return sum + Math.floor(c.level / 3);
      if (prog === "artificer") return sum + Math.ceil(c.level / 2);
      return sum;
    }, 0);
    slotMaxes = MULTICLASS_SLOTS[spellLevel] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  // Warlock pact slots
  const warlockLevel = s.classes.find((c) => c.name === "Warlock")?.level ?? 0;
  const pactSlotMax = warlockLevel >= 2 ? 2 : warlockLevel >= 1 ? 1 : 0;
  const pactSlotLevel =
    warlockLevel >= 9
      ? 5
      : warlockLevel >= 7
        ? 4
        : warlockLevel >= 5
          ? 3
          : warlockLevel >= 3
            ? 2
            : 1;

  const slots: ComputedChar["spellcasting"]["slots"] = slotMaxes
    .map((max, i) => ({
      level: i + 1,
      max,
      current: max - (s.spellcasting.slotsUsed[i + 1] ?? 0),
    }))
    .filter((sl) => sl.max > 0);

  // Spell ability — use getSpellcastingAbility helper (reads ClassMechanicsRegistry)
  const spellClass = s.classes.find((c) => getSpellcastingAbility(c) !== null);
  const spellAbilKey = spellClass ? getSpellcastingAbility(spellClass) : null;
  const spellMod = spellAbilKey ? abilMod(spellAbilKey) : 0;
  const spellAbilLabel = spellAbilKey
    ? ({
        str: "Strength",
        dex: "Dexterity",
        con: "Constitution",
        int: "Intelligence",
        wis: "Wisdom",
        cha: "Charisma",
      }[spellAbilKey] ?? "—")
    : "—";

  const cantripTier = totalLevel >= 10 ? 3 : totalLevel >= 5 ? 2 : 1;

  const bardLevel = s.classes.find((c) => c.name === "Bard")?.level ?? 0;

  // Carry capacity
  const isHuman = s.race.name === "Human";
  const carryCapacityKg = Math.floor(
    (40 + 10 * finalScore("str")) * (isHuman ? 1.25 : 1),
  );
  const totalWeightLb = s.equipment.inventory.reduce(
    (sum, i) => sum + (i.wt ?? 0) * i.qty,
    0,
  );
  const totalWeightKg = Math.round(totalWeightLb * 0.453592 * 10) / 10;
  const encumberedAt = Math.round(carryCapacityKg * 0.8);
  const heavilyEncAt = Math.round(carryCapacityKg * 0.9333);

  // Darkvision
  const darkvisionFt = s.race.darkvision ?? 0;
  const darkvisionM = darkvisionFt === 80 ? 24 : darkvisionFt === 40 ? 12 : 0;

  const hitDiceDisplay = s.classes
    .map((c) => `${c.level}d${classHitDie(c.name)}`)
    .join(" + ");
  const classLabel = s.classes.map((c) => `${c.name} ${c.level}`).join(" / ");

  const passive: ComputedChar["passive"] = {
    perception: 10 + skillBonus("Perception"),
    investigation: 10 + skillBonus("Investigation"),
    insight: 10 + skillBonus("Insight"),
  };

  // Resources — derived from ClassMechanics declarations
  const barbClass = s.classes.find((c) => c.name === "Barbarian");
  const monkClass = s.classes.find((c) => c.name === "Monk");
  const sorcClass = s.classes.find((c) => c.name === "Sorcerer");

  // Helper: pick max from a threshold table [[minLevel, value], ...]
  const thresholdMax = (table: [number, number][], level: number) =>
    [...table].reverse().find(([l]) => level >= l)?.[1] ?? 0;

  const bardMech = ClassMechanicsRegistry.get("Bard");
  const bardicInspiration = (() => {
    if (bardLevel === 0 || !bardMech?.bardicInspiration) return null;
    const bi = bardMech.bardicInspiration;
    const max = thresholdMax(bi.maxByLevel, bardLevel);
    const dieFaces = thresholdMax(bi.dieByLevel, bardLevel);
    return {
      current: s.resources.bardicInspiration?.current ?? max,
      max,
      resetOn: bi.resetOn,
      die: `d${dieFaces}`,
    };
  })();

  const rages = (() => {
    if (!barbClass) return null;
    const rageTable = ClassMechanicsRegistry.get("Barbarian")?.rageTable ?? {};
    const max = rageTable[barbClass.level] ?? 2;
    return { current: s.resources.rages ?? max, max, resetOn: "long" as const };
  })();

  const kiPoints = monkClass
    ? {
        current: s.resources.kiPoints ?? monkClass.level,
        max: monkClass.level,
        resetOn: "short" as const,
      }
    : null;

  const sorceryPoints = sorcClass
    ? {
        current: s.resources.sorceryPoints ?? sorcClass.level,
        max: sorcClass.level,
        resetOn: "long" as const,
      }
    : null;

  const resources: ComputedChar["resources"] = {
    bardicInspiration,
    rages,
    kiPoints,
    sorceryPoints,
    custom: s.resources.custom ?? [],
  };

  // Conditions list
  const conditionsList = [
    "Blinded",
    "Burning",
    "Charmed",
    "Downed",
    "Encumbered",
    "Ensnared",
    "Enwebbed",
    "Fearful",
    "Frightened",
    "Grappled",
    "Heavily Encumbered",
    "Invisible",
    "Paralyzed",
    "Poisoned",
    "Prone",
    "Restrained",
    "Silenced",
    "Sleeping",
    "Slowed",
    "Stunned",
    "Turned",
    "Wet",
  ];

  // Race features from registry — base race + selected subrace
  const raceRegData = reg?.races?.find((r) => r.name === s.race.name);
  const subraceData = s.race.subrace
    ? raceRegData?.subrace.find((sr) => sr.name === s.race.subrace)
    : undefined;
  type RaceEntry = { type?: string; name?: string; entries?: unknown[] };
  const parseRaceEntries = (entries: unknown[]) =>
    (entries as RaceEntry[])
      .filter(
        (e) =>
          e?.type === "entries" && e.name && !RACE_SKIP_ENTRIES.has(e.name),
      )
      .map((e) => ({
        name: e.name!,
        desc: entriesToDesc(e.entries ?? []),
        entries: e.entries ?? [],
      }));
  // Merge: base entries first, then subrace entries (subrace may override by name)
  const baseEntries = parseRaceEntries(raceRegData?.entries ?? []);
  const subraceEntries = parseRaceEntries(
    (subraceData?.entries as unknown[]) ?? [],
  );
  // Deduplicate by name — subrace version wins
  const raceFeatureMap = new Map<string, FeatureEntry>();
  for (const f of baseEntries) raceFeatureMap.set(f.name, f);
  for (const f of subraceEntries) raceFeatureMap.set(f.name, f); // overwrite

  // Racial innate spell grants (base race — applies to all, not variant-specific)
  const baseAsp = (
    (raceRegData?.additionalSpells ?? []) as Record<string, unknown>[]
  ).filter((asp) => !asp.name); // unnamed → applies to all race members
  for (const asp of baseAsp) {
    const desc = spellGrantDesc(asp);
    if (desc)
      raceFeatureMap.set("Innate Spells", { name: "Innate Spells", desc });
  }

  // Subrace / legacy spell grants (from additionalSpells-based pseudo-subraces)
  if (subraceData) {
    const subAsps = ((
      subraceData as { additionalSpells?: Record<string, unknown>[] }
    ).additionalSpells ?? []) as Record<string, unknown>[];
    for (const asp of subAsps) {
      const desc = spellGrantDesc(asp);
      if (desc) {
        const label = `${subraceData.name} Spells`;
        raceFeatureMap.set(label, { name: label, desc });
      }
    }
    // Dragonborn-style pseudo-subraces: damageType + resist from _versions implementation
    if (subraceData.damageType && subraceData.resist) {
      const dmg = subraceData.damageType;
      const res = subraceData.resist[0] ?? dmg.toLowerCase();
      raceFeatureMap.set("Draconic Ancestry", {
        name: "Draconic Ancestry",
        desc: `${dmg} damage type. Resistance to ${res} damage. Breath Weapon uses ${dmg} damage in a 15-ft Cone or 30-ft Line (DEX save, 1d10 per attack scaling to 4d10 at level 17, uses = Proficiency Bonus per long rest).`,
      });
    }
  }

  // Race-granted feat (Human Variant, Custom Lineage)
  if (s.race.feat) {
    raceFeatureMap.set("Race Feat", { name: `Feat: ${s.race.feat}`, desc: "" });
  }

  const raceFeatures: FeatureEntry[] = [...raceFeatureMap.values()];

  // Class features from registry
  const classFeatures: FeatureEntry[] = s.classes.flatMap((cls) => {
    const feats = reg?.classes?.[cls.name]?.features ?? [];
    return feats
      .filter((f) => f.level <= cls.level && !f.isClassFeatureVariant)
      .map((f) => ({
        name: f.name,
        desc: entriesToDesc(f.entries as unknown[]),
        entries: f.entries ?? [],
        className: cls.name,
        level: f.level,
      }));
  });

  // Subclass features from registry
  const subclassFeatures: FeatureEntry[] = s.classes.flatMap((cls) => {
    if (!cls.subclass) return [];
    const allSubFeats = reg?.classes?.[cls.name]?.subclassFeatures ?? [];
    const scData = (
      (reg?.classes?.[cls.name]?.subclasses as {
        name: string;
        shortName?: string;
      }[]) ?? []
    ).find((sc) => sc.name === cls.subclass);
    const shortName = scData?.shortName ?? cls.subclass;
    return allSubFeats
      .filter(
        (f) =>
          f.subclassShortName === shortName &&
          f.level <= cls.level &&
          !f.isClassFeatureVariant &&
          f.entries?.length,
      )
      .map((f) => ({
        name: f.name,
        desc: entriesToDesc(f.entries as unknown[]),
        entries: f.entries ?? [],
        className: cls.name,
        level: f.level,
      }));
  });

  // Background features from registry — XPHB backgrounds surface their feat
  const bgRegData = reg?.backgrounds?.find((b) => b.name === s.background.name);
  const backgroundFeatures: FeatureEntry[] = (
    (bgRegData?.entries ?? []) as {
      data?: { isFeature?: boolean };
      name?: string;
      entries?: unknown[];
    }[]
  )
    .filter((e) => e?.data?.isFeature === true)
    .map((e) => ({
      name: e.name ?? "",
      desc: entriesToDesc(e.entries ?? []),
      entries: e.entries ?? [],
    }));
  if (bgRegData?.backgroundFeat) {
    const featLookupName = bgRegData.backgroundFeat.replace(/\s*\(.*\)$/, "");
    const featData = (
      reg?.feats as Array<{ name: string; entries?: unknown[] }> | undefined
    )?.find((f) => f.name === featLookupName);
    backgroundFeatures.push({
      name: `Feat: ${bgRegData.backgroundFeat}`,
      desc: entriesToDesc(featData?.entries),
      entries: featData?.entries ?? [],
    });
  }

  // Speed from race registry
  const raceSpeedRaw = raceRegData?.speed;
  const raceSpeedFt =
    typeof raceSpeedRaw === "object" && raceSpeedRaw !== null
      ? (raceSpeedRaw.walk ?? 30)
      : (raceSpeedRaw ?? 30);
  void Math.round(raceSpeedFt * 0.3); // raceSpeedM unused — speed displayed in ft only

  // ── AC from equipped armor ────────────────────────────────────────────────
  // Try registry items first (works for any item), fallback to static table.
  // resolveRegItem / mhIsTwoHanded / magic* bonuses computed in the early block.
  const armorKey = s.equipment.armor
    ? s.equipment.armor.split("|")[0].toLowerCase().trim()
    : null;
  const regArmor = resolveRegItem(s.equipment.armor);
  const armorData = armorKey ? ARMOR_TABLE[armorKey] : undefined;
  const shieldKey = s.equipment.meleeSet?.offhand;
  const shieldBonus =
    !mhIsTwoHanded &&
    (shieldKey === "shield" || shieldKey?.startsWith("shield|"))
      ? (resolveRegItem(shieldKey)?.ac ?? 2)
      : 0;

  // Fold save bonus into every ability's save (flat, stacks with proficiency).
  if (magicSave) {
    for (const k of Object.keys(abilities))
      abilities[k] = { ...abilities[k], save: abilities[k].save + magicSave };
  }

  let computedAC = 10 + abilMod("dex");
  let computedACSource = "Unarmored";

  if (regArmor?.ac != null) {
    // Use registry data
    const t = (regArmor.type ?? "").replace(/\|.*/, "");
    let dexBonus = 0;
    if (t === "LA") dexBonus = abilMod("dex");
    else if (t === "MA")
      dexBonus = Math.min(abilMod("dex"), regArmor.dexterityMax ?? 2);
    computedAC = regArmor.ac + dexBonus + shieldBonus;
    computedACSource = regArmor.name + (shieldBonus ? " + Shield" : "");
  } else if (armorData) {
    // Static table fallback
    const dexBonus = armorData.dex
      ? Math.min(abilMod("dex"), armorData.maxDex ?? 99)
      : 0;
    computedAC = armorData.base + dexBonus + shieldBonus;
    const armorName = (armorKey ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
    computedACSource = shieldBonus ? `${armorName} + Shield` : armorName;
  } else if (s.equipment.armor) {
    computedAC = 10 + abilMod("dex") + shieldBonus;
    computedACSource = s.equipment.armor
      .split("|")[0]
      .replace(/\b\w/g, (l) => l.toUpperCase());
  } else {
    // Check each active class for a declared unarmedAC formula
    let unarmedACApplied = false;
    for (const cls of s.classes) {
      const uda = ClassMechanicsRegistry.get(cls.name)?.unarmedAC;
      if (!uda) continue;
      if (
        uda.requiresSubclass &&
        !uda.requiresSubclass.includes(cls.subclass ?? "")
      )
        continue;
      if (uda.requiresNoShield && shieldBonus > 0) continue;
      let ac: number;
      if (uda.formula === "dex+con")
        ac = 10 + abilMod("dex") + abilMod("con") + shieldBonus;
      else if (uda.formula === "dex+wis")
        ac = 10 + abilMod("dex") + abilMod("wis");
      else ac = 13 + abilMod("dex") + shieldBonus; // flat13+dex
      computedAC = ac;
      computedACSource =
        shieldBonus > 0 && uda.shieldLabel ? uda.shieldLabel : uda.label;
      unarmedACApplied = true;
      break;
    }
    if (!unarmedACApplied) {
      computedAC = 10 + abilMod("dex") + shieldBonus;
      computedACSource = shieldBonus ? "Unarmored + Shield" : "Unarmored";
    }
  }

  // Magic AC from equipped gear (+N armor/shield, Ring/Cloak of Protection, etc.)
  if (magicAc) {
    computedAC += magicAc;
    const label = magicAcSources.length ? magicAcSources.join(", ") : "Magic";
    computedACSource += ` + ${label} (+${magicAc})`;
  }

  // ── Class speed bonuses ───────────────────────────────────────────────────
  const armorIsHeavy =
    (armorData ? !armorData.dex : false) ||
    (regArmor?.type ?? "").replace(/\|.*/, "") === "HA";
  let totalSpeedFt = raceSpeedFt;
  // Class speed bonuses declared in ClassMechanics
  for (const cls of s.classes) {
    const m = ClassMechanicsRegistry.get(cls.name);
    for (const sb of m?.speedBonuses ?? []) {
      if (cls.level < sb.minLevel) continue;
      if (sb.requiresUnarmored && s.equipment.armor) continue;
      if (sb.requiresNotHeavyArmor && armorIsHeavy) continue;
      totalSpeedFt += sb.bonus;
    }
  }
  // Infiltrator Arcane Armor: Powered Steps (+5ft speed)
  if (
    s.classes.some((c) => c.name === "Artificer" && c.subclass === "Armorer") &&
    s.armorerModel === "infiltrator"
  ) {
    totalSpeedFt += 5;
  }

  // Magic-item walk-speed modifiers (modifySpeed); fly/climb/burrow not modeled.
  // static overrides the base, then multiply scales the result.
  for (const ms of speedMods)
    if (ms.static?.walk != null) totalSpeedFt = ms.static.walk;
  for (const ms of speedMods)
    if (ms.multiply?.walk != null)
      totalSpeedFt = Math.round(totalSpeedFt * ms.multiply.walk);
  const totalSpeedM = Math.round(totalSpeedFt * 0.3);

  // ── Attacks from equipped weapons ─────────────────────────────────────────
  const DMG_TYPE_FULL: Record<string, string> = {
    B: "Bludgeoning",
    P: "Piercing",
    S: "Slashing",
    F: "Fire",
    C: "Cold",
    L: "Lightning",
    T: "Thunder",
    N: "Necrotic",
    R: "Radiant",
    A: "Acid",
    Po: "Poison",
    Ps: "Psychic",
  };

  // Flat magic weapon bonus ("+1"/"+2"/"+3") — applies to both attack and damage rolls.
  const weaponBonusNum = (regItem: RegistryItem | undefined) => {
    const n = parseInt(String(regItem?.bonusWeapon ?? "").replace("+", ""), 10);
    return Number.isFinite(n) ? n : 0;
  };
  // Unconditional extra damage dice on a hit (e.g. "+1d4 Fire"), appended to the dmg string.
  const bonusDamageSuffix = (regItem: RegistryItem | undefined) => {
    const bd = regItem?.bonusDamage;
    if (!bd?.dice) return "";
    const typeLabel = bd.type
      ? bd.type.charAt(0).toUpperCase() + bd.type.slice(1)
      : "";
    return ` + ${bd.dice}${typeLabel ? " " + typeLabel : ""}`;
  };

  // ── Subclass-granted proficiencies — from ClassMechanics declarations ────────
  const subclassArmorGrants: string[] = [];
  const subclassWeaponGrants: string[] = [];
  for (const cls of s.classes) {
    const m = ClassMechanicsRegistry.get(cls.name);
    const sub = (cls.subclass ?? "").toLowerCase();
    for (const grant of m?.subclassArmorGrants ?? []) {
      if (!sub.includes(grant.subclassPattern)) continue;
      if (grant.minLevel && cls.level < grant.minLevel) continue;
      subclassArmorGrants.push(...grant.armor);
      if (grant.weapons) subclassWeaponGrants.push(...grant.weapons);
    }
    for (const grant of m?.subclassWeaponGrants ?? []) {
      if (!sub.includes(grant.subclassPattern)) continue;
      if (grant.minLevel && cls.level < grant.minLevel) continue;
      subclassWeaponGrants.push(...grant.weapons);
      if (grant.armor) subclassArmorGrants.push(...grant.armor);
    }
  }

  const classProfs = recomputeArmorWeaponProfs(s.classes);
  const allWeaponProfs = [
    ...new Set([
      ...classProfs.weapons.map((p) => p.toLowerCase()),
      ...s.proficiencies.weapons.map((p) => p.toLowerCase()),
      ...subclassWeaponGrants,
    ]),
  ];
  const allArmorProfs = [
    ...new Set([
      ...classProfs.armor.map((p) => p.toLowerCase()),
      ...s.proficiencies.armor.map((p) => p.toLowerCase()),
      ...bg3ExtraArmorProfs.map((p) => p.toLowerCase()),
      ...subclassArmorGrants,
    ]),
  ];

  // Melee attack stat override — e.g. Hexblade uses CHA when CHA ≥ STR
  const isHexblade = s.classes.some((c) => {
    const override = ClassMechanicsRegistry.get(
      c.name,
    )?.subclassMeleeStatOverride;
    return override?.[c.subclass ?? ""] === "max-of-str-cha";
  });
  const meleeStatKey = (hasFinesse: boolean): string => {
    const candidates: string[] = ["str", "cha", ...(hasFinesse ? ["dex"] : [])];
    return candidates.reduce((best, st) =>
      abilMod(st) >= abilMod(best) ? st : best,
    );
  };

  const attacks: ComputedChar["attacks"] = [];
  const addWeapon = (key: string | null | undefined) => {
    if (!key || key === "shield" || key.startsWith("shield|")) return;
    const wname = key.split("|")[0].toLowerCase().trim();
    const regWpn = effectiveItem(key);
    const wstats = WEAPON_TABLE[wname];

    if (regWpn?.dmg1) {
      const props = (regWpn.property ?? []).map((p) => p.split("|")[0]);
      const hasFinesse = props.includes("F");
      const isRanged = (regWpn.type ?? "").replace(/\|.*/, "") === "R";
      const statKey = isRanged
        ? "dex"
        : isHexblade
          ? meleeStatKey(hasFinesse)
          : hasFinesse && abilMod("dex") > abilMod("str")
            ? "dex"
            : "str";
      const mod = abilMod(statKey);
      const wb = weaponBonusNum(regWpn); // bonusWeapon → attack & damage
      const wAtk = parseFlatBonus(regWpn.bonusWeaponAttack); // attack only
      const wDmg = parseFlatBonus(regWpn.bonusWeaponDamage); // damage only
      const hasProfW = isItemProficient(regWpn, allWeaponProfs, allArmorProfs);
      const flatMod = mod + wb + wDmg;
      const bonus = mod + (hasProfW ? prof : 0) + wb + wAtk;
      const dmgStr =
        (flatMod >= 0
          ? `${regWpn.dmg1}+${flatMod}`
          : `${regWpn.dmg1}${flatMod}`) + bonusDamageSuffix(regWpn);
      const dmgType =
        DMG_TYPE_FULL[regWpn.dmgType ?? ""] ?? regWpn.dmgType ?? "";
      const noteArr: string[] = [];
      if (isRanged) noteArr.push("Ranged");
      if (hasFinesse) noteArr.push("Finesse");
      if (isHexblade && !isRanged && statKey === "cha")
        noteArr.push("Hex Warrior");
      if (!hasProfW) noteArr.push("No Prof.");
      if (props.includes("V") && regWpn.dmg2)
        noteArr.push(`Versatile ${regWpn.dmg2}`);
      attacks.push({
        name: regWpn.name,
        bonus,
        dmg: dmgStr,
        type: dmgType,
        notes: noteArr.join(" · "),
        crit: regWpn.critThreshold,
      });
    } else if (wstats) {
      const statKey = wstats.ranged
        ? "dex"
        : isHexblade
          ? meleeStatKey(wstats.finesse ?? false)
          : wstats.finesse && abilMod("dex") > abilMod("str")
            ? "dex"
            : "str";
      const mod = abilMod(statKey);
      // Static table items lack registry data for prof check — fall back to name match
      const hasProfW =
        allWeaponProfs.includes("simple") ||
        allWeaponProfs.includes("martial") ||
        allWeaponProfs.includes(wname);
      const bonus = mod + (hasProfW ? prof : 0);
      const dmgStr = mod >= 0 ? `${wstats.dmg}+${mod}` : `${wstats.dmg}${mod}`;
      const noteBase = wstats.ranged
        ? "Ranged"
        : wstats.finesse
          ? "Finesse"
          : isHexblade && statKey === "cha"
            ? "Hex Warrior"
            : "";
      attacks.push({
        name: wname.replace(/\b\w/g, (l) => l.toUpperCase()),
        bonus,
        dmg: dmgStr,
        type: wstats.type,
        notes: [noteBase, !hasProfW ? "No Prof." : ""]
          .filter(Boolean)
          .join(" · "),
      });
    }
  };
  addWeapon(s.equipment.meleeSet?.mainhand);
  addWeapon(s.equipment.rangedSet?.mainhand);

  // ── Offhand (light weapon bonus action attack) ─────────────────────────────
  const ohKey = s.equipment.meleeSet?.offhand;
  if (ohKey && ohKey !== "shield" && !ohKey.startsWith("shield|")) {
    const ohname = ohKey.split("|")[0].toLowerCase().trim();
    const regOh = effectiveItem(ohKey);
    const ohstats = WEAPON_TABLE[ohname];
    const ohProps = (regOh?.property ?? []).map((p: string) => p.split("|")[0]);
    const isLight = regOh ? ohProps.includes("L") : LIGHT_WEAPONS.has(ohname);

    if (isLight) {
      if (regOh?.dmg1) {
        const hasFinesse = ohProps.includes("F");
        const ohStatKey = isHexblade
          ? meleeStatKey(hasFinesse)
          : hasFinesse && abilMod("dex") > abilMod("str")
            ? "dex"
            : "str";
        const mod = abilMod(ohStatKey);
        const wb = weaponBonusNum(regOh); // bonusWeapon → attack & damage
        const wAtk = parseFlatBonus(regOh.bonusWeaponAttack); // attack only
        const wDmg = parseFlatBonus(regOh.bonusWeaponDamage); // damage only
        const hasProfO = isItemProficient(regOh, allWeaponProfs, allArmorProfs);
        const bonus = mod + (hasProfO ? prof : 0) + wb + wAtk;
        const dmgBonus = wb + wDmg;
        const dmgBase =
          dmgBonus === 0
            ? regOh.dmg1
            : dmgBonus > 0
              ? `${regOh.dmg1}+${dmgBonus}`
              : `${regOh.dmg1}${dmgBonus}`;
        attacks.push({
          name: regOh.name + " (off-hand)",
          bonus,
          dmg: dmgBase + bonusDamageSuffix(regOh),
          type: DMG_TYPE_FULL[regOh.dmgType ?? ""] ?? regOh.dmgType ?? "",
          notes: ["Bonus Action", !hasProfO ? "No Prof." : ""]
            .filter(Boolean)
            .join(" · "),
          crit: regOh.critThreshold,
        });
      } else if (ohstats) {
        const ohStatKey2 = ohstats.ranged
          ? "dex"
          : isHexblade
            ? meleeStatKey(ohstats.finesse ?? false)
            : ohstats.finesse && abilMod("dex") > abilMod("str")
              ? "dex"
              : "str";
        const mod = abilMod(ohStatKey2);
        const hasProfO =
          allWeaponProfs.includes("simple") ||
          allWeaponProfs.includes("martial") ||
          allWeaponProfs.includes(ohname);
        const bonus = mod + (hasProfO ? prof : 0);
        attacks.push({
          name: ohname.replace(/\b\w/g, (l) => l.toUpperCase()) + " (off-hand)",
          bonus,
          dmg: ohstats.dmg,
          type: ohstats.type,
          notes: ["Bonus Action", !hasProfO ? "No Prof." : ""]
            .filter(Boolean)
            .join(" · "),
        });
      }
    }
  }

  // ── Unarmed Strike ────────────────────────────────────────────────────────
  // Check ClassMechanics for customAttackModels (e.g. Armorer Artificer)
  let customUnarmedApplied = false;
  for (const cls of s.classes) {
    const cam = ClassMechanicsRegistry.get(cls.name)?.customAttackModels;
    if (!cam || cls.subclass !== cam.subclass) continue;
    const modelKey = (s as unknown as Record<string, unknown>)[
      cam.modelField
    ] as string | undefined;
    if (!modelKey) continue;
    const model = cam.models.find((mo) => mo.key === modelKey);
    if (!model) continue;
    const mod = abilMod(model.statKey);
    attacks.push({
      name: model.name,
      bonus: mod + prof,
      dmg: `${model.die} + ${mod}`,
      type: model.type,
      notes: model.notes,
      isUnarmed: true,
    });
    customUnarmedApplied = true;
    break;
  }
  if (!customUnarmedApplied) {
    // Baseline unarmed strike (Monk gets Martial Arts die)
    const monkLvl = s.classes.find((c) => c.name === "Monk")?.level ?? 0;
    const monkMech = ClassMechanicsRegistry.get("Monk");
    const martialDieFaces =
      monkLvl > 0 ? (monkMech?.martialArtsDieByLevel?.[monkLvl] ?? 4) : 4;
    const unarmedDie = `d${martialDieFaces}`;
    const unarmedStatKey =
      monkLvl > 0 && abilMod("dex") >= abilMod("str") ? "dex" : "str";
    const unarmedMod = abilMod(unarmedStatKey as "str" | "dex");
    attacks.push({
      name:
        monkLvl > 0 ? `Unarmed — Martial Arts ${unarmedDie}` : "Unarmed Strike",
      bonus: unarmedMod + prof,
      dmg: `1${unarmedDie} + ${unarmedMod}`,
      type: "bludgeoning",
      notes: monkLvl > 0 ? "Martial Arts" : "",
      isUnarmed: true,
    });
  }

  // ── Fighting Style bonuses ─────────────────────────────────────────────────
  const chosenStyles = s.featureChoices?.fightingStyles ?? [];

  // Archery: +2 to ranged attack bonus
  if (chosenStyles.includes("Archery")) {
    for (const a of attacks) {
      if (a.notes.includes("Ranged")) a.bonus = (a.bonus as number) + 2;
    }
  }

  // Defense: +1 AC when wearing armor
  if (chosenStyles.includes("Defense") && s.equipment.armor) {
    computedAC += 1;
    computedACSource += " + Defense";
  }

  // Dueling: +2 damage when wielding a melee weapon in one hand with nothing in the other
  if (chosenStyles.includes("Dueling")) {
    const mh = s.equipment.meleeSet?.mainhand;
    const oh = s.equipment.meleeSet?.offhand;
    if (mh && (!oh || oh === "shield" || oh.startsWith("shield|"))) {
      for (const a of attacks) {
        if (!a.notes.includes("Ranged")) {
          a.dmg = addDmgFlat(a.dmg, 2);
          a.notes = (a.notes ? a.notes + " · " : "") + "Dueling";
        }
      }
    }
  }

  // Two-Weapon Fighting: add ability mod to off-hand attack damage
  if (chosenStyles.includes("Two-Weapon Fighting")) {
    const oh = s.equipment.meleeSet?.offhand;
    if (oh && oh !== "shield" && !oh.startsWith("shield|")) {
      for (const a of attacks) {
        if (a.notes.includes("Bonus Action")) {
          // Add ability mod to off-hand damage string
          const ohname2 = oh.split("|")[0].toLowerCase().trim();
          const regOh2 = resolveRegItem(oh);
          const ohstats2 = WEAPON_TABLE[ohname2];
          const props2 = (regOh2?.property ?? []).map(
            (p: string) => p.split("|")[0],
          );
          const hasFinesse2 = props2.includes("F") || ohstats2?.finesse;
          const useFinesse2 =
            (hasFinesse2 ?? false) && abilMod("dex") > abilMod("str");
          const mod2 = abilMod(useFinesse2 ? "dex" : "str");
          if (mod2 !== 0) {
            // a.dmg may already carry a trailing " + XdY Type" bonus-damage suffix (from a
            // magic weapon) — insert the ability mod into the base term, before that suffix.
            const [core, ...suffix] = a.dmg.split(" + ");
            const newCore = mod2 > 0 ? `${core}+${mod2}` : `${core}${mod2}`;
            a.dmg = [newCore, ...suffix].join(" + ");
          }
          a.notes = "Bonus Action · TWF";
        }
      }
    }
  }

  // Great Weapon Fighting: annotate (reroll 1s/2s on damage dice — display only)
  if (chosenStyles.includes("Great Weapon Fighting")) {
    for (const a of attacks) {
      if (!a.notes.includes("Ranged")) {
        a.notes = (a.notes ? a.notes + " · " : "") + "GWF reroll 1s/2s";
      }
    }
  }

  // ── Resolve chosen optional features for display ───────────────────────────
  const optFeats = reg?.optionalFeatures ?? [];
  const findOpt = (name: string) => optFeats.find((f) => f.name === name);

  type ChosenOptFeat = {
    name: string;
    desc: string;
    entries?: unknown[];
    optType:
      | "fightingStyle"
      | "invocation"
      | "metamagic"
      | "maneuver"
      | "infusion";
  };
  const chosenOptionalFeatures: ChosenOptFeat[] = [
    ...[
      ...(s.featureChoices?.fightingStyles ?? []),
      ...(s.featureChoices?.featFightingStyleChoices ?? []),
    ].map((n) => {
      const f = findOpt(n);
      return {
        name: n,
        desc: entriesToDesc(f?.entries ?? []),
        entries: f?.entries ?? [],
        optType: "fightingStyle" as const,
      };
    }),
    ...(s.featureChoices?.invocations ?? []).map((n) => {
      const f = findOpt(n);
      return {
        name: n,
        desc: entriesToDesc(f?.entries ?? []),
        entries: f?.entries ?? [],
        optType: "invocation" as const,
      };
    }),
    ...(s.featureChoices?.metamagic ?? []).map((n) => {
      const f = findOpt(n);
      return {
        name: n,
        desc: entriesToDesc(f?.entries ?? []),
        entries: f?.entries ?? [],
        optType: "metamagic" as const,
      };
    }),
    ...(s.featureChoices?.maneuvers ?? []).map((n) => {
      const f = findOpt(n);
      return {
        name: n,
        desc: entriesToDesc(f?.entries ?? []),
        entries: f?.entries ?? [],
        optType: "maneuver" as const,
      };
    }),
    ...(s.featureChoices?.infusions ?? []).map((n) => {
      const f = findOpt(n);
      return {
        name: n,
        desc: entriesToDesc(f?.entries ?? []),
        entries: f?.entries ?? [],
        optType: "infusion" as const,
      };
    }),
  ];

  // ── Combat abilities (reference cards — no individual use tracking) ──────────
  const combatAbilities: import("./types").CombatAbility[] = [];
  for (const f of chosenOptionalFeatures) {
    if (f.optType === "maneuver") {
      combatAbilities.push({
        name: f.name,
        desc: f.desc,
        cost: "1 Sup. Die",
        costAmount: 1,
        pool: "superiorityDice",
        source: "maneuver",
      });
    } else if (f.optType === "metamagic") {
      const spCost = METAMAGIC_COST_AMOUNTS[f.name];
      combatAbilities.push({
        name: f.name,
        desc: f.desc,
        cost: METAMAGIC_COSTS[f.name] ?? "varies",
        costAmount: spCost,
        pool: spCost !== undefined ? "sorceryPoints" : undefined,
        source: "metamagic",
      });
    } else {
      // invocations, fightingStyles — reference only
      combatAbilities.push({ name: f.name, desc: f.desc, source: f.optType });
    }
  }
  const monkCls = s.classes.find((c) => c.name === "Monk");
  if (monkCls) {
    // XPHB renamed Monk subclasses — map to PHB/TCE names used in MONK_KI_DEFS
    const MONK_SC_ALIAS: Record<string, string> = {
      "Warrior of Shadow": "Way of Shadow",
      "Warrior of Mercy": "Way of Mercy",
      "Warrior of the Open Hand": "Way of the Open Hand",
      "Warrior of the Elements": "Way of the Four Elements",
    };
    const monkScForKi =
      (monkCls.subclass && MONK_SC_ALIAS[monkCls.subclass]) || monkCls.subclass;
    for (const def of MONK_KI_DEFS) {
      if (monkCls.level < def.minLevel) continue;
      if (def.subclass && monkScForKi !== def.subclass) continue;
      combatAbilities.push({
        name: def.name,
        desc: def.desc,
        cost: def.cost,
        costAmount: def.costAmount > 0 ? def.costAmount : undefined,
        pool: def.costAmount > 0 ? "kiPoints" : undefined,
        source: "ki",
      });
    }
    const isElementalMonk =
      monkCls.subclass === "Way of the Four Elements" ||
      monkCls.subclass === "Warrior of the Elements";
    if (isElementalMonk) {
      for (const discName of s.featureChoices?.elementalDisciplines ?? []) {
        const feat = reg?.optionalFeatures.find(
          (f) => f.name === discName && f.featureType.includes("ED"),
        );
        if (!feat) continue;
        const entryText =
          ((feat.entries as unknown[]).find((e) => typeof e === "string") as
            | string
            | undefined) ?? "";
        const kiMatch = entryText.match(/spend (\d+) ki/i);
        const kiCost = kiMatch ? parseInt(kiMatch[1], 10) : 0;
        combatAbilities.push({
          name: feat.name,
          desc: entriesToDesc(feat.entries),
          cost: kiCost > 0 ? `${kiCost} Ki` : "Free",
          costAmount: kiCost,
          pool: kiCost > 0 ? "kiPoints" : undefined,
          source: "ki",
        });
      }
    }
  }

  // ── Armorer model combat abilities ────────────────────────────────────────
  const armorerCls = s.classes.find(
    (c) => c.name === "Artificer" && c.subclass === "Armorer",
  );
  if (armorerCls && s.armorerModel) {
    const intMod = abilMod("int");
    const giantStatUses = Math.max(1, intMod);
    if (s.armorerModel === "guardian") {
      combatAbilities.push({
        name: "Defensive Field",
        desc: `While Bloodied, take a Bonus Action to gain ${armorerCls.level} Temporary Hit Points (= Artificer level). Lost if you doff the armor.`,
        source: "armorModel",
        actionType: "bonus",
      });
    } else if (s.armorerModel === "infiltrator") {
      combatAbilities.push({
        name: "Dampening Field",
        desc: "You have Advantage on Dexterity (Stealth) checks. If the armor imposes Disadvantage on Stealth, they cancel each other.",
        source: "armorModel",
        actionType: "passive",
      });
    } else if (s.armorerModel === "dreadnaught") {
      combatAbilities.push({
        name: "Giant Stature",
        desc: `Bonus Action: transform and enlarge for 1 minute. Reach +5ft; if smaller than Large, become Large. ${giantStatUses} use${giantStatUses !== 1 ? "s" : ""} (= INT mod, min 1). Regain all on Long Rest.`,
        source: "armorModel",
        actionType: "bonus",
      });
    }
  }

  const initiativeMod =
    abilMod("dex") + effectiveRules.initiativeFlat + (hasFeat("Alert") ? 5 : 0);

  // Merge race-granted resistances with those from equipped magic items (resist).
  const allDamageResistances = [...bg3DamageResistances];
  for (const dt of resistSet) {
    const tc = dt.charAt(0).toUpperCase() + dt.slice(1);
    if (!allDamageResistances.some((x) => x.toLowerCase() === dt))
      allDamageResistances.push(tc);
  }

  const baseResult: ComputedChar = {
    name: s.name,
    player: s.player,
    campaign: s.campaign,
    image: s.image,

    classLabel,
    classes: s.classes,
    race: s.race.name + (s.race.subrace ? ` (${s.race.subrace})` : ""),
    background: s.background.name,

    totalLevel,
    proficiencyBonus: prof,
    ac: computedAC,
    acSource: computedACSource,
    initiative: initiativeMod,
    initiativeDie: effectiveRules.initiativeDie,
    inspirationMax: effectiveRules.inspirationMax,
    speed: totalSpeedM,
    speedFt: totalSpeedFt,

    abilities,
    skills,
    passive,
    senses:
      darkvisionFt > 0
        ? `Darkvision ${darkvisionFt}ft (${darkvisionM}m)`
        : "None",
    darkvisionFt,
    darkvisionM,

    hp: { current: Math.min(s.hp.current, maxHP), temp: s.hp.temp, max: maxHP },
    hitDiceDisplay,
    hitDiceRemaining: s.hitDiceRemaining,
    deathSaves: s.deathSaves,
    exhaustion: s.exhaustion ?? 0,
    inspiration: s.inspiration,
    jackOfAllTrades: s.jackOfAllTrades,

    proficiencies: {
      armor: allArmorProfs.join(", ") || "—",
      weapons: allWeaponProfs.join(", "),
      tools: (s.proficiencies.tools ?? []).join(", "),
      languages: (s.proficiencies.languages ?? []).join(", "),
    },

    equipment: s.equipment,
    attacks,
    carryCapacityKg,
    totalWeightKg,
    totalWeightLb,
    encumberedAt,
    heavilyEncAt,

    conditionsList,
    activeConditions: Object.keys(
      Array.isArray(s.conditions as unknown) ? {} : (s.conditions ?? {}),
    ),

    spellcasting: {
      ability: spellAbilLabel,
      abilityKey: spellAbilKey,
      saveDC: 8 + prof + spellMod + magicSpellSaveDc,
      attackBonus: prof + spellMod + magicSpellAttack,
      cantripTier,
      slots,
      pactSlots:
        warlockLevel > 0
          ? {
              max: pactSlotMax,
              current: pactSlotMax - (s.resources.pactSlots?.used ?? 0),
              level: pactSlotLevel,
            }
          : null,
      cantrips: s.spellcasting.cantrips,
      known: s.spellcasting.known,
      prepared: s.spellcasting.prepared,
      grantedCantrips: bg3GrantedCantrips,
      grantedSpells: bg3GrantedSpells,
    },

    damageResistances: allDamageResistances,
    concentrationSaveBonus: magicConcentration,

    raceFeatures,
    classFeatures,
    subclassFeatures: s.classes.some((c) => c.subclass) ? subclassFeatures : [],
    backgroundFeatures,
    subclassLabel: s.classes.find((c) => c.subclass)?.subclass ?? null,

    featureChoices: s.featureChoices ?? {
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
    chosenOptionalFeatures,
    combatAbilities,

    resources,
    actionsList: computeActions(
      s.classes,
      s.feats,
      s.abilityScores,
      prof,
      s.resources.actionUses,
    ),

    ...(() => {
      const artLevel =
        s.classes.find((c) => c.name === "Artificer")?.level ?? 0;
      const artInfTable =
        ClassMechanicsRegistry.get("Artificer")?.infusionTable;
      return {
        infusionsKnown: artInfTable
          ? thresholdMax(artInfTable.infusionsKnown, artLevel)
          : 0,
        infusedItemsMax: artInfTable
          ? thresholdMax(artInfTable.infusedItemsMax, artLevel)
          : 0,
        plansKnown: artInfTable
          ? thresholdMax(artInfTable.plansKnown, artLevel)
          : 0,
      };
    })(),

    notes: s.notes,
  };

  return PluginRegistry.applyComputeHooks(baseResult, s, effectiveRules);
}

// ── Active character singleton ───────────────────────────────────────────────

export function loadActiveChar(): StoredChar {
  return CharStorage.getActiveChar() ?? DEFAULT_STORED;
}

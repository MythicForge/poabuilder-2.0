// ── Class spell lists from spell-lists.md (normalized lowercase, levels 0–6 only) ──

const SPELL_LISTS: Record<string, Set<string>> = {
  Bard: new Set([
    // cantrips
    "dancing lights",
    "light",
    "mage hand",
    "mending",
    "message",
    "minor illusion",
    "prestidigitation",
    "true strike",
    "vicious mockery",
    // 1st
    "animal friendship",
    "bane",
    "charm person",
    "comprehend languages",
    "cure wounds",
    "detect magic",
    "disguise self",
    "faerie fire",
    "feather fall",
    "healing word",
    "heroism",
    "hideous laughter",
    "identify",
    "illusory script",
    "longstrider",
    "silent image",
    "sleep",
    "speak with animals",
    "thunderwave",
    "unseen servant",
    // 2nd
    "animal messenger",
    "blindness/deafness",
    "calm emotions",
    "detect thoughts",
    "enhance ability",
    "enthrall",
    "heat metal",
    "hold person",
    "invisibility",
    "knock",
    "lesser restoration",
    "locate animals or plants",
    "locate object",
    "magic mouth",
    "see invisibility",
    "shatter",
    "silence",
    "suggestion",
    "zone of truth",
    // 3rd
    "bestow curse",
    "clairvoyance",
    "dispel magic",
    "fear",
    "glyph of warding",
    "hypnotic pattern",
    "major image",
    "nondetection",
    "plant growth",
    "sending",
    "speak with dead",
    "speak with plants",
    "stinking cloud",
    "tiny hut",
    "tongues",
    // 4th
    "compulsion",
    "confusion",
    "dimension door",
    "freedom of movement",
    "greater invisibility",
    "hallucinatory terrain",
    "locate creature",
    "polymorph",
    // 5th
    "animate objects",
    "awaken",
    "dominate person",
    "dream",
    "geas",
    "greater restoration",
    "hold monster",
    "legend lore",
    "mass cure wounds",
    "mislead",
    "modify memory",
    "planar binding",
    "raise dead",
    "scrying",
    "seeming",
    "teleportation circle",
    // 6th
    "eyebite",
    "find the path",
    "guards and wards",
    "irresistible dance",
    "mass suggestion",
    "programmed illusion",
    "true seeing",
  ]),

  Cleric: new Set([
    // cantrips
    "guidance",
    "light",
    "mending",
    "resistance",
    "sacred flame",
    "thaumaturgy",
    // 1st
    "bane",
    "bless",
    "command",
    "create or destroy water",
    "cure wounds",
    "detect evil and good",
    "detect magic",
    "detect poison and disease",
    "guiding bolt",
    "healing word",
    "inflict wounds",
    "protection from evil and good",
    "purify food and drink",
    "sanctuary",
    "shield of faith",
    // 2nd
    "aid",
    "augury",
    "blindness/deafness",
    "calm emotions",
    "continual flame",
    "enhance ability",
    "find traps",
    "gentle repose",
    "hold person",
    "lesser restoration",
    "locate object",
    "prayer of healing",
    "protection from poison",
    "silence",
    "spiritual weapon",
    "warding bond",
    "zone of truth",
    // 3rd
    "animate dead",
    "beacon of hope",
    "bestow curse",
    "clairvoyance",
    "create food and water",
    "daylight",
    "dispel magic",
    "glyph of warding",
    "magic circle",
    "meld into stone",
    "protection from energy",
    "remove curse",
    "revivify",
    "sending",
    "speak with dead",
    "spirit guardians",
    "tongues",
    "water walk",
    // 4th
    "banishment",
    "control water",
    "death ward",
    "divination",
    "freedom of movement",
    "guardian of faith",
    "locate creature",
    "mass healing word",
    "stone shape",
    // 5th
    "commune",
    "contagion",
    "dispel evil and good",
    "flame strike",
    "geas",
    "greater restoration",
    "hallow",
    "insect plague",
    "legend lore",
    "mass cure wounds",
    "planar binding",
    "raise dead",
    "scrying",
    // 6th
    "blade barrier",
    "create undead",
    "find the path",
    "forbiddance",
    "harm",
    "heal",
    "heroes' feast",
    "planar ally",
    "true seeing",
    "word of recall",
  ]),

  Druid: new Set([
    // cantrips
    "druidcraft",
    "guidance",
    "mending",
    "poison spray",
    "produce flame",
    "resistance",
    "shillelagh",
    // 1st
    "animal friendship",
    "charm person",
    "create or destroy water",
    "cure wounds",
    "detect magic",
    "detect poison and disease",
    "entangle",
    "faerie fire",
    "fog cloud",
    "goodberry",
    "healing word",
    "jump",
    "longstrider",
    "purify food and drink",
    "speak with animals",
    "thunderwave",
    // 2nd
    "animal messenger",
    "barkskin",
    "darkvision",
    "enhance ability",
    "find traps",
    "flame blade",
    "flaming sphere",
    "gust of wind",
    "heat metal",
    "hold person",
    "lesser restoration",
    "locate animals or plants",
    "locate object",
    "moonbeam",
    "pass without trace",
    "protection from poison",
    "spike growth",
    // 3rd
    "call lightning",
    "conjure animals",
    "daylight",
    "dispel magic",
    "meld into stone",
    "plant growth",
    "protection from energy",
    "sleet storm",
    "speak with plants",
    "water breathing",
    "water walk",
    "wind wall",
    // 4th
    "blight",
    "confusion",
    "conjure minor elementals",
    "conjure woodland beings",
    "control water",
    "dominate beast",
    "freedom of movement",
    "giant insect",
    "hallucinatory terrain",
    "ice storm",
    "locate creature",
    "polymorph",
    "stone shape",
    "stoneskin",
    "wall of fire",
    // 5th
    "antilife shell",
    "awaken",
    "commune with nature",
    "conjure elemental",
    "contagion",
    "geas",
    "greater restoration",
    "insect plague",
    "mass cure wounds",
    "planar binding",
    "reincarnate",
    "scrying",
    "tree stride",
    "wall of stone",
    // 6th
    "conjure fey",
    "find the path",
    "heal",
    "heroes' feast",
    "move earth",
    "sunbeam",
    "transport via plants",
    "wall of thorns",
    "wind walk",
  ]),

  Paladin: new Set([
    // no cantrips
    // 1st
    "bless",
    "command",
    "cure wounds",
    "detect evil and good",
    "detect magic",
    "detect poison and disease",
    "divine favor",
    "heroism",
    "protection from evil and good",
    "purify food and drink",
    "shield of faith",
    // 2nd
    "aid",
    "branding smite",
    "find steed",
    "lesser restoration",
    "locate object",
    "magic weapon",
    "protection from poison",
    "zone of truth",
    // 3rd
    "create food and water",
    "daylight",
    "dispel magic",
    "magic circle",
    "remove curse",
    "revivify",
    // 4th
    "banishment",
    "death ward",
    "locate creature",
    // 5th
    "dispel evil and good",
    "geas",
    "raise dead",
  ]),

  Ranger: new Set([
    // no cantrips
    // 1st
    "alarm",
    "animal friendship",
    "cure wounds",
    "detect magic",
    "detect poison and disease",
    "fog cloud",
    "goodberry",
    "hunter's mark",
    "jump",
    "longstrider",
    "speak with animals",
    // 2nd
    "animal messenger",
    "barkskin",
    "darkvision",
    "find traps",
    "lesser restoration",
    "locate animals or plants",
    "locate object",
    "pass without trace",
    "protection from poison",
    "silence",
    "spike growth",
    // 3rd
    "conjure animals",
    "daylight",
    "nondetection",
    "plant growth",
    "protection from energy",
    "speak with plants",
    "water breathing",
    "water walk",
    "wind wall",
    // 4th
    "conjure woodland beings",
    "freedom of movement",
    "locate creature",
    "stoneskin",
    // 5th
    "commune with nature",
    "tree stride",
  ]),

  Sorcerer: new Set([
    // cantrips
    "acid splash",
    "chill touch",
    "dancing lights",
    "fire bolt",
    "light",
    "mage hand",
    "mending",
    "message",
    "minor illusion",
    "poison spray",
    "prestidigitation",
    "ray of frost",
    "shocking grasp",
    "true strike",
    // 1st
    "burning hands",
    "charm person",
    "color spray",
    "comprehend languages",
    "detect magic",
    "disguise self",
    "expeditious retreat",
    "false life",
    "feather fall",
    "fog cloud",
    "jump",
    "mage armor",
    "magic missile",
    "shield",
    "silent image",
    "sleep",
    "thunderwave",
    // 2nd
    "alter self",
    "blindness/deafness",
    "blur",
    "darkness",
    "darkvision",
    "detect thoughts",
    "enhance ability",
    "enlarge/reduce",
    "gust of wind",
    "hold person",
    "invisibility",
    "knock",
    "levitate",
    "mirror image",
    "misty step",
    "scorching ray",
    "see invisibility",
    "shatter",
    "spider climb",
    "suggestion",
    "web",
    // 3rd
    "blink",
    "clairvoyance",
    "daylight",
    "dispel magic",
    "fear",
    "fireball",
    "fly",
    "gaseous form",
    "haste",
    "hypnotic pattern",
    "lightning bolt",
    "major image",
    "protection from energy",
    "sleet storm",
    "slow",
    "stinking cloud",
    "tongues",
    "water breathing",
    "water walk",
    // 4th
    "banishment",
    "blight",
    "confusion",
    "dimension door",
    "dominate beast",
    "greater invisibility",
    "ice storm",
    "polymorph",
    "stoneskin",
    "wall of fire",
    // 5th
    "animate objects",
    "cloudkill",
    "cone of cold",
    "creation",
    "dominate person",
    "hold monster",
    "insect plague",
    "seeming",
    "telekinesis",
    "teleportation circle",
    "wall of stone",
    // 6th
    "chain lightning",
    "circle of death",
    "disintegrate",
    "eyebite",
    "globe of invulnerability",
    "mass suggestion",
    "move earth",
    "sunbeam",
    "true seeing",
  ]),

  Warlock: new Set([
    // cantrips
    "chill touch",
    "eldritch blast",
    "mage hand",
    "minor illusion",
    "poison spray",
    "prestidigitation",
    "true strike",
    // 1st
    "charm person",
    "comprehend languages",
    "expeditious retreat",
    "hellish rebuke",
    "illusory script",
    "protection from evil and good",
    "unseen servant",
    // 2nd
    "darkness",
    "enthrall",
    "hold person",
    "invisibility",
    "mirror image",
    "misty step",
    "ray of enfeeblement",
    "shatter",
    "spider climb",
    "suggestion",
    // 3rd
    "counterspell",
    "dispel magic",
    "fear",
    "fly",
    "gaseous form",
    "hypnotic pattern",
    "magic circle",
    "major image",
    "remove curse",
    "tongues",
    "vampiric touch",
    // 4th
    "banishment",
    "blight",
    "dimension door",
    "hallucinatory terrain",
    // 5th
    "contact other plane",
    "dream",
    "hold monster",
    "scrying",
    // 6th
    "circle of death",
    "conjure fey",
    "create undead",
    "eyebite",
    "flesh to stone",
    "mass suggestion",
    "true seeing",
  ]),

  Wizard: new Set([
    // cantrips
    "acid splash",
    "chill touch",
    "dancing lights",
    "fire bolt",
    "light",
    "mage hand",
    "mending",
    "message",
    "minor illusion",
    "poison spray",
    "prestidigitation",
    "ray of frost",
    "shocking grasp",
    "true strike",
    // 1st
    "alarm",
    "burning hands",
    "charm person",
    "color spray",
    "comprehend languages",
    "detect magic",
    "disguise self",
    "expeditious retreat",
    "false life",
    "feather fall",
    "find familiar",
    "floating disk",
    "fog cloud",
    "grease",
    "hideous laughter",
    "identify",
    "illusory script",
    "jump",
    "longstrider",
    "mage armor",
    "magic missile",
    "protection from evil and good",
    "shield",
    "silent image",
    "sleep",
    "thunderwave",
    "unseen servant",
    // 2nd
    "acid arrow",
    "alter self",
    "arcane lock",
    "arcanist's magic aura",
    "blindness/deafness",
    "blur",
    "continual flame",
    "darkness",
    "darkvision",
    "detect thoughts",
    "enlarge/reduce",
    "flaming sphere",
    "gentle repose",
    "gust of wind",
    "hold person",
    "invisibility",
    "knock",
    "levitate",
    "locate object",
    "magic mouth",
    "magic weapon",
    "mirror image",
    "misty step",
    "ray of enfeeblement",
    "rope trick",
    "scorching ray",
    "see invisibility",
    "shatter",
    "spider climb",
    "suggestion",
    "web",
    // 3rd
    "animate dead",
    "bestow curse",
    "blink",
    "clairvoyance",
    "counterspell",
    "dispel magic",
    "fear",
    "fireball",
    "fly",
    "gaseous form",
    "glyph of warding",
    "haste",
    "hypnotic pattern",
    "lightning bolt",
    "magic circle",
    "major image",
    "nondetection",
    "phantom steed",
    "protection from energy",
    "remove curse",
    "sending",
    "sleet storm",
    "slow",
    "stinking cloud",
    "tiny hut",
    "tongues",
    "vampiric touch",
    "water breathing",
    // 4th
    "arcane eye",
    "banishment",
    "black tentacles",
    "blight",
    "confusion",
    "conjure minor elementals",
    "control water",
    "dimension door",
    "fabricate",
    "faithful hound",
    "fire shield",
    "greater invisibility",
    "hallucinatory terrain",
    "ice storm",
    "locate creature",
    "phantasmal killer",
    "polymorph",
    "private sanctum",
    "resilient sphere",
    "secret chest",
    "stone shape",
    "stoneskin",
    "wall of fire",
    // 5th
    "animate objects",
    "arcane hand",
    "cloudkill",
    "cone of cold",
    "conjure elemental",
    "contact other plane",
    "creation",
    "dominate person",
    "dream",
    "geas",
    "hold monster",
    "legend lore",
    "mislead",
    "modify memory",
    "passwall",
    "planar binding",
    "scrying",
    "seeming",
    "telekinesis",
    "telepathic bond",
    "teleportation circle",
    "wall of force",
    "wall of stone",
    // 6th
    "chain lightning",
    "circle of death",
    "contingency",
    "create undead",
    "disintegrate",
    "eyebite",
    "flesh to stone",
    "freezing sphere",
    "globe of invulnerability",
    "guards and wards",
    "instant summons",
    "irresistible dance",
    "magic jar",
    "mass suggestion",
    "move earth",
    "programmed illusion",
    "sunbeam",
    "true seeing",
    "wall of ice",
  ]),
};

// BG3 class aliases — extend base lists with oath/subclass spells
SPELL_LISTS["Paladin (BG3)"] = new Set([
  ...SPELL_LISTS.Paladin,
  "compelled duel",
  "searing smite",
  "thunderous smite",
  "wrathful smite",
  "sanctuary",
  "speak with animals",
  "ensnaring strike",
  "bane",
  "hunter's mark",
  "hellish rebuke",
  "inflict wounds",
  "warding bond",
  "misty step",
  "moonbeam",
  "hold person",
  "animate dead",
  "darkness",
  "beacon of hope",
  "dispel magic",
  "protection from energy",
  "plant growth",
  "haste",
  "bestow curse",
  "aura of vitality",
  "spirit guardians",
]);
SPELL_LISTS["Ranger (BG3)"] = new Set([
  ...SPELL_LISTS.Ranger,
  "ensnaring strike",
  "hail of thorns",
  "enhance jump",
]);
SPELL_LISTS["Arcane Trickster"] = new Set([
  ...SPELL_LISTS.Wizard,
  ...SPELL_LISTS.Bard,
]);
SPELL_LISTS["Eldritch Knight"] = new Set([
  ...SPELL_LISTS.Wizard,
  ...SPELL_LISTS.Warlock,
]);
SPELL_LISTS["Architect of Ruin"] = new Set([
  ...SPELL_LISTS.Cleric,
  ...SPELL_LISTS.Warlock,
]);

// ── Known spells per level (index = level−1, BG3 cap = level 12) ──
// null = prepared caster (no hard cap on learning)
const KNOWN_TABLE: Record<string, (number | null)[]> = {
  Bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15],
  Sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12],
  Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11],
  Ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7], // 0 at L1 (no casting)
  Cleric: Array(12).fill(null),
  Druid: Array(12).fill(null),
  Paladin: Array(12).fill(null),
  Wizard: Array(12).fill(null),
};
KNOWN_TABLE["Paladin (BG3)"] = KNOWN_TABLE.Paladin;
KNOWN_TABLE["Ranger (BG3)"] = KNOWN_TABLE.Ranger;
// Third-type subclass casters: spells known start at L3 (index 2)
// [L1-2: 0, L3: 3, L4: 4, L5-6: 4, L7: 5, L8-9: 6, L10: 7, L11-12: 8]
const THIRD_CASTER_KNOWN: (number | null)[] = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8];
KNOWN_TABLE["Arcane Trickster"] = THIRD_CASTER_KNOWN;
KNOWN_TABLE["Eldritch Knight"] = THIRD_CASTER_KNOWN;
KNOWN_TABLE["Architect of Ruin"] = THIRD_CASTER_KNOWN;

// ── Cantrips known per level (index = level−1) ──
const CANTRIP_TABLE: Record<string, number[]> = {
  Bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  Cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5],
  Druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  Sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6],
  Warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  Wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5],
  // Paladin, Ranger: no cantrips
  // Third-type subclass casters: 2 at L3, 3 at L10
};
const THIRD_CASTER_CANTRIPS = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3];
CANTRIP_TABLE["Arcane Trickster"] = THIRD_CASTER_CANTRIPS;
CANTRIP_TABLE["Eldritch Knight"] = THIRD_CASTER_CANTRIPS;
CANTRIP_TABLE["Architect of Ruin"] = THIRD_CASTER_CANTRIPS;

// ── Prepared max formula ──
// formula: fn(level, abilMod) → number
const PREPARED_FORMULA: Record<
  string,
  (level: number, mods: Record<string, number>) => number
> = {
  Cleric: (l, m) => Math.max(1, l + (m["WIS"] ?? 0)),
  Druid: (l, m) => Math.max(1, l + (m["WIS"] ?? 0)),
  Paladin: (l, m) => Math.max(1, Math.floor(l / 2) + (m["CHA"] ?? 0)),
  Wizard: (l, m) => Math.max(1, l + (m["INT"] ?? 0)),
};
PREPARED_FORMULA["Paladin (BG3)"] = PREPARED_FORMULA.Paladin;

// ── Feat-based spellcasting ───────────────────────────────────────────────────

// Feats that grant cantrips + spells from a named class.
// Magic Initiate (ClassName) → 2 cantrips + 1 spell from that class.
// If no class is specified (plain "Magic Initiate"), treat as unrestricted (null list).
const FEAT_GRANTS_CANTRIPS = 2; // cantrips granted per Magic-Initiate-style feat

function featGrantedClasses(featNames: string[]): {
  classes: string[];
  unrestricted: boolean;
} {
  const classes: string[] = [];
  let unrestricted = false;
  for (const name of featNames) {
    // Match "Magic Initiate", "Magic Initiate (Wizard)", "Magic Initiate Wizard", etc.
    if (/magic initiate/i.test(name)) {
      const m = name.match(/magic initiate[:\s(]+([A-Za-z ]+?)\)?$/i);
      if (m) {
        const cls = m[1].trim();
        // Normalise BG3 alias names
        const canonical =
          cls === "Paladin" ? "Paladin" : cls === "Ranger" ? "Ranger" : cls;
        if (SPELL_LISTS[canonical]) classes.push(canonical);
        else unrestricted = true; // unknown class name → open all lists
      } else {
        unrestricted = true; // plain "Magic Initiate" with no class → unrestricted
      }
    }
    // Druidic Warrior / Blessed Warrior fighting styles grant cantrips from a list
    if (/druidic warrior/i.test(name)) {
      classes.push("Druid");
    }
    if (/blessed warrior/i.test(name)) {
      classes.push("Cleric");
    }
    // Ritual Caster → open all lists for ritual spells
    if (/ritual caster/i.test(name)) {
      unrestricted = true;
    }
  }
  return { classes, unrestricted };
}

export interface SpellRestrictions {
  allowedNames: Set<string> | null; // null = no filter
  maxCantrips: number | null; // null = no cap
  maxKnown: number | null; // null = prepared caster — no hard known cap
  preparedMax: number | null; // only set for prepared casters
  isPreparedCaster: boolean;
  hasSpellcasting: boolean;
}

export function getSpellRestrictions(
  classes: Array<{ name: string; subclass?: string | null; level: number }>,
  abilMods: Record<string, number>,
  featNames?: string[],
): SpellRestrictions {
  // A class qualifies as a spellcaster if the class name OR subclass name has a spell list
  const spellCasters = classes.filter(
    (c) => SPELL_LISTS[c.name] || (c.subclass && SPELL_LISTS[c.subclass]),
  );
  const { classes: featClasses, unrestricted: featUnrestricted } =
    featGrantedClasses(featNames ?? []);
  const hasFeatSpells = featClasses.length > 0 || featUnrestricted;

  if (spellCasters.length === 0 && !hasFeatSpells) {
    return {
      allowedNames: new Set(),
      maxCantrips: 0,
      maxKnown: 0,
      preparedMax: null,
      isPreparedCaster: false,
      hasSpellcasting: false,
    };
  }

  // null = no filter when any feat opens all lists
  let allowedNames: Set<string> | null = featUnrestricted
    ? null
    : new Set<string>();

  // Class spell lists — prefer subclass key when available (e.g. Arcane Trickster)
  for (const c of spellCasters) {
    const listKey = (c.subclass && SPELL_LISTS[c.subclass]) ? c.subclass : c.name;
    const list = SPELL_LISTS[listKey];
    if (list && allowedNames !== null)
      for (const spell of list) allowedNames.add(spell);
  }

  // Feat class spell lists
  for (const cls of featClasses) {
    const list = SPELL_LISTS[cls];
    if (list && allowedNames !== null)
      for (const spell of list) allowedNames.add(spell);
  }

  // Cantrip cap: sum from class tables + 2 per Magic-Initiate-style feat
  // For subclass casters (e.g. Arcane Trickster), use the subclass cantrip table
  let maxCantrips: number | null = null;
  for (const c of spellCasters) {
    const tableKey =
      (c.subclass && CANTRIP_TABLE[c.subclass]) ? c.subclass : c.name;
    const table = CANTRIP_TABLE[tableKey];
    if (table) {
      const idx = Math.min(Math.max(c.level, 1), 12) - 1;
      maxCantrips = (maxCantrips ?? 0) + table[idx];
    }
  }
  if (featClasses.length > 0) {
    maxCantrips =
      (maxCantrips ?? 0) + featClasses.length * FEAT_GRANTS_CANTRIPS;
  }
  if (featUnrestricted && spellCasters.length === 0) {
    // Ritual Caster with no class caster — allow cantrips from the unrestricted list
    maxCantrips = (maxCantrips ?? 0) + FEAT_GRANTS_CANTRIPS;
  }

  // Known cap + prepared caster detection
  let maxKnown: number | null = null;
  let isPreparedCaster = false;

  for (const c of spellCasters) {
    const knownKey =
      (c.subclass && KNOWN_TABLE[c.subclass]) ? c.subclass : c.name;
    const knownRow = KNOWN_TABLE[knownKey];
    if (!knownRow) continue;
    const idx = Math.min(Math.max(c.level, 1), 12) - 1;
    const cap = knownRow[idx];
    if (cap === null) {
      isPreparedCaster = true;
    } else {
      maxKnown = (maxKnown ?? 0) + cap;
    }
  }
  if (isPreparedCaster) maxKnown = null; // any prepared class → no hard known cap

  // Feat-only spellcasting: don't add to known cap (cantrips + 1 innate spell, not tracked here)

  // Prepared max (sum for multiclass prepared casters)
  let preparedMax: number | null = null;
  for (const c of spellCasters) {
    const fn = PREPARED_FORMULA[c.name];
    if (!fn) continue;
    preparedMax = (preparedMax ?? 0) + fn(c.level, abilMods);
  }

  return {
    allowedNames,
    maxCantrips,
    maxKnown,
    preparedMax,
    isPreparedCaster,
    hasSpellcasting: true,
  };
}

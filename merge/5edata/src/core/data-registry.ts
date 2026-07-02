import type {
  Registry,
  RegistrySpell,
  RegistryItem,
  RegistryOptionalFeature,
  BestiaryEntry,
  MonsterFluff,
} from "./types";
import { SANE_PRICES } from "./sane-prices";

const BASE = "/data";

const CLASS_NAMES = [
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "bg3-paladin",
  "ranger",
  "bg3-ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
  "artificer",
  "champion",
  "captain",
  "messenger",
  "scholar",
  "treasure-hunter",
  "warden",
  "apothecary",
  "illrigger",
];

// Sources that are core 5e — classes from these get no source suffix in their display name
const STANDARD_SOURCES = new Set(["PHB", "XPHB", "EFA"]);

const HEALING_OVERRIDES: Record<string, { formula: string; upcast: string }> = {
  "Cure Wounds": { formula: "2d8 + SAM + Prof", upcast: "+2d8/slot above 1st" },
  "Healing Word": {
    formula: "2d4 + SAM + Prof",
    upcast: "+2d4/slot above 1st",
  },
  "Mass Cure Wounds": {
    formula: "5d8 + SAM + Prof",
    upcast: "+5d8/slot above 5th",
  },
  "Mass Healing Word": {
    formula: "2d4 + SAM + Prof",
    upcast: "+2d4/slot above 3rd",
  },
  "Prayer of Healing": {
    formula: "4d8 + SAM + Prof",
    upcast: "+4d8/slot above 2nd",
  },
  Aid: { formula: "2d8 + Prof", upcast: "+2d8/slot above 2nd" },
};

// Singleton registry — populated once on first load
export let REGISTRY: Registry | null = null;

export const REGISTRY_PROMISE: Promise<Registry> = loadRegistry();

async function loadRegistry(): Promise<Registry> {
  const fetches: Promise<unknown>[] = [
    fetch(`${BASE}/skills.json`).then((r) => r.json()),
    fetch(`${BASE}/races.json`).then((r) => r.json()),
    fetch(`${BASE}/backgrounds.json`).then((r) => r.json()),
    fetch(`${BASE}/feats.json`).then((r) => r.json()),
    fetch(`${BASE}/optionalfeatures.json`).then((r) => r.json()),
    ...CLASS_NAMES.map((n) =>
      fetch(`${BASE}/class/class-${n}.json`).then((r) => r.json()),
    ),
  ];

  const [skillsData, racesData, bgData, featsData, optFeatData, ...classFiles] =
    (await Promise.all(fetches)) as [
      { skill?: { name: string; ability: string }[] },
      { race?: Record<string, unknown>[]; subrace?: Record<string, unknown>[] },
      { background?: Record<string, unknown>[] },
      { feat?: Record<string, unknown>[] },
      { optionalfeature?: Record<string, unknown>[] },
      ...Record<string, unknown>[],
    ];

  // Skills
  const skills: Registry["skills"] = {};
  for (const sk of skillsData.skill ?? []) {
    skills[sk.name] = sk.ability;
  }

  // Dedup helpers — prefer highest-priority source
  const SOURCE_RANK = [
    "XPHB",
    "MPMM",
    "VGM",
    "ERLW",
    "EFA",
    "PHB",
    "EEPC",
    "DMG",
  ];

  function sourceRank(src: string) {
    const i = SOURCE_RANK.indexOf(src);
    return i === -1 ? 999 : i;
  }

  function dedupByName<T extends { name: string; source: string }>(
    entries: T[],
  ): T[] {
    const seen = new Map<string, T>();
    for (const entry of entries) {
      const existing = seen.get(entry.name);
      if (!existing || sourceRank(entry.source) < sourceRank(existing.source))
        seen.set(entry.name, entry);
    }
    return [...seen.values()];
  }

  // Dedup class features by name+level — same source priority
  function dedupFeatures<
    T extends { name: string; level: number; source: string },
  >(feats: T[]): T[] {
    const seen = new Map<string, T>();
    for (const f of feats) {
      const key = `${f.name}|${f.level}`;
      const existing = seen.get(key);
      if (!existing || sourceRank(f.source) < sourceRank(existing.source))
        seen.set(key, f);
    }
    return [...seen.values()];
  }

  // Dedup subclass features by name+level+subclassShortName+source — keep all source variants
  function dedupSubclassFeatures<
    T extends {
      name: string;
      level: number;
      subclassShortName: string;
      source?: string;
    },
  >(feats: T[]): T[] {
    const seen = new Map<string, T>();
    for (const f of feats) {
      const key = `${f.name}|${f.level}|${f.subclassShortName}|${f.source ?? ""}`;
      if (!seen.has(key)) seen.set(key, f);
    }
    return [...seen.values()];
  }

  // Classes
  const classes: Registry["classes"] = {};
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    const file = classFiles[i] as Record<string, unknown>;
    const clsList = file.class as Record<string, unknown>[] | undefined;
    if (!clsList?.length) continue;
    // Pick the entry with the best (lowest-rank) source; falls back to first entry
    const cls = clsList.reduce((best, entry) =>
      sourceRank(entry.source as string) < sourceRank(best.source as string)
        ? entry
        : best,
    );
    const rawName = cls.name as string;
    const source = cls.source as string;
    // Append "(SRC)" for non-standard sources, unless the name already contains a parenthetical (e.g. BG3 classes)
    const regKey =
      rawName.includes("(") || STANDARD_SOURCES.has(source)
        ? rawName
        : `${rawName} (${source})`;
    const hd = cls.hd as { faces?: number } | undefined;
    // When a file contains multiple full class versions (e.g. Artificer TCE + EFA),
    // restrict features and subclasses to the winning source only.
    const multiSource = clsList.length > 1;
    const srcFilter = (f: Record<string, unknown>) =>
      !multiSource || f.source === source;
    const rawFeats = (
      (file.classFeature as Record<string, unknown>[] | undefined) ?? []
    ).filter(
      (f) =>
        f.className === rawName && !f.isClassFeatureVariant && srcFilter(f),
    );
    // Subclass data: don't apply srcFilter — _copy filter + name+source dedup handles duplication
    const rawSubFeats = (
      (file.subclassFeature as Record<string, unknown>[] | undefined) ?? []
    );
    const rawSubsAll = (
      (file.subclass as { name: string; source: string; _copy?: unknown }[]) ?? []
    ).filter((s) => !s._copy);
    // Dedup by name+source (remove exact dupes), then rename PHB entries to "(Classic)" when XPHB sibling exists
    const subUnique = new Map<string, { name: string; source: string; _copy?: unknown }>();
    for (const s of rawSubsAll) {
      const key = `${s.name}|${s.source}`;
      if (!subUnique.has(key)) subUnique.set(key, s);
    }
    const subAll = [...subUnique.values()];
    const xphbSubNames = new Set(subAll.filter((s) => s.source === "XPHB").map((s) => s.name));
    const rawSubs = subAll.map((s) =>
      s.source !== "XPHB" && xphbSubNames.has(s.name)
        ? { ...s, name: s.name + " (Classic)" }
        : s,
    );
    const rawSE = cls.startingEquipment as
      | { defaultData?: unknown[]; goldAlternative?: string }
      | undefined;
    classes[regKey] = {
      name: regKey,
      source,
      hitDie: hd?.faces ?? 8,
      saveProficiencies: (cls.proficiency as string[]) ?? [],
      startingProfs:
        (cls.startingProficiencies as Record<string, unknown>) ?? {},
      spellcastingAbility: (cls.spellcastingAbility as string | null) ?? null,
      casterProgression: (cls.casterProgression as string | null) ?? null,
      cantripProgression: (cls.cantripProgression as number[]) ?? [],
      subclasses: dedupByName(rawSubs),
      features: dedupFeatures(
        rawFeats as unknown as Registry["classes"][string]["features"],
      ),
      subclassFeatures: dedupSubclassFeatures(
        rawSubFeats as unknown as Registry["classes"][string]["subclassFeatures"],
      ),
      startingEquipment: rawSE
        ? {
            defaultData: rawSE.defaultData,
            goldAlternative: rawSE.goldAlternative,
          }
        : null,
    };
  }

  // Build top-level subrace map: raceName → subraces[]
  const subracesByRace = new Map<string, Record<string, unknown>[]>();
  for (const sr of (racesData.subrace ?? []) as Record<string, unknown>[]) {
    const key = sr.raceName as string;
    if (!key) continue;
    if (!subracesByRace.has(key)) subracesByRace.set(key, []);
    subracesByRace.get(key)!.push(sr);
  }

  // Helper: build traditional top-level + inline subraces for a race, deduped by name (source priority)
  function buildTraditionalSubs(
    rName: string,
    inlineArr: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const topSubs = subracesByRace.get(rName) ?? [];
    const subraceMap = new Map<string, Record<string, unknown>>();
    // Apply source priority for top-level subs with same name
    for (const sr of topSubs) {
      if (
        !sr.name ||
        String(sr.name).startsWith("Variant;") ||
        sr.name === "Variant Human"
      )
        continue;
      const nm = sr.name as string;
      const existing = subraceMap.get(nm);
      if (
        !existing ||
        sourceRank(sr.source as string) < sourceRank(existing.source as string)
      ) {
        subraceMap.set(nm, sr);
      }
    }
    for (const sr of inlineArr) {
      if (
        !sr.name ||
        String(sr.name).startsWith("Variant;") ||
        sr.name === "Variant Human"
      )
        continue;
      const nm = sr.name as string;
      if (!subraceMap.has(nm)) subraceMap.set(nm, sr);
    }
    return [...subraceMap.values()];
  }

  // Races — strip fixed ASI, filter Variant Human, attach subraces, deduplicate by name
  const races = dedupByName(
    ((racesData.race ?? []) as Record<string, unknown>[]).map((r) => {
      // XPHB-style races use additionalSpells named variants as subraces (e.g., Elf→High Elf/Drow/Wood Elf, Tiefling→Abyssal/Chthonic/Infernal)
      const aspVariants = (
        (r.additionalSpells ?? []) as Record<string, unknown>[]
      ).filter((asp) => asp.name);

      // Some XPHB races use _versions._implementations for variants (e.g., Dragonborn lineages)
      const versionImpls =
        ((r._versions as Record<string, unknown>[])?.[0]?._implementations as
          | Record<string, unknown>[]
          | undefined) ?? [];

      const inlineSubs = (r.subrace ?? []) as Record<string, unknown>[];
      const traditionalSubs = buildTraditionalSubs(
        r.name as string,
        inlineSubs,
      );

      let subs: Record<string, unknown>[];
      if (aspVariants.length > 0) {
        // ASP pseudo-subraces (XPHB rework) merged with traditional subraces
        // Exclude traditional subs whose name is a case-insensitive prefix of an ASP variant name
        // e.g., "High" excluded because "High Elf" exists; "Drow" excluded as exact dup
        const aspNames = aspVariants.map((a) =>
          (a.name as string).toLowerCase(),
        );
        const aspSubs = aspVariants.map((asp) => ({
          name: asp.name,
          source: r.source,
          raceName: r.name,
          additionalSpells: [asp],
          entries: [],
        }));
        const filteredTraditional = traditionalSubs.filter((sr) => {
          const nm = (sr.name as string).toLowerCase();
          return !aspNames.some((an) => an === nm || an.startsWith(nm + " "));
        });
        subs = [...aspSubs, ...filteredTraditional];
      } else if (versionImpls.length > 0) {
        // _versions implementations (e.g., Dragonborn: Black (Acid), Red (Fire), etc.)
        // plus any traditional subraces not covered (Draconblood, Ravenite)
        const versionSubs = versionImpls
          .filter((impl) => (impl._variables as Record<string, string>)?.color)
          .map((impl) => {
            const vars = impl._variables as Record<string, string>;
            const resist = (impl.resist as string[])?.[0] ?? "";
            return {
              name: `${vars.color} (${vars.damageType})`,
              source: r.source,
              raceName: r.name,
              damageType: vars.damageType,
              resist: [resist],
              entries: [],
            };
          });
        const versionNames = new Set(
          versionSubs.map((s) => (s.name as string).toLowerCase()),
        );
        const extraTraditional = traditionalSubs.filter(
          (sr) => !versionNames.has((sr.name as string).toLowerCase()),
        );
        subs = [...versionSubs, ...extraTraditional];
      } else {
        subs = traditionalSubs;
      }

      return {
        ...r,
        subrace: subs,
        ability: undefined,
      } as unknown as Registry["races"][number];
    }),
  );

  // Backgrounds — XPHB only; parse background feat from list entry
  const backgrounds = ((bgData.background ?? []) as Record<string, unknown>[])
    .filter((b) => b.source === "XPHB")
    .map((b) => {
      const rawSkills =
        (b.skillProficiencies as Record<string, boolean>[])?.[0] ?? {};
      const list = (
        (b.entries as Record<string, unknown>[] | undefined) ?? []
      ).find((e) => e.type === "list") as
        | { items?: { name?: string; entry?: string }[] }
        | undefined;
      const featItem = list?.items?.find((i) => i.name === "Feat:");
      let backgroundFeat: string | undefined;
      if (featItem?.entry) {
        const m = featItem.entry.match(/\{@feat ([^|}\n]+?)(?:\|[^}]*)?\}(.*)/);
        if (m) {
          const qualifier = m[2].trim();
          backgroundFeat = qualifier
            ? `${m[1].trim()} ${qualifier}`
            : m[1].trim();
        }
      }
      return {
        name: b.name as string,
        source: b.source as string,
        skillProficiencies: Object.keys(rawSkills)
          .filter((k) => rawSkills[k])
          .slice(0, 2),
        entries: (b.entries as unknown[]) ?? [],
        backgroundFeat,
        startingEquipment: (b.startingEquipment as unknown[] | undefined) ?? [],
      };
    });

  // Feats — deduplicate by name, XPHB takes priority
  const feats = dedupByName(
    ((featsData.feat ?? []) as Record<string, unknown>[]).map((f) => {
      const prereqs = ((f.prerequisite ?? []) as Record<string, unknown>[]).map(
        (p) => {
          const out = { ...p };
          delete out["ability"];
          return out;
        },
      );
      return {
        ...f,
        prerequisite: prereqs,
        name: f.name as string,
        source: f.source as string,
      };
    }),
  );

  // Optional features — skip Onomancy Rites, deduplicate by name (XPHB preferred)
  const optionalFeatures = dedupByName(
    (
      (optFeatData.optionalfeature ??
        []) as unknown as RegistryOptionalFeature[]
    ).filter((f) => !(f.featureType ?? []).includes("OR")),
  );

  const reg: Registry = {
    skills,
    classes,
    races,
    backgrounds,
    feats,
    optionalFeatures,
    spells: null,
    items: null,
    conditions: null,
    bestiary: null,
    bestiaryFluff: null,
  };
  REGISTRY = reg;
  return reg;
}

export async function loadSpells(): Promise<RegistrySpell[]> {
  if (REGISTRY?.spells) return REGISTRY.spells;
  const SOURCES = ["spells-phb", "spells-xge", "spells-tce", "spells-xphb"];
  const files = (await Promise.all(
    SOURCES.map((s) => fetch(`${BASE}/spells/${s}.json`).then((r) => r.json())),
  )) as { spell?: RegistrySpell[] }[];

  const merged = files.flatMap((f) => f.spell ?? []);
  const spells: RegistrySpell[] = merged
    .filter((s) => s.level <= 6)
    .map((s) => {
      // BG3: cantrip tiers at 1/5/10
      if (s.level === 0) {
        const raw = s as unknown as Record<string, unknown>;
        if (raw.scalingLevelDice) {
          const scaling =
            (raw.scalingLevelDice as Record<string, Record<string, unknown>>)
              .scaling ?? {};
          if (scaling["11"] && !scaling["10"]) {
            scaling["10"] = scaling["11"];
            delete scaling["11"];
          }
        }
      }
      const override = HEALING_OVERRIDES[s.name];
      if (override) s.bg3Formula = `${override.formula} (${override.upcast})`;
      return s;
    });

  if (REGISTRY) REGISTRY.spells = spells;
  return spells;
}

export async function loadItems(): Promise<RegistryItem[]> {
  if (REGISTRY?.items) return REGISTRY.items;
  const [magicData, baseData, bg3Data, arrowData, bonusDmgData] =
    (await Promise.all([
      fetch(`${BASE}/items.json`).then((r) => r.json()),
      fetch(`${BASE}/items-base.json`).then((r) => r.json()),
      fetch(`${BASE}/items-bg3.json`).then((r) => r.json()),
      fetch(`${BASE}/special-arrows.json`).then((r) => r.json()),
      fetch(`${BASE}/bonus-damage.json`).then((r) => r.json()),
    ])) as [
      { item?: RegistryItem[] },
      { baseitem?: RegistryItem[] },
      { item?: RegistryItem[] },
      { item?: RegistryItem[] },
      { item?: { name: string; source: string; dice: string; type: string }[] },
    ];

  const items: RegistryItem[] = [
    ...(magicData.item ?? []).map((i) => {
      const c = { ...i };
      delete (c as Record<string, unknown>)["reqAttune"];
      delete (c as Record<string, unknown>)["reqAttuneTags"];
      return c;
    }),
    ...(baseData.baseitem ?? []).map((i) => ({ ...i, _base: true })),
    ...(bg3Data.item ?? []).map((i) => ({
      ...i,
      bonusWeapon: i.bonusWeapon ?? parseBg3BonusWeapon(i),
    })),
    ...(arrowData.item ?? []),
  ];

  // Merge in curated unconditional bonus-damage-on-hit data (see scripts/audit-bonus-damage.mjs)
  const bonusDmgMap = new Map(
    (bonusDmgData.item ?? []).map((b) => [
      `${b.name}|${b.source}`.toLowerCase(),
      { dice: b.dice, type: b.type },
    ]),
  );
  for (const item of items) {
    const bd = bonusDmgMap.get(`${item.name}|${item.source}`.toLowerCase());
    if (bd) item.bonusDamage = bd;
  }

  // Apply sane price overrides
  for (const item of items) {
    const price = SANE_PRICES[item.name.toLowerCase()];
    if (price != null) item.value = price * 100;
  }
  if (REGISTRY) REGISTRY.items = items;
  return items;
}

// BG3 items encode their flat magic bonus in the first italic entries line instead of a
// structured field, e.g. "_Dagger +1, requires attunement_". Extract it so it can be applied
// to attack/damage rolls the same way as 5etools' bonusWeapon field.
function parseBg3BonusWeapon(item: RegistryItem): string | undefined {
  const first = item.entries?.[0];
  if (typeof first !== "string") return undefined;
  const m = first.match(/^_[^_]*\+(\d)[^_]*_$/);
  return m ? `+${m[1]}` : undefined;
}

// Every bestiary source shipped in /data/bestiary (sans fluff). Loaded and
// merged on first request; the source filter in the GM picker lets the user
// narrow by book. `mm`/`xmm` lead so the common Monster Manual entries sort first.
export const BESTIARY_SOURCES = [
  "mm", "xmm", "mpmm", "mtf", "vgm", "ftd", "tce", "bgg", "bmt", "phb", "xphb",
  "dmg", "xdmg", "scc", "mot", "vrgr", "egw", "erlw", "ggr", "skt", "toa",
  "cos", "oota", "wbtw", "idrotf", "cm", "gos", "bgdia", "kftgv", "pota", "rot",
  "tftyp", "wdh", "wdmm", "hotdq", "dsotdq", "sdw", "slw", "lmop", "dod", "mff",
  "mpp", "mcv1sc", "mcv2dc", "mcv3mc", "mcv4ec", "ai", "awm", "gotsf", "lox",
  "dip", "aatm", "abh", "aitfr-dn", "aitfr-fcd", "aitfr-isf", "aitfr-thp",
  "bam", "coa", "crcotn", "dc", "ditlcot", "dod", "dosi", "efa", "esk", "fraif",
  "hat-tg", "hftt", "hol", "hotb", "imr", "jttrc", "kkw", "lfl", "llk", "lr",
  "lrdt", "mabjov", "mgelft", "mismv1", "nf", "nrh-ass", "nrh-at", "nrh-avitw",
  "nrh-awol", "nrh-coi", "nrh-tcmc", "nrh-tlt", "oow", "pabtso", "ps-a", "ps-d",
  "ps-i", "ps-k", "ps-x", "ps-z", "qftis", "rmbre", "rtg", "sads", "tofw",
  "ttp", "vd", "veor", "wtthc", "xge",
];

export async function loadBestiary(): Promise<BestiaryEntry[]> {
  if (REGISTRY?.bestiary) return REGISTRY.bestiary;
  const unique = Array.from(new Set(BESTIARY_SOURCES));
  const files = await Promise.all(
    unique.map((src) =>
      fetch(`${BASE}/bestiary/bestiary-${src}.json`)
        .then((r) => (r.ok ? r.json() : { monster: [] }))
        .catch(() => ({ monster: [] })),
    ),
  );
  const merged = files.flatMap(
    (f) => (f as { monster?: BestiaryEntry[] }).monster ?? [],
  );
  if (REGISTRY) REGISTRY.bestiary = merged;
  return merged;
}

type RawFluffEntry = {
  name: string;
  source: string;
  entries?: unknown[];
  images?: MonsterFluff["images"];
  _copy?: {
    name: string;
    source: string;
    _mod?: { entries?: { mode: string; items: unknown } };
  };
};

export async function loadBestiaryFluff(): Promise<MonsterFluff[]> {
  if (REGISTRY?.bestiaryFluff) return REGISTRY.bestiaryFluff;

  const indexData = await fetch(`${BASE}/bestiary/fluff-index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : Promise.resolve({} as Record<string, string>)))
    .catch(() => ({} as Record<string, string>));

  const filenames = Object.values(indexData);
  const files = await Promise.all(
    filenames.map((filename) =>
      fetch(`${BASE}/bestiary/${filename}`)
        .then((r) => (r.ok ? r.json() : { monsterFluff: [] }))
        .catch(() => ({ monsterFluff: [] })),
    ),
  );

  const rawEntries = files.flatMap(
    (f: unknown) => ((f as { monsterFluff?: RawFluffEntry[] }).monsterFluff ?? []),
  );

  // Build lookup of base entries (no _copy) for resolution
  const byKey = new Map<string, RawFluffEntry>();
  for (const e of rawEntries) {
    if (!e._copy) byKey.set(`${e.name}|${e.source}`, e);
  }

  const resolved: MonsterFluff[] = rawEntries.map((e) => {
    if (!e._copy) return { name: e.name, source: e.source, entries: e.entries, images: e.images };
    const base = byKey.get(`${e._copy.name}|${e._copy.source}`);
    if (!base) return { name: e.name, source: e.source, entries: [] };

    let entries = [...(base.entries ?? [])];
    const mod = e._copy._mod?.entries;
    if (mod) {
      const items = Array.isArray(mod.items) ? mod.items : [mod.items];
      if (mod.mode === "prependArr") entries = [...items, ...entries];
      else if (mod.mode === "appendArr") entries = [...entries, ...items];
      else if (mod.mode === "replaceArr") entries = items;
    }
    return { name: e.name, source: e.source, entries, images: e.images ?? base.images };
  });

  if (REGISTRY) REGISTRY.bestiaryFluff = resolved;
  return resolved;
}

export async function loadConditions(): Promise<unknown[]> {
  if (REGISTRY?.conditions) return REGISTRY.conditions;
  const data = (await fetch(`${BASE}/conditionsdiseases.json`).then((r) =>
    r.json(),
  )) as { condition?: unknown[] };
  const conditions = data.condition ?? [];
  if (REGISTRY) REGISTRY.conditions = conditions;
  return conditions;
}

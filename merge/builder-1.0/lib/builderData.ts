import { readFileSync } from "fs";
import path from "path";
import type {
  BuilderProfession,
  BuilderOrigin,
  BuilderFeat,
  BuilderSpell,
  BuilderFeatureEntry,
  AttributeKey,
  BuilderVocationCaster,
  BuilderStartingPack,
  BuilderOriginPackCategory,
  ChoiceFeature,
} from "./characterTypes";
import { getProfessionFeats } from "./data";

function readJSON<T>(filename: string): T {
  const filePath = path.join(process.cwd(), "content", filename);
  return JSON.parse(readFileSync(filePath, "utf-8").replace(/^﻿/, "")) as T;
}

const ALL_VITALS = [
  "Vigor",
  "Intuition",
  "Talent",
  "Awareness",
  "Lore",
  "Social",
];

function parseVitalsChoice(skills: string[]): {
  count: number;
  options: string[];
} {
  if (!skills?.length) return { count: 0, options: [] };
  const first = skills[0].toLowerCase();
  const count = first.includes("two") ? 2 : 1;
  if (first.includes("any")) return { count, options: ALL_VITALS };

  const options: string[] = [];
  const dash = skills[0].match(/[—\-]\s*([A-Z][a-z]+)/);
  if (dash) options.push(dash[1]);
  skills.slice(1).forEach((s) => {
    const clean = s
      .replace(/^or\s+/i, "")
      .replace(/[,.]$/, "")
      .trim();
    if (clean && ALL_VITALS.includes(clean)) options.push(clean);
  });
  return { count, options };
}

// ─── Caster detection — requires "You are a **X-caster**" to avoid false positives ─

interface CasterInfo {
  casterType: "full" | "half" | "limited" | null;
  casterSource: string | null;
  casterModifierOptions: AttributeKey[];
}

function detectCasterFromMarkdown(md: string): CasterInfo {
  // Normalize non-breaking spaces before matching
  const normalized = md.replace(/\u00a0/g, " ");
  // Strict match: must say "You are a **X-caster**" or "You're a **X-caster**"
  const typeMatch = normalized.match(
    /You(?:'re| are) a \*\*(Full|Half|Limited)-[Cc]aster\*\*/i,
  );
  if (!typeMatch)
    return { casterType: null, casterSource: null, casterModifierOptions: [] };

  const casterType = typeMatch[1].toLowerCase() as "full" | "half" | "limited";

  const sourceMatch =
    normalized.match(/\*\*[Ss]ource\*\*\s+is\s+\*\*(.*?)\*\*/i) ||
    normalized.match(/\*\*[Ss]ource\*\*:\s*_?(.*?)_?\n/i) ||
    normalized.match(/[Ss]ource\*\*[^*\n]+\*\*(.*?)\*\*/i) ||
    normalized.match(/\*\*source\*\* is \*\*(.*?)\*\*/i) ||
    normalized.match(/source\*\* is \*\*(.*?)\*\*/i);
  const casterSource = sourceMatch ? sourceMatch[1].trim() : null;

  const modMatch =
    normalized.match(/Spellcasting Modifier\*\*\s+is\s+(.*?)(?:\n|$)/i) ||
    normalized.match(/Spellcasting Modifier\*\*:\s*_?(.*?)_?[\n.]/i) ||
    normalized.match(/spell casting modifier\*\* is\s+(.*?)(?:\n|$)/i) ||
    normalized.match(/spellcasting modifier\*\* is\s+(.*?)(?:\n|$)/i);
  const modRaw = modMatch ? modMatch[1].trim() : "";

  const casterModifierOptions: AttributeKey[] = [];
  if (/mind/i.test(modRaw)) casterModifierOptions.push("mind");
  if (/will/i.test(modRaw)) casterModifierOptions.push("will");
  if (/brawn/i.test(modRaw)) casterModifierOptions.push("brawn");
  if (/finesse/i.test(modRaw)) casterModifierOptions.push("finesse");
  if (/body/i.test(modRaw)) casterModifierOptions.push("brawn"); // legacy alias
  if (casterModifierOptions.length === 0 && modRaw) {
    // fallback: try lower-cased
    const lower = modRaw.toLowerCase();
    if (lower.includes("mind")) casterModifierOptions.push("mind");
    else if (lower.includes("will")) casterModifierOptions.push("will");
    else if (lower.includes("brawn")) casterModifierOptions.push("brawn");
    else if (lower.includes("finesse")) casterModifierOptions.push("finesse");
    else if (lower.includes("body")) casterModifierOptions.push("brawn"); // legacy alias
  }

  return { casterType, casterSource, casterModifierOptions };
}

function detectCasterFromFeatures(
  features: Array<{ description_markdown?: string }>,
): CasterInfo {
  for (const f of features ?? []) {
    const info = detectCasterFromMarkdown(f.description_markdown ?? "");
    if (info.casterType) return info;
  }
  return { casterType: null, casterSource: null, casterModifierOptions: [] };
}

// ─── Starting pack helpers ────────────────────────────────────────────────────

function extractProfessionPack(
  rawPack: Record<string, unknown>,
): BuilderStartingPack {
  function items(key: string): string[] {
    const section = rawPack[key] as { items?: string[] } | undefined;
    const raw =
      section?.items?.filter((i) => i && i.toLowerCase() !== "none") ?? [];
    // Merge items that start with "or " into the previous item as an "X or Y" choice
    const merged: string[] = [];
    for (const item of raw) {
      if (/^or\s+/i.test(item) && merged.length > 0) {
        merged[merged.length - 1] =
          `${merged[merged.length - 1]} or ${item.replace(/^or\s+/i, "")}`;
      } else {
        merged.push(item);
      }
    }
    return merged;
  }
  const result: BuilderStartingPack = {
    weapons: items("weapons"),
    armor: items("armor"),
    kit: items("kit"),
    inventory: items("inventory"),
    currency: (rawPack.starting_currency as string | null) ?? null,
  };
  // Fallback: if all categories are empty but a raw string exists, parse and categorize it
  const allEmpty =
    result.weapons.length === 0 &&
    result.armor.length === 0 &&
    result.kit.length === 0 &&
    result.inventory.length === 0;
  if (allEmpty) {
    const rawStr = (rawPack.raw as string | undefined) ?? "";
    if (rawStr) {
      for (const entry of rawStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        const lower = entry.toLowerCase();
        if (
          /\b(sword|dagger|axe|bow|crossbow|spear|mace|staff|wand|knife|blade|lance|flail|hammer|maul|rapier|sling|arrow|bolt|quiver|pistol|rifle)/.test(
            lower,
          )
        ) {
          result.weapons.push(entry);
        } else if (
          /\b(armor|armour|shield|robe|cloak|clothing|clothes|garb|vestment|outfit|attire)\b/.test(
            lower,
          )
        ) {
          result.armor.push(entry);
        } else if (
          /\b(kit|tools|tool|lockpick|grappling|rope|hook|pick)\b/.test(lower)
        ) {
          result.kit.push(entry);
        } else {
          result.inventory.push(entry);
        }
      }
    }
  }
  return result;
}

function extractOriginPack(
  rawPack: Record<string, unknown> | undefined,
  packName: string,
): { name: string; categories: BuilderOriginPackCategory[] } | null {
  if (!rawPack?.parsed) return null;
  const parsed = rawPack.parsed as Record<string, { items?: string[] }>;
  const categories: BuilderOriginPackCategory[] = Object.entries(parsed)
    .map(([key, val]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      items: (val.items ?? []).filter((i) => i && i.toLowerCase() !== "none"),
    }))
    .filter((cat) => cat.items.length > 0);
  if (categories.length === 0) return null;
  return { name: packName ?? "Origin Pack", categories };
}

// ─── Exported loaders ─────────────────────────────────────────────────────────

export function getBuilderProfessions(): BuilderProfession[] {
  const data = readJSON<{ professions: Record<string, unknown>[] }>(
    "professions.json",
  );
  return data.professions.map((p) => {
    const prof = p as {
      id: string;
      name: string;
      role: string;
      flavor: string;
      starting_vitality: string;
      vitality_gained_per_tier: string;
      body_modifier_bonus: string;
      path_options: string[];
      proficiencies: {
        vitals_skills: string[];
        armaments: string[];
        protection: string[];
        tool_kits: string[];
      };
      features: Array<{
        id?: string;
        name?: string;
        description_markdown?: string;
        traits?: string[];
        activation?: { raw?: string };
      }>;
      starting_pack: Record<string, unknown>;
    };

    const { count, options } = parseVitalsChoice(
      prof.proficiencies?.vitals_skills ?? [],
    );
    const caster = detectCasterFromFeatures(prof.features ?? []);

    return {
      id: prof.id,
      name: prof.name,
      role: prof.role ?? "",
      flavor: prof.flavor ?? "",
      startingVitality: prof.starting_vitality ?? "10 + Body",
      vitalityPerTier: prof.vitality_gained_per_tier ?? "2d8",
      bodyModifierBonus: prof.body_modifier_bonus ?? "1d6 per 5 Body",
      woundBonusPerTier: ((prof as Record<string, unknown>).wound_bonus_per_tier as number) ?? 1,
      pathOptions: prof.path_options ?? [],
      vitalsChoiceCount: count,
      vitalsOptions: options,
      armaments: prof.proficiencies?.armaments ?? [],
      protection: prof.proficiencies?.protection ?? [],
      toolKits: prof.proficiencies?.tool_kits ?? [],
      ...caster,
      startingPack: extractProfessionPack(prof.starting_pack ?? {}),
      baseFeatures: (prof.features ?? []).map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        descriptionMarkdown: f.description_markdown ?? "",
        traits: f.traits ?? [],
        activationRaw: f.activation?.raw ?? null,
      })),
      customResource: ((prof as Record<string, unknown>).custom_resource as import("./characterTypes").CustomResourceDef | undefined) ?? undefined,
    } satisfies BuilderProfession;
  });
}

export function getBuilderOrigins(): BuilderOrigin[] {
  const data = readJSON<{ origins: Record<string, unknown>[] }>("origins.json");
  return data.origins.map((o) => {
    const origin = o as {
      id: string;
      name: string;
      flavor: string;
      pack_name: string;
      origin_pack: Record<string, unknown>;
      origin_features: Array<{
        id?: string;
        name?: string;
        description_markdown?: string;
        traits?: string[];
        activation?: { raw?: string };
      }>;
      vocations: Array<{
        id: string;
        name: string;
        flavor: string;
        attribute_bonus: { attribute: string; value: number };
        features: Array<{
          id?: string;
          name?: string;
          description_markdown?: string;
          traits?: string[];
          activation?: { raw?: string };
        }>;
      }>;
    };

    const originFeatures = origin.origin_features ?? [];
    const originCasterInfo = detectCasterFromFeatures(originFeatures);
    const originCaster: BuilderVocationCaster | null =
      originCasterInfo.casterType
        ? {
            casterType: originCasterInfo.casterType,
            casterSource: originCasterInfo.casterSource ?? "",
            casterModifierOptions: originCasterInfo.casterModifierOptions,
          }
        : null;

    return {
      id: origin.id,
      name: origin.name,
      flavor: origin.flavor ?? "",
      baseFeatures: originFeatures.map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        descriptionMarkdown: f.description_markdown ?? "",
        traits: f.traits ?? [],
        activationRaw: f.activation?.raw ?? null,
      })),
      caster: originCaster,
      vocations: (origin.vocations ?? []).map((v) => {
        const casterInfo = detectCasterFromFeatures(v.features ?? []);
        const vocationCaster: BuilderVocationCaster | null =
          casterInfo.casterType
            ? {
                casterType: casterInfo.casterType,
                casterSource: casterInfo.casterSource ?? "",
                casterModifierOptions: casterInfo.casterModifierOptions,
              }
            : null;
        return {
          id: v.id,
          name: v.name,
          flavor: v.flavor ?? "",
          attributeBonus: {
            attribute: ((v.attribute_bonus?.attribute ?? "brawn") as string).toLowerCase() as AttributeKey,
            value: v.attribute_bonus?.value ?? 1,
          },
          caster: vocationCaster,
          features: (v.features ?? []).map((f) => ({
            id: f.id ?? "",
            name: f.name ?? "",
            descriptionMarkdown: f.description_markdown ?? "",
            traits: f.traits ?? [],
            activationRaw: f.activation?.raw ?? null,
          })),
        };
      }),
      originPack: extractOriginPack(origin.origin_pack, origin.pack_name),
    } satisfies BuilderOrigin;
  });
}

export function getBuilderFeats(): {
  professionFeats: BuilderFeat[];
  originFeats: BuilderFeat[];
} {
  const { feats: pfFeats } = getProfessionFeats();
  const of_ = readJSON<{ feats: Record<string, unknown>[] }>(
    "origin_feats.json",
  );

  function mapFeat(
    f: Record<string, unknown>,
    ownerType: "profession" | "origin",
  ): BuilderFeat {
    const md = (f.description_markdown as string) ?? "";
    const casterDetected = detectCasterFromMarkdown(md);
    const casterInfo: BuilderVocationCaster | null = casterDetected.casterType
      ? {
          casterType: casterDetected.casterType,
          casterSource: casterDetected.casterSource ?? "",
          casterModifierOptions: casterDetected.casterModifierOptions,
        }
      : null;
    return {
      id: f.id as string,
      name: f.name as string,
      ownerId: f.owner_id as string,
      ownerName: f.owner_name as string,
      ownerType,
      tier: (f.tier as number) ?? 1,
      tag: (f.tag as string) ?? null,
      required: (f.required as string) ?? null,
      pathInvestment: (f.path_investment as string) ?? null,
      descriptionMarkdown: md,
      traits: (f.traits as string[]) ?? [],
      activationRaw: (f.activation as { raw?: string })?.raw ?? null,
      casterInfo,
      fixedExpertise: (f.fixed_expertise as string[] | undefined) ?? undefined,
    };
  }

  return {
    professionFeats: pfFeats.map((f) =>
      mapFeat(f as unknown as Record<string, unknown>, "profession"),
    ),
    originFeats: (of_.feats ?? []).map((f) => mapFeat(f, "origin")),
  };
}

export function getBuilderSpells(): BuilderSpell[] {
  const data = readJSON<{ spells: Record<string, unknown>[] }>("spells.json");
  return (data.spells ?? [])
    .filter((s) => !(s.reference_only as boolean))
    .map(
      (s) =>
        ({
          id: s.id as string,
          name: s.name as string,
          slug: s.slug as string,
          tier: (s.tier as number) ?? 0,
          isCantrip: (s.is_cantrip as boolean) ?? false,
          school: (s.school as string) ?? (s.school_display as string) ?? "",
          sources: (s.sources as string[]) ?? [],
          grantedByOwners: (() => {
            const gb = s.granted_by as { owner?: string | string[] } | undefined;
            const owner = gb?.owner;
            if (!owner) return [];
            return Array.isArray(owner) ? owner : [owner];
          })(),
          range: (s.range as string) ?? "",
          duration: (s.duration as string) ?? "",
          descriptionMarkdown: (s.description_markdown as string) ?? "",
          amps: (s.amps as Array<{ cost: string; effect: string }>) ?? [],
        }) satisfies BuilderSpell,
    );
}

export function getChoiceFeatures(): ChoiceFeature[] {
  const data = readJSON<{ features: ChoiceFeature[] }>("choice_features.json");
  return data.features ?? [];
}

// ─── Item catalog ─────────────────────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  weight: number;
  slot: string | null;
  traits: string[];
  damage?: string;
  armorBonus?: number;
  armorCategory?: string | null;
  armorTier?: "Standard" | "Enhanced" | "Fortified" | null;
  woundBonus?: number;
  shieldType?: "Temporary" | "Light" | "Medium" | "Heavy" | null;
  equippable: boolean;
  cost?: number; // price in gold pieces (null/undefined = no price)
  // Weapon structured fields
  armamentTags: string[]; // e.g. ["simple", "finesse"]
  damageTypeTags: string[]; // e.g. ["puncture", "slash"]
  isRanged: boolean;
  equipSlots: string[]; // e.g. ["main_hand", "off_hand"]
  damageDiceCount: number;
  damageDiceSize: number;
}

export function getItemCatalog(): CatalogItem[] {
  const data = readJSON<{ catalog: Record<string, unknown[]> }>("items.json");
  const items: CatalogItem[] = [];

  // Damage type code → tag mapping
  const DAMAGE_CODE_TO_TAG: Record<string, string> = {
    B: "blunt",
    S: "slash",
    P: "puncture",
  };

  function mapItem(raw: Record<string, unknown>, cat: string): CatalogItem {
    const template = (raw.inventory_template as Record<string, unknown>) ?? {};
    const traits =
      (raw.traits as Array<{ name: string }> | string[] | undefined) ?? [];
    const groups = (raw.groups as string[] | undefined) ?? [];
    const damageTypes =
      (raw.damage_types as Array<{ code: string }> | undefined) ?? [];
    const equipSlots = (raw.equip_slots as string[] | undefined) ?? [];

    // Parse damage string e.g. "1d8" → count/size
    const damageStr = (raw.damage as string | undefined) ?? "";
    const diceMatch = damageStr.match(/^(\d+)d(\d+)$/i);
    const damageDiceCount = diceMatch ? parseInt(diceMatch[1]) : 0;
    const damageDiceSize = diceMatch ? parseInt(diceMatch[2]) : 6;

    return {
      id: raw.id as string,
      name: raw.name as string,
      category: cat,
      weight: (raw.weight as number) ?? 1,
      slot: (template.slot as string) ?? equipSlots[0] ?? null,
      traits: Array.isArray(traits)
        ? traits.map((t) =>
            typeof t === "string" ? t : (t as { name: string }).name,
          )
        : [],
      damage: raw.damage as string | undefined,
      armorBonus: (() => {
        const r = raw.armor_bonus_range as
          | { value?: number; min?: number }
          | undefined;
        const s = raw.armor_bonus as { value?: number } | undefined;
        return r?.value ?? r?.min ?? s?.value;
      })(),
      armorCategory: (raw.armor_type as string | undefined) ?? null,
      armorTier: (raw.armor_tier as "Standard" | "Enhanced" | "Fortified" | undefined) ?? null,
      woundBonus: (raw.wound_bonus as number | undefined) ?? 0,
      shieldType: (raw.shield_type as "Temporary" | "Light" | "Medium" | "Heavy" | undefined) ?? null,
      equippable: (raw.equippable as boolean) ?? false,
      cost: (raw.cost as number | null) ?? undefined,
      armamentTags: groups.map((g) => g.toLowerCase()),
      damageTypeTags: damageTypes
        .map((d) => DAMAGE_CODE_TO_TAG[d.code] ?? d.code.toLowerCase())
        .filter(Boolean),
      isRanged: groups.map((g) => g.toLowerCase()).includes("ranged"),
      equipSlots,
      damageDiceCount,
      damageDiceSize,
    };
  }

  for (const [rawCat, entries] of Object.entries(data.catalog ?? {})) {
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1, -1); // "weapons" → "Weapon"
    const display =
      cat === "Weapon"
        ? "Weapon"
        : cat === "Armor"
          ? "Armor"
          : cat === "Shield"
            ? "Shield"
            : cat === "Kit"
              ? "Kit"
              : cat === "Consumable"
                ? "Consumable"
                : "Misc";
    for (const entry of entries) {
      items.push(mapItem(entry as Record<string, unknown>, display));
    }
  }
  return items;
}

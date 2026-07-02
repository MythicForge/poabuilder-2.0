// Synchronous typed registry over the /data content. All JSON is bundled
// eagerly via import.meta.glob — the dataset is a few hundred KB, so no lazy
// loading or fetch layer is needed (simpler than 5edata's async registry).

import type {
  CatalogItem, ConditionDef, Origin, PathDef, Profession, ResourceDef, Spell,
  TierProgression, Vocation,
} from "./types.ts";

const professionModules = import.meta.glob("@data/professions/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const originModules = import.meta.glob("@data/origins/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
import spellsDoc from "@data/spells/spells.json";
import itemsDoc from "@data/items/items.json";
import conditionsDoc from "@data/shared/conditions.json";
import universalResourcesDoc from "@data/shared/universal-resources.json";
import tierProgressionDoc from "@data/shared/tier-progression.json";
import originFeatsDoc from "@data/shared/origin-feats.json";
import equipmentRulesDoc from "@data/shared/equipment-rules.json";

function isTemplate(path: string): boolean {
  return path.includes("/_");
}

const professions = new Map<string, Profession>();
const paths = new Map<string, PathDef>();
for (const [file, mod] of Object.entries(professionModules)) {
  if (isTemplate(file)) continue;
  const j = mod as Profession & PathDef;
  if ((j as PathDef).profession) paths.set(j.id, j as PathDef);
  else professions.set(j.id, j as Profession);
}

const origins = new Map<string, Origin>();
const vocations = new Map<string, Vocation>();
for (const [file, mod] of Object.entries(originModules)) {
  if (isTemplate(file)) continue;
  const j = mod as Origin & Vocation;
  if ((j as Vocation).origin) vocations.set(j.id, j as Vocation);
  else origins.set(j.id, j as Origin);
}

const spells = new Map<string, Spell>();
for (const s of (spellsDoc as { spells: Spell[] }).spells) spells.set(s.id, s);

const items = new Map<string, CatalogItem>();
const itemsTyped = itemsDoc as unknown as { catalog: Record<string, CatalogItem[]>; carry_rules: { carry_capacity_formula: string }; armor_types: unknown[]; slot_definitions: Record<string, unknown> };
for (const list of Object.values(itemsTyped.catalog)) {
  for (const it of list) items.set(it.id, it);
}

const conditions = new Map<string, ConditionDef>();
for (const c of (conditionsDoc as { conditions: ConditionDef[] }).conditions) conditions.set(c.id, c);
const conditionsByName = new Map<string, ConditionDef>();
for (const c of conditions.values()) conditionsByName.set(c.name, c);

export const REGISTRY = {
  professions,
  paths,
  origins,
  vocations,
  spells,
  items,
  itemsDoc: itemsTyped,
  conditions,
  conditionsByName,
  universalResources: (universalResourcesDoc as { resources: ResourceDef[] }).resources,
  tierProgression: tierProgressionDoc as TierProgression,
  universalOriginFeats: (originFeatsDoc as { feats: import("./types.ts").Feat[] }).feats,
  equipmentRules: equipmentRulesDoc as Record<string, unknown>,

  pathsOf(professionId: string): PathDef[] {
    return [...paths.values()].filter((p) => p.profession === professionId);
  },
  vocationsOf(originId: string): Vocation[] {
    return [...vocations.values()].filter((v) => v.origin === originId);
  },
};

export type Registry = typeof REGISTRY;

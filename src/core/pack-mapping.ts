// Turns profession `starting_pack` + origin `pack` manifests into pickable
// inventory lines. Two manifest dialects exist: profession packs use slot tokens
// ("melee_weapon", "medium_armor"), origin packs use human strings + {type:choice}.
// Tokens become category pickers; named strings fuzzy-match the catalog, falling
// back to a free-text custom item; {type:choice} becomes a pick-N list.

import type { CatalogItem, InventoryItem, Origin, Profession } from "./types.ts";
import type { Registry } from "./data-registry.ts";

export interface PackLine {
  id: string;
  source: string;
  section: string;
  kind: "item" | "category" | "choice";
  label: string;
  catalogId: string | null; // item kind: matched id, or null for free-text
  options: { id: string; name: string }[]; // category kind
  count: number; // choice kind
  from: string[]; // choice kind
}

export interface Currency { gold: number; silver: number; copper: number }

const norm = (s: string) => s.toLowerCase().replace(/[_\-()/]/g, " ").replace(/\s+/g, " ").trim();
export const humanize = (token: string) => {
  const n = norm(token).replace(/\bor\b/g, "or");
  return n.charAt(0).toUpperCase() + n.slice(1);
};

const rangeCodes = (it: CatalogItem) => (it.range_bands ?? []).map((r) => r.code);
const isMelee = (it: CatalogItem) => rangeCodes(it).includes("M");
const isRanged = (it: CatalogItem) => rangeCodes(it).some((c) => c !== "M");

function itemsIn(reg: Registry, category: string, filter?: (i: CatalogItem) => boolean) {
  const out: { id: string; name: string }[] = [];
  for (const it of reg.items.values()) {
    if (it.category?.toLowerCase() === category && (!filter || filter(it))) out.push({ id: it.id, name: it.name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Recognized slot tokens → a labelled catalog-category option list. null = not a token. */
function categoryFor(token: string, reg: Registry): { label: string; options: { id: string; name: string }[] } | null {
  const armor = (type: string) => itemsIn(reg, "armor", (i) => i.armor_type?.toLowerCase() === type);
  switch (token.toLowerCase()) {
    case "melee_weapon": return { label: "Melee weapon", options: itemsIn(reg, "weapon", isMelee) };
    case "ranged_weapon": return { label: "Ranged weapon", options: itemsIn(reg, "weapon", isRanged) };
    case "ranged_weapon_or_shield":
      return { label: "Ranged weapon or shield", options: [...itemsIn(reg, "weapon", isRanged), ...itemsIn(reg, "shield")] };
    case "weapon": case "any_weapon": return { label: "Weapon", options: itemsIn(reg, "weapon") };
    case "light_armor": return { label: "Light armor", options: armor("light") };
    case "medium_armor": return { label: "Medium armor", options: armor("medium") };
    case "heavy_armor": return { label: "Heavy armor", options: armor("heavy") };
    case "armor": return { label: "Armor", options: itemsIn(reg, "armor") };
    case "shield": return { label: "Shield", options: itemsIn(reg, "shield") };
    default: return null;
  }
}

/** Best catalog match for a free string, or null when nothing crosses the threshold. */
export function matchItem(text: string, reg: Registry): { id: string; name: string } | null {
  const q = norm(text);
  if (!q) return null;
  const qtok = new Set(q.split(" "));
  let best: { id: string; name: string } | null = null;
  let bestScore = 0;
  for (const it of reg.items.values()) {
    const n = norm(it.name);
    if (n === q) return { id: it.id, name: it.name };
    const ntok = n.split(" ");
    const overlap = ntok.filter((w) => qtok.has(w)).length;
    const score = overlap / Math.max(qtok.size, ntok.length);
    if (score > bestScore) { bestScore = score; best = { id: it.id, name: it.name }; }
  }
  return bestScore >= 0.5 ? best : null;
}

export function resolvePack(prof: Profession | undefined, origin: Origin | undefined, reg: Registry): { lines: PackLine[]; currency: Currency } {
  const lines: PackLine[] = [];
  const currency: Currency = { gold: 0, silver: 0, copper: 0 };

  const consume = (manifest: Record<string, unknown> | undefined, source: string) => {
    for (const [section, val] of Object.entries(manifest ?? {})) {
      if (section === "currency") { Object.assign(currency, val); continue; }
      if (Array.isArray(val)) {
        val.forEach((entry, i) => {
          if (typeof entry !== "string") return;
          const id = `${source}:${section}:${i}`;
          const cat = categoryFor(entry, reg);
          if (cat) {
            lines.push({ id, source, section, kind: "category", label: cat.label, options: cat.options, catalogId: null, count: 0, from: [] });
          } else {
            const m = matchItem(entry, reg);
            lines.push({ id, source, section, kind: "item", label: m?.name ?? humanize(entry), catalogId: m?.id ?? null, options: [], count: 0, from: [] });
          }
        });
      } else if (val && typeof val === "object" && (val as { type?: string }).type === "choice") {
        const c = val as { count?: number; from?: string[] };
        lines.push({ id: `${source}:${section}`, source, section, kind: "choice", label: `Choose ${c.count ?? 1}`, from: c.from ?? [], count: c.count ?? 1, catalogId: null, options: [] });
      }
    }
  };

  if (prof) consume(prof.starting_pack, prof.name);
  if (origin) consume(origin.pack, origin.name);
  return { lines, currency };
}

/** Build an InventoryItem from a catalog id (falls back to custom when unknown). */
export function inventoryFromCatalog(itemId: string, name: string | null, reg: Registry): InventoryItem {
  const cat = reg.items.get(itemId);
  return {
    id: itemId,
    catalog_item_id: cat ? cat.id : null,
    name: name ?? cat?.name ?? itemId,
    quantity: 1,
    equipped: false,
    slot: null,
    masterwork_bonus: 0,
    medium_armor_stat: null,
    reduction_pool_current: null,
    notes: "",
    custom: null,
  };
}

/** Free-text inventory item for pack entries that matched nothing. */
export function inventoryCustom(name: string): InventoryItem {
  return {
    id: `custom-${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
    catalog_item_id: null,
    name,
    quantity: 1,
    equipped: false,
    slot: null,
    masterwork_bonus: 0,
    medium_armor_stat: null,
    reduction_pool_current: null,
    notes: "",
    custom: null,
  };
}

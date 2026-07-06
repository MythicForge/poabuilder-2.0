// Masterwork level is tracked per inventory instance (InventoryItem.masterwork_bonus)
// but capped by the catalog item's own eligibility/max, since custom items or
// stale data could carry a stray value.

import type { CatalogItem, InventoryItem } from "./types.ts";

export function masterworkBonus(item: InventoryItem, cat: CatalogItem | null): number {
  if (!cat?.masterwork_eligible) return 0;
  const max = cat.masterwork_max ?? 0;
  return Math.max(0, Math.min(max, item.masterwork_bonus ?? 0));
}

export function formatWeaponDamage(cat: CatalogItem | null, bonus: number): string {
  if (!cat?.damage) return "—";
  return bonus > 0 ? `${cat.damage}+${bonus}` : cat.damage;
}

// Compact one-line stat for cards/popover: damage → armor bonus → shield
// reduction pool → weight fallback.
export function itemShortStat(cat: CatalogItem | null): string {
  if (!cat) return "";
  if (cat.damage) return cat.damage;
  const armorBonus = typeof cat.armor_bonus === "number" ? cat.armor_bonus : cat.armor_bonus?.value;
  if (armorBonus) return `+${armorBonus} Armor`;
  if (cat.reduction_pool) return `Reduction ${cat.reduction_pool}`;
  return `wt ${cat.weight ?? 0}`;
}

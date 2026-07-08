// Masterwork level is tracked per inventory instance (InventoryItem.masterwork_bonus)
// but capped by the catalog item's own eligibility/max, since custom items or
// stale data could carry a stray value.

import type { CatalogItem, InventoryItem } from "./types.ts";

export function masterworkBonus(item: InventoryItem, cat: CatalogItem | null): number {
  if (!cat?.masterwork_eligible) return 0;
  const max = cat.masterwork_max ?? 0;
  return Math.max(0, Math.min(max, item.masterwork_bonus ?? 0));
}

/** A weapon whose damage IS its modifier value (no dice), e.g. Sling. */
export function isModifierDamage(cat: CatalogItem | null): boolean {
  return String(cat?.damage ?? "").trim().toLowerCase() === "modifier";
}

// `damageMod` (resolved weapon modifier) is only consulted for "Modifier"
// weapons, which deal that value as their whole damage; dice weapons ignore it
// here (their modifier is shown separately).
export function formatWeaponDamage(
  cat: CatalogItem | null,
  bonus: number,
  damageMod?: number,
): string {
  if (!cat?.damage) return "—";
  if (isModifierDamage(cat)) return String((damageMod ?? 0) + bonus);
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

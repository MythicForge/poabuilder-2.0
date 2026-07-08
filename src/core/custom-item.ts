// Custom-item forking — sheet-only, by construction. Every write lands on the
// StoredCharacter (InventoryItem.custom); the system catalog (REGISTRY / data/)
// is never touched. resolveItem already prefers `it.custom`, so a fork changes
// only this character's copy — the catalog keeps offering the book version.
//
// These helpers are pure and testable. inventory-tab's onSave composes them:
//   updateItem(id, sanitizeOnSave(it, forkItem(it, cat, edits), reg))

import type { CatalogItem, InventoryItem } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { legalSlotsFor } from "./equip.ts";
import { masterworkBonus } from "./masterwork.ts";

/** Editable catalog fields the editor exposes (everything else is copied through). */
export type ItemEdits = Partial<CatalogItem>;

// Equip slots are derived from category, never hand-edited (editing raw slots
// invites broken states — see plan §4). Changing category re-derives them.
function slotsForCategory(category: string | undefined): string[] {
  switch (category) {
    case "Weapon":
      return ["main_hand", "off_hand"];
    case "Shield":
      return ["off_hand"];
    case "Armor":
      return ["body"];
    default:
      return []; // Kit and anything else is not slot-equippable
  }
}

/** Blank template for "create custom item from scratch". */
export function blankCustom(id: string): CatalogItem {
  return { id: `custom-${id}`, name: "New item", category: "Kit", weight: 0, cost: null };
}

/**
 * Build the next `custom` CatalogItem for an inventory item given edits.
 * - catalog-backed, first fork: deep-copy the resolved catalog item, apply
 *   edits, stamp a `custom-` id so it can never collide with a registry id.
 * - already custom: shallow-merge edits, keep the existing custom id.
 * `catalog_item_id` is left untouched by callers → provenance survives.
 */
export function forkItem(
  it: InventoryItem,
  cat: CatalogItem | null,
  edits: ItemEdits,
): CatalogItem {
  const base = it.custom ?? cat;
  const source: CatalogItem = base
    ? structuredClone(base)
    : blankCustom(it.id);
  const merged: CatalogItem = { ...source, ...edits };
  // First fork off a catalog item gets a fresh custom id; an existing custom
  // keeps its own id (already `custom-…`).
  merged.id = it.custom ? merged.id : `custom-${it.id}`;
  // Category drives equip slots — re-derive them when the category changes so a
  // Weapon→Kit edit actually becomes unequippable (a two-handed weapon kept as a
  // weapon retains its stored slots).
  if (edits.category !== undefined && edits.category !== source.category) {
    merged.equip_slots = slotsForCategory(merged.category);
  }
  return merged;
}

/**
 * Revert a catalog-backed custom item to the book version. Only valid when the
 * item still points at a catalog id — a from-scratch custom has nothing to
 * revert to. Returns the inventory patch (drops `custom`, restores the name).
 */
export function revertItem(
  it: InventoryItem,
  cat: CatalogItem | null,
): Partial<InventoryItem> {
  return { custom: null, name: cat?.name ?? it.name };
}

/** True when reverting is possible (catalog-backed). */
export function canRevert(it: InventoryItem): boolean {
  return it.catalog_item_id != null && it.custom != null;
}

/**
 * Given a computed next `custom`, produce the full inventory patch with every
 * derived field re-clamped so the edit can't leave the item in an illegal
 * state:
 *  - name mirrors custom.name (rows/cards read it.name)
 *  - slot cleared + unequipped if the new category makes it illegal
 *  - masterwork zeroed when no longer eligible, else clamped to the new max
 *  - reduction pool current clamped to the new pool max (or cleared)
 */
export function sanitizeOnSave(
  it: InventoryItem,
  nextCustom: CatalogItem,
  _reg: Registry,
): Partial<InventoryItem> {
  const patch: Partial<InventoryItem> = {
    custom: nextCustom,
    name: nextCustom.name,
  };

  // slot legality — category/traits may have changed the legal slots
  if (it.slot != null && !legalSlotsFor(nextCustom).includes(it.slot)) {
    patch.slot = null;
    patch.equipped = false;
  }

  // masterwork clamp
  const mw = masterworkBonus({ ...it, custom: nextCustom }, nextCustom);
  if (mw !== (it.masterwork_bonus ?? 0)) patch.masterwork_bonus = mw;

  // reduction pool clamp
  if (nextCustom.reduction_pool == null) {
    if (it.reduction_pool_current != null) patch.reduction_pool_current = null;
  } else if (
    it.reduction_pool_current != null &&
    it.reduction_pool_current > nextCustom.reduction_pool
  ) {
    patch.reduction_pool_current = nextCustom.reduction_pool;
  }

  return patch;
}

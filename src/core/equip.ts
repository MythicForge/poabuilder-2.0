// Pure slot-equip helpers. Item -> slot (not 5e's slot -> item-key map) since
// InventoryItem already has a stable id and a `slot` field; this avoids the
// dual-bookkeeping sync bugs a slot-pointer map would need to guard against.

import type { ActiveBoon, CatalogItem, InventoryItem, SlotId, StoredCharacter } from "./types.ts";
import type { Registry } from "./data-registry.ts";
import { resolveItem } from "./compute.ts";

export function isTwoHanded(cat: CatalogItem | null): boolean {
  return !!cat?.equip_slots?.includes("two_hands");
}

// ── Slot-aware equipment resolution (single source of truth) ────────────────
// Both computeCharacter (defenses) and collectFeats (condition gating) read
// equipment through here, so slot-equipped and legacy flag-equipped items
// resolve identically everywhere.

export interface Equipped {
  armor: { cat: CatalogItem; item: InventoryItem } | null;
  shield: { cat: CatalogItem; item: InventoryItem } | null;
  weapons: { cat: CatalogItem; item: InventoryItem }[];
}

export function equipped(stored: StoredCharacter, reg: Registry): Equipped {
  const items = stored.inventory.items;
  const bySlot = (s: string) => items.find((it) => it.slot === s);

  const bodyItem = bySlot("body");
  const bodyCat = bodyItem ? resolveItem(bodyItem, reg) : null;
  let armor =
    bodyItem && bodyCat?.category === "Armor" && !bodyCat.is_template
      ? { cat: bodyCat, item: bodyItem }
      : null;

  const mainItem = bySlot("main_hand");
  const mainCat = mainItem ? resolveItem(mainItem, reg) : null;
  const mainIsTwoHanded = isTwoHanded(mainCat);

  const offItem = bySlot("off_hand");
  const offCat = offItem ? resolveItem(offItem, reg) : null;

  let shield =
    offCat?.category === "Shield" ? { cat: offCat, item: offItem! } : null;
  if (shield && mainIsTwoHanded) shield = null; // 2H mainhand blocks the shield bonus

  const weapons: { cat: CatalogItem; item: InventoryItem }[] = [];
  if (mainCat?.category === "Weapon")
    weapons.push({ cat: mainCat, item: mainItem! });
  if (offCat?.category === "Weapon")
    weapons.push({ cat: offCat, item: offItem! });

  // back-compat: flag-only equipped items (no slot) for characters predating the slot system
  for (const item of items) {
    if (item.slot != null) continue;
    if (!item.equipped) continue;
    const cat = resolveItem(item, reg);
    if (!cat) continue;
    if (!armor && cat.category === "Armor" && !cat.is_template)
      armor = { cat, item };
    else if (!shield && !mainIsTwoHanded && cat.category === "Shield")
      shield = { cat, item };
    else if (cat.category === "Weapon") weapons.push({ cat, item });
  }

  return { armor, shield, weapons };
}

/** Slot-aware armor type + shield presence for condition gating. */
export function equipmentContext(
  stored: StoredCharacter,
  reg: Registry,
): { armorType: "Light" | "Medium" | "Heavy" | null; hasShield: boolean; wearingArmor: boolean } {
  const eq = equipped(stored, reg);
  const raw = eq.armor ? String(eq.armor.cat.armor_type ?? "") : "";
  const armorType =
    raw === "Light" || raw === "Medium" || raw === "Heavy" ? raw : null;
  return { armorType, hasShield: !!eq.shield, wearingArmor: !!eq.armor };
}

/** Slots an item may be dropped into (two-handed weapons target main_hand only; off_hand occupation is implicit). */
export function legalSlotsFor(cat: CatalogItem | null): SlotId[] {
  if (!cat) return [];
  if (isTwoHanded(cat)) return ["main_hand"];
  return (cat.equip_slots ?? []).filter((s): s is SlotId => s === "main_hand" || s === "off_hand" || s === "body");
}

function physicalSlots(item: InventoryItem, cat: CatalogItem | null): SlotId[] {
  if (item.slot == null) return [];
  if (item.slot === "main_hand" && isTwoHanded(cat)) return ["main_hand", "off_hand"];
  return [item.slot];
}

export function equipToSlot(items: InventoryItem[], itemId: string, slot: SlotId, reg: Registry): InventoryItem[] {
  const target = items.find((it) => it.id === itemId);
  if (!target) return items;
  const cat = resolveItem(target, reg);
  if (!legalSlotsFor(cat).includes(slot)) return items;

  const claims: SlotId[] = isTwoHanded(cat) ? ["main_hand", "off_hand"] : [slot];

  return items.map((it) => {
    if (it.id === itemId) return { ...it, slot, equipped: true };
    const occupies = physicalSlots(it, resolveItem(it, reg));
    if (occupies.some((s) => claims.includes(s))) return { ...it, slot: null, equipped: false };
    return it;
  });
}

export function unequip(items: InventoryItem[], itemId: string): InventoryItem[] {
  return items.map((it) => (it.id === itemId ? { ...it, slot: null, equipped: false } : it));
}

export function defaultSlotFor(cat: CatalogItem | null, items: InventoryItem[], reg: Registry): SlotId | null {
  const legal = legalSlotsFor(cat);
  if (legal.length === 0) return null;
  const occupied = new Set<SlotId>();
  for (const it of items) {
    if (it.slot == null) continue;
    for (const s of physicalSlots(it, resolveItem(it, reg))) occupied.add(s);
  }
  return legal.find((s) => !occupied.has(s)) ?? legal[0];
}

export function offHandBlocked(items: InventoryItem[], reg: Registry): boolean {
  const main = items.find((it) => it.slot === "main_hand");
  return !!main && isTwoHanded(resolveItem(main, reg));
}

export function canDualWield(activeBoons: ActiveBoon[]): boolean {
  return activeBoons.some(({ boon }) => boon.type === "equipment_rule_override" && boon.rule === "allow_dual_wield");
}

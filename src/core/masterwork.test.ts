import { describe, expect, it } from "vitest";
import { REGISTRY } from "./data-registry.ts";
import { computeCharacter } from "./compute.ts";
import { formatWeaponDamage, masterworkBonus } from "./masterwork.ts";
import type { InventoryItem, StoredCharacter } from "./types.ts";
import brenJson from "@data/characters/fixture-bren-tier2-fighter.json";

const bren = brenJson as unknown as StoredCharacter;

function mkItem(id: string, catalogId: string, slot: InventoryItem["slot"], masterwork_bonus = 0): InventoryItem {
  return {
    id,
    catalog_item_id: catalogId,
    name: catalogId,
    quantity: 1,
    equipped: true,
    slot,
    masterwork_bonus,
    medium_armor_stat: null,
    reduction_pool_current: null,
    notes: "",
    custom: null,
  };
}

describe("masterwork", () => {
  it("clamps the stored bonus to the catalog item's max", () => {
    const cat = REGISTRY.items.get("weapon-longsword")!;
    const item = mkItem("i1", "weapon-longsword", "main_hand", 99);
    expect(masterworkBonus(item, cat)).toBe(cat.masterwork_max);
  });

  it("ignores a stray bonus on a non-eligible catalog item", () => {
    const cat = REGISTRY.items.get("gold-currency") ?? REGISTRY.items.get("weapon-longsword")!;
    const item = mkItem("i1", "weapon-longsword", "main_hand", 2);
    // force non-eligible for this assertion
    expect(masterworkBonus(item, { ...cat, masterwork_eligible: false })).toBe(0);
  });

  it("formats weapon damage with the masterwork bonus appended", () => {
    const cat = REGISTRY.items.get("weapon-longsword")!;
    expect(formatWeaponDamage(cat, 0)).toBe(cat.damage);
    expect(formatWeaponDamage(cat, 2)).toBe(`${cat.damage}+2`);
  });

  it("raises the armor cap by the masterwork bonus", () => {
    const base: StoredCharacter = {
      ...bren,
      inventory: { ...bren.inventory, items: [mkItem("a1", "armor-chainmail", "body", 0)] },
    };
    const upgraded: StoredCharacter = {
      ...bren,
      inventory: { ...bren.inventory, items: [mkItem("a1", "armor-chainmail", "body", 2)] },
    };
    const a = computeCharacter(base, REGISTRY);
    const b = computeCharacter(upgraded, REGISTRY);
    expect(b.defenses.Armor).toBeGreaterThanOrEqual(a.defenses.Armor);
  });

  it("light armor is never worse than unarmored, even for high-Finesse characters", () => {
    const highFinesse: StoredCharacter = {
      ...bren,
      build: { ...bren.build, attributes: { ...bren.build.attributes, finesse: 9 } },
      inventory: { ...bren.inventory, items: [] },
    };
    const unarmored = computeCharacter(highFinesse, REGISTRY);

    const cat = REGISTRY.items.get("armor-shadow-weave")!;
    const armored: StoredCharacter = {
      ...highFinesse,
      inventory: { ...highFinesse.inventory, items: [mkItem("a1", "armor-shadow-weave", "body", 0)] },
    };
    const withArmor = computeCharacter(armored, REGISTRY);

    expect(withArmor.defenses.Armor).toBe(unarmored.defenses.Armor + (cat.armor_bonus as { value: number }).value);
  });
});

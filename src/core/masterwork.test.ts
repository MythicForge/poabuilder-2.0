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

  it("light armor caps Finesse at 5 (+ masterwork); armor bonus stacks on the capped stat", () => {
    // Corrected per equipment-rules.json: Light stat_cap = 5. Unarmored Finesse
    // is uncapped, so at very high Finesse unarmored can exceed light armor —
    // that is intended. Light = 8 + armor_bonus + min(5 + masterwork, Finesse).
    const cat = REGISTRY.items.get("armor-shadow-weave")!;
    const armorBonus = (cat.armor_bonus as { value: number }).value;

    const mk = (finesse: number, mw = 0) => {
      const c: StoredCharacter = {
        ...bren,
        build: { ...bren.build, attributes: { ...bren.build.attributes, finesse } },
        inventory: { ...bren.inventory, items: [mkItem("a1", "armor-shadow-weave", "body", mw)] },
      };
      return computeCharacter(c, REGISTRY).defenses.Armor;
    };

    // Finesse 4 (below cap): full Finesse counts.
    expect(mk(4)).toBe(8 + armorBonus + Math.min(5, 4));
    // Finesse 9 (above cap): capped at 5.
    expect(mk(9)).toBe(8 + armorBonus + 5);
    // masterwork raises the cap to 6.
    expect(mk(9, 1)).toBe(8 + armorBonus + 6);
  });
});

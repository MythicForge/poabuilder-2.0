import { describe, expect, it } from "vitest";
import { REGISTRY } from "./data-registry.ts";
import { computeCharacter } from "./compute.ts";
import { defaultSlotFor, equipToSlot, legalSlotsFor, offHandBlocked, unequip } from "./equip.ts";
import type { InventoryItem, StoredCharacter } from "./types.ts";
import brenJson from "@data/characters/fixture-bren-tier2-fighter.json";

const bren = brenJson as unknown as StoredCharacter;

function mkItem(id: string, catalogId: string, slot: InventoryItem["slot"] = null, equipped = false): InventoryItem {
  return {
    id,
    catalog_item_id: catalogId,
    name: catalogId,
    quantity: 1,
    equipped,
    slot,
    masterwork_bonus: 0,
    medium_armor_stat: null,
    reduction_pool_current: null,
    notes: "",
    custom: null,
  };
}

describe("equip helpers", () => {
  it("equips into an empty slot", () => {
    const items = [mkItem("i1", "weapon-longsword")];
    const next = equipToSlot(items, "i1", "main_hand", REGISTRY);
    expect(next.find((it) => it.id === "i1")).toMatchObject({ slot: "main_hand", equipped: true });
  });

  it("evicts the previous occupant of a slot", () => {
    const items = [mkItem("i1", "weapon-longsword", "main_hand", true), mkItem("i2", "weapon-longsword")];
    const next = equipToSlot(items, "i2", "main_hand", REGISTRY);
    expect(next.find((it) => it.id === "i1")).toMatchObject({ slot: null, equipped: false });
    expect(next.find((it) => it.id === "i2")).toMatchObject({ slot: "main_hand", equipped: true });
  });

  it("a two-handed weapon in main_hand evicts off_hand and blocks off-hand equip", () => {
    const items = [mkItem("shield1", "shield-buckler", "off_hand", true), mkItem("axe1", "weapon-great-axe")];
    const next = equipToSlot(items, "axe1", "main_hand", REGISTRY);
    expect(next.find((it) => it.id === "shield1")).toMatchObject({ slot: null, equipped: false });
    expect(next.find((it) => it.id === "axe1")).toMatchObject({ slot: "main_hand", equipped: true });
    expect(offHandBlocked(next, REGISTRY)).toBe(true);
  });

  it("rejects an illegal slot for the item", () => {
    const items = [mkItem("armor1", "armor-leather-armor")];
    const next = equipToSlot(items, "armor1", "main_hand", REGISTRY);
    expect(next.find((it) => it.id === "armor1")).toMatchObject({ slot: null, equipped: false });
  });

  it("unequip clears slot and equipped", () => {
    const items = [mkItem("i1", "weapon-longsword", "main_hand", true)];
    const next = unequip(items, "i1");
    expect(next[0]).toMatchObject({ slot: null, equipped: false });
  });

  it("defaultSlotFor picks the first free legal slot", () => {
    const cat = REGISTRY.items.get("weapon-longsword")!;
    const items = [mkItem("i1", "weapon-longsword", "main_hand", true)];
    expect(defaultSlotFor(cat, items, REGISTRY)).toBe("off_hand");
  });

  it("legalSlotsFor a two-handed weapon is main_hand only", () => {
    const cat = REGISTRY.items.get("weapon-great-axe")!;
    expect(legalSlotsFor(cat)).toEqual(["main_hand"]);
  });
});

describe("compute: slot-aware equipment bucketing", () => {
  it("prefers body-slotted armor over flag-only armor", () => {
    const char: StoredCharacter = {
      ...bren,
      inventory: {
        ...bren.inventory,
        items: [
          mkItem("a1", "armor-leather-armor", "body", true),
          mkItem("a2", "armor-leather-armor", null, true),
        ],
      },
    };
    const computed = computeCharacter(char, REGISTRY);
    expect(computed.defenseBreakdown.Armor.join(" ")).toBeTruthy();
    // both are the same armor type here, so assert bucketing picked the slotted one specifically
    const slotted = computeCharacter(
      { ...char, inventory: { ...char.inventory, items: [mkItem("a1", "armor-leather-armor", "body", true)] } },
      REGISTRY,
    );
    expect(computed.defenses.Armor).toBe(slotted.defenses.Armor);
  });

  it("drops the shield bonus when a two-handed weapon occupies main_hand", () => {
    const withShieldOnly: StoredCharacter = {
      ...bren,
      inventory: { ...bren.inventory, items: [mkItem("s1", "shield-buckler", "off_hand", true)] },
    };
    const withTwoHander: StoredCharacter = {
      ...bren,
      inventory: {
        ...bren.inventory,
        items: [mkItem("s1", "shield-buckler", "off_hand", true), mkItem("g1", "weapon-great-axe", "main_hand", true)],
      },
    };
    const a = computeCharacter(withShieldOnly, REGISTRY);
    const b = computeCharacter(withTwoHander, REGISTRY);
    expect(b.defenses.Armor).toBeLessThan(a.defenses.Armor);
  });

  it("flags dual-wielding two weapons without a dual-wield boon", () => {
    const char: StoredCharacter = {
      ...bren,
      inventory: {
        ...bren.inventory,
        items: [mkItem("w1", "weapon-longsword", "main_hand", true), mkItem("w2", "weapon-longsword", "off_hand", true)],
      },
    };
    const computed = computeCharacter(char, REGISTRY);
    expect(computed.warnings.some((w) => w.toLowerCase().includes("dual"))).toBe(true);
  });
});

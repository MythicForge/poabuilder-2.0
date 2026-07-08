import { describe, it, expect } from "vitest";
import { evalCondition, type ConditionCtx } from "./conditions.ts";

const base: ConditionCtx = {
  armorType: null,
  hasShield: false,
  activeStates: [],
  wearingArmor: false,
};
const ctx = (o: Partial<ConditionCtx> = {}): ConditionCtx => ({ ...base, ...o });

describe("evalCondition — single terms", () => {
  it("empty condition is always true", () => {
    expect(evalCondition("", ctx())).toBe(true);
    expect(evalCondition(null, ctx())).toBe(true);
  });
  it("no_armor / unarmored", () => {
    expect(evalCondition("no_armor", ctx({ wearingArmor: false }))).toBe(true);
    expect(evalCondition("unarmored", ctx({ wearingArmor: true }))).toBe(false);
  });
  it("light_or_no_armor", () => {
    expect(evalCondition("light_or_no_armor", ctx())).toBe(true);
    expect(
      evalCondition("light_or_no_armor", ctx({ armorType: "Light", wearingArmor: true })),
    ).toBe(true);
    expect(
      evalCondition("light_or_no_armor", ctx({ armorType: "Heavy", wearingArmor: true })),
    ).toBe(false);
  });
  it("armor type terms (+ wearing_* aliases)", () => {
    expect(evalCondition("light_armor", ctx({ armorType: "Light" }))).toBe(true);
    expect(evalCondition("medium_armor", ctx({ armorType: "Medium" }))).toBe(true);
    expect(evalCondition("heavy_armor", ctx({ armorType: "Light" }))).toBe(false);
    expect(evalCondition("wearing_medium_armor", ctx({ armorType: "Medium" }))).toBe(true);
    expect(evalCondition("wearing_heavy_armor", ctx({ armorType: "Heavy" }))).toBe(true);
    expect(evalCondition("wearing_heavy_armor", ctx({ armorType: "Medium" }))).toBe(false);
  });
  it("shield terms", () => {
    expect(evalCondition("no_shield", ctx({ hasShield: false }))).toBe(true);
    expect(evalCondition("shield_equipped", ctx({ hasShield: true }))).toBe(true);
    expect(evalCondition("no_shield", ctx({ hasShield: true }))).toBe(false);
  });
  it("state terms + rage alias", () => {
    expect(evalCondition("state:rage", ctx({ activeStates: ["rage"] }))).toBe(true);
    expect(evalCondition("raging", ctx({ activeStates: ["rage"] }))).toBe(true);
    expect(evalCondition("state:focus", ctx({ activeStates: ["rage"] }))).toBe(false);
  });
  it("unknown term ⇒ unknown", () => {
    expect(evalCondition("under_a_full_moon", ctx())).toBe("unknown");
  });
});

describe("evalCondition — AND/OR", () => {
  it("AND both true", () => {
    expect(
      evalCondition("light_or_no_armor AND no_shield", ctx()),
    ).toBe(true);
  });
  it("AND one false", () => {
    expect(
      evalCondition("light_or_no_armor AND no_shield", ctx({ hasShield: true })),
    ).toBe(false);
  });
  it("OR mix", () => {
    expect(evalCondition("heavy_armor OR no_shield", ctx())).toBe(true);
    expect(
      evalCondition("heavy_armor OR shield_equipped", ctx({ armorType: "Light", wearingArmor: true })),
    ).toBe(false);
  });
  it("case-insensitive operators", () => {
    expect(evalCondition("no_armor and no_shield", ctx())).toBe(true);
  });
  it("unknown term poisons the whole expression", () => {
    expect(evalCondition("no_shield AND foo_bar", ctx())).toBe("unknown");
    expect(evalCondition("foo_bar OR no_shield", ctx())).toBe("unknown");
  });
  it("malformed ⇒ unknown", () => {
    expect(evalCondition("no_shield AND", ctx())).toBe("unknown");
  });
});

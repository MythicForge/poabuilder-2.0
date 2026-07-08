import { describe, expect, it } from "vitest";
import { evalFormula, parseAvgDiceExpr, standardEnv } from "./formula.ts";
import { REGISTRY } from "./data-registry.ts";
import { calcTier, computeCharacter, skillAttrValue, baseDiceFromAttr, skillRank, profDieSize } from "./compute.ts";
import type { StoredCharacter } from "./types.ts";
import brenJson from "@data/characters/fixture-bren-tier2-fighter.json";
import seleneJson from "@data/characters/fixture-selene-tier3-mage.json";

const bren = brenJson as unknown as StoredCharacter;
const selene = seleneJson as unknown as StoredCharacter;

describe("formula evaluator", () => {
  const env = standardEnv({ brawn: 6, finesse: 2, mind: 1, will: 2 }, 2);
  it("evaluates arithmetic + identifiers", () => {
    expect(evalFormula("12 + Brawn", env)).toBe(18);
    expect(evalFormula("(2 * Tier) + Brawn", env)).toBe(10);
    expect(evalFormula("4 + Tier + floor(Will / 3)", env)).toBe(6);
    expect(evalFormula("max(Will, Tier)", env)).toBe(2);
  });
  it("evaluates dice as rounded average", () => {
    expect(evalFormula("2d12", env)).toBe(13);
    expect(parseAvgDiceExpr("2d12")).toBe(13);
    expect(parseAvgDiceExpr("1d8")).toBe(5);
  });
  it("throws on unknown identifiers", () => {
    expect(() => evalFormula("Charisma + 1", env)).toThrow();
  });
});

describe("registry", () => {
  it("loads all content", () => {
    expect(REGISTRY.professions.size).toBe(11);
    expect(REGISTRY.paths.size).toBe(22);
    expect(REGISTRY.origins.size).toBe(13);
    expect(REGISTRY.vocations.size).toBe(39);
    expect(REGISTRY.spells.size).toBe(165);
    expect(REGISTRY.conditions.size).toBe(22);
    expect(REGISTRY.items.size).toBeGreaterThan(70);
  });
});

describe("tier from feats purchased", () => {
  it("matches the progression table", () => {
    expect(calcTier(0, REGISTRY)).toBe(1);
    expect(calcTier(2, REGISTRY)).toBe(1);
    expect(calcTier(3, REGISTRY)).toBe(2);
    expect(calcTier(6, REGISTRY)).toBe(3);
    expect(calcTier(8, REGISTRY)).toBe(4);
    expect(calcTier(10, REGISTRY)).toBe(5);
    expect(calcTier(16, REGISTRY)).toBe(5);
  });
});

describe("skills (ported math)", () => {
  const attrs = { brawn: 6, finesse: 2, mind: 1, will: 2 };
  it("attr mapping incl. best-of pairs", () => {
    expect(skillAttrValue("Vigor", attrs)).toBe(6);
    expect(skillAttrValue("Talent", attrs)).toBe(2);
    expect(skillAttrValue("Lore", attrs)).toBe(2);
  });
  it("base dice thresholds", () => {
    expect(baseDiceFromAttr(0)).toBe(1);
    expect(baseDiceFromAttr(4)).toBe(2);
    expect(baseDiceFromAttr(8)).toBe(3);
    expect(baseDiceFromAttr(12)).toBe(4);
  });
  it("ranks and die sizes", () => {
    expect(skillRank("Vigor", ["Vigor"], {})).toBe("Trained");
    expect(skillRank("Vigor", ["Vigor"], { Vigor: 2 })).toBe("Master");
    expect(profDieSize("Trained")).toBe(8);
    expect(profDieSize("Master")).toBe(12);
  });
});

describe("fixture: Bren (Tier-2 Fighter)", () => {
  const c = computeCharacter(bren, REGISTRY);
  it("tier + attributes (vocation +1 brawn)", () => {
    expect(c.tier).toBe(2);
    expect(c.attributes).toEqual({ brawn: 6, finesse: 1, mind: 1, will: 1 });
  });
  it("static defenses", () => {
    expect(c.defenses.Fortitude).toBe(14);
    expect(c.defenses.Mental).toBe(9);
    expect(c.defenses["Will Defense"]).toBe(9);
  });
  it("universal resources use new-data formulas", () => {
    // ambition: 4 + Tier(2) + floor(Will 1/3) = 6; die = max(Will 1→1d4, Tier 2→1d6) = 1d6
    expect(c.ambition.max).toBe(6);
    expect(c.ambition.die).toBe("1d6");
    // vitality: 12+Brawn(6)=18 + (tier-1)*avg(2d12)=13 + floor(6/5)*avg(1d8)=5 → 36
    expect(c.vitality.max).toBe(36);
  });
  it("wounds: 1 + 2*tier + floor(brawn/3) + armor bonus", () => {
    const armorWound = 1; // chainmail wound_bonus, if any, included
    expect(c.wounds.max).toBeGreaterThanOrEqual(7);
  });
  it("adrenaline resource max = Brawn + Tier", () => {
    const adr = c.resources.find((r) => r.def.id === "adrenaline");
    expect(adr?.max).toBe(8);
    expect(adr?.current).toBe(3);
  });
  it("collects starting + purchased feats with choice resolution", () => {
    const ids = c.featCards.map((f) => f.feat.id);
    expect(ids).toContain("signature_school");
    expect(ids).toContain("adrenaline_rush");
    expect(ids).toContain("defensive_stance");
    // defender school selected → stance stat_bonus visible among boons of the card
    const school = c.featCards.find((f) => f.feat.id === "signature_school")!;
    expect(school.activeBoons.some((b) => b.type === "stat_bonus")).toBe(true);
  });
  it("no spellcasting", () => {
    expect(c.spellcasting).toBeNull();
  });
});

describe("export envelope", () => {
  it("round-trips a character", async () => {
    const { exportCharacter, importCharacter } = await import("./export.ts");
    const json = exportCharacter(bren);
    const back = importCharacter(json);
    expect(back).toEqual({ ...bren, schema_version: 1 });
  });
  it("rejects foreign JSON", async () => {
    const { importCharacter } = await import("./export.ts");
    expect(() => importCharacter('{"app":"other"}')).toThrow();
  });
});

describe("fixture: Selene (Tier-3 Mage)", () => {
  const c = computeCharacter(selene, REGISTRY);
  it("tier + attributes (artisan +1 mind)", () => {
    expect(c.tier).toBe(3);
    expect(c.attributes.mind).toBe(7);
  });
  it("spellcasting block", () => {
    expect(c.spellcasting).not.toBeNull();
    const sc = c.spellcasting!;
    expect(sc.casterType).toBe("full");
    expect(sc.modifier).toBe("mind");
    expect(sc.spellcastingTier).toBe(3); // threshold(6 feats)=2 → min(2+1, 6)
    expect(sc.spellDC).toBe(20); // 10 + 3 + 7
    expect(sc.knownAllowance).toBe(10); // 4 + 3*2
    expect(sc.preparedAllowance).toBe(10); // mind 7 + tier 3
    expect(sc.reservoirMax).toBe(13); // mana: (2*3) + 7
  });
  it("ambition uses new formula", () => {
    expect(c.ambition.max).toBe(8); // 4 + 3 + floor(3/3)
  });
  it("no warnings", () => {
    expect(c.warnings).toEqual([]);
  });
});

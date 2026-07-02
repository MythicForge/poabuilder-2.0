import { describe, expect, it } from "vitest";
import { REGISTRY } from "./data-registry.ts";
import { computeCharacter } from "./compute.ts";
import { featEligibility, slotCapacity, slotState } from "./feat-eligibility.ts";
import { validateCharacter } from "./validate-character.ts";
import type { Feat, StoredCharacter } from "./types.ts";
import brenJson from "@data/characters/fixture-bren-tier2-fighter.json";

const bren = brenJson as unknown as StoredCharacter;
const clone = () => structuredClone(bren);
const featOf = (fileId: string, featId: string): Feat => {
  const src = REGISTRY.professions.get(fileId) ?? REGISTRY.paths.get(fileId);
  const f = src?.feats.find((x) => x.id === featId);
  if (!f) throw new Error(`missing feat ${featId} in ${fileId}`);
  return f;
};

describe("slot capacity by tier", () => {
  it("pools slots across reached tiers", () => {
    expect(slotCapacity(1, null, REGISTRY)).toEqual({ tactical: 1, narrative: 1, minor: 1 });
    expect(slotCapacity(2, null, REGISTRY)).toEqual({ tactical: 2, narrative: 2, minor: 2 });
    expect(slotCapacity(3, null, REGISTRY)).toEqual({ tactical: 3, narrative: 3, minor: 2 });
  });
  it("tier-4 flexible slot only counts once chosen", () => {
    expect(slotCapacity(4, null, REGISTRY)).toEqual({ tactical: 3, narrative: 3, minor: 3 });
    expect(slotCapacity(4, "tactical", REGISTRY)).toEqual({ tactical: 4, narrative: 3, minor: 3 });
    expect(slotCapacity(5, "narrative", REGISTRY)).toEqual({ tactical: 5, narrative: 6, minor: 5 });
  });
  it("tier 5 with the choice slot covers exactly max_feats", () => {
    const cap = slotCapacity(5, "tactical", REGISTRY);
    expect(cap.tactical + cap.narrative + cap.minor).toBe(REGISTRY.tierProgression.max_feats);
  });
});

describe("slot state (Bren fixture)", () => {
  it("counts one purchased feat per slot type", () => {
    const s = slotState(bren, REGISTRY);
    expect(s.used).toEqual({ tactical: 1, narrative: 1, minor: 1 });
    expect(s.capacity).toEqual({ tactical: 2, narrative: 2, minor: 2 });
    expect(s.purchasedSelected).toBe(3);
    expect(s.tier4ChoicePending).toBe(false);
  });
});

describe("featEligibility", () => {
  it("starting feats are auto-granted, not pickable", () => {
    const e = featEligibility(bren, featOf("fighter", "signature_school"), REGISTRY);
    expect(e.ok).toBe(false);
    expect(e.reasons[0]).toMatch(/starting feat/);
  });

  it("tier gate blocks feats above character tier", () => {
    const e = featEligibility(bren, featOf("fighter", "warriors_tenacity"), REGISTRY); // tier 3
    expect(e.ok).toBe(false);
    expect(e.reasons.join()).toMatch(/Tier 3/);
  });

  it("feat prerequisites (bare-array form) block until owned", () => {
    const c = clone();
    c.build.feats_purchased = 8; // tier 4, plenty of room
    c.build.feat_ids = [];
    const tenacity = featOf("fighter", "warriors_tenacity"); // requires adrenaline_rush
    expect(featEligibility(c, tenacity, REGISTRY).reasons.join()).toMatch(/Adrenaline Rush/);
    c.build.feat_ids = ["adrenaline_rush"];
    expect(featEligibility(c, tenacity, REGISTRY).ok).toBe(true);
  });

  it("path_investment counts selected feats from that path", () => {
    const c = clone();
    c.build.feats_purchased = 8;
    c.build.feat_ids = ["defensive_stance"]; // 1 sentinel feat
    const bulwark = featOf("sentinel", "bulwark_maneuver"); // needs sentinel count 2
    expect(featEligibility(c, bulwark, REGISTRY).ok).toBe(false);
    c.build.feat_ids = ["defensive_stance", "signature_armor"]; // 2 sentinel feats
    expect(featEligibility(c, bulwark, REGISTRY).ok).toBe(true);
  });

  it("slot budget blocks adding beyond capacity, keeps already-selected", () => {
    const c = clone(); // tier 2: 2 tactical slots
    c.build.feats_purchased = 6; // still tier 2… (6 → tier 3) use 5
    c.build.feats_purchased = 5; // tier 2
    c.build.feat_ids = ["defensive_stance", "tactical_fortification"]; // 2 tactical used
    const opportunistic = featOf("reaver", "opportunistic_strike"); // tactical T2
    const e = featEligibility(c, opportunistic, REGISTRY);
    expect(e.ok).toBe(false);
    expect(e.reasons.join()).toMatch(/no tactical slots left/);
    // a selected feat stays eligible to keep
    expect(featEligibility(c, featOf("sentinel", "defensive_stance"), REGISTRY).ok).toBe(true);
  });

  it("purchase budget blocks selecting more feats than purchased", () => {
    const c = clone();
    c.build.feats_purchased = 3;
    // 3 already selected → a 4th needs more purchases
    const e = featEligibility(c, featOf("fighter", "fighting_technique"), REGISTRY);
    expect(e.ok).toBe(false);
    expect(e.reasons.join()).toMatch(/raise Feats/);
  });
});

describe("validateCharacter", () => {
  it("fixture is clean", () => {
    const computed = computeCharacter(bren, REGISTRY);
    expect(validateCharacter(bren, REGISTRY, computed)).toEqual([]);
  });

  it("flags attribute overspend", () => {
    const c = clone();
    c.build.attributes.brawn = 20;
    const issues = validateCharacter(c, REGISTRY, computeCharacter(c, REGISTRY));
    expect(issues.join()).toMatch(/attributes overspent/);
  });

  it("flags skill pick overflow and off-list picks", () => {
    const c = clone();
    c.build.skills.proficiencies = ["Vigor", "Talent", "Awareness", "Lore"];
    const issues = validateCharacter(c, REGISTRY, computeCharacter(c, REGISTRY));
    expect(issues.join()).toMatch(/too many skill proficiencies/);
    expect(issues.join()).toMatch(/"Lore" is not offered/);
  });

  it("flags expertise overspend against the skill budget", () => {
    const c = clone(); // earned = floor(3/2) = 1, points already spend 1
    c.build.skills.expertise_bumps = { Vigor: 1 };
    const issues = validateCharacter(c, REGISTRY, computeCharacter(c, REGISTRY));
    expect(issues.join()).toMatch(/skill points overspent: 2 of 1/);
  });

  it("flags slot overflow", () => {
    const c = clone();
    c.build.feats_purchased = 5; // tier 2 → 2 tactical slots
    c.build.feat_ids = ["defensive_stance", "tactical_fortification", "opportunistic_strike"];
    const issues = validateCharacter(c, REGISTRY, computeCharacter(c, REGISTRY));
    expect(issues.join()).toMatch(/tactical slots overfilled: 3 of 2/);
  });

  it("flags tier violations on selected feats", () => {
    const c = clone();
    c.build.feats_purchased = 4; // still tier 2
    c.build.feat_ids = [...c.build.feat_ids, "warriors_tenacity"]; // tier 3 feat
    const issues = validateCharacter(c, REGISTRY, computeCharacter(c, REGISTRY));
    expect(issues.join()).toMatch(/Warrior's Tenacity: requires Tier 3/);
  });

  it("flags spells without a spellcasting grant", () => {
    const c = clone();
    c.build.known_spell_ids = ["arc-lightning"];
    const issues = validateCharacter(c, REGISTRY, computeCharacter(c, REGISTRY));
    expect(issues.join()).toMatch(/no spellcasting grant/);
  });
});

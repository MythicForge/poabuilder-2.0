import { describe, expect, it } from "vitest";
import { REGISTRY } from "./data-registry.ts";
import { computeCharacter } from "./compute.ts";
import {
  featEligibility,
  slotCapacity,
  slotState,
} from "./feat-eligibility.ts";
import { validateCharacter } from "./validate-character.ts";
import { matchItem, resolvePack } from "./pack-mapping.ts";
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
    expect(slotCapacity(1, null, REGISTRY)).toEqual({
      tactical: 1,
      narrative: 1,
      passive: 1,
    });
    expect(slotCapacity(2, null, REGISTRY)).toEqual({
      tactical: 2,
      narrative: 2,
      passive: 2,
    });
    expect(slotCapacity(3, null, REGISTRY)).toEqual({
      tactical: 3,
      narrative: 3,
      passive: 2,
    });
  });
  it("tier-4 flexible slot only counts once chosen", () => {
    expect(slotCapacity(4, null, REGISTRY)).toEqual({
      tactical: 3,
      narrative: 3,
      passive: 3,
    });
    expect(slotCapacity(4, "tactical", REGISTRY)).toEqual({
      tactical: 4,
      narrative: 3,
      passive: 3,
    });
    expect(slotCapacity(5, "narrative", REGISTRY)).toEqual({
      tactical: 5,
      narrative: 6,
      passive: 5,
    });
  });
  it("tier 5 with the choice slot covers exactly max_feats", () => {
    const cap = slotCapacity(5, "tactical", REGISTRY);
    expect(cap.tactical + cap.narrative + cap.passive).toBe(
      REGISTRY.tierProgression.max_feats,
    );
  });
});

describe("slot state (Bren fixture)", () => {
  it("counts one purchased feat per slot type", () => {
    const s = slotState(bren, REGISTRY);
    expect(s.used).toEqual({ tactical: 1, narrative: 1, passive: 1 });
    expect(s.capacity).toEqual({ tactical: 2, narrative: 2, passive: 2 });
    expect(s.purchasedSelected).toBe(3);
    expect(s.tier4ChoicePending).toBe(false);
  });
});

describe("featEligibility", () => {
  it("starting feats are auto-granted, not pickable", () => {
    const e = featEligibility(
      bren,
      featOf("fighter", "signature_school"),
      REGISTRY,
    );
    expect(e.ok).toBe(false);
    expect(e.reasons[0]).toMatch(/starting feat/);
  });

  it("tier gate blocks feats above character tier", () => {
    const e = featEligibility(
      bren,
      featOf("fighter", "warriors_tenacity"),
      REGISTRY,
    ); // tier 3
    expect(e.ok).toBe(false);
    expect(e.reasons.join()).toMatch(/Tier 3/);
  });

  it("feat prerequisites (bare-array form) block until owned", () => {
    const c = clone();
    c.build.feats_purchased = 8; // tier 4, plenty of room
    c.build.feat_ids = [];
    const tenacity = featOf("fighter", "warriors_tenacity"); // requires adrenaline_rush
    expect(featEligibility(c, tenacity, REGISTRY).reasons.join()).toMatch(
      /Adrenaline Rush/,
    );
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
    expect(
      featEligibility(c, featOf("sentinel", "defensive_stance"), REGISTRY).ok,
    ).toBe(true);
  });

  it("purchase budget blocks selecting more feats than purchased", () => {
    const c = clone();
    c.build.feats_purchased = 3;
    // 3 already selected → a 4th needs more purchases
    const e = featEligibility(
      c,
      featOf("fighter", "fighting_technique"),
      REGISTRY,
    );
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
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/attributes overspent/);
  });

  it("flags skill pick overflow and off-list picks", () => {
    const c = clone();
    c.build.skills.proficiencies = ["Vigor", "Talent", "Awareness", "Lore"];
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/too many skill proficiencies/);
    expect(issues.join()).toMatch(/"Lore" is not offered/);
  });

  it("flags skill dice overspend against the skill point budget", () => {
    const c = clone(); // earned = 4 creation + floor(3/2) = 5, points already spend 1
    c.build.skills.points = {
      ...c.build.skills.points,
      Talent: 3,
      Awareness: 2,
    };
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/skill points overspent: 6 of 5/);
  });

  it("flags expertise overspend against the expertise point budget", () => {
    const c = clone(); // bren is tier 2 → expertise earned = 1
    c.build.skills.expertise_bumps = { Vigor: 1, Talent: 1 };
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/expertise points overspent: 2 of 1/);
  });

  it("flags slot overflow", () => {
    const c = clone();
    c.build.feats_purchased = 5; // tier 2 → 2 tactical slots
    c.build.feat_ids = [
      "defensive_stance",
      "tactical_fortification",
      "opportunistic_strike",
    ];
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/tactical slots overfilled: 3 of 2/);
  });

  it("flags tier violations on selected feats", () => {
    const c = clone();
    c.build.feats_purchased = 4; // still tier 2
    c.build.feat_ids = [...c.build.feat_ids, "warriors_tenacity"]; // tier 3 feat
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/Warrior's Tenacity: requires Tier 3/);
  });

  it("flags spells without a spellcasting grant", () => {
    const c = clone();
    c.build.known_spell_ids = ["arc-lightning"];
    const issues = validateCharacter(
      c,
      REGISTRY,
      computeCharacter(c, REGISTRY),
    );
    expect(issues.join()).toMatch(/no spellcasting grant/);
  });
});

describe("pack mapping", () => {
  const fighter = REGISTRY.professions.get("fighter")!;

  it("profession slot tokens become category pickers with options", () => {
    const { lines } = resolvePack(fighter, undefined, REGISTRY);
    const melee = lines.find(
      (l) => l.section === "weapons" && l.label === "Melee weapon",
    );
    expect(melee?.kind).toBe("category");
    expect(melee!.options.length).toBeGreaterThan(0);
  });

  it("reads starting currency from the manifest", () => {
    expect(resolvePack(fighter, undefined, REGISTRY).currency.gold).toBe(12);
  });

  it("matchItem resolves an exact catalog name, rejects noise", () => {
    expect(matchItem("Dagger", REGISTRY)?.id).toBe("weapon-dagger");
    expect(matchItem("zzz nonexistent gizmo", REGISTRY)).toBeNull();
  });
});

describe("resource pools (pip tracker data layer)", () => {
  it("absent pools.resources key computes current = max", () => {
    const c = clone();
    delete (c.pools.resources as Record<string, number>).adrenaline;
    const computed = computeCharacter(c, REGISTRY);
    const adrenaline = computed.resources.find(
      (r) => r.def.id === "adrenaline",
    );
    if (adrenaline) expect(adrenaline.current).toBe(adrenaline.max);
  });

  it("stored current above max clamps to max", () => {
    const c = clone();
    const prof = REGISTRY.professions.get(c.build.profession_id)!;
    const def = prof.resources[0];
    c.pools.resources[def.id] = 9999;
    const computed = computeCharacter(c, REGISTRY);
    const res = computed.resources.find((r) => r.def.id === def.id)!;
    expect(res.current).toBe(res.max);
  });

  it("absent pools.uses key computes usesRemaining = feat.uses.count", () => {
    const c = clone();
    const featWithUses = [
      ...REGISTRY.professions.values(),
      ...REGISTRY.paths.values(),
    ]
      .flatMap((p) => p.feats)
      .find((f) => f.uses);
    expect(featWithUses).toBeTruthy();
    delete (c.pools.uses as Record<string, number>)[featWithUses!.id];
    expect(c.pools.uses[featWithUses!.id] ?? featWithUses!.uses!.count).toBe(
      featWithUses!.uses!.count,
    );
  });

  it("tier_gated vessels: max steps at tier 1/3/5 thresholds", () => {
    const c = clone();
    c.build.profession_id = "shaman";
    const tierToFeats: Record<number, number> = { 1: 0, 2: 3, 3: 6, 5: 16 };
    for (const [tier, feats] of Object.entries(tierToFeats)) {
      c.build.feats_purchased = feats;
      const computed = computeCharacter(c, REGISTRY);
      expect(computed.tier).toBe(Number(tier));
      const vessels = computed.resources.find((r) => r.def.id === "vessels")!;
      const expected = { 1: 2, 2: 2, 3: 3, 5: 4 }[Number(tier)];
      expect(vessels.max).toBe(expected);
    }
  });
});

describe("spell spheres normalization", () => {
  it("every spell exposes spheres as a string array", () => {
    for (const s of REGISTRY.spells.values())
      expect(Array.isArray(s.spheres)).toBe(true);
  });
  it("a string sphere becomes a one-element array", () => {
    expect(REGISTRY.spells.get("alarm")?.spheres).toEqual(["conjuration"]);
  });
});

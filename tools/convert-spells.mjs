#!/usr/bin/env node
// Ports merge/builder-1.0/content/spells.json → data/spells/spells.json (new format).
// Cost rule (user ruling 2026-07-01): base cost = spell tier, cantrips 0; amps add extra.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const old = JSON.parse(readFileSync("merge/builder-1.0/content/spells.json", "utf8"));

const spells = old.spells.map((s) => ({
  id: s.id,
  name: s.name,
  tier: s.tier,
  is_cantrip: s.is_cantrip,
  school: s.school || null,
  spheres: s.spheres,
  range: s.range || null,
  duration: s.duration || null,
  cost: s.is_cantrip ? 0 : s.tier,
  area: s.area || null,
  description: s.description_markdown,
  amps: s.amps,
  ...(s.reference_only ? { reference_only: true } : {}),
}));

const out = {
  $meta: {
    name: "Path of Ambition — Spells",
    version: "2.0.0",
    source: "ported from builder-1.0 content/spells.json",
    cost_rule: "base cast costs mana equal to tier; cantrips are free; amps add listed extra cost",
  },
  spells,
};

mkdirSync("data/spells", { recursive: true });
writeFileSync("data/spells/spells.json", JSON.stringify(out, null, 2) + "\n");
console.log(`wrote data/spells/spells.json (${spells.length} spells, ${spells.filter((s) => s.is_cantrip).length} cantrips, ${spells.filter((s) => s.reference_only).length} reference-only)`);

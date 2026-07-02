#!/usr/bin/env node
// Ports merge/builder-1.0/content/items.json (poa.items.v2) → data/items/items.json.
// Structural passthrough with:
//   - carry formula `Body` → `Brawn` (Body is a known typo per REFERENCE.md)
//   - per-item `inventory_template` dropped (sheet resolves stats from catalog at compute time)
//   - `slug` dropped (id is the key)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const old = JSON.parse(readFileSync("merge/builder-1.0/content/items.json", "utf8"));

const stripItem = ({ slug, inventory_template, ...rest }) => rest;

const catalog = Object.fromEntries(
  Object.entries(old.catalog).map(([k, items]) => [k, items.map(stripItem)])
);

const carry_rules = {
  ...old.carry_rules,
  carry_capacity_formula: old.carry_rules.carry_capacity_formula.replace(/\bBody\b/g, "Brawn"),
};

const out = {
  $meta: {
    name: "Path of Ambition — Item Catalog",
    version: "2.0.0",
    source: "ported from builder-1.0 content/items.json (poa.items.v2)",
    notes: ["carry formula Body→Brawn (typo fix per REFERENCE.md)"],
  },
  item_traits: old.item_traits,
  armor_types: old.armor_types,
  masterwork_quality: old.masterwork_quality,
  abbreviations: old.abbreviations,
  kit_legends: old.kit_legends,
  slot_definitions: old.slot_definitions,
  carry_rules,
  catalog,
};

mkdirSync("data/items", { recursive: true });
writeFileSync("data/items/items.json", JSON.stringify(out, null, 2) + "\n");
const counts = Object.fromEntries(Object.entries(catalog).map(([k, v]) => [k, v.length]));
console.log("wrote data/items/items.json", counts);
console.log("carry formula:", carry_rules.carry_capacity_formula);

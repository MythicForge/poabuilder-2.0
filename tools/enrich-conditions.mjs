#!/usr/bin/env node
// Enriches data/shared/conditions.json (id+name only) with stacking flags and
// rules text from merge/builder-1.0/conditions.js.

import { readFileSync, writeFileSync } from "node:fs";

const target = JSON.parse(readFileSync("data/shared/conditions.json", "utf8"));
const src = readFileSync("merge/builder-1.0/conditions.js", "utf8");

// Parse the JS object literal: Name: { stack:bool, tip:"..." }
const OLD = {};
const re = /(\w+):\s*\{\s*stack:\s*(true|false),\s*tip:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = re.exec(src))) OLD[m[1]] = { stacking: m[2] === "true", rules: m[3].replace(/\\"/g, '"') };

let enriched = 0;
for (const c of target.conditions) {
  const old = OLD[c.name];
  if (!old) {
    console.warn(`! no old data for condition ${c.name}`);
    continue;
  }
  c.stacking = old.stacking;
  c.rules = old.rules;
  enriched++;
}

writeFileSync("data/shared/conditions.json", JSON.stringify(target, null, 2) + "\n");
const missing = Object.keys(OLD).filter((n) => !target.conditions.some((c) => c.name === n));
console.log(`enriched ${enriched}/${target.conditions.length} conditions; old-only names: ${missing.join(", ") || "none"}`);

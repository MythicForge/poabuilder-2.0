#!/usr/bin/env node
// Converts retired boon types in data/professions/*.json to live types.
//   merge-action types  → transformed in place (tools/lib/boon-map.mjs)
//   describe-action types → removed; generated prose appended to the nearest
//     ancestor `description`; original boon preserved in that dict's `_review`
//     array for the human editing pass.
// Idempotent: converted files contain no retired types, so a re-run is a no-op.
// Usage: node tools/convert-retired-boons.mjs [--dry]

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { MERGE_TRANSFORMS, describeProse } from "./lib/boon-map.mjs";

const DRY = process.argv.includes("--dry");
const schema = JSON.parse(readFileSync("data/shared/boon-schema.json", "utf8"));
const LIVE = new Set(Object.keys(schema.types));
const RETIRED = schema.retired;

const stats = { merged: {}, described: {}, files: 0 };

const isBoon = (o) =>
  o && typeof o === "object" && !Array.isArray(o) &&
  typeof o.type === "string" && (LIVE.has(o.type) || o.type in RETIRED);

// Walk any node IN PLACE (no copies — dropped-boon prose is appended to ancestor
// `description` fields, which must be visible in the final tree).
// `descHolder` = nearest ancestor dict owning a `description` string.
// `ctx` = nearest enclosing feat {featId, featName}.
// Returns the (possibly replaced) node, or DROP to delete it from its parent.
const DROP = Symbol("drop");

function dropToProse(boon, label, descHolder) {
  const prose = describeProse(boon);
  stats.described[label] = (stats.described[label] || 0) + 1;
  if (descHolder) {
    descHolder.description = descHolder.description.trimEnd() + " " + prose;
    descHolder._review = descHolder._review || [];
    descHolder._review.push({ dropped_type: label, original: boon, generated: prose });
  } else {
    console.warn(`  ! no description ancestor for dropped ${label}`);
  }
  return DROP;
}

function walk(node, descHolder, ctx) {
  if (Array.isArray(node)) {
    const kept = [];
    for (const item of node) {
      const r = walk(item, descHolder, ctx);
      if (r !== DROP) kept.push(r);
    }
    node.length = 0;
    node.push(...kept);
    return node;
  }
  if (!node || typeof node !== "object") return node;

  const nextCtx =
    typeof node.id === "string" && typeof node.description === "string"
      ? { featId: node.id, featName: node.name }
      : ctx;
  const nextHolder = typeof node.description === "string" ? node : descHolder;

  if (isBoon(node) && node.type in RETIRED) {
    const rule = RETIRED[node.type];
    if (rule.action === "merge") {
      stats.merged[node.type] = (stats.merged[node.type] || 0) + 1;
      const replaced = MERGE_TRANSFORMS[node.type](node, nextCtx ?? {});
      return walk(replaced, descHolder, nextCtx); // children may still hold retired boons
    }
    // describe: drop wholesale — nested boons appear inside the generated prose JSON
    return dropToProse(node, node.type, descHolder);
  }

  for (const k of Object.keys(node)) {
    if (k === "_review") continue; // preserved originals contain retired types by design
    const r = walk(node[k], nextHolder, nextCtx);
    if (r === DROP) delete node[k]; // required single-boon slot lost its payload
    else node[k] = r;
  }

  // A conditional_effect whose effect was dropped is itself description-only now.
  if (isBoon(node) && node.type === "conditional_effect" && node.effect === undefined) {
    return dropToProse(node, "conditional_effect(emptied)", descHolder);
  }
  return node;
}

for (const file of globSync("data/professions/*.json")) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const before = JSON.stringify(data);
  const converted = walk(data, null, null);
  if (JSON.stringify(converted) !== before) {
    stats.files++;
    if (!DRY) writeFileSync(file, JSON.stringify(converted, null, 2) + "\n");
    console.log(`${DRY ? "[dry] " : ""}converted: ${file}`);
  }
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
console.log(`\nfiles changed: ${stats.files}`);
console.log(`merged (${sum(stats.merged)}):`, stats.merged);
console.log(`described (${sum(stats.described)}):`, stats.described);

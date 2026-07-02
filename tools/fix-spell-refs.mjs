#!/usr/bin/env node
// Normalizes spell-id references in profession/origin data to match
// data/spells/spells.json ids: underscore→hyphen, plus fuzzy singular/plural
// and possessive-slug matches. Reports refs it cannot resolve.

import { readFileSync, writeFileSync, globSync } from "node:fs";

const SPELL_IDS = new Set(JSON.parse(readFileSync("data/spells/spells.json", "utf8")).spells.map((s) => s.id));

function resolve(ref) {
  if (SPELL_IDS.has(ref)) return ref;
  const hyph = ref.replace(/_/g, "-");
  if (SPELL_IDS.has(hyph)) return hyph;
  // possessive: apprentices-artifice → apprentice-s-artifice
  const poss = hyph.replace(/([a-z])s-/g, "$1-s-");
  if (SPELL_IDS.has(poss)) return poss;
  // plural drift: arcane-needle → arcane-needles
  if (SPELL_IDS.has(hyph + "s")) return hyph + "s";
  if (hyph.endsWith("s") && SPELL_IDS.has(hyph.slice(0, -1))) return hyph.slice(0, -1);
  return null;
}

const unresolved = new Map();
let fixed = 0;

function walk(o, file) {
  if (Array.isArray(o)) {
    o.forEach((v, i) => {
      if (typeof v === "string") return; // handled by parent key context
      walk(v, file);
    });
    return;
  }
  if (!o || typeof o !== "object") return;
  for (const [k, v] of Object.entries(o)) {
    if (k === "_review") continue;
    const isSpellListKey =
      k === "spell_ids" || (k === "from" && Array.isArray(v) && o.max !== undefined) /* cantrips {max, from} */;
    if (k === "spell_id" && typeof v === "string") {
      const r = resolve(v);
      if (r && r !== v) { o[k] = r; fixed++; }
      else if (!r) unresolved.set(v, file);
    } else if (isSpellListKey && Array.isArray(v)) {
      o[k] = v.map((s) => {
        if (typeof s !== "string") return s;
        const r = resolve(s);
        if (r && r !== s) { fixed++; return r; }
        if (!r) unresolved.set(s, file);
        return s;
      });
    } else {
      walk(v, file);
    }
  }
}

for (const file of [...globSync("data/professions/*.json"), ...globSync("data/origins/*.json"), "data/shared/origin-feats.json"]) {
  const j = JSON.parse(readFileSync(file, "utf8"));
  const before = JSON.stringify(j);
  walk(j, file);
  if (JSON.stringify(j) !== before) writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
}

console.log(`fixed refs: ${fixed}`);
if (unresolved.size) {
  console.log(`unresolved (${unresolved.size}):`);
  for (const [ref, file] of unresolved) console.log(`  ${ref}  (${file})`);
}

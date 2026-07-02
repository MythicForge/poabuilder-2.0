#!/usr/bin/env node
// Validates all content under data/ against data/shared/boon-schema.json plus
// cross-file references. Exit 1 on ERRORs; WARNs and TODO counts are reported
// but non-fatal. Run: npm run validate  (or node tools/validate-data.mjs)

import { readFileSync, globSync } from "node:fs";
import { checkFormula } from "./lib/formula-check.mjs";

const schema = JSON.parse(readFileSync("data/shared/boon-schema.json", "utf8"));
const LIVE = schema.types;
const RETIRED = new Set(Object.keys(schema.retired));
const ENUMS = schema.enums;

const errors = [];
const warns = [];
const todo = { "port-boons": 0, _review: 0 };

const load = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    errors.push(`${f}: JSON parse failed — ${e.message}`);
    return null;
  }
};

// ── Load all content ─────────────────────────────────────────────────────────
const professionFiles = globSync("data/professions/*.json").filter((f) => !f.includes("_"));
const originFiles = globSync("data/origins/*.json").filter((f) => !f.includes("_origin-"));
const spellsDoc = load("data/spells/spells.json");
const itemsDoc = load("data/items/items.json");
const conditionsDoc = load("data/shared/conditions.json");
const universalDoc = load("data/shared/universal-resources.json");
const originFeatsDoc = load("data/shared/origin-feats.json");
const activeStatesDoc = load("data/shared/active-states.json");

const SPELL_IDS = new Set((spellsDoc?.spells ?? []).map((s) => s.id));
const CONDITION_IDS = new Set((conditionsDoc?.conditions ?? []).map((c) => c.id));
const ITEM_IDS = new Set(Object.values(itemsDoc?.catalog ?? {}).flat().map((i) => i.id));
const UNIVERSAL_RESOURCES = new Set((universalDoc?.resources ?? []).map((r) => r.id));

const ALL_FEAT_IDS = new Set();
const ALL_CHOICE_KEYS = new Set();
const RESOURCE_IDS = new Set(UNIVERSAL_RESOURCES);
const PROFESSION_IDS = new Set();
const ORIGIN_IDS = new Set();
const VOCATION_IDS = new Set();

const docs = []; // [file, json, kind]
for (const f of professionFiles) {
  const j = load(f);
  if (!j) continue;
  docs.push([f, j]);
  if (!f.includes("profession-")) PROFESSION_IDS.add(j.id);
  for (const r of j.resources ?? []) RESOURCE_IDS.add(r.id);
  for (const feat of j.feats ?? []) ALL_FEAT_IDS.add(feat.id);
}
for (const f of originFiles) {
  const j = load(f);
  if (!j) continue;
  docs.push([f, j]);
  if (j.origin) VOCATION_IDS.add(j.id);
  else ORIGIN_IDS.add(j.id);
  for (const feat of j.feats ?? []) ALL_FEAT_IDS.add(feat.id);
}
for (const feat of originFeatsDoc?.feats ?? []) ALL_FEAT_IDS.add(feat.id);
if (originFeatsDoc) docs.push(["data/shared/origin-feats.json", originFeatsDoc]);
if (activeStatesDoc) docs.push(["data/shared/active-states.json", activeStatesDoc]);

// first pass: collect choice keys
function collectKeys(o) {
  if (Array.isArray(o)) return o.forEach(collectKeys);
  if (!o || typeof o !== "object") return;
  if (typeof o.type === "string" && ["choice", "multi_choice", "daily_mode_choice"].includes(o.type) && o.key) {
    ALL_CHOICE_KEYS.add(o.key);
  }
  for (const [k, v] of Object.entries(o)) if (k !== "_review") collectKeys(v);
}
for (const [, j] of docs) collectKeys(j);

// ── Boon validation ──────────────────────────────────────────────────────────
const isBoon = (o) => {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  if (typeof o.type !== "string" || !(LIVE[o.type] || RETIRED.has(o.type))) return false;
  // structural pick-lists ({type:"choice", count, from}) in proficiencies/packs
  // share the "choice" type name but are not the boon
  if (o.type === "choice" && o.from !== undefined && o.key === undefined) return false;
  return true;
};

// A required field is also satisfied by one of these alternative fields
// (patterns REFERENCE.md documents but boon-schema's required flags don't cover).
const REQUIRED_ALTERNATIVES = {
  "grants_known_spells.count": ["spell_ids", "from"],
  "resistance.damage_type": ["damage_type_ref"],
  "reduction_pool.formula": ["source"],
  "spell.spell_id": ["restriction", "spell_filter", "tier_max"],
  "cantrip_upgrade.bonus": ["minimum_die_size"],
};

function validateBoon(boon, file, path) {
  if (RETIRED.has(boon.type)) {
    errors.push(`${file} ${path}: retired boon type "${boon.type}"`);
    return;
  }
  const spec = LIVE[boon.type];
  for (const f of spec.fields) {
    const v = boon[f.name];
    if (f.required && (v === undefined || v === null)) {
      const alts = REQUIRED_ALTERNATIVES[`${boon.type}.${f.name}`] ?? [];
      if (!alts.some((a) => boon[a] !== undefined && boon[a] !== null)) {
        errors.push(`${file} ${path}: ${boon.type} missing required field "${f.name}"`);
      }
      continue;
    }
    if (v === undefined || v === null) continue;
    if (f.kind === "enum" && f.enum) {
      const allowed = ENUMS[f.enum] ?? [];
      if (typeof v === "string" && !allowed.includes(v)) {
        warns.push(`${file} ${path}: ${boon.type}.${f.name} = "${v}" not in enum ${f.enum}`);
      }
    }
    if (f.kind === "formula") {
      const r = checkFormula(v);
      if (!r.ok) warns.push(`${file} ${path}: ${boon.type}.${f.name} formula "${v}" — ${r.error}`);
    }
    if (f.kind === "number" && typeof v !== "number") {
      warns.push(`${file} ${path}: ${boon.type}.${f.name} expected number, got ${JSON.stringify(v)}`);
    }
  }
  // cross-refs
  if (boon.type === "feat_grant" && boon.feat_id && !ALL_FEAT_IDS.has(boon.feat_id)) {
    errors.push(`${file} ${path}: feat_grant.feat_id "${boon.feat_id}" not found`);
  }
  if (boon.type === "upgrade_feat" && boon.feat_id && !ALL_FEAT_IDS.has(boon.feat_id)) {
    errors.push(`${file} ${path}: upgrade_feat.feat_id "${boon.feat_id}" not found`);
  }
  if (boon.type === "choice_conditional" && boon.choice_key && !ALL_CHOICE_KEYS.has(boon.choice_key)) {
    errors.push(`${file} ${path}: choice_conditional.choice_key "${boon.choice_key}" not found`);
  }
  for (const key of ["spell_id"]) {
    if (typeof boon[key] === "string" && !SPELL_IDS.has(boon[key])) {
      warns.push(`${file} ${path}: ${boon.type}.${key} "${boon[key]}" not in spells.json`);
    }
  }
  for (const key of ["spell_ids"]) {
    for (const sid of Array.isArray(boon[key]) ? boon[key] : []) {
      if (!SPELL_IDS.has(sid)) warns.push(`${file} ${path}: ${boon.type}.${key} "${sid}" not in spells.json`);
    }
  }
  if (Array.isArray(boon.cantrips?.from)) {
    for (const sid of boon.cantrips.from) {
      if (!SPELL_IDS.has(sid)) warns.push(`${file} ${path}: ${boon.type} cantrip "${sid}" not in spells.json`);
    }
  }
  if (typeof boon.resource === "string" && ["restore_resource", "upgrade_resource", "resource_conversion"].includes(boon.type)) {
    if (!RESOURCE_IDS.has(boon.resource)) {
      warns.push(`${file} ${path}: ${boon.type}.resource "${boon.resource}" not a known resource`);
    }
  }
  if (boon.type === "cure_condition") {
    for (const cid of Array.isArray(boon.conditions) ? boon.conditions : boon.condition_id ? [boon.condition_id] : []) {
      if (!CONDITION_IDS.has(cid)) warns.push(`${file} ${path}: cure_condition "${cid}" not in conditions.json`);
    }
  }
}

function walk(o, file, path) {
  if (Array.isArray(o)) return o.forEach((v, i) => walk(v, file, `${path}[${i}]`));
  if (!o || typeof o !== "object") return;
  if (o._todo === "port-boons") todo["port-boons"]++;
  if (Array.isArray(o._review)) todo._review += o._review.length;
  if (isBoon(o)) validateBoon(o, file, path);
  else if (typeof o.type === "string" && /^[a-z][a-z0-9_]*$/.test(o.type) && !LIVE[o.type] && !RETIRED.has(o.type)) {
    // lowercase snake_case `type` that isn't a known boon: probable typo (weapon dicts use Title Case)
    const IGNORED = new Set(["choice", "table"]); // structural, not boons
    if (!IGNORED.has(o.type)) warns.push(`${file} ${path}: unrecognized type "${o.type}" (not a live or retired boon)`);
  }
  for (const [k, v] of Object.entries(o)) {
    if (k === "_review") continue;
    walk(v, file, `${path}.${k}`);
  }
}

for (const [f, j] of docs) walk(j, f, "$");

// ── Structural cross-refs ────────────────────────────────────────────────────
for (const f of originFiles) {
  const j = load(f);
  if (!j || j.origin) continue;
  for (const vid of j.vocations ?? []) {
    if (!globSync(`data/origins/origin-${j.id}-*.json`).some((p) => p.endsWith(`origin-${vid.replace(j.id + "-", j.id + "-")}.json`)) &&
        !globSync("data/origins/*.json").some((p) => p.includes(vid))) {
      errors.push(`${f}: vocation "${vid}" has no origin-*.json file`);
    }
  }
}

// spells sanity
for (const s of spellsDoc?.spells ?? []) {
  if (!s.id) errors.push(`data/spells/spells.json: spell with empty id (name: "${(s.name ?? "").slice(0, 40)}")`);
  else if (s.id.length > 60) warns.push(`data/spells/spells.json: suspicious slug id "${s.id.slice(0, 50)}…" (broken extraction?)`);
}

// ── Character fixtures ───────────────────────────────────────────────────────
for (const f of globSync("data/characters/*.json")) {
  const c = load(f);
  if (!c) continue;
  const b = c.build ?? {};
  if (!PROFESSION_IDS.has(b.profession_id)) errors.push(`${f}: profession_id "${b.profession_id}" not found`);
  if (!ORIGIN_IDS.has(b.origin_id)) errors.push(`${f}: origin_id "${b.origin_id}" not found`);
  if (!VOCATION_IDS.has(b.vocation_id)) errors.push(`${f}: vocation_id "${b.vocation_id}" not found`);
  for (const id of b.feat_ids ?? []) if (!ALL_FEAT_IDS.has(id)) errors.push(`${f}: feat_id "${id}" not found`);
  for (const id of [...(b.known_spell_ids ?? []), ...(b.known_cantrip_ids ?? []), ...(b.prepared_spell_ids ?? [])]) {
    if (!SPELL_IDS.has(id)) errors.push(`${f}: spell id "${id}" not found`);
  }
  for (const it of c.inventory?.items ?? []) {
    if (it.catalog_item_id && !ITEM_IDS.has(it.catalog_item_id)) errors.push(`${f}: catalog_item_id "${it.catalog_item_id}" not found`);
  }
  for (const cid of Object.keys(c.conditions ?? {})) {
    if (!CONDITION_IDS.has(cid)) errors.push(`${f}: condition "${cid}" not found`);
  }
  for (const key of Object.keys(c.build?.choices ?? {})) {
    if (!ALL_CHOICE_KEYS.has(key)) warns.push(`${f}: choice key "${key}" not defined by any boon`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`professions: ${professionFiles.length} files | origins+vocations: ${originFiles.length} | spells: ${SPELL_IDS.size} | items: ${ITEM_IDS.size} | conditions: ${CONDITION_IDS.size} | feats indexed: ${ALL_FEAT_IDS.size} | choice keys: ${ALL_CHOICE_KEYS.size}`);
console.log(`TODO port-boons: ${todo["port-boons"]} | _review markers: ${todo._review}`);
if (warns.length) {
  console.log(`\nWARNINGS (${warns.length}):`);
  for (const w of warns) console.log("  ~ " + w);
}
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  for (const e of errors) console.log("  ✗ " + e);
  process.exit(1);
}
console.log("\nvalidation: GREEN" + (warns.length ? ` (${warns.length} warnings)` : ""));

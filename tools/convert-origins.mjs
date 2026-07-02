#!/usr/bin/env node
// Ports builder-1.0 origins + origin feats into the new-format templates:
//   data/origins/<origin>.json                     (13 origins, per _origin-template.json)
//   data/origins/origin-<origin>-<vocation>.json   (39 vocations, per _origin-vocation-template.json)
//   data/shared/origin-feats.json                  (universal origin feats)
// Per user ruling: feature prose ships description-only — every feat gets empty
// boons + `_todo: "port-boons"`; the validator reports the count.
// `body` attribute bonuses are mapped to brawn with an `_review` note (needs a
// per-vocation Brawn-vs-Finesse human ruling).

import { readFileSync, writeFileSync } from "node:fs";

const origins = JSON.parse(readFileSync("merge/builder-1.0/content/origins.json", "utf8")).origins;
const originFeats = JSON.parse(readFileSync("merge/builder-1.0/content/origin_feats.json", "utf8")).feats;

const stats = { origins: 0, vocations: 0, feats: 0, universal: 0, bodyRulings: [] };

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function activationToFields(activation) {
  const out = { cost: null, range: null, duration: null, uses: null };
  if (!activation) return out;
  const res = activation.resources ?? {};
  if (Object.keys(res).length) out.cost = { ...res };
  const props = activation.properties ?? {};
  if (props.range) out.range = props.range;
  if (props.duration) out.duration = props.duration;
  if (props.uses) out.uses = props.uses;
  // duration often only present in the raw string, e.g. "2 AP | Duration 1 Minute"
  if (!out.duration && typeof activation.raw === "string") {
    const m = activation.raw.match(/Duration\s+([^|]+)/i);
    if (m) out.duration = m[1].trim();
  }
  return out;
}

function featFromOld(f, prerequisites) {
  return {
    id: f.id,
    name: f.name.trim(),
    tags: f.tag ? [f.tag] : [],
    tier: f.tier ?? 0,
    trait: (f.traits && f.traits[0]) || f.trait_raw || "Passive",
    slot_type: null,
    ...activationToFields(f.activation),
    feat_dc: null,
    prerequisites,
    description: f.description_markdown,
    boons: [],
    _todo: "port-boons",
  };
}

function packFromOld(originPack) {
  const parsed = originPack?.parsed ?? {};
  const items = (k) => parsed[k]?.items ?? [];
  const raw = originPack?.raw ?? "";
  const pickMatch = raw.match(/Misc\.?\s*\(Pick\s+(\d+)\)/i);
  const miscItems = items("misc");
  return {
    consumables: items("consumables"),
    kits: items("kits"),
    clothing: items("clothing"),
    misc: pickMatch
      ? { type: "choice", count: Number(pickMatch[1]), from: miscItems }
      : miscItems,
  };
}

const universal = [];

for (const og of origins) {
  const vocationIds = [];

  for (const v of og.vocations) {
    const vslug = slugify(v.name);
    const vid = `${og.id}-${vslug}`;
    vocationIds.push(vid);

    let attribute = v.attribute_bonus.attribute;
    const voc = {
      id: vid,
      name: v.name,
      origin: og.id,
      description: v.flavor,
      attribute_bonus: { attribute, amount: v.attribute_bonus.value },
      feats: (v.features ?? []).map((f) => featFromOld(f, [])),
      spellcasting: v.caster ?? null,
    };
    if (attribute === "body") {
      voc.attribute_bonus.attribute = "brawn";
      voc._review = [`attribute_bonus was "+${v.attribute_bonus.value} Body" — mapped to brawn; verify Brawn vs Finesse`];
      stats.bodyRulings.push(vid);
    }
    stats.feats += voc.feats.length;
    stats.vocations++;
    writeFileSync(`data/origins/origin-${og.id}-${vslug}.json`, JSON.stringify(voc, null, 2) + "\n");
  }

  const ownFeats = originFeats.filter((f) => f.owner_id === og.id);
  const baseFeats = (og.origin_features ?? []).map((f) => featFromOld(f, []));
  const tierFeats = ownFeats.map((f) =>
    featFromOld(f, { feats: [], origin_investment: { origin: og.id, count: 0 } })
  );

  const out = {
    id: og.id,
    name: og.name,
    description: og.flavor,
    pack: packFromOld(og.origin_pack),
    vocations: vocationIds,
    feats: [...baseFeats, ...tierFeats],
  };
  stats.feats += out.feats.length;
  stats.origins++;
  writeFileSync(`data/origins/${og.id}.json`, JSON.stringify(out, null, 2) + "\n");
}

for (const f of originFeats.filter((f) => f.owner_name === "Universal")) {
  universal.push(featFromOld(f, { feats: [], origin_investment: { origin: "any", count: 0 } }));
}
stats.universal = universal.length;
stats.feats += universal.length;
writeFileSync("data/shared/origin-feats.json", JSON.stringify({
  $meta: { name: "Universal origin feats", source: "ported from builder-1.0 origin_feats.json" },
  feats: universal,
}, null, 2) + "\n");

console.log(`origins: ${stats.origins}, vocations: ${stats.vocations}, universal feats: ${stats.universal}, total feats: ${stats.feats}`);
console.log(`body→brawn rulings needed (${stats.bodyRulings.length}):`, stats.bodyRulings.join(", "));

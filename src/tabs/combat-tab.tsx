// Combat tab: equipped weapons (stats from catalog), active-state toggles,
// activation feats (cost/range/duration) for quick reference.

import type { ComputedCharacter, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { resolveItem } from "../core/compute.ts";
import { Markdown } from "@ui/primitives.tsx";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

export function CombatTab({ c, stored, setStored }: TabProps) {
  const weapons = stored.inventory.items
    .filter((it) => it.equipped)
    .map((it) => ({ it, cat: resolveItem(it, REGISTRY) }))
    .filter((x) => x.cat?.category === "Weapon");

  const activationFeats = c.featCards.filter(
    ({ feat }) => feat.cost || feat.uses || (feat.trait && feat.trait.toLowerCase() !== "passive"),
  );

  return (
    <>
      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Equipped Weapons</div>
        </div>
        {weapons.length === 0 && <div className="feat-row"><div className="desc">Nothing equipped.</div></div>}
        {weapons.map(({ it, cat }) => (
          <div className="attack-row" key={it.id}>
            <span className="name">{it.name}{it.masterwork_bonus ? ` (MW +${it.masterwork_bonus})` : ""}</span>
            <span className="dmg">{cat?.damage ?? "—"}</span>
            <span className="type">
              {(cat?.damage_types ?? []).map((d) => d.name).join("/") || "—"}
              {" · "}
              {(cat?.range_bands ?? []).map((r) => r.name).join("/") || "Melee"}
            </span>
            <span className="type">{(cat?.traits ?? []).map((t) => t.name).join(", ")}</span>
          </div>
        ))}
      </div>

      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Actions & Activated Feats</div>
        </div>
        {activationFeats.length === 0 && <div className="feat-row"><div className="desc">No activated feats.</div></div>}
        {activationFeats.map(({ feat, owner }) => (
          <div className="feat-row" key={feat.id}>
            <div className="row-1">
              <span className="name">{feat.name}</span>
              <span className="src">
                {owner}
                {feat.cost ? ` · cost ${formatCost(feat.cost)}` : ""}
                {feat.range ? ` · ${feat.range}` : ""}
                {feat.duration ? ` · ${feat.duration}` : ""}
                {feat.feat_dc ? ` · DC ${feat.feat_dc}` : ""}
              </span>
            </div>
            <Markdown className="desc" text={feat.description} />
          </div>
        ))}
      </div>
    </>
  );
}

function formatCost(cost: unknown): string {
  if (cost == null) return "";
  if (typeof cost === "string" || typeof cost === "number") return String(cost);
  const c = cost as Record<string, unknown>;
  const parts: string[] = [];
  if (c.ap) parts.push(`${c.ap} AP`);
  if (Array.isArray(c.resources)) {
    for (const r of c.resources as Array<Record<string, unknown>>) parts.push(`${r.amount} ${r.id}`);
  }
  for (const [k, v] of Object.entries(c)) {
    if (k === "ap" || k === "resources") continue;
    parts.push(`${v} ${k}`);
  }
  return parts.join(" + ") || JSON.stringify(cost);
}

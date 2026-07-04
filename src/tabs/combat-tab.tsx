// Combat tab: equipped weapons (stats from catalog) + an owner-grouped
// ledger of activation feats with a cross-cutting action-economy filter.

import { useMemo, useState } from "react";
import type { ComputedCharacter, ComputedResource, FeatCard, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { resolveItem } from "../core/compute.ts";
import { normalizeTrait } from "../core/trait.ts";
import { groupFeatCards } from "../shared/feat-groups.ts";
import { SOURCE_COLOR } from "../shared/source-colors.ts";
import { Markdown, PipTracker } from "@ui/primitives.tsx";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

type EconFilter = "all" | "actions" | "triggers" | "limited" | "free";

function apCost(cost: unknown): number {
  if (cost && typeof cost === "object" && !Array.isArray(cost)) {
    const ap = (cost as Record<string, unknown>).ap;
    if (typeof ap === "number") return ap;
  }
  return 0;
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

function matchesFilter(card: FeatCard, filter: EconFilter): boolean {
  const trait = normalizeTrait(card.feat.trait);
  switch (filter) {
    case "actions":
      return apCost(card.feat.cost) >= 1;
    case "triggers":
      return trait === "trigger";
    case "limited":
      return card.feat.uses != null;
    case "free":
      return apCost(card.feat.cost) < 1 && trait !== "trigger" && trait !== "passive";
    default:
      return true;
  }
}

function PoolChip({ resource }: { resource: ComputedResource }) {
  return (
    <span className="poolchip">
      <span className="poolchip-name">{resource.def.name}</span>
      <span className="poolchip-ct">
        <b>{resource.current}</b>/{resource.max}
      </span>
    </span>
  );
}

export function CombatTab({ c, stored, setStored }: TabProps) {
  const [filter, setFilter] = useState<EconFilter>("all");
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const slotRank: Record<string, number> = { main_hand: 0, off_hand: 1 };
  const weapons = stored.inventory.items
    .filter((it) => it.equipped)
    .map((it) => ({ it, cat: resolveItem(it, REGISTRY) }))
    .filter((x) => x.cat?.category === "Weapon")
    .sort((a, b) => (slotRank[a.it.slot ?? ""] ?? 2) - (slotRank[b.it.slot ?? ""] ?? 2));

  const combatRelevant = c.featCards.filter(
    (fc) => fc.feat.cost || fc.feat.uses || normalizeTrait(fc.feat.trait) !== "passive",
  );

  const allGroups = useMemo(() => groupFeatCards(combatRelevant), [combatRelevant]);

  const professionResource = c.resources[0];
  const professionOwner = REGISTRY.professions.get(stored.build.profession_id)?.name;
  const groups = allGroups.some((g) => g.source === "profession") || !professionResource || !professionOwner
    ? allGroups
    : [
        { key: `profession:${professionOwner}`, source: "profession" as const, owner: professionOwner, label: `Profession — ${professionOwner}`, cards: [] },
        ...allGroups,
      ].sort((a, b) => {
        const order = ["profession", "path", "origin", "vocation", "universal"];
        return order.indexOf(a.source) - order.indexOf(b.source) || a.owner.localeCompare(b.owner);
      });

  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const spendUse = (featId: string, current: number, delta: number, max: number) =>
    setStored((s) => ({
      ...s,
      pools: { ...s.pools, uses: { ...s.pools.uses, [featId]: Math.max(0, Math.min(max, current + delta)) } },
    }));

  return (
    <>
      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Equipped Weapons</div>
        </div>
        {weapons.length === 0 && <div className="feat-row"><div className="desc">Nothing equipped.</div></div>}
        {weapons.map(({ it, cat }) => (
          <div className="attack-row" key={it.id}>
            <span className="name">
              {it.slot && <span className="inv-type-badge" style={{ marginRight: 6, marginLeft: 0 }}>{it.slot === "main_hand" ? "MAIN" : "OFF"}</span>}
              {it.name}{it.masterwork_bonus ? ` (MW +${it.masterwork_bonus})` : ""}
            </span>
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
        <div className="ab-filters">
          {(["all", "actions", "triggers", "limited", "free"] as EconFilter[]).map((f) => (
            <button
              key={f}
              className={`ab-filter-btn${filter === f ? " sel" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ledger-scroll">
          {groups.length === 0 && <div className="ledger-empty">No activated feats.</div>}
          {groups.map((g) => {
            const rows = g.cards.filter((card) => matchesFilter(card, filter));
            return (
              <div className="lgroup" key={g.key}>
                <div className="lgroup-head" style={{ ["--c" as string]: SOURCE_COLOR[g.source] }}>
                  <span className="lgroup-bar" />
                  <span className="lgroup-title">{g.label}</span>
                  {g.source === "profession" && professionResource && <PoolChip resource={professionResource} />}
                  <span className="lgroup-rule" />
                </div>
                {rows.length === 0 && <div className="ldtext" style={{ padding: "4px 12px 8px" }}>No matching feats.</div>}
                {rows.map((card) => {
                  const feat = card.feat;
                  const uses = feat.uses ? (stored.pools.uses[feat.id] ?? feat.uses.count) : null;
                  const open = openRows.has(feat.id);
                  return (
                    <div className="litem" key={feat.id}>
                      <div className="lrow" style={{ gridTemplateColumns: "1fr auto auto 16px" }} onClick={() => toggleRow(feat.id)}>
                        <span className="lname">{feat.name}</span>
                        <span className="lcost-cell">
                          {feat.cost != null && <span className="cost-badge">{formatCost(feat.cost)}</span>}
                        </span>
                        <span className="lpip-cell">
                          {uses !== null && feat.uses && (
                            <PipTracker
                              current={uses}
                              max={feat.uses.count}
                              onChange={(n) => spendUse(feat.id, uses, n - uses, feat.uses!.count)}
                              label=""
                            />
                          )}
                        </span>
                        <span className={`lcaret${open ? " open" : ""}`}>▸</span>
                      </div>
                      {open && (
                        <div className="lrow-detail">
                          <div className="lmeta">
                            {feat.range && <span className="mi"><span className="mk">range</span><span className="mv">{feat.range}</span></span>}
                            {feat.duration && <span className="mi"><span className="mk">duration</span><span className="mv">{feat.duration}</span></span>}
                            {feat.feat_dc && <span className="mi"><span className="mk">dc</span><span className="mv gold">{feat.feat_dc}</span></span>}
                          </div>
                          <Markdown className="ldtext" text={feat.description} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

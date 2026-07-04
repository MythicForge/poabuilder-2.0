// Features tab: master/detail — source rail, searchable list, slide-in detail
// with choice pickers, state toggles, and limited-use counters.

import { useMemo, useState } from "react";
import type { Boon, ComputedCharacter, Feat, StoredCharacter } from "../core/types.ts";
import { Markdown, Pill, PipTracker } from "@ui/primitives.tsx";
import { normalizeTrait } from "../core/trait.ts";
import { groupFeatCards } from "../shared/feat-groups.ts";
import { SOURCE_COLOR } from "../shared/source-colors.ts";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

function usesRemaining(feat: Feat, stored: StoredCharacter): number | null {
  if (!feat.uses) return null;
  return stored.pools.uses[feat.id] ?? feat.uses.count;
}

export function FeatsTab({ c, stored, setStored }: TabProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const groups = useMemo(() => groupFeatCards(c.featCards), [c.featCards]);
  const openCard = openId ? c.featCards.find((fc) => fc.feat.id === openId) : undefined;
  const openGroup = openCard ? groups.find((g) => g.key === `${openCard.source}:${openCard.owner}`) : undefined;

  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .filter((g) => selectedGroup === "all" || g.key === selectedGroup)
    .map((g) => ({
      ...g,
      cards: q
        ? g.cards.filter(
            ({ feat }) => feat.name.toLowerCase().includes(q) || feat.description.toLowerCase().includes(q),
          )
        : g.cards,
    }))
    .filter((g) => g.cards.length > 0);

  const setChoice = (key: string, value: string) =>
    setStored((s) => ({ ...s, build: { ...s.build, choices: { ...s.build.choices, [key]: value } } }));

  const toggleState = (state: string) =>
    setStored((s) => ({
      ...s,
      states: {
        active: s.states.active.includes(state)
          ? s.states.active.filter((x) => x !== state)
          : [...s.states.active, state],
      },
    }));

  const spendUse = (feat: Feat, delta: number) =>
    setStored((s) => {
      const max = feat.uses?.count ?? 0;
      const cur = s.pools.uses[feat.id] ?? max;
      return { ...s, pools: { ...s.pools, uses: { ...s.pools.uses, [feat.id]: Math.max(0, Math.min(max, cur + delta)) } } };
    });

  return (
    <div className="feat-md">
      <div className="feat-md-search">
        <input placeholder="search features…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="md-body">
        <div className="md-rail">
          <div
            className={`md-rail-item${selectedGroup === "all" ? " active" : ""}`}
            onClick={() => setSelectedGroup("all")}
          >
            <span className="md-rail-label">All</span>
            <span className="md-rail-count">{c.featCards.length}</span>
          </div>
          {groups.map((g) => (
            <div
              key={g.key}
              className={`md-rail-item${selectedGroup === g.key ? " active" : ""}`}
              style={{ ["--c" as string]: SOURCE_COLOR[g.source] }}
              onClick={() => setSelectedGroup(g.key)}
            >
              <span className="md-rail-label">{g.label}</span>
              <span className="md-rail-count">{g.cards.length}</span>
            </div>
          ))}
        </div>

        <div className="md-list">
          {visibleGroups.length === 0 && <div className="md-list-empty">No features match your search.</div>}
          {visibleGroups.map((g) => (
            <div key={g.key}>
              {selectedGroup === "all" && (
                <div className="md-list-group-head" style={{ ["--c" as string]: SOURCE_COLOR[g.source] }}>
                  {g.label}
                </div>
              )}
              {g.cards.map(({ feat, starting }) => {
                const trait = normalizeTrait(feat.trait);
                return (
                  <div
                    key={feat.id}
                    className={`md-list-item${openId === feat.id ? " active" : ""}`}
                    onClick={() => setOpenId(feat.id)}
                  >
                    <span className="md-list-item-name">{feat.name}</span>
                    <span style={{ display: "flex", gap: 5 }}>
                      <span className="md-list-item-tag">{starting ? "starting" : `tier ${feat.tier}`}</span>
                      {feat.slot_type && <span className="md-list-item-tag">{feat.slot_type}</span>}
                      {trait && <span className={`tag ${trait}`}>{trait}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className={`md-detail${openCard ? " detail-open" : ""}`}>
          {openCard && (
            <>
              <div className="md-detail-head">
                <button className="md-detail-back" onClick={() => setOpenId(null)}>← Back</button>
              </div>
              <div className="md-detail-src" style={{ ["--c" as string]: SOURCE_COLOR[openCard.source] }}>
                {openGroup?.label ?? openCard.owner}
              </div>
              <div className="md-detail-name">{openCard.feat.name}</div>
              <div className="md-detail-tag-wrap" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="md-detail-tag">{openCard.starting ? "starting" : `tier ${openCard.feat.tier}`}</span>
                {openCard.feat.slot_type && <span className="md-detail-tag">{openCard.feat.slot_type}</span>}
                {normalizeTrait(openCard.feat.trait) && (
                  <span className={`tag ${normalizeTrait(openCard.feat.trait)}`}>{normalizeTrait(openCard.feat.trait)}</span>
                )}
                {usesRemaining(openCard.feat, stored) !== null && openCard.feat.uses && (
                  <PipTracker
                    current={usesRemaining(openCard.feat, stored) as number}
                    max={openCard.feat.uses.count}
                    onChange={(n) => spendUse(openCard.feat, n - (usesRemaining(openCard.feat, stored) as number))}
                    label={openCard.feat.uses.recharge.replace(/_/g, " ")}
                  />
                )}
              </div>
              <div className="md-detail-body">
                <Markdown text={openCard.feat.description} />
                <BoonControls boons={openCard.activeBoons} stored={stored} setChoice={setChoice} toggleState={toggleState} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BoonControls({
  boons, stored, setChoice, toggleState,
}: {
  boons: Boon[];
  stored: StoredCharacter;
  setChoice: (key: string, value: string) => void;
  toggleState: (state: string) => void;
}) {
  const controls: React.ReactNode[] = [];
  for (const b of boons) {
    if ((b.type === "choice" || b.type === "multi_choice") && typeof b.key === "string" && Array.isArray(b.options)) {
      const sel = stored.build.choices[b.key];
      const selected = Array.isArray(sel) ? sel[0] : sel;
      controls.push(
        <label key={`choice-${b.key}`} style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "var(--mono)", fontSize: 11 }}>
          <span style={{ color: "var(--text-faint)" }}>{String(b.prompt ?? b.key)}:</span>
          <select
            value={selected ?? ""}
            onChange={(e) => setChoice(b.key as string, e.target.value)}
            style={{ background: "var(--card-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px" }}
          >
            <option value="" disabled>pick…</option>
            {(b.options as Array<Record<string, unknown>>).map((o) => (
              <option key={String(o.value)} value={String(o.value)}>{String(o.label ?? o.value)}</option>
            ))}
          </select>
        </label>,
      );
    }
    if (b.type === "activate_state" && typeof b.state === "string") {
      const on = stored.states.active.includes(b.state);
      controls.push(
        <Pill
          key={`state-${b.state}`}
          className=""
          style={{ cursor: "pointer", borderColor: on ? "var(--gold)" : "var(--border)", color: on ? "var(--gold)" : "var(--text-muted)" }}
        >
          <span onClick={() => toggleState(b.state as string)}>{on ? "◉" : "○"} {b.state.replace(/_/g, " ")}</span>
        </Pill>,
      );
    }
  }
  if (!controls.length) return null;
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>{controls}</div>;
}

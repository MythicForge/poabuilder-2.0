// GM Toolbox — Encounter Tracker panel.
// Initiative spine of expandable combatant cards. Monster cards mirror the
// player-sheet Vassals tab: HP ±/damage/heal, ability scores, traits & actions,
// and the shared player-style condition bar. Players show live HP + conditions.
// Encounter state is lifted to the view (gm-view.tsx) for persistence.

import React, { useEffect, useMemo, useState } from "react";
import { loadBestiary } from "../core/data-registry";
import { Icon } from "../shared/primitives";
import { CondBar } from "../shared/condition-bar";
import { StatBlockModal } from "./gm-statblock";
import { bestiaryType, bestiaryCR, bestiaryAC, crToNum } from "../core/bestiary-util";
import type { BestiaryEntry, MonsterFluff } from "../core/types";
import type { GmCombatant, GmEncounter } from "../core/gm-types";
import type { PartyMember } from "./gm-party";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── Add Monster modal ────────────────────────────────────────────────────────

function AddMonsterModal({
  onAdd,
  onClose,
}: {
  onAdd: (c: GmCombatant) => void;
  onClose: () => void;
}) {
  const [all, setAll] = useState<BestiaryEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [crFilter, setCrFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    loadBestiary().then(setAll);
  }, []);

  const sources = useMemo(() => {
    if (!all) return [];
    return Array.from(new Set(all.map((e) => e.source))).sort();
  }, [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    const crMax = crFilter === "all" ? Infinity : crToNum(crFilter);
    return all
      .filter(
        (e) =>
          (!q || e.name.toLowerCase().includes(q)) &&
          (sourceFilter === "all" || e.source === sourceFilter) &&
          crToNum(bestiaryCR(e)) <= crMax,
      )
      .slice(0, 80);
  }, [all, query, crFilter, sourceFilter]);

  const pick = (m: BestiaryEntry) => {
    const hp = m.hp?.average ?? 1;
    onAdd({
      id: uid(),
      name: m.name,
      type: "monster",
      initiative: null,
      conditions: {},
      dead: false,
      hpMax: hp,
      hpCurrent: hp,
      ac: bestiaryAC(m),
      cr: bestiaryCR(m),
      creatureName: m.name,
      creatureSource: m.source,
    });
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="modal-box">
        <div className="modal-head">
          <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Summon a Foe</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-filters">
          <input
            className="modal-search"
            style={{ flex: 1 }}
            placeholder="Search the bestiary…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            className="modal-select"
            value={crFilter}
            onChange={(e) => setCrFilter(e.target.value)}
          >
            <option value="all">All CR</option>
            <option value="1/4">CR ≤ 1/4</option>
            <option value="1/2">CR ≤ 1/2</option>
            <option value="1">CR ≤ 1</option>
            <option value="3">CR ≤ 3</option>
            <option value="5">CR ≤ 5</option>
            <option value="10">CR ≤ 10</option>
            <option value="20">CR ≤ 20</option>
          </select>
          <select
            className="modal-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            title="Filter by source book"
          >
            <option value="all">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-list">
          {all == null ? (
            <div className="modal-empty">Loading bestiary…</div>
          ) : filtered.length === 0 ? (
            <div className="modal-empty">No creatures match — adjust search or CR filter</div>
          ) : (
            <>
              {filtered.map((e) => (
                <div
                  key={`${e.name}|${e.source}`}
                  className="modal-item-row"
                  onClick={() => {
                    pick(e);
                    onClose();
                  }}
                >
                  <div className="modal-item-name">{e.name}</div>
                  <div className="modal-item-meta">
                    <span className="modal-type-badge">{bestiaryType(e)}</span>
                    <span
                      className="modal-type-badge"
                      style={{ color: "var(--gold-dim)", borderColor: "var(--gold-dim)" }}
                    >
                      CR {bestiaryCR(e)}
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                      HP {e.hp?.average ?? "?"}
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)", marginLeft: "auto" }}>
                      {e.source}
                    </span>
                  </div>
                </div>
              ))}
              {filtered.length === 80 && (
                <div style={{ padding: "8px 16px", color: "var(--text-faint)", fontFamily: "var(--mono)", fontSize: 10, textAlign: "center" }}>
                  Showing 80 of more — refine search
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Player menu ──────────────────────────────────────────────────────────

function AddPlayerMenu({
  members,
  existingCharIds,
  onAdd,
  onClose,
}: {
  members: PartyMember[];
  existingCharIds: Set<string>;
  onAdd: (c: GmCombatant) => void;
  onClose: () => void;
}) {
  const available = members.filter((m) => !existingCharIds.has(m.id));
  return (
    <div className="modal-backdrop" onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 360 }}>
        <div className="modal-head">
          <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Add Player</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-list">
          {available.length === 0 ? (
            <div className="modal-empty">All known players are already in the fight.</div>
          ) : (
            available.map((m) => (
              <div
                key={m.id}
                className="modal-item-row"
                onClick={() => {
                  onAdd({
                    id: uid(),
                    name: m.name,
                    type: "player",
                    initiative: null,
                    conditions: {},
                    charId: m.id,
                  });
                  onClose();
                }}
              >
                <div className="modal-item-name">{m.name}</div>
                <div className="modal-item-meta">
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                    {m.classLabel} · Lv {m.totalLevel}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Combatant card ───────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-faint)",
  padding: "2px 4px",
  lineHeight: 1,
  fontSize: 16,
};

function CombatantCard({
  c,
  active,
  selected,
  entry,
  fluff,
  member,
  liveHp,
  groupColor,
  groupBg,
  isGroupFirst,
  onSelect,
  onPatch,
  onRemove,
}: {
  c: GmCombatant;
  active: boolean;
  selected: boolean;
  entry: BestiaryEntry | null;
  fluff?: MonsterFluff | null;
  member?: PartyMember | null;
  liveHp?: { current: number; max: number };
  groupColor?: string | null;
  groupBg?: string | null;
  isGroupFirst?: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<GmCombatant>) => void;
  onRemove: () => void;
}) {
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjVal, setAdjVal] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const isMonster = c.type === "monster";

  const hpMax = c.hpMax ?? 1;
  const hpCur = c.hpCurrent ?? 0;
  const pct = isMonster
    ? Math.max(0, Math.min(100, (hpCur / Math.max(1, hpMax)) * 100))
    : liveHp
      ? Math.max(0, Math.min(100, (liveHp.current / Math.max(1, liveHp.max)) * 100))
      : 0;
  const hpColor = pct > 60 ? "var(--vitality)" : pct > 25 ? "#c8a030" : "var(--danger)";

  const changeHP = (d: number) =>
    onPatch({ hpCurrent: Math.max(0, Math.min(hpMax, hpCur + d)) });
  const applyDamage = () => {
    const n = parseInt(adjVal, 10);
    if (!n || n <= 0) return;
    onPatch({ hpCurrent: Math.max(0, hpCur - n) });
    setAdjVal("");
    setAdjOpen(false);
  };
  const applyHeal = () => {
    const n = parseInt(adjVal, 10);
    if (!n || n <= 0) return;
    onPatch({ hpCurrent: Math.min(hpMax, hpCur + n) });
    setAdjVal("");
    setAdjOpen(false);
  };

  return (
    <div
      style={{
        position: "relative",
        borderTop: "1px solid var(--border-soft)",
        borderLeft: `3px solid ${active ? "var(--gold)" : selected ? "var(--gold-dim)" : "transparent"}`,
        borderRight: groupColor ? `3px solid ${groupColor}` : undefined,
        background: active ? "var(--gold-shadow)" : selected ? "var(--card-2)" : groupBg ?? "transparent",
        opacity: c.dead ? 0.45 : 1,
        transition: "opacity 0.2s, background 0.2s",
      }}
    >
      {isGroupFirst && groupColor && (
        <div style={{
          position: "absolute",
          top: 8,
          right: 10,
          fontFamily: "var(--mono)",
          fontSize: 7,
          letterSpacing: "0.12em",
          color: groupColor,
          opacity: 0.75,
          pointerEvents: "none",
          userSelect: "none",
        }}>
          ● GROUP
        </div>
      )}
      {/* Header */}
      <div className="list-head" style={{ borderBottom: "none", padding: "10px 14px 6px", gap: 8 }}>
        <span style={{ width: 12, flexShrink: 0, color: "var(--gold)", fontSize: 12 }}>
          {active ? "▶" : ""}
        </span>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 7, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
            INIT
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={c.initiative ?? ""}
            onChange={(e) => onPatch({ initiative: e.target.value === "" ? null : Number(e.target.value) })}
            onFocus={(e) => e.target.select()}
            placeholder="—"
            title="Initiative — tap to edit"
            className="gm-init-input"
            style={{
              width: 46,
              textAlign: "center",
              padding: "5px 2px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 5,
              color: "var(--gold-bright)",
              fontFamily: "var(--mono)",
              fontSize: 17,
              fontWeight: 600,
            }}
          />
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", flex: 1, gap: 2, minWidth: 0, cursor: "pointer" }}
          onClick={onSelect}
          title="View stat block"
        >
          <span
            className="ttl"
            style={{
              fontSize: 16,
              color: isMonster ? "var(--text)" : "var(--gold)",
              textDecoration: c.dead ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.name}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
            {isMonster
              ? `AC ${c.ac} · CR ${c.cr}${c.creatureSource ? ` · ${c.creatureSource}` : ""}`
              : `PLAYER${liveHp ? ` · HP ${liveHp.current}/${liveHp.max}` : ""}`}
          </span>
        </div>

        <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
          <button
            style={{ ...iconBtn, fontSize: 13, fontStyle: "italic", fontFamily: "var(--serif)", color: selected ? "var(--gold)" : "var(--text-faint)" }}
            title="Stat block"
            onClick={() => {
              onSelect();
              setInfoOpen(true);
            }}
          >
            ⓘ
          </button>
          {isMonster && (
            <button
              style={{ ...iconBtn, color: c.dead ? "var(--danger)" : "var(--text-faint)" }}
              title={c.dead ? "Restore" : "Mark dead"}
              onClick={() => onPatch({ dead: !c.dead })}
            >
              <Icon kind="skull" size={13} />
            </button>
          )}
          <button style={{ ...iconBtn, fontSize: 20 }} title="Remove" onClick={onRemove}>
            ×
          </button>
        </div>
      </div>

      {/* Monster compact HP (always visible) */}
      {isMonster && (
        <div style={{ padding: "0 14px 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pm" style={{ cursor: "pointer", userSelect: "none", fontSize: 18, color: "var(--text-muted)" }} onClick={() => changeHP(-1)}>
            −
          </span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 20, color: pct < 25 ? "var(--danger)" : "var(--text)", minWidth: 26, textAlign: "center" }}>
            {hpCur}
          </span>
          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>/</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 15, color: "var(--text-muted)" }}>{hpMax}</span>
          <span className="pm" style={{ cursor: "pointer", userSelect: "none", fontSize: 18, color: "var(--text-muted)" }} onClick={() => changeHP(1)}>
            +
          </span>
          <div className="hp-bar-wrap" onClick={() => setAdjOpen((o) => !o)} style={{ cursor: "pointer", flex: 1 }} title="Click to apply damage or healing">
            <div className="hp-bar" style={{ width: `${pct}%`, background: hpColor }} />
          </div>
        </div>
      )}
      {isMonster && adjOpen && (
        <div className="hp-adj" style={{ padding: "0 14px 8px" }}>
          <input
            className="hp-adj-input"
            type="number"
            min="1"
            placeholder="Amount"
            value={adjVal}
            autoFocus
            onChange={(e) => setAdjVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyDamage();
              if (e.key === "Escape") {
                setAdjOpen(false);
                setAdjVal("");
              }
            }}
          />
          <div className="hp-adj-btns">
            <button className="hp-adj-btn hp-adj-dmg" onClick={applyDamage}>
              Damage
            </button>
            <button className="hp-adj-btn hp-adj-heal" onClick={applyHeal}>
              Heal
            </button>
          </div>
        </div>
      )}

      {/* Conditions — always visible, player-style bar */}
      <CondBar conditions={c.conditions} onChange={(next) => onPatch({ conditions: next })} />

      {/* Narrow-screen fallback: floating stat block (docked panel is hidden) */}
      {infoOpen && (
        <StatBlockModal combatant={c} entry={entry} fluff={fluff} member={member} onClose={() => setInfoOpen(false)} />
      )}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

const actionBtn: React.CSSProperties = {
  padding: "9px 16px",
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: "0.1em",
  cursor: "pointer",
};

export function GmEncounterPanel({
  encounter,
  members,
  bestiary,
  fluff,
  selectedId,
  onSelect,
  onChange,
  onEnd,
}: {
  encounter: GmEncounter;
  members: PartyMember[];
  bestiary: BestiaryEntry[];
  fluff?: MonsterFluff[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (next: GmEncounter) => void;
  onEnd: () => void;
}) {
  const [showMonster, setShowMonster] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const memberById = useMemo(() => {
    const map: Record<string, PartyMember> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const groupStyleMap = useMemo(() => {
    const map = new Map<string, { color: string; bg: string; isFirst: boolean } | null>();
    const list = encounter.combatants;
    let i = 0;
    while (i < list.length) {
      const type = list[i].type;
      let j = i;
      while (j < list.length && list[j].type === type) j++;
      if (j - i >= 2) {
        const color = type === "player" ? "#5a8fd4" : "#c05050";
        const bg = type === "player" ? "rgba(90,143,212,0.06)" : "rgba(192,80,80,0.06)";
        for (let k = i; k < j; k++) map.set(list[k].id, { color, bg, isFirst: k === i });
      } else {
        map.set(list[i].id, null);
      }
      i = j;
    }
    return map;
  }, [encounter.combatants]);

  const entryFor = (c: GmCombatant): BestiaryEntry | null =>
    c.creatureName
      ? bestiary.find((b) => b.name === c.creatureName && b.source === c.creatureSource) ?? null
      : null;

  const fluffFor = (c: GmCombatant): MonsterFluff | null =>
    c.creatureName && fluff
      ? (fluff.find((f) => f.name === c.creatureName && f.source === c.creatureSource) ??
         fluff.find((f) => f.name === c.creatureName) ??
         null)
      : null;

  const patch = (p: Partial<GmEncounter>) => onChange({ ...encounter, ...p });
  const addCombatant = (c: GmCombatant) => patch({ combatants: [...encounter.combatants, c] });
  const patchCombatant = (id: string, up: Partial<GmCombatant>) =>
    patch({ combatants: encounter.combatants.map((c) => (c.id === id ? { ...c, ...up } : c)) });
  const removeCombatant = (id: string) =>
    patch({ combatants: encounter.combatants.filter((c) => c.id !== id) });

  const sortInit = (list: GmCombatant[]) =>
    [...list].sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));

  const startEncounter = () =>
    onChange({ ...encounter, combatants: sortInit(encounter.combatants), started: true, round: 1, activeTurnIndex: 0 });

  const nextTurn = () => {
    if (encounter.combatants.length === 0) return;
    const next = encounter.activeTurnIndex + 1;
    if (next >= encounter.combatants.length) patch({ activeTurnIndex: 0, round: encounter.round + 1 });
    else patch({ activeTurnIndex: next });
  };

  const prevTurn = () => {
    if (encounter.combatants.length === 0) return;
    if (encounter.activeTurnIndex > 0) {
      patch({ activeTurnIndex: encounter.activeTurnIndex - 1 });
    } else if (encounter.round > 1) {
      patch({ activeTurnIndex: encounter.combatants.length - 1, round: encounter.round - 1 });
    }
  };

  const endEncounter = () => {
    if (confirm("End this encounter? The initiative order and monster HP will be cleared.")) onEnd();
  };

  const existingCharIds = new Set(encounter.combatants.filter((c) => c.charId).map((c) => c.charId!));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--text-faint)" }}>
          ENCOUNTER TRACKER
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {encounter.started && (
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--gold)" }}>
              Round {encounter.round}
            </span>
          )}
          {encounter.started ? (
            <>
              <button
                onClick={prevTurn}
                disabled={encounter.round === 1 && encounter.activeTurnIndex === 0}
                title="Previous turn"
                style={{
                  ...actionBtn,
                  padding: "9px 12px",
                  opacity: encounter.round === 1 && encounter.activeTurnIndex === 0 ? 0.4 : 1,
                  cursor: encounter.round === 1 && encounter.activeTurnIndex === 0 ? "not-allowed" : "pointer",
                }}
              >
                ◀ PREV
              </button>
              <button onClick={nextTurn} style={{ ...actionBtn, background: "var(--gold-dim)", border: "1px solid var(--gold)", color: "var(--gold-bright)", fontWeight: 600 }}>
                NEXT TURN ▶
              </button>
            </>
          ) : (
            <button
              onClick={startEncounter}
              disabled={encounter.combatants.length === 0}
              style={{
                ...actionBtn,
                background: "var(--gold-dim)",
                border: "1px solid var(--gold)",
                color: "var(--gold-bright)",
                fontWeight: 600,
                opacity: encounter.combatants.length === 0 ? 0.4 : 1,
                cursor: encounter.combatants.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              START ENCOUNTER
            </button>
          )}
        </div>
      </div>

      {/* Initiative spine */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", minHeight: 80 }}>
        {encounter.combatants.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--text-faint)" }}>
            The field is empty. Add monsters and players to begin.
          </div>
        ) : (
          encounter.combatants.map((c, i) => {
            const lm = c.charId ? memberById[c.charId] : undefined;
            const gs = groupStyleMap.get(c.id) ?? null;
            return (
              <CombatantCard
                key={c.id}
                c={c}
                active={encounter.started && i === encounter.activeTurnIndex}
                selected={c.id === selectedId}
                entry={entryFor(c)}
                fluff={fluffFor(c)}
                member={lm}
                liveHp={lm ? { current: lm.hp.current, max: lm.hp.max } : undefined}
                groupColor={gs?.color ?? null}
                groupBg={gs?.bg ?? null}
                isGroupFirst={gs?.isFirst ?? false}
                onSelect={() => onSelect(c.id)}
                onPatch={(up) => patchCombatant(c.id, up)}
                onRemove={() => removeCombatant(c.id)}
              />
            );
          })
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={() => setShowMonster(true)} style={actionBtn}>
          + ADD MONSTER
        </button>
        <button onClick={() => setShowPlayer(true)} style={actionBtn}>
          + ADD PLAYER
        </button>
        {encounter.combatants.length > 1 && (
          <button onClick={() => patch({ combatants: sortInit(encounter.combatants) })} style={actionBtn}>
            ⇅ RE-SORT
          </button>
        )}
        <div style={{ flex: 1 }} />
        {(encounter.started || encounter.combatants.length > 0) && (
          <button onClick={endEncounter} style={{ ...actionBtn, color: "var(--danger)", borderColor: "var(--danger-dim)" }}>
            END ENCOUNTER
          </button>
        )}
      </div>

      {showMonster && (
        <AddMonsterModal onAdd={addCombatant} onClose={() => setShowMonster(false)} />
      )}
      {showPlayer && (
        <AddPlayerMenu members={members} existingCharIds={existingCharIds} onAdd={addCombatant} onClose={() => setShowPlayer(false)} />
      )}
    </div>
  );
}

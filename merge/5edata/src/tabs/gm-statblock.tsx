// GM Toolbox — creature stat block.
// `StatBlock` reproduces the official 5e stat block layout (title, defenses,
// ability table with MOD/SAVE, skills/senses/immunities/languages/CR, then
// Traits / Actions / Bonus Actions / Reactions / Legendary Actions / Spellcasting).
// Used by the docked right panel (wide) and the per-card "i" modal (narrow).

import React, { useState, useEffect } from "react";
import { renderEntries, stripTags } from "../core/tag-renderer";
import { bestiaryType, bestiaryCR, bestiaryAC, crToNum } from "../core/bestiary-util";
import type { BestiaryEntry, MonsterBlock, MonsterSpellcasting, MonsterFluff } from "../core/types";
import type { GmCombatant } from "../core/gm-types";
import { PlayerSheetView } from "./gm-party";
import type { PartyMember } from "./gm-party";

const SIZE_LABEL: Record<string, string> = {
  T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
};
const ALIGN_LABEL: Record<string, string> = {
  L: "Lawful", N: "Neutral", C: "Chaotic", G: "Good", E: "Evil", U: "Unaligned", A: "Any",
};
const mod = (score: number) => Math.floor((score - 10) / 2);
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const pbFromCr = (cr: number) => (cr < 1 ? 2 : 2 + Math.floor((cr - 1) / 4));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function alignmentLabel(a: BestiaryEntry["alignment"]): string {
  if (!a) return "";
  const parts = a.flatMap((x) =>
    typeof x === "string" ? [ALIGN_LABEL[x] ?? x] : (x.alignment ?? []).map((c) => ALIGN_LABEL[c] ?? c),
  );
  return parts.join(" ");
}

function speedLabel(speed: BestiaryEntry["speed"]): string {
  const order = ["walk", "burrow", "climb", "fly", "swim"];
  return Object.entries(speed)
    .filter(([, v]) => v !== false)
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([k, v]) => {
      const n = typeof v === "number" ? v : typeof v === "object" ? v.number : null;
      if (n == null) return null;
      const cond = typeof v === "object" && v.condition ? ` (${stripTags(v.condition)})` : "";
      return k === "walk" ? `${n} ft.${cond}` : `${cap(k)} ${n} ft.${cond}`;
    })
    .filter(Boolean)
    .join(", ");
}

// Flatten 5etools damage/condition lists (strings or nested {immune:[],note}).
function flattenDR(arr: unknown[] | undefined, key: string): string {
  if (!arr?.length) return "";
  const walk = (item: unknown): string => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const inner = (o[key] as unknown[]) ?? [];
      const body = inner.map(walk).join(", ");
      const pre = o.preNote ? `${o.preNote} ` : "";
      const note = o.note ? ` ${o.note}` : "";
      return `${pre}${body}${note}`.trim();
    }
    return "";
  };
  return arr.map(walk).filter(Boolean).join("; ");
}

// ── Small presentational helpers ─────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        fontSize: 17,
        color: "var(--gold)",
        letterSpacing: "0.02em",
        borderBottom: "1px solid var(--gold-dim)",
        margin: "14px 16px 8px",
        paddingBottom: 2,
      }}
    >
      {children}
    </div>
  );
}

function LabeledLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "1px 16px", fontFamily: "var(--sans)", fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
      <span style={{ color: "var(--gold)", fontWeight: 600 }}>{label}</span>{" "}
      {children}
    </div>
  );
}

function NamedBlock({ block }: { block: MonsterBlock }) {
  return (
    <div className="feat-row" style={{ padding: "0 16px" }}>
      <div className="desc" style={{ marginTop: 4 }}>
        {block.name && (
          <span style={{ fontWeight: 700, fontStyle: "italic", color: "var(--text)" }}>{block.name}. </span>
        )}
        {renderEntries(block.entries, { spellAttackBonus: 0 })}
      </div>
    </div>
  );
}

function Spellcasting({ block }: { block: MonsterSpellcasting }) {
  const dailyLabel = (key: string): string => {
    const each = key.endsWith("e");
    const n = parseInt(key, 10);
    return `${n}/Day${each ? " Each" : ""}:`;
  };
  const ordinal = (n: number) =>
    n === 0 ? "Cantrips" : `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || [11, 12, 13].includes(n) ? 0 : n % 10]} Level`;

  return (
    <div className="feat-row" style={{ padding: "0 16px" }}>
      <div className="desc" style={{ marginTop: 4 }}>
        {block.name && (
          <span style={{ fontWeight: 700, fontStyle: "italic", color: "var(--text)" }}>{block.name}. </span>
        )}
        {block.headerEntries && renderEntries(block.headerEntries, { spellAttackBonus: 0 })}
        {block.will && block.will.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{ fontWeight: 600, fontStyle: "italic" }}>At Will: </span>
            {block.will.map((s) => stripTags(s)).join(", ")}
          </div>
        )}
        {block.daily &&
          Object.entries(block.daily).map(([key, spells]) => (
            <div key={key} style={{ marginTop: 4 }}>
              <span style={{ fontWeight: 600, fontStyle: "italic" }}>{dailyLabel(key)} </span>
              {spells.map((s) => stripTags(s)).join(", ")}
            </div>
          ))}
        {block.spells &&
          Object.entries(block.spells)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([lvl, info]) => (
              <div key={lvl} style={{ marginTop: 4 }}>
                <span style={{ fontWeight: 600, fontStyle: "italic" }}>
                  {ordinal(Number(lvl))}
                  {info.slots ? ` (${info.slots} slots)` : Number(lvl) === 0 ? " (at will)" : ""}:{" "}
                </span>
                {(info.spells ?? []).map((s) => stripTags(s)).join(", ")}
              </div>
            ))}
        {block.footerEntries && renderEntries(block.footerEntries, { spellAttackBonus: 0 })}
      </div>
    </div>
  );
}

// ── View toggle ──────────────────────────────────────────────────────────────

type PanelView = "stats" | "lore";

function ViewToggle({
  view,
  hasLore,
  onChange,
}: {
  view: PanelView;
  hasLore: boolean;
  onChange: (v: PanelView) => void;
}) {
  const btn = (v: PanelView, label: string, disabled?: boolean) => {
    const active = view === v;
    return (
      <button
        key={v}
        onClick={() => !disabled && onChange(v)}
        disabled={disabled}
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          padding: "4px 12px",
          border: "none",
          borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
          background: "transparent",
          color: disabled ? "var(--text-faint)" : active ? "var(--gold-bright)" : "var(--text-muted)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: active ? 700 : 400,
          transition: "color 0.15s, border-color 0.15s",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {btn("stats", "STAT BLOCK")}
      {btn("lore", "LORE", !hasLore)}
    </div>
  );
}

// ── Lore view ─────────────────────────────────────────────────────────────────

function LoreView({ fluff, entry }: { fluff: MonsterFluff | null; entry: BestiaryEntry | null }) {
  if (!fluff?.entries?.length) {
    return (
      <div
        style={{
          padding: "32px 20px",
          textAlign: "center",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 15,
          color: "var(--text-faint)",
          lineHeight: 1.6,
        }}
      >
        No lore available for this creature.
      </div>
    );
  }

  const sizeType = entry
    ? [
        entry.size?.map((s) => SIZE_LABEL[s] ?? s).join("/"),
        bestiaryType(entry),
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <div>
      {/* Creature header */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-faint)" }}>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontWeight: 600,
            fontSize: 22,
            color: "var(--gold)",
            lineHeight: 1.1,
          }}
        >
          {fluff.name}
        </div>
        {sizeType && (
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 11,
              color: "var(--text-muted)",
              fontStyle: "italic",
              marginTop: 3,
              letterSpacing: "0.02em",
            }}
          >
            {sizeType}
          </div>
        )}
      </div>

      {/* Lore body */}
      <div
        style={{
          padding: "14px 18px 20px",
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text)",
        }}
        className="lore-body"
      >
        {renderEntries(fluff.entries, { spellAttackBonus: 0 })}
      </div>
    </div>
  );
}

// ── Main stat block ──────────────────────────────────────────────────────────

export function StatBlock({
  combatant,
  entry,
}: {
  combatant: GmCombatant;
  entry: BestiaryEntry | null;
}) {
  if (combatant.type === "player") {
    return (
      <div style={{ padding: "20px 16px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--gold)" }}>
          {combatant.name}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.1em", marginTop: 6 }}>
          PLAYER CHARACTER
        </div>
        <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14, color: "var(--text-muted)", marginTop: 14 }}>
          Open their character sheet for the full stat block.
        </div>
      </div>
    );
  }

  // Title line
  const sizeType = entry
    ? [
        entry.size?.map((s) => SIZE_LABEL[s] ?? s).join("/"),
        bestiaryType(entry) + (typeof entry.type === "object" && entry.type.tags?.length ? ` (${entry.type.tags.join(", ")})` : ""),
        alignmentLabel(entry.alignment),
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const crStr = entry ? bestiaryCR(entry) : combatant.cr ?? "?";
  const crN = crToNum(crStr);
  const pb = pbFromCr(crN);

  // Initiative: explicit number, or dexMod + proficiency*PB; passive = 10 + bonus
  let initLine: string | null = null;
  if (entry) {
    const dexMod = mod(entry.dex);
    let initBonus = dexMod;
    if (typeof entry.initiative === "number") initBonus = entry.initiative;
    else if (entry.initiative && typeof entry.initiative === "object")
      initBonus = dexMod + (entry.initiative.proficiency ?? 0) * pb;
    initLine = `${fmt(initBonus)} (${10 + initBonus})`;
  }

  const abilCol = (stats: ("str" | "dex" | "con" | "int" | "wis" | "cha")[]) =>
    stats.map((ab) => {
      if (!entry) return null;
      const score = entry[ab];
      const m = mod(score);
      const saveStr = entry.save?.[ab];
      const proficient = saveStr != null;
      return (
        <div key={ab} style={{ display: "grid", gridTemplateColumns: "34px 1fr 1fr 1fr", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {ab}
          </span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 15, textAlign: "center" }}>{score}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, textAlign: "center", color: "var(--text-muted)" }}>{fmt(m)}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, textAlign: "center", color: proficient ? "var(--gold-bright)" : "var(--text-faint)", fontWeight: proficient ? 700 : 400 }}>
            {saveStr ?? fmt(m)}
          </span>
        </div>
      );
    });

  const skillLine = entry?.skill
    ? Object.entries(entry.skill).map(([k, v]) => `${cap(k)} ${v}`).join(", ")
    : "";
  const resistStr = flattenDR(entry?.resist, "resist");
  const immuneStr = flattenDR(entry?.immune, "immune");
  const vulnStr = flattenDR(entry?.vulnerable, "vulnerable");
  const condImmStr = flattenDR(entry?.conditionImmune, "conditionImmune");
  const sensesArr = [...(entry?.senses ?? [])];
  if (entry?.passive != null) sensesArr.push(`Passive Perception ${entry.passive}`);

  return (
    <div style={{ paddingBottom: 14 }}>
      {/* Title */}
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontFamily: "var(--serif)", fontVariant: "small-caps", fontWeight: 600, fontSize: 24, color: "var(--gold)", lineHeight: 1.1 }}>
          {combatant.name}
        </div>
        {sizeType && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>
            {sizeType}
          </div>
        )}
      </div>

      {/* Defenses */}
      <div style={{ padding: "10px 16px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 13 }}>
          <span style={{ color: "var(--gold)", fontWeight: 600 }}>AC</span> {entry ? bestiaryAC(entry) : combatant.ac}
          {initLine && (
            <>
              {"   "}
              <span style={{ color: "var(--gold)", fontWeight: 600 }}>Initiative</span> {initLine}
            </>
          )}
        </div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 13 }}>
          <span style={{ color: "var(--gold)", fontWeight: 600 }}>HP</span>{" "}
          {combatant.hpCurrent ?? entry?.hp?.average ?? "?"}/{combatant.hpMax ?? entry?.hp?.average ?? "?"}
          {entry?.hp?.formula && <span style={{ color: "var(--text-faint)" }}> ({entry.hp.formula})</span>}
        </div>
        {entry && speedLabel(entry.speed) && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 13 }}>
            <span style={{ color: "var(--gold)", fontWeight: 600 }}>Speed</span> {speedLabel(entry.speed)}
          </div>
        )}
      </div>

      {!entry ? (
        <div style={{ padding: "8px 16px 4px", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14, color: "var(--text-faint)" }}>
          No detailed stat block available for this creature.
        </div>
      ) : (
        <>
          {/* Ability table */}
          <div
            style={{
              margin: "10px 16px",
              padding: "8px 6px",
              background: "var(--card-2)",
              borderRadius: 6,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px 16px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "34px 1fr 1fr 1fr", gap: 2, fontFamily: "var(--mono)", fontSize: 7, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
              <span /><span style={{ textAlign: "center" }}>SCORE</span><span style={{ textAlign: "center" }}>MOD</span><span style={{ textAlign: "center" }}>SAVE</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "34px 1fr 1fr 1fr", gap: 2, fontFamily: "var(--mono)", fontSize: 7, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
              <span /><span style={{ textAlign: "center" }}>SCORE</span><span style={{ textAlign: "center" }}>MOD</span><span style={{ textAlign: "center" }}>SAVE</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{abilCol(["str", "dex", "con"])}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{abilCol(["int", "wis", "cha"])}</div>
          </div>

          {/* Detail lines */}
          {skillLine && <LabeledLine label="Skills">{skillLine}</LabeledLine>}
          {resistStr && <LabeledLine label="Resistances">{resistStr}</LabeledLine>}
          {immuneStr && <LabeledLine label="Immunities">{immuneStr}</LabeledLine>}
          {vulnStr && <LabeledLine label="Vulnerabilities">{vulnStr}</LabeledLine>}
          {condImmStr && <LabeledLine label="Condition Immunities">{condImmStr}</LabeledLine>}
          {sensesArr.length > 0 && <LabeledLine label="Senses">{sensesArr.join(", ")}</LabeledLine>}
          {entry.languages && entry.languages.length > 0 && (
            <LabeledLine label="Languages">{entry.languages.join(", ")}</LabeledLine>
          )}
          <LabeledLine label="CR">
            {crStr}
            {(() => {
              const crObj = typeof entry.cr === "object" ? entry.cr : null;
              const lair = crObj?.xpLair ? `, or ${crObj.xpLair.toLocaleString()} in lair` : "";
              const xp = crObj?.xp ? `${crObj.xp.toLocaleString()} XP${lair}; ` : "";
              return ` (${xp}PB ${fmt(pb)})`;
            })()}
          </LabeledLine>

          {/* Spellcasting (when displayed as traits, render before Actions) */}
          {entry.spellcasting && entry.spellcasting.length > 0 && (
            <>
              <SectionHeader>Spellcasting</SectionHeader>
              {entry.spellcasting.map((sc, i) => (
                <Spellcasting key={i} block={sc} />
              ))}
            </>
          )}

          {entry.trait && entry.trait.length > 0 && (
            <>
              <SectionHeader>Traits</SectionHeader>
              {entry.trait.map((t, i) => <NamedBlock key={i} block={t} />)}
            </>
          )}
          {entry.action && entry.action.length > 0 && (
            <>
              <SectionHeader>Actions</SectionHeader>
              {entry.action.map((a, i) => <NamedBlock key={i} block={a} />)}
            </>
          )}
          {entry.bonus && entry.bonus.length > 0 && (
            <>
              <SectionHeader>Bonus Actions</SectionHeader>
              {entry.bonus.map((b, i) => <NamedBlock key={i} block={b} />)}
            </>
          )}
          {entry.reaction && entry.reaction.length > 0 && (
            <>
              <SectionHeader>Reactions</SectionHeader>
              {entry.reaction.map((r, i) => <NamedBlock key={i} block={r} />)}
            </>
          )}
          {entry.legendary && entry.legendary.length > 0 && (
            <>
              <SectionHeader>Legendary Actions</SectionHeader>
              <div style={{ padding: "0 16px 4px", fontFamily: "var(--sans)", fontSize: 12, fontStyle: "italic", color: "var(--text-muted)" }}>
                {entry.legendaryHeader
                  ? renderEntries(entry.legendaryHeader, { spellAttackBonus: 0 })
                  : `Legendary Action Uses: ${entry.legendaryActions ?? 3}${
                      entry.legendaryActionsLair ? ` (${entry.legendaryActionsLair} in Lair)` : ""
                    }. Immediately after another creature's turn, this creature can expend a use to take one of the following actions.`}
              </div>
              {entry.legendary.map((l, i) => <NamedBlock key={i} block={l} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Docked right-hand reading pane (wide screens). */
export function StatBlockPanel({
  combatant,
  entry,
  fluff,
  member,
}: {
  combatant: GmCombatant | null;
  entry: BestiaryEntry | null;
  fluff?: MonsterFluff | null;
  member?: PartyMember | null;
}) {
  const [view, setView] = useState<PanelView>("stats");
  const isPlayer = combatant?.type === "player";

  useEffect(() => { setView("stats"); }, [combatant?.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {!combatant || isPlayer ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--text-faint)" }}>
            {isPlayer ? "PLAYER" : "STAT BLOCK"}
          </div>
        ) : (
          <ViewToggle view={view} hasLore={!!(fluff?.entries?.length)} onChange={setView} />
        )}
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {!combatant ? (
          <div style={{ padding: "40px 18px", textAlign: "center", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 16, color: "var(--text-faint)" }}>
            Select a creature in the tracker to read its stat block.
          </div>
        ) : isPlayer && member ? (
          <>
            <div style={{ padding: "14px 16px 0", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, color: "var(--gold)" }}>
              {member.name || "Unnamed"}
            </div>
            <PlayerSheetView m={member} />
          </>
        ) : view === "lore" ? (
          <LoreView fluff={fluff ?? null} entry={entry} />
        ) : (
          <StatBlock combatant={combatant} entry={entry} />
        )}
      </div>
    </div>
  );
}

/** Floating modal — fallback for narrow screens where the docked panel is hidden. */
export function StatBlockModal({
  combatant,
  entry,
  fluff,
  member,
  onClose,
}: {
  combatant: GmCombatant;
  entry: BestiaryEntry | null;
  fluff?: MonsterFluff | null;
  member?: PartyMember | null;
  onClose: () => void;
}) {
  const [view, setView] = useState<PanelView>("stats");
  const isPlayer = combatant.type === "player" && member;
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 480, maxHeight: "85vh" }}>
        <div className="modal-head">
          {isPlayer ? (
            <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>
              {member!.name || "Player"}
            </span>
          ) : (
            <ViewToggle view={view} hasLore={!!(fluff?.entries?.length)} onChange={setView} />
          )}
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div style={{ overflowY: "auto" }}>
          {isPlayer ? (
            <PlayerSheetView m={member!} />
          ) : view === "lore" ? (
            <LoreView fluff={fluff ?? null} entry={entry} />
          ) : (
            <StatBlock combatant={combatant} entry={entry} />
          )}
        </div>
      </div>
    </div>
  );
}

// GM Toolbox — Party Watch panel.
// Dumb presentational component: receives a normalized PartyMember[] and
// renders one card per character. The view layer owns data sourcing so that
// a Firebase live listener can be merged in later without touching this file.

import React from "react";
import type { PlayerSheetSnapshot } from "../core/party-snapshot";

export interface PartyResource {
  label: string; // e.g. "Slots L1", "Rage", "Ki"
  current: number;
  max: number;
}

export interface PartyMember {
  id: string;
  name: string;
  classLabel: string;
  totalLevel: number;
  hp: { current: number; max: number; temp: number };
  conditions: string[];
  deathSaves: { successes: number; failures: number };
  resources: PartyResource[];
  live: boolean; // true = streaming from a session, false = local roster
  sheet?: PlayerSheetSnapshot; // fuller snapshot for the GM detail view
}

function hpColor(pct: number): string {
  if (pct <= 0) return "var(--danger-dim)";
  if (pct < 0.34) return "var(--danger)";
  if (pct < 0.67) return "var(--gold)";
  return "var(--vitality)";
}

function HpBar({ current, max, temp }: PartyMember["hp"]) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const down = current <= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div
        style={{
          position: "relative",
          height: 14,
          borderRadius: 3,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct * 100}%`,
            background: hpColor(pct),
            transition: "width 0.35s ease, background 0.35s ease",
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: down ? "var(--danger)" : "var(--text-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {down ? "DOWNED" : `${current} / ${max}`}
        {temp > 0 && (
          <span style={{ color: "var(--vitality)" }}> +{temp} temp</span>
        )}
      </div>
    </div>
  );
}

function DeathSaves({ successes, failures }: PartyMember["deathSaves"]) {
  const dot = (filled: boolean, color: string) => (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        border: `1px solid ${color}`,
        background: filled ? color : "transparent",
        display: "inline-block",
      }}
    />
  );
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
        DEATH
      </span>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <React.Fragment key={`s${i}`}>{dot(i < successes, "var(--vitality)")}</React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <React.Fragment key={`f${i}`}>{dot(i < failures, "var(--danger)")}</React.Fragment>
        ))}
      </div>
    </div>
  );
}

function PartyCard({ m, onOpen }: { m: PartyMember; onOpen?: () => void }) {
  const down = m.hp.current <= 0;
  const clickable = !!m.sheet && !!onOpen;
  return (
    <div
      onClick={clickable ? onOpen : undefined}
      title={clickable ? "View character sheet" : undefined}
      style={{
        background: "var(--card)",
        border: `1px solid ${down ? "var(--danger-dim)" : "var(--border)"}`,
        borderRadius: 8,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 19, color: "var(--gold)", fontStyle: "italic", lineHeight: 1.1 }}>
          {m.name || "Unnamed"}
        </div>
        <div
          title={m.live ? "Live from session" : "From local roster"}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 8,
            letterSpacing: "0.1em",
            color: m.live ? "var(--vitality)" : "var(--text-faint)",
            whiteSpace: "nowrap",
          }}
        >
          {m.live ? "● LIVE" : "○ LOCAL"}
        </div>
      </div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text-muted)", marginTop: -6 }}>
        {m.classLabel || "No class"} · Lv {m.totalLevel}
      </div>

      <HpBar {...m.hp} />

      {m.conditions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {m.conditions.map((cond) => (
            <span
              key={cond}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.04em",
                padding: "2px 7px",
                borderRadius: 10,
                color: "var(--gold-bright)",
                background: "var(--gold-shadow)",
                border: "1px solid var(--gold-dim)",
              }}
            >
              {cond}
            </span>
          ))}
        </div>
      )}

      {m.resources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {m.resources.map((r) => (
            <span
              key={r.label}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text-dim)",
                padding: "1px 0",
              }}
            >
              <span style={{ color: "var(--text-faint)" }}>{r.label} </span>
              {r.current}/{r.max}
            </span>
          ))}
        </div>
      )}

      {down && <DeathSaves {...m.deathSaves} />}
    </div>
  );
}

const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const ABIL_ORDER = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

// GM's "view player sheet" body — the at-a-glance fields that matter while
// running. Shared by the party-watch modal and the docked stat-block panel.
export function PlayerSheetView({ m }: { m: PartyMember }) {
  const s = m.sheet;
  return (
    <div style={{ overflowY: "auto", padding: "12px 16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--text-muted)", marginTop: -4 }}>
        {m.classLabel || "No class"} · Lv {m.totalLevel}
      </div>

      {/* HP */}
      <div>
        <HpBar {...m.hp} />
        {m.hp.current <= 0 && <div style={{ marginTop: 6 }}><DeathSaves {...m.deathSaves} /></div>}
      </div>

      {!s ? (
        <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14, color: "var(--text-faint)" }}>
          Detailed sheet not available — the player may be on an older client.
        </div>
      ) : (
        <>
          {/* Combat line */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="isb-tag isb-gold">AC {s.ac}</span>
            <span className="isb-tag">Init {fmtMod(s.initiative)}</span>
            <span className="isb-tag">Speed {s.speedFt}ft</span>
            <span className="isb-tag">Pass. Perc {s.passivePerception}</span>
            <span className="isb-tag">Pass. Insight {s.passiveInsight}</span>
            <span className="isb-tag">Hit Dice {s.hitDice}</span>
          </div>

              {/* Attributes */}
              <Section label="Attributes">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                  {ABIL_ORDER.map((ab) => {
                    const a = s.abilities[ab];
                    if (!a) return null;
                    return (
                      <div key={ab} style={{ textAlign: "center", background: "var(--card-2)", borderRadius: 5, padding: "5px 2px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.08em" }}>{ab}</div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--gold)", lineHeight: 1.2 }}>{a.score}</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)" }}>{fmtMod(a.mod)}</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: a.prof ? "var(--gold-bright)" : "var(--text-faint)" }}>
                          save {fmtMod(a.save)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Money */}
              <Section label="Money">
                <div style={{ display: "flex", gap: 12, fontFamily: "var(--mono)", fontSize: 13 }}>
                  {(["pp", "gp", "sp", "cp"] as const).map((c) => (
                    <span key={c}>
                      <span style={{ color: "var(--gold)" }}>{s.currency[c]}</span>
                      <span style={{ color: "var(--text-faint)", fontSize: 10 }}> {c}</span>
                    </span>
                  ))}
                </div>
              </Section>

              {/* Spell slots & resources */}
              {(s.slots.length > 0 || s.pactSlots || m.resources.length > 0) && (
                <Section label="Slots & Resources">
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {s.slots.map((sl) => (
                      <span key={sl.level}>
                        <span style={{ color: "var(--text-faint)" }}>L{sl.level} </span>
                        {sl.current}/{sl.max}
                      </span>
                    ))}
                    {s.pactSlots && (
                      <span>
                        <span style={{ color: "var(--text-faint)" }}>Pact L{s.pactSlots.level} </span>
                        {s.pactSlots.current}/{s.pactSlots.max}
                      </span>
                    )}
                    {m.resources
                      .filter((r) => !/^L\d+$/.test(r.label) && r.label !== "Pact")
                      .map((r) => (
                        <span key={r.label}>
                          <span style={{ color: "var(--text-faint)" }}>{r.label} </span>
                          {r.current}/{r.max}
                        </span>
                      ))}
                  </div>
                </Section>
              )}

              {/* Skills */}
              <Section label="Skills">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 14px" }}>
                  {s.skills.map((sk) => (
                    <div
                      key={sk.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "var(--sans)",
                        fontSize: 12,
                        color: sk.prof === "none" ? "var(--text-muted)" : "var(--text)",
                      }}
                    >
                      <span>
                        {sk.prof === "expert" ? "◆ " : sk.prof === "prof" ? "● " : "○ "}
                        {sk.name}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", color: sk.prof === "none" ? "var(--text-faint)" : "var(--gold)" }}>
                        {fmtMod(sk.mod)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              {m.conditions.length > 0 && (
                <Section label="Conditions">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {m.conditions.map((c) => (
                      <span key={c} style={{ fontFamily: "var(--mono)", fontSize: 9, padding: "2px 7px", borderRadius: 10, color: "var(--gold-bright)", background: "var(--gold-shadow)", border: "1px solid var(--gold-dim)" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
        </>
      )}
    </div>
  );
}

function PlayerSheetModal({ m, onClose }: { m: PartyMember; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 460, maxHeight: "85vh" }}>
        <div className="modal-head">
          <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--gold)" }}>
            {m.name || "Unnamed"}
          </span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <PlayerSheetView m={m} />
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--gold-dim)", textTransform: "uppercase" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function GmPartyPanel({ members }: { members: PartyMember[] }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [viewing, setViewing] = React.useState<PartyMember | null>(null);

  // Keep the open sheet fresh as live data updates.
  const viewingLive = viewing ? members.find((m) => m.id === viewing.id) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--text-faint)" }}>
          PARTY WATCH
          {members.length > 0 && (
            <span style={{ color: "var(--text-dim)" }}> · {members.length}</span>
          )}
        </span>
        {members.length > 0 && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Show full cards" : "Collapse to names"}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 5,
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {collapsed ? "▸ EXPAND" : "▾ COLLAPSE"}
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 16,
            color: "var(--text-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          No players connected. Start a session and share the code — players who join appear here.
        </div>
      ) : collapsed ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
          }}
        >
          {members.map((m) => {
            const down = m.hp.current <= 0;
            const clickable = !!m.sheet;
            return (
              <div
                key={m.id}
                onClick={clickable ? () => setViewing(m) : undefined}
                title={clickable ? "View character sheet" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", cursor: clickable ? "pointer" : "default" }}
              >
                <span style={{ color: m.live ? "var(--vitality)" : "var(--text-faint)", fontSize: 9 }}>
                  {m.live ? "●" : "○"}
                </span>
                <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 15, color: "var(--gold)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name || "Unnamed"}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: down ? "var(--danger)" : "var(--text-muted)" }}>
                  {down ? "DOWN" : `${m.hp.current}/${m.hp.max}`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        members.map((m) => <PartyCard key={m.id} m={m} onOpen={() => setViewing(m)} />)
      )}

      {viewingLive && <PlayerSheetModal m={viewingLive} onClose={() => setViewing(null)} />}
    </div>
  );
}

// Center vitals: Vitality card (current/max/temp + damage-heal input),
// Wounds pip tracker, Ambition pool + die, rest buttons.

import { useState } from "react";
import type { ComputedCharacter, StoredCharacter } from "../core/types.ts";
import { Icon } from "@ui/primitives.tsx";
import { REGISTRY } from "../core/data-registry.ts";
import { applyRest, type RestKind } from "../core/rest.ts";

interface VitalsProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

export function VitalityCard({ c, setStored }: VitalsProps) {
  const [amount, setAmount] = useState("");
  const [tempEdit, setTempEdit] = useState(false);
  const [tempVal, setTempVal] = useState("");

  const changeVitality = (delta: number) =>
    setStored((s) => {
      let d = delta;
      let temp = s.pools.temp_vitality;
      if (d < 0 && temp > 0) {
        const absorbed = Math.min(temp, -d);
        temp -= absorbed;
        d += absorbed;
      }
      return {
        ...s,
        pools: {
          ...s.pools,
          temp_vitality: temp,
          vitality: Math.max(0, Math.min(c.vitality.max, s.pools.vitality + d)),
        },
      };
    });

  const applyAmount = (sign: 1 | -1) => {
    const n = parseInt(amount, 10);
    if (!Number.isNaN(n) && n > 0) changeVitality(sign * n);
    setAmount("");
  };

  const pct = c.vitality.max > 0 ? Math.round((c.vitality.current / c.vitality.max) * 100) : 0;

  return (
    <div className="hp-card">
      <div className="hp-head">
        <span className="heart"><Icon kind="heart" size={12} /></span> Vitality
      </div>
      <div className="hp-body">
        <div className="hp-main">
          <div className="hp-grid">
            <div className="hp-cell">
              <div className="lbl">Current</div>
              <div className="v">
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => changeVitality(-1)}>−</span>
                <span>{c.vitality.current}</span>
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => changeVitality(1)}>+</span>
              </div>
            </div>
            <div className="hp-slash">/</div>
            <div className="hp-cell">
              <div className="lbl">Max</div>
              <div className="v"><span>{c.vitality.max}</span></div>
            </div>
            <div className="hp-cell">
              <div className="lbl">Temp</div>
              <div className="v">
                {tempEdit ? (
                  <input
                    className="hp-temp-input"
                    type="number"
                    min="0"
                    autoFocus
                    value={tempVal}
                    onChange={(e) => setTempVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    onBlur={() => {
                      const n = parseInt(tempVal, 10);
                      setStored((s) => ({ ...s, pools: { ...s.pools, temp_vitality: Number.isNaN(n) ? 0 : Math.max(0, n) } }));
                      setTempEdit(false);
                    }}
                  />
                ) : (
                  <span className="hp-temp-val" onClick={() => { setTempVal(String(c.vitality.temp)); setTempEdit(true); }} title="Click to set temp vitality">
                    {c.vitality.temp}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="hp-bar-wrap">
            <div className="hp-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="hp-meta">
            <input
              className="hp-temp-input"
              style={{ width: 54 }}
              type="number"
              min="0"
              placeholder="amt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={() => applyAmount(-1)}>
              <span className="name">Damage</span>
            </button>
            <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={() => applyAmount(1)}>
              <span className="name">Heal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WoundsAmbitionRest({ c, stored, setStored }: VitalsProps) {
  const setWounds = (n: number) =>
    setStored((s) => ({ ...s, pools: { ...s.pools, wounds: Math.max(0, Math.min(c.wounds.max, n)) } }));
  const setAmbition = (n: number) =>
    setStored((s) => ({ ...s, pools: { ...s.pools, ambition: Math.max(0, Math.min(c.ambition.max, n)) } }));

  const rest = (kind: RestKind) => setStored((s) => applyRest(s, c, REGISTRY, kind));

  const dead = c.wounds.current >= c.wounds.max;

  return (
    <div className="hp-card" style={dead ? { borderColor: "var(--danger)" } : undefined}>
      <div className="hp-head">
        <span className="heart"><Icon kind="skull" size={12} /></span> Wounds
        {dead && <span style={{ color: "var(--danger)", marginLeft: 8 }}>MAX WOUNDS — DEAD</span>}
      </div>
      <div style={{ display: "flex", gap: 4, padding: "6px 12px", flexWrap: "wrap" }}>
        {Array.from({ length: c.wounds.max }, (_, i) => (
          <span
            key={i}
            className={`slot-pip${i < c.wounds.current ? "" : " used"}`}
            style={{ cursor: "pointer", ...(i < c.wounds.current ? { background: "var(--danger)", borderColor: "var(--danger)" } : {}) }}
            title={`Wound ${i + 1} of ${c.wounds.max}`}
            onClick={() => setWounds(i < c.wounds.current ? i : i + 1)}
          />
        ))}
      </div>

      <div className="hp-head" style={{ marginTop: 6 }}>
        <span className="heart"><Icon kind="dice" size={12} /></span> Ambition
        <span style={{ marginLeft: "auto", fontFamily: "var(--serif)", color: "var(--gold)" }}>{c.ambition.die}</span>
      </div>
      <div className="hp-grid" style={{ padding: "0 12px 8px" }}>
        <div className="hp-cell">
          <div className="lbl">Pool</div>
          <div className="v">
            <span className="pm" style={{ cursor: "pointer" }} onClick={() => setAmbition(c.ambition.current - 1)}>−</span>
            <span>{c.ambition.current}</span>
            <span className="pm" style={{ cursor: "pointer" }} onClick={() => setAmbition(c.ambition.current + 1)}>+</span>
          </div>
        </div>
        <div className="hp-slash">/</div>
        <div className="hp-cell">
          <div className="lbl">Max</div>
          <div className="v"><span>{c.ambition.max}</span></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "0 12px 12px", flexWrap: "wrap" }}>
        <button className="rest-btn" onClick={() => rest("respite")} title="Restores Will ambition (min 3); spend hit dice equivalents">
          <span className="name">Respite</span>
          <span className="sub">{stored.play.respites_used} used</span>
        </button>
        <button className="rest-btn" onClick={() => rest("long_rest")} title="Full vitality, Will×2 ambition (min 8), resets respites">
          <span className="name">Long Rest</span>
        </button>
        <button className="rest-btn" onClick={() => rest("daily_preparation")} title="Reset daily modes and daily-preparation uses">
          <span className="name">Daily Prep</span>
        </button>
      </div>
    </div>
  );
}

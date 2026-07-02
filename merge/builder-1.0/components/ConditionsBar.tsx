"use client";

import { useState, useEffect, useRef } from "react";
import { CONDITIONS } from "@/conditions";
import type { Character } from "@/lib/characterTypes";

const COND_CATEGORY: Record<string, string> = {
  Bleeding: "damage", Burning: "damage",
  Poisoned: "poison",
  Blinded: "sense", Deafened: "sense",
  Charmed: "mind", Compelled: "mind", Dominated: "mind", Frightened: "mind", Enraged: "mind",
  Restrained: "control", Immobilized: "control", Stunned: "control", Inert: "control", Unconscious: "control", Prone: "control",
  Dazed: "hinder", Weakened: "hinder", Sapped: "hinder", Crippled: "hinder", Maimed: "hinder", Silenced: "hinder",
};
const COND_COLOR: Record<string, string> = {
  damage: "#e0623d", poison: "#5fae6b", sense: "#5f94d6",
  mind: "#d877ab", control: "#9d80dd", hinder: "#cf9a4e",
};
const STACKING = new Set(["Bleeding", "Burning", "Dazed", "Poisoned", "Weakened"]);

function condColor(code: string) {
  return COND_COLOR[COND_CATEGORY[code] ?? "hinder"] ?? "#cf9a4e";
}

function condInitial(code: string) {
  return code.slice(0, 2).toUpperCase();
}

interface ConditionsBarProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
}

export default function ConditionsBar({ c, persist }: ConditionsBarProps) {
  const [popOpen, setPopOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const activeConds: Record<string, number> = (c.activeConditions as Record<string, number>) ?? {};

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setPopOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function setCondition(code: string, val: number) {
    persist({ activeConditions: { ...activeConds, [code]: Math.max(0, val) } });
  }

  function removeCondition(code: string) {
    const next = { ...activeConds };
    delete next[code];
    persist({ activeConditions: next });
  }

  const activeKeys = Object.entries(activeConds)
    .filter(([, v]) => v > 0)
    .map(([k]) => k);

  return (
    <div ref={rowRef} className="poa-cbar">
      <div className="poa-cbar-label">
        Conditions
        <span className={`poa-cbar-count${activeKeys.length === 0 ? " zero" : ""}`}>
          {activeKeys.length}
        </span>
      </div>

      <div className="poa-cbar-chips">
        {activeKeys.length === 0 ? (
          <div className="poa-cbar-empty">
            <span className="poa-cbar-pulse" />
            No active conditions
          </div>
        ) : (
          activeKeys.map((code) => {
            const count = activeConds[code] ?? 0;
            const isStack = STACKING.has(code);
            const color = condColor(code);
            const def = CONDITIONS[code as keyof typeof CONDITIONS];
            return (
              <div
                key={code}
                className="poa-cb-chip"
                style={{ "--c": color } as React.CSSProperties}
              >
                <span className="poa-cb-disc">{condInitial(code)}</span>
                <span className="poa-cb-name">{code}</span>
                {isStack && (
                  <>
                    <button
                      className="poa-cb-step"
                      onClick={(e) => { e.stopPropagation(); setCondition(code, count - 1); }}
                    >−</button>
                    <span className="poa-cb-count">{count}</span>
                    <button
                      className="poa-cb-step"
                      onClick={(e) => { e.stopPropagation(); setCondition(code, count + 1); }}
                    >+</button>
                  </>
                )}
                <button
                  className="poa-cb-x"
                  onClick={(e) => { e.stopPropagation(); removeCondition(code); }}
                >×</button>

                {/* Hover tooltip */}
                {def && (
                  <div className="poa-cb-tip">
                    <div className="poa-cb-tip-name">{code}</div>
                    <div className="poa-cb-tip-eff">{def.tip}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button
        className={`poa-cb-add${popOpen ? " open" : ""}`}
        onClick={() => setPopOpen((p) => !p)}
      >
        <span className="poa-cb-add-plus">+</span> Add
      </button>

      {popOpen && (
        <div className="poa-cb-pop">
          <div className="poa-cb-pop-head">
            <span>Conditions</span>
            <span>click to toggle</span>
          </div>
          <div className="poa-cb-pop-grid">
            {(Object.entries(CONDITIONS) as [string, { stack: boolean; tip: string }][]).map(
              ([code, def]) => {
                const active = (activeConds[code] ?? 0) > 0;
                const color = condColor(code);
                return (
                  <button
                    key={code}
                    className={`poa-cb-opt${active ? " on" : ""}`}
                    style={{ "--c": color } as React.CSSProperties}
                    title={def.tip}
                    onClick={() => {
                      if (active) removeCondition(code);
                      else setCondition(code, 1);
                    }}
                  >
                    <span className="poa-cb-odisc">{condInitial(code)}</span>
                    <span className="poa-cb-oname">{code}</span>
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}

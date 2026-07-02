// Conditions bar for PoA: chips for active conditions (stack counts on
// stacking conditions), hover tooltips with rules text, and an add-popover
// grid of the full catalog. Reuses the ported cb-* styles.

import { useEffect, useRef, useState } from "react";
import type { ConditionDef } from "../core/types.ts";

interface ConditionsBarProps {
  conditions: Record<string, number>; // id → stack count
  catalog: ConditionDef[];
  onChange: (next: Record<string, number>) => void;
}

const CONDITION_COLOR: Record<string, string> = {
  Bleeding: "#c65b4e",
  Burning: "#d98a3d",
  Poisoned: "#7fae5f",
  Weakened: "#a08bc9",
  Dazed: "#c9b45f",
};

export function ConditionsBar({ conditions, catalog, onChange }: ConditionsBarProps) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const active = catalog.filter((c) => (conditions[c.id] ?? 0) > 0);
  const set = (id: string, count: number) => {
    const next = { ...conditions };
    if (count <= 0) delete next[id];
    else next[id] = count;
    onChange(next);
  };

  return (
    <div className="cb-row">
      <div className="cb-active-wrap">
        {active.length === 0 && (
          <div className="cb-empty">
            <span className="cb-pulse" />
            <span>NO ACTIVE CONDITIONS</span>
          </div>
        )}
        {active.map((c) => {
          const count = conditions[c.id];
          const color = CONDITION_COLOR[c.name];
          return (
            <div
              key={c.id}
              className="cb-chip"
              style={color ? ({ "--c": color } as React.CSSProperties) : undefined}
              onClick={() => (c.stacking ? set(c.id, count + 1) : undefined)}
              title={c.stacking ? "Click to add a stack" : undefined}
            >
              <span className="cb-disc">{c.stacking ? count : c.id[0]}</span>
              <span>{c.name}</span>
              {c.stacking && count > 1 && <span className="cb-count">×{count}</span>}
              <span
                className="cb-x"
                onClick={(e) => {
                  e.stopPropagation();
                  set(c.id, c.stacking ? count - 1 : 0);
                }}
                title={c.stacking && count > 1 ? "Remove one stack" : "Remove"}
              >
                ✕
              </span>
              <span className="cb-tip">
                <span className="cb-tip-name">{c.name}{c.stacking ? ` ×${count}` : ""}</span>
                <span className="cb-tip-eff">{c.rules}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative" }} ref={popRef}>
        <button className={`cb-add${open ? " open" : ""}`} onClick={() => setOpen((v) => !v)}>
          <span className="cb-add-plus">+</span> CONDITION
        </button>
        {open && (
          <div className="cb-pop" style={{ right: 0 }}>
            <div className="cb-pop-head">
              <span>CONDITIONS</span>
              <span>{active.length} active</span>
            </div>
            <div className="cb-pop-grid">
              {catalog.map((c) => {
                const on = (conditions[c.id] ?? 0) > 0;
                const color = CONDITION_COLOR[c.name];
                return (
                  <button
                    key={c.id}
                    className={`cb-opt${on ? " on" : ""}`}
                    style={color ? ({ "--c": color } as React.CSSProperties) : undefined}
                    title={c.rules}
                    onClick={() => set(c.id, on ? 0 : 1)}
                  >
                    <span className="cb-odisc">{c.id[0]}</span>
                    <span className="cb-oname">{c.name}{c.stacking ? " ⁺" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

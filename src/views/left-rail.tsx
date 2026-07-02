// Left rail: attributes, defenses (with breakdown tooltips), proficiencies,
// profession resources with steppers.

import type { ComputedCharacter, DefenseKey, StoredCharacter } from "../core/types.ts";
import { ATTRIBUTES } from "../core/types.ts";

interface LeftRailProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

const ATTR_LABEL: Record<string, string> = {
  brawn: "BRW", finesse: "FIN", mind: "MND", will: "WIL",
};
const DEFENSES: DefenseKey[] = ["Armor", "Fortitude", "Mental", "Will Defense"];

export function LeftRail({ c, stored, setStored }: LeftRailProps) {
  const setResource = (id: string, value: number, max: number) =>
    setStored((s) => ({
      ...s,
      pools: { ...s.pools, resources: { ...s.pools.resources, [id]: Math.max(0, Math.min(max, value)) } },
    }));

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Attributes</div>
        </div>
        <div className="ability-unified-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {ATTRIBUTES.map((a) => (
            <div className="ability-cell" key={a}>
              <div className="ac-abbr">{ATTR_LABEL[a]}</div>
              <div className="ac-mod">{c.attributes[a]}</div>
              <div className="ac-score-row">
                <span className="ac-score-lbl">{a}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Defenses</div>
        </div>
        <div className="kv-list">
          {DEFENSES.map((d) => (
            <div className="kv" key={d} title={c.defenseBreakdown[d].join("\n")}>
              <span className="k">{d}</span>
              <span className="v" style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--gold)" }}>
                {c.defenses[d]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Proficiencies</div>
        </div>
        <div className="lang-block">
          <div className="l">Armaments</div>
          <div className="v">{c.proficiencies.armaments.join(", ") || "—"}</div>
        </div>
        <div className="lang-block">
          <div className="l">Protection</div>
          <div className="v">{c.proficiencies.protection.join(", ") || "—"}</div>
        </div>
        {c.proficiencies.tools.length > 0 && (
          <div className="lang-block">
            <div className="l">Tools</div>
            <div className="v">{c.proficiencies.tools.join(", ")}</div>
          </div>
        )}
      </div>

      {c.resources.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Resources</div>
          </div>
          {c.resources.map((r) => (
            <div className="kv" key={r.def.id} title={r.def.description ?? ""}>
              <span className="k">{r.def.name}</span>
              <span className="v" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="pm" style={{ cursor: "pointer" }}
                  onClick={() => setResource(r.def.id, r.current - 1, r.max)}>−</span>
                <span style={{ fontFamily: "var(--serif)", fontSize: 15, color: "var(--gold)" }}>
                  {r.current}/{r.max}
                </span>
                <span className="pm" style={{ cursor: "pointer" }}
                  onClick={() => setResource(r.def.id, r.current + 1, r.max)}>+</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {stored.states.active.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Active States</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 2px" }}>
            {stored.states.active.map((st) => (
              <span key={st} className="tag" style={{ borderColor: "var(--gold-dim)", color: "var(--gold)" }}>
                {st.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

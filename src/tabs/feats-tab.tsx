// Feats tab: cards grouped by source, with choice pickers, state toggles,
// and limited-use counters.

import type { Boon, ComputedCharacter, Feat, StoredCharacter } from "../core/types.ts";
import { Pill } from "@ui/primitives.tsx";

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
  const owners = [...new Set(c.featCards.map((f) => f.owner))];

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
    <>
      {owners.map((owner) => (
        <div className="list-card" key={owner}>
          <div className="card-header">
            <div className="card-title">{owner}</div>
          </div>
          {c.featCards.filter((f) => f.owner === owner).map(({ feat, starting, activeBoons }) => {
            const uses = usesRemaining(feat, stored);
            return (
              <div className="feat-row" key={feat.id}>
                <div className="row-1">
                  <span className="name">{feat.name}</span>
                  <span className="src">
                    {starting ? "starting" : `tier ${feat.tier}`}
                    {feat.slot_type ? ` · ${feat.slot_type}` : ""}
                    {feat.trait ? ` · ${feat.trait}` : ""}
                  </span>
                  {uses !== null && feat.uses && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", fontFamily: "var(--mono)", fontSize: 11 }}>
                      <span className="pm" style={{ cursor: "pointer" }} onClick={() => spendUse(feat, -1)}>−</span>
                      {uses}/{feat.uses.count} ({feat.uses.recharge.replace(/_/g, " ")})
                      <span className="pm" style={{ cursor: "pointer" }} onClick={() => spendUse(feat, 1)}>+</span>
                    </span>
                  )}
                </div>
                <div className="desc">{feat.description}</div>
                <BoonControls boons={activeBoons} stored={stored} setChoice={setChoice} toggleState={toggleState} />
              </div>
            );
          })}
        </div>
      ))}
    </>
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
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>{controls}</div>;
}

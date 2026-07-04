// Spells tab: reservoir tracker, prepared/known lists with cast buttons
// (cost = tier + spell_cost_modifier), cantrips, amps shown inline.

import { useState } from "react";
import type { ComputedCharacter, Spell, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { Markdown, PipTracker } from "@ui/primitives.tsx";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

export function SpellsTab({ c, stored, setStored }: TabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sc = c.spellcasting;

  if (!sc) {
    return (
      <div className="list-card">
        <div className="feat-row"><div className="desc">This character has no spellcasting.</div></div>
      </div>
    );
  }

  const costMod = c.activeBoons
    .filter(({ boon }) => boon.type === "spell_cost_modifier")
    .reduce((s, { boon }) => s + (typeof boon.amount === "number" ? boon.amount : 0), 0);

  const castCost = (sp: Spell) => (sp.is_cantrip ? 0 : Math.max(0, sp.cost + costMod));

  const setReservoir = (n: number) =>
    setStored((s) => ({ ...s, pools: { ...s.pools, reservoir: Math.max(0, Math.min(sc.reservoirMax, n)) } }));

  const cast = (sp: Spell) => setReservoir(stored.pools.reservoir - castCost(sp));

  const togglePrepared = (id: string) =>
    setStored((s) => ({
      ...s,
      build: {
        ...s.build,
        prepared_spell_ids: s.build.prepared_spell_ids.includes(id)
          ? s.build.prepared_spell_ids.filter((x) => x !== id)
          : [...s.build.prepared_spell_ids, id],
      },
    }));

  const spellRow = (sp: Spell, kind: "cantrip" | "spell") => {
    const prepared = stored.build.prepared_spell_ids.includes(sp.id);
    const cost = castCost(sp);
    const open = expanded === sp.id;
    return (
      <div className="feat-row" key={sp.id}>
        <div className="row-1" style={{ cursor: "pointer" }} onClick={() => setExpanded(open ? null : sp.id)}>
          <span className="name">{sp.name}</span>
          <span className="src">
            {sp.is_cantrip ? "cantrip" : `tier ${sp.tier}`}
            {sp.school ? ` · ${sp.school}` : ""}
            {sp.range ? ` · ${sp.range}` : ""}
            {sp.duration ? ` · ${sp.duration}` : ""}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {kind === "spell" && (
              <button
                className="rest-btn"
                style={{ padding: "1px 8px" }}
                title={prepared ? "Prepared — click to unprepare" : "Click to prepare"}
                onClick={(e) => { e.stopPropagation(); togglePrepared(sp.id); }}
              >
                <span className="name" style={prepared ? { color: "var(--gold)" } : undefined}>
                  {prepared ? "PREPARED" : "prepare"}
                </span>
              </button>
            )}
            <button
              className="rest-btn"
              style={{ padding: "1px 8px" }}
              disabled={stored.pools.reservoir < cost}
              onClick={(e) => { e.stopPropagation(); cast(sp); }}
              title={`Spend ${cost} from reservoir`}
            >
              <span className="name">CAST {cost > 0 ? `(${cost})` : "(free)"}</span>
            </button>
          </span>
        </div>
        {open && (
          <div className="desc">
            <Markdown text={sp.description} />
            {sp.amps.length > 0 && (
              <ul style={{ marginTop: 6 }}>
                {sp.amps.map((a, i) => <li key={i}><b>Amp {a.cost}:</b> {a.effect}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  const known = stored.build.known_spell_ids.map((id) => REGISTRY.spells.get(id)).filter((x): x is Spell => !!x);
  const cantrips = stored.build.known_cantrip_ids.map((id) => REGISTRY.spells.get(id)).filter((x): x is Spell => !!x);

  return (
    <>
      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Reservoir</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>
            DC <span style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--gold)" }}>{sc.spellDC}</span>
            {" · "}spell tier {sc.spellcastingTier}
            {" · "}mod {sc.modifier} {sc.modifierValue}
            {costMod !== 0 && ` · cost ${costMod > 0 ? "+" : ""}${costMod}`}
          </div>
        </div>
        <div className="hp-grid" style={{ padding: "4px 8px 10px" }}>
          <div className="hp-cell">
            <div className="lbl">Current</div>
            <div className="v">
              <PipTracker current={stored.pools.reservoir} max={sc.reservoirMax} onChange={setReservoir} />
            </div>
          </div>
          <div className="hp-cell">
            <div className="lbl">Prepared</div>
            <div className="v"><span>{stored.build.prepared_spell_ids.length}/{sc.preparedAllowance}</span></div>
          </div>
          <div className="hp-cell">
            <div className="lbl">Known</div>
            <div className="v"><span>{known.length}/{sc.knownAllowance}</span></div>
          </div>
        </div>
        {sc.spheres.length > 0 && (
          <div style={{ padding: "0 12px 10px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
            SPHERES: {sc.spheres.join(", ")}
          </div>
        )}
      </div>

      {cantrips.length > 0 && (
        <div className="list-card">
          <div className="card-header"><div className="card-title">Cantrips</div></div>
          {cantrips.map((sp) => spellRow(sp, "cantrip"))}
        </div>
      )}

      <div className="list-card">
        <div className="card-header"><div className="card-title">Known Spells</div></div>
        {known.length === 0 && <div className="feat-row"><div className="desc">No known spells.</div></div>}
        {known
          .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
          .map((sp) => spellRow(sp, "spell"))}
      </div>
    </>
  );
}

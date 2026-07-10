// Spells tab: reservoir tracker, prepared/known lists with cast buttons.
// Cast cost = base (tier + spell_cost_modifier − signature discount) + any Amps
// armed on the expanded spell. Arming Amps previews the spend on the reservoir
// pips (armed = leaving this cast, over = can't afford). Flat Amps toggle;
// "per Amp" Amps get a stepper; Amps sharing an exclusive_group arm choose-one.

import { useState } from "react";
import type {
  ComputedCharacter,
  Spell,
  StoredCharacter,
} from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { Markdown, PipTracker } from "@ui/primitives.tsx";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

type Amp = Spell["amps"][number] & { exclusive_group?: string };

const ampValue = (a: Amp) => parseInt(a.cost, 10) || 0; // "+2" -> 2
const isStackable = (a: Amp) => !!a.stackable || /per\s+amp/i.test(a.effect);

export function SpellsTab({ c, stored, setStored }: TabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Amp counts for the currently expanded spell, keyed by amp index.
  // Flat amps are 0/1; stackable amps count up. Cleared when the row changes.
  const [armed, setArmed] = useState<Record<number, number>>({});
  const sc = c.spellcasting;

  if (!sc) {
    return (
      <div className="list-card">
        <div className="feat-row">
          <div className="desc">This character has no spellcasting.</div>
        </div>
      </div>
    );
  }

  const costMod = c.activeBoons
    .filter(({ boon }) => boon.type === "spell_cost_modifier")
    .reduce(
      (s, { boon }) => s + (typeof boon.amount === "number" ? boon.amount : 0),
      0,
    );

  const sig = sc.signature;
  const baseCost = (sp: Spell) => {
    if (sp.is_cantrip) return 0;
    let cost = sp.cost + costMod;
    if (sig && sig.spellIds.includes(sp.id)) cost -= sig.costReduction; // signature discount
    return Math.max(0, cost);
  };

  // Armed-Amp surcharge for a spell (only the expanded row can be armed).
  const ampSurcharge = (sp: Spell) =>
    expanded === sp.id
      ? sp.amps.reduce((s, a, i) => s + (armed[i] || 0) * ampValue(a as Amp), 0)
      : 0;

  const totalCost = (sp: Spell) => baseCost(sp) + ampSurcharge(sp);

  const reservoir = stored.pools.reservoir;

  const setReservoir = (n: number) =>
    setStored((s) => ({
      ...s,
      pools: {
        ...s.pools,
        reservoir: Math.max(0, Math.min(sc.reservoirMax, n)),
      },
    }));

  const openRow = (id: string) => {
    setExpanded((cur) => (cur === id ? null : id));
    setArmed({}); // arming is per-row; reset whenever the open row changes
  };

  const setAmp = (i: number, n: number) =>
    setArmed((a) => ({ ...a, [i]: Math.max(0, n) }));

  const toggleAmp = (sp: Spell, i: number) =>
    setArmed((a) => {
      const amps = sp.amps as Amp[];
      const group = amps[i].exclusive_group;
      const next = { ...a, [i]: a[i] ? 0 : 1 };
      // Arming an exclusive amp clears its siblings in the same group.
      if (group && !a[i]) {
        amps.forEach((other, j) => {
          if (j !== i && other.exclusive_group === group) next[j] = 0;
        });
      }
      return next;
    });

  const cast = (sp: Spell) => {
    setReservoir(reservoir - totalCost(sp));
    setArmed({});
  };

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

  const ampRow = (sp: Spell, a: Amp, i: number) => {
    const n = armed[i] || 0;
    if (isStackable(a)) {
      const capReached = totalCost(sp) >= reservoir; // one more pip won't fit
      const atMax = a.stack_max != null && n >= a.stack_max;
      return (
        <div className={`amp-row${n > 0 ? " on" : ""}`} key={i}>
          <div className="amp-stepper">
            <button disabled={n <= 0} onClick={() => setAmp(i, n - 1)}>
              −
            </button>
            <span className="amp-n">{n}</span>
            <button
              disabled={capReached || atMax}
              onClick={() => setAmp(i, n + 1)}
            >
              +
            </button>
          </div>
          <span className="amp-eff">
            {a.effect} <span className="amp-per">per amp</span>
          </span>
          <span className="amp-cost">
            +{ampValue(a)}
            {n > 1 ? ` ×${n} = +${ampValue(a) * n}` : ""}
          </span>
        </div>
      );
    }
    const on = n > 0;
    return (
      <div
        className={`amp-row amp-toggle${on ? " on" : ""}`}
        key={i}
        onClick={() => toggleAmp(sp, i)}
        role="checkbox"
        aria-checked={on}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggleAmp(sp, i);
          }
        }}
      >
        <span className="amp-box">{on ? "✦" : ""}</span>
        <span className="amp-eff">{a.effect}</span>
        <span className="amp-cost">+{ampValue(a)}</span>
      </div>
    );
  };

  const spellRow = (sp: Spell, kind: "cantrip" | "spell") => {
    const prepared = stored.build.prepared_spell_ids.includes(sp.id);
    const open = expanded === sp.id;
    const total = totalCost(sp);
    const base = baseCost(sp);
    const surcharge = total - base;
    const short = total > reservoir;
    const exclusive = (sp.amps as Amp[]).some((a) => a.exclusive_group);
    return (
      <div className="feat-row" key={sp.id}>
        <div
          className="row-1"
          style={{ cursor: "pointer" }}
          onClick={() => openRow(sp.id)}
        >
          <span className="name">{sp.name}</span>
          <span className="src">
            {sp.is_cantrip ? "cantrip" : `tier ${sp.tier}`}
            {sp.school ? ` · ${sp.school}` : ""}
            {sp.range ? ` · ${sp.range}` : ""}
            {sp.duration ? ` · ${sp.duration}` : ""}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {kind === "spell" && (
              <button
                className="rest-btn"
                style={{ padding: "1px 8px" }}
                title={
                  prepared
                    ? "Prepared — click to unprepare"
                    : "Click to prepare"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  togglePrepared(sp.id);
                }}
              >
                <span
                  className="name"
                  style={prepared ? { color: "var(--gold)" } : undefined}
                >
                  {prepared ? "PREPARED" : "prepare"}
                </span>
              </button>
            )}
            <button
              className="rest-btn"
              style={{ padding: "1px 8px" }}
              disabled={short}
              onClick={(e) => {
                e.stopPropagation();
                cast(sp);
              }}
              title={
                short
                  ? `Short ${total - reservoir} — reduce Amps or rest`
                  : `Spend ${total} from reservoir`
              }
            >
              <span
                className="name"
                style={short ? { color: "var(--danger)" } : undefined}
              >
                {short
                  ? `SHORT ${total - reservoir}`
                  : `CAST ${total > 0 ? `(${total})` : "(free)"}`}
              </span>
            </button>
          </span>
        </div>
        {open && (
          <div className="desc">
            <Markdown text={sp.description} />
            {sp.amps.length > 0 && (
              <div className="amp-panel">
                <div className="amp-panel-head">
                  Amps{exclusive ? " · choose one" : ""}
                </div>
                {(sp.amps as Amp[]).map((a, i) => ampRow(sp, a, i))}
                <div className="amp-breakdown">
                  base <b>{base}</b>
                  {surcharge > 0 && (
                    <>
                      {" "}
                      + amps <b>{surcharge}</b> = <b>{total}</b>
                    </>
                  )}{" "}
                  {total === 1 ? "reservoir" : "reservoir"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const known = stored.build.known_spell_ids
    .map((id) => REGISTRY.spells.get(id))
    .filter((x): x is Spell => !!x);
  const cantrips = stored.build.known_cantrip_ids
    .map((id) => REGISTRY.spells.get(id))
    .filter((x): x is Spell => !!x);

  // Reservoir spend preview from the expanded spell's armed cost.
  const expandedSpell = expanded
    ? (known.find((s) => s.id === expanded) ??
      cantrips.find((s) => s.id === expanded) ??
      null)
    : null;
  const previewCost = expandedSpell ? totalCost(expandedSpell) : 0;
  const commit = Math.min(previewCost, reservoir);
  const over = Math.max(0, previewCost - reservoir);

  return (
    <>
      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Reservoir</div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--text-faint)",
            }}
          >
            DC{" "}
            <span
              style={{
                fontFamily: "var(--serif)",
                fontSize: 16,
                color: "var(--gold)",
              }}
            >
              {sc.spellDC}
            </span>
            {" · "}spell tier {sc.spellcastingTier}
            {" · "}mod {sc.modifier} {sc.modifierValue}
            {costMod !== 0 && ` · cost ${costMod > 0 ? "+" : ""}${costMod}`}
          </div>
        </div>
        <div className="hp-grid" style={{ padding: "4px 8px 4px" }}>
          <div className="hp-cell">
            <div className="lbl">Current</div>
            <div className="v">
              <PipTracker
                current={reservoir}
                max={sc.reservoirMax}
                onChange={setReservoir}
                commit={commit}
                over={over}
              />
            </div>
          </div>
          <div className="hp-cell">
            <div className="lbl">Prepared</div>
            <div className="v">
              <span>
                {stored.build.prepared_spell_ids.length}/{sc.preparedAllowance}
              </span>
            </div>
          </div>
          <div className="hp-cell">
            <div className="lbl">Known</div>
            <div className="v">
              <span>
                {Math.max(0, known.length - sc.freeKnownCount)}/
                {sc.knownAllowance}
                {sc.freeKnownCount > 0 && ` (+${sc.freeKnownCount} free)`}
              </span>
            </div>
          </div>
        </div>
        <div className="resv-legend">
          <span>
            <i className="sw sw-have" />
            remaining
          </span>
          <span>
            <i className="sw sw-armed" />
            armed
          </span>
          <span>
            <i className="sw sw-short" />
            short
          </span>
          {previewCost > 0 && (
            <span
              className="resv-status"
              style={over > 0 ? { color: "var(--danger)" } : undefined}
            >
              {over > 0
                ? `short ${over}`
                : `armed ${previewCost} · ${reservoir - previewCost} remaining after`}
            </span>
          )}
        </div>
        {sc.spheres.length > 0 && (
          <div
            style={{
              padding: "0 12px 10px",
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-faint)",
            }}
          >
            SPHERES: {sc.spheres.join(", ")}
          </div>
        )}
      </div>

      {cantrips.length > 0 && (
        <div className="list-card">
          <div className="card-header">
            <div className="card-title">Cantrips</div>
          </div>
          {cantrips.map((sp) => spellRow(sp, "cantrip"))}
        </div>
      )}

      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Known Spells</div>
        </div>
        {known.length === 0 && (
          <div className="feat-row">
            <div className="desc">No known spells.</div>
          </div>
        )}
        {known
          .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
          .map((sp) => spellRow(sp, "spell"))}
      </div>
    </>
  );
}

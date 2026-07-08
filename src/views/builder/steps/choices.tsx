import { useState } from "react";
import { REGISTRY } from "../../../core/data-registry.ts";
import { walkBoons } from "../../../core/boon-resolver.ts";
import { spellAccessible } from "../../../core/spell-access.ts";
import { spellSourceColor } from "../../../shared/spell-source-colors.ts";
import { Markdown } from "@ui/primitives.tsx";
import type { ComputedSpellcasting, Spell } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

// Resolve feat choice/multi_choice boons and pick spells against the engine's
// computed allowances. Sphere filter is a convenience (vocab varies across the
// data), never a hard gate — validateCharacter enforces tier ≤ spellcasting tier.

interface ChoiceDef {
  key: string;
  kind: "choice" | "multi_choice";
  prompt: string;
  count: number;
  owner: string;
  options: { value: string; label: string; description?: string }[];
}

function gatherChoices(featCards: StepProps["computed"]["featCards"]): ChoiceDef[] {
  const out: ChoiceDef[] = [];
  const seen = new Set<string>();
  for (const card of featCards) {
    walkBoons(card.feat.boons, (b) => {
      if ((b.type === "choice" || b.type === "multi_choice") && typeof b.key === "string" && Array.isArray(b.options)) {
        if (seen.has(b.key)) return;
        seen.add(b.key);
        out.push({
          key: b.key,
          kind: b.type,
          prompt: typeof b.prompt === "string" ? b.prompt : b.key,
          count: typeof b.count === "number" ? b.count : 1,
          owner: card.feat.name,
          options: (b.options as Record<string, unknown>[]).map((o) => ({
            value: String(o.value),
            label: String(o.label ?? o.value),
            description: typeof o.description === "string" ? o.description : undefined,
          })),
        });
      }
    });
  }
  return out;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const spheresOf = (pool: Spell[]) => {
  const set = new Set<string>();
  pool.forEach((s) => s.spheres.forEach((x) => set.add(x)));
  return [...set].sort();
};

export function ChoicesStep({ draft, update, computed }: StepProps) {
  const choices = gatherChoices(computed.featCards);
  const sc = computed.spellcasting;

  const setChoice = (key: string, value: string) => update((d) => { d.build.choices[key] = value; });
  const toggleMulti = (key: string, value: string, max: number) =>
    update((d) => {
      const cur = Array.isArray(d.build.choices[key]) ? (d.build.choices[key] as string[]) : [];
      const has = cur.includes(value);
      if (has) d.build.choices[key] = cur.filter((v) => v !== value);
      else if (cur.length < max) d.build.choices[key] = [...cur, value];
    });

  return (
    <div>
      <div className="bld-field-label">Feat Choices</div>
      {choices.length === 0 ? (
        <div className="bld-empty">No feat choices to resolve for the selected feats.</div>
      ) : (
        choices.map((ch) => (
          <div key={ch.key} className="bld-choice">
            <div className="bld-choice-head">
              <span className="bld-choice-prompt">{ch.prompt}</span>
              <span className="bld-choice-owner">{ch.owner}{ch.kind === "multi_choice" ? ` · pick ${ch.count}` : ""}</span>
            </div>
            {ch.kind === "choice" ? (
              <select
                className="bld-select"
                value={(draft.build.choices[ch.key] as string) ?? ""}
                onChange={(e) => setChoice(ch.key, e.target.value)}
              >
                <option value="">— choose —</option>
                {ch.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <div className="bld-chip-row">
                {ch.options.map((o) => {
                  const cur = Array.isArray(draft.build.choices[ch.key]) ? (draft.build.choices[ch.key] as string[]) : [];
                  const on = cur.includes(o.value);
                  const atLimit = !on && cur.length >= ch.count;
                  return (
                    <button key={o.value} className={`bld-chip${on ? " bld-chip--on" : ""}`} disabled={atLimit}
                      onClick={() => toggleMulti(ch.key, o.value, ch.count)}>{o.label}</button>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}

      <div className="bld-field-label" style={{ marginTop: 30 }}>Spells</div>
      {!sc ? (
        <div className="bld-empty">This build has no spellcasting grant.</div>
      ) : (
        <>
          <div className="bld-note">
            Caster: {sc.casterType} · spell tier {sc.spellcastingTier} · DC {sc.spellDC}
            {sc.spheres.length ? ` · spheres: ${sc.spheres.map(capitalize).join(", ")}` : ""}
          </div>

          <SpellPicker
            title="Cantrips"
            cap={sc.cantripAllowance}
            selected={draft.build.known_cantrip_ids}
            pool={[...REGISTRY.spells.values()].filter((s) => s.is_cantrip && !s.reference_only)}
            sc={sc}
            onToggle={(id) => update((d) => toggleIn(d.build.known_cantrip_ids, id, sc.cantripAllowance, (v) => { d.build.known_cantrip_ids = v; }))}
          />

          <SpellPicker
            title="Known spells"
            cap={sc.knownAllowance}
            selected={draft.build.known_spell_ids}
            pool={[...REGISTRY.spells.values()].filter((s) => !s.is_cantrip && !s.reference_only && s.tier <= sc.spellcastingTier)}
            sc={sc}
            onToggle={(id) => update((d) => toggleIn(d.build.known_spell_ids, id, sc.knownAllowance, (v) => {
              d.build.known_spell_ids = v;
              d.build.prepared_spell_ids = d.build.prepared_spell_ids.filter((p) => v.includes(p));
            }))}
          />

          <SpellPicker
            title="Prepared"
            cap={sc.preparedAllowance}
            selected={draft.build.prepared_spell_ids}
            pool={draft.build.known_spell_ids.map((id) => REGISTRY.spells.get(id)).filter((s): s is Spell => !!s)}
            sc={sc}
            onToggle={(id) => update((d) => toggleIn(d.build.prepared_spell_ids, id, sc.preparedAllowance, (v) => { d.build.prepared_spell_ids = v; }))}
          />
        </>
      )}
    </div>
  );
}

function toggleIn(list: string[], id: string, cap: number, commit: (v: string[]) => void) {
  if (list.includes(id)) commit(list.filter((x) => x !== id));
  else if (list.length < cap) commit([...list, id]);
}

const sourcesOf = (pool: Spell[]) => {
  const set = new Set<string>();
  pool.forEach((s) => s.sources.forEach((x) => set.add(x)));
  return [...set].sort();
};

function SpellPicker({ title, cap, selected, pool, sc, onToggle }: {
  title: string; cap: number; selected: string[]; pool: Spell[]; sc: ComputedSpellcasting; onToggle: (id: string) => void;
}) {
  const [sphere, setSphere] = useState("all");
  const [source, setSource] = useState("all");
  const [showInaccessible, setShowInaccessible] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const spheres = spheresOf(pool);
  const sources = sourcesOf(pool);
  const sel = new Set(selected);

  const accessible = pool.filter((s) => spellAccessible(s, sc).ok);
  const hiddenCount = pool.length - accessible.length;
  const base = showInaccessible ? pool : accessible;
  const shown = base
    .filter((s) => sphere === "all" || s.spheres.includes(sphere))
    .filter((s) => source === "all" || s.sources.includes(source));

  return (
    <div className="bld-spellsec">
      <div className="bld-spellsec-head">
        <span className="bld-field-label" style={{ margin: 0 }}>{title} <span style={{ color: selected.length > cap ? "var(--danger)" : "var(--text-faint)" }}>{selected.length}/{cap}</span></span>
        <span style={{ display: "flex", gap: 8 }}>
          {spheres.length > 1 && (
            <select className="bld-select" style={{ minWidth: 150 }} value={sphere} onChange={(e) => setSphere(e.target.value)}>
              <option value="all">All spheres</option>
              {spheres.map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
            </select>
          )}
          {sources.length > 1 && (
            <select className="bld-select" style={{ minWidth: 150 }} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </span>
      </div>
      {hiddenCount > 0 && (
        <button className="bld-btn bld-btn--ghost" style={{ marginBottom: 8 }} onClick={() => setShowInaccessible((v) => !v)}>
          {showInaccessible ? "hide inaccessible spells" : `show inaccessible (${hiddenCount})`}
        </button>
      )}
      {pool.length === 0 ? (
        <div className="bld-empty">{title === "Prepared" ? "Choose known spells first." : "No eligible spells."}</div>
      ) : (
        <div className="bld-spelllist">
          {shown.map((s) => {
            const on = sel.has(s.id);
            const access = spellAccessible(s, sc);
            const atLimit = !on && (selected.length >= cap || !access.ok);
            const open = expanded === s.id;
            return (
              <div key={s.id} className={`bld-exp-row${on ? " bld-exp-row--on" : ""}${!access.ok ? " bld-exp-row--blocked" : ""}`}>
                <div className="bld-exp-row-head" onClick={() => setExpanded(open ? null : s.id)}>
                  <span className="bld-exp-row-name">{s.name}</span>
                  <span className="bld-exp-row-meta">
                    {s.is_cantrip ? "cantrip" : `T${s.tier}`}
                    {!s.is_cantrip ? ` · ${s.cost} cost` : ""}
                    {s.spheres.length ? ` · ${s.spheres.map(capitalize).join(", ")}` : ""}
                  </span>
                  <span className="bld-exp-row-badges">
                    {s.sources.map((src) => (
                      <span key={src} className="bld-source-badge" style={{ ["--c" as string]: spellSourceColor(src) }}>{src}</span>
                    ))}
                    {!access.ok && <span className="bld-source-badge bld-source-badge--warn" title={access.reason}>{access.reason}</span>}
                  </span>
                  <button
                    className={`bld-chip bld-exp-row-toggle${on ? " bld-chip--on" : ""}`}
                    disabled={atLimit}
                    title={!access.ok ? access.reason : undefined}
                    onClick={(e) => { e.stopPropagation(); onToggle(s.id); }}
                  >
                    {on ? "selected" : "select"}
                  </button>
                </div>
                {open && (
                  <div className="bld-exp-row-body">
                    <div className="bld-note" style={{ margin: "0 0 8px" }}>
                      {[s.range && `Range: ${s.range}`, s.duration && `Duration: ${s.duration}`, s.area && `Area: ${s.area}`]
                        .filter(Boolean).join(" · ")}
                    </div>
                    <Markdown text={s.description} />
                    {s.amps.length > 0 && (
                      <ul style={{ marginTop: 6 }}>
                        {s.amps.map((a, i) => <li key={i}><b>Amp {a.cost}:</b> {a.effect}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

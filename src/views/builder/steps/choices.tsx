import { useState } from "react";
import { REGISTRY } from "../../../core/data-registry.ts";
import { walkBoons } from "../../../core/boon-resolver.ts";
import type { Spell } from "../../../core/types.ts";
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
            {sc.spheres.length ? ` · spheres: ${sc.spheres.join(", ")}` : ""}
          </div>

          <SpellPicker
            title="Cantrips"
            cap={sc.cantripAllowance}
            selected={draft.build.known_cantrip_ids}
            pool={[...REGISTRY.spells.values()].filter((s) => s.is_cantrip && !s.reference_only)}
            onToggle={(id) => update((d) => toggleIn(d.build.known_cantrip_ids, id, sc.cantripAllowance, (v) => { d.build.known_cantrip_ids = v; }))}
          />

          <SpellPicker
            title="Known spells"
            cap={sc.knownAllowance}
            selected={draft.build.known_spell_ids}
            pool={[...REGISTRY.spells.values()].filter((s) => !s.is_cantrip && !s.reference_only && s.tier <= sc.spellcastingTier)}
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

function SpellPicker({ title, cap, selected, pool, onToggle }: {
  title: string; cap: number; selected: string[]; pool: Spell[]; onToggle: (id: string) => void;
}) {
  const [sphere, setSphere] = useState("all");
  const spheres = spheresOf(pool);
  const shown = sphere === "all" ? pool : pool.filter((s) => s.spheres.includes(sphere));
  const sel = new Set(selected);

  return (
    <div className="bld-spellsec">
      <div className="bld-spellsec-head">
        <span className="bld-field-label" style={{ margin: 0 }}>{title} <span style={{ color: selected.length > cap ? "var(--danger)" : "var(--text-faint)" }}>{selected.length}/{cap}</span></span>
        {spheres.length > 1 && (
          <select className="bld-select" style={{ minWidth: 150 }} value={sphere} onChange={(e) => setSphere(e.target.value)}>
            <option value="all">All spheres</option>
            {spheres.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      {pool.length === 0 ? (
        <div className="bld-empty">{title === "Prepared" ? "Choose known spells first." : "No eligible spells."}</div>
      ) : (
        <div className="bld-spelllist">
          {shown.map((s) => {
            const on = sel.has(s.id);
            const atLimit = !on && selected.length >= cap;
            return (
              <button key={s.id} className={`bld-chip${on ? " bld-chip--on" : ""}`} disabled={atLimit}
                title={s.spheres.join(", ")} onClick={() => onToggle(s.id)}>
                {s.name}{s.tier ? <span style={{ opacity: 0.6 }}> T{s.tier}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

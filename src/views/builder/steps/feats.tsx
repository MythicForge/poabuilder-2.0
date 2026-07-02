import { REGISTRY } from "../../../core/data-registry.ts";
import type { Feat } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

// Skeleton feat picker: gathers the feat pools relevant to the current build and
// toggles them into build.feat_ids. Slot-budget + prerequisite enforcement
// (featEligibility) is a follow-up — see review/05-builder-wizard.md step 4.

function pools(profId: string, originId: string, vocationId: string): { owner: string; feats: Feat[] }[] {
  const out: { owner: string; feats: Feat[] }[] = [];
  const prof = REGISTRY.professions.get(profId);
  if (prof) {
    out.push({ owner: prof.name, feats: prof.feats ?? [] });
    for (const path of REGISTRY.pathsOf(profId)) out.push({ owner: path.name, feats: path.feats ?? [] });
  }
  const origin = REGISTRY.origins.get(originId);
  if (origin) out.push({ owner: origin.name, feats: origin.feats ?? [] });
  const vocation = REGISTRY.vocations.get(vocationId);
  if (vocation) out.push({ owner: vocation.name, feats: vocation.feats ?? [] });
  out.push({ owner: "Origin (universal)", feats: REGISTRY.universalOriginFeats ?? [] });
  return out.filter((p) => p.feats.length > 0);
}

export function FeatsStep({ draft, update, computed }: StepProps) {
  const b = draft.build;
  const chosen = new Set(b.feat_ids);
  const groups = pools(b.profession_id, b.origin_id, b.vocation_id);

  const setPurchased = (n: number) =>
    update((d) => { d.build.feats_purchased = Math.max(0, n); });

  const toggle = (id: string) =>
    update((d) => {
      const set = new Set(d.build.feat_ids);
      set.has(id) ? set.delete(id) : set.add(id);
      d.build.feat_ids = [...set];
    });

  return (
    <div>
      <div className="bld-meter">
        <span className="bld-meter-name">Feats</span>
        <span className="bld-stepper">
          <button onClick={() => setPurchased(b.feats_purchased - 1)}>−</button>
          <span className="bld-stepper-val">{b.feats_purchased}</span>
          <button onClick={() => setPurchased(b.feats_purchased + 1)}>+</button>
        </span>
        <span className="bld-budget">purchased → <strong style={{ color: "var(--gold)" }}>Tier {computed.tier}</strong></span>
      </div>
      <div className="bld-note">
        Feats purchased drives your Tier. Selecting feats here is unconstrained for now —
        slot budgets and prerequisites arrive with <code>featEligibility</code>.
      </div>

      {groups.length === 0 ? (
        <div className="bld-empty">Pick a profession and origin first, or author feats into their JSON.</div>
      ) : (
        groups.map((g) => (
          <div key={g.owner} style={{ marginTop: 22 }}>
            <div className="bld-field-label">{g.owner}</div>
            <div className="bld-grid">
              {g.feats.map((f) => {
                const on = chosen.has(f.id);
                return (
                  <button
                    key={f.id}
                    className={`bld-pick${on ? " bld-pick--on" : ""}`}
                    onClick={() => toggle(f.id)}
                  >
                    <div className="bld-pick-name" style={{ fontSize: 16 }}>{f.name}</div>
                    <div className="bld-pick-meta">
                      T{f.tier} · {f.trait}{f.slot_type ? ` · ${f.slot_type}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

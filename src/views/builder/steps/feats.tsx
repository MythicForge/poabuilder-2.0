import { REGISTRY } from "../../../core/data-registry.ts";
import { featEligibility, SLOT_TYPES, slotState } from "../../../core/feat-eligibility.ts";
import type { Feat } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

// Feat picker with live slot-budget + prerequisite gating (featEligibility).
// Tier-0 feats are auto-granted; ineligible feats are disabled with the reason.

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
  const slots = slotState(draft, REGISTRY);

  const setPurchased = (n: number) => update((d) => { d.build.feats_purchased = Math.max(0, n); });
  const toggle = (id: string) =>
    update((d) => {
      const set = new Set(d.build.feat_ids);
      set.has(id) ? set.delete(id) : set.add(id);
      d.build.feat_ids = [...set];
    });
  const setTier4 = (choice: "tactical" | "narrative") =>
    update((d) => { d.build.tier4_slot_choice = d.build.tier4_slot_choice === choice ? null : choice; });

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

      <div className="bld-slots">
        {SLOT_TYPES.map((t) => {
          const over = slots.used[t] > slots.capacity[t];
          return (
            <span key={t} className={`bld-slot-pill${over ? " bld-slot-pill--over" : ""}`}>
              {t} {slots.used[t]}/{slots.capacity[t]}
            </span>
          );
        })}
        <span className={`bld-slot-pill${slots.purchasedSelected > b.feats_purchased ? " bld-slot-pill--over" : ""}`}>
          purchased {slots.purchasedSelected}/{b.feats_purchased}
        </span>
      </div>

      {slots.tier4ChoicePending && (
        <div className="bld-note" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          Tier-4 flexible slot:
          <button className={`bld-btn${b.tier4_slot_choice === "tactical" ? " bld-btn--gold" : ""}`} onClick={() => setTier4("tactical")}>Tactical</button>
          <button className={`bld-btn${b.tier4_slot_choice === "narrative" ? " bld-btn--gold" : ""}`} onClick={() => setTier4("narrative")}>Narrative</button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bld-empty">Pick a profession and origin first, or author feats into their JSON.</div>
      ) : (
        groups.map((g) => (
          <div key={g.owner} style={{ marginTop: 22 }}>
            <div className="bld-field-label">{g.owner}</div>
            <div className="bld-grid">
              {g.feats.map((f) => {
                const on = chosen.has(f.id);
                const starting = f.tier === 0;
                const elig = starting ? null : featEligibility(draft, f, REGISTRY);
                const blocked = !on && !!elig && !elig.ok;
                return (
                  <button
                    key={f.id}
                    className={`bld-pick${on ? " bld-pick--on" : ""}${starting || blocked ? " bld-pick--locked" : ""}`}
                    disabled={starting || blocked}
                    title={blocked ? elig!.reasons.join("; ") : undefined}
                    onClick={() => !starting && toggle(f.id)}
                  >
                    <div className="bld-pick-name" style={{ fontSize: 16 }}>{f.name}</div>
                    <div className="bld-pick-meta">
                      {starting ? "Starting" : `T${f.tier}`} · {f.trait}{f.slot_type ? ` · ${f.slot_type}` : ""}
                    </div>
                    {starting && <div className="bld-pick-flag">granted automatically</div>}
                    {blocked && <div className="bld-pick-flag bld-pick-flag--block">{elig!.reasons[0]}</div>}
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

import { useState } from "react";
import { REGISTRY } from "../../../core/data-registry.ts";
import { featEligibility, prereqPills, SLOT_TYPES, slotState } from "../../../core/feat-eligibility.ts";
import { Markdown } from "@ui/primitives.tsx";
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

function formatCost(cost: unknown): string | null {
  if (!cost || typeof cost !== "object") return null;
  const c = cost as { ap?: number; resources?: { id: string; amount: number }[] };
  const parts: string[] = [];
  if (typeof c.ap === "number") parts.push(`${c.ap} AP`);
  for (const r of c.resources ?? []) parts.push(`${r.amount} ${r.id}`);
  return parts.length ? parts.join(" · ") : null;
}

export function FeatsStep({ draft, update, computed }: StepProps) {
  const b = draft.build;
  const chosen = new Set(b.feat_ids);
  const groups = pools(b.profession_id, b.origin_id, b.vocation_id);
  const slots = slotState(draft, REGISTRY);
  const [expanded, setExpanded] = useState<string | null>(null);

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
            <div className="bld-spelllist" style={{ maxHeight: "none", border: "none", padding: 0 }}>
              {g.feats.map((f) => {
                const on = chosen.has(f.id);
                const starting = f.tier === 0;
                const elig = starting ? null : featEligibility(draft, f, REGISTRY);
                const blocked = !on && !!elig && !elig.ok;
                const open = expanded === f.id;
                const cost = formatCost(f.cost);
                const pills = starting ? [] : prereqPills(draft, f, REGISTRY);
                return (
                  <div key={f.id} className={`bld-exp-row${on ? " bld-exp-row--on" : ""}${blocked ? " bld-exp-row--blocked" : ""}`}>
                    <div className="bld-exp-row-head" onClick={() => setExpanded(open ? null : f.id)}>
                      <span className="bld-exp-row-name">{f.name}</span>
                      <span className="bld-exp-row-meta">
                        {starting ? "starting" : `T${f.tier}`} · {f.trait}{f.slot_type ? ` · ${f.slot_type}` : ""}
                      </span>
                      <span className="bld-exp-row-badges" />
                      {starting ? (
                        <span className="bld-pick-flag" style={{ marginTop: 0 }}>granted automatically</span>
                      ) : (
                        <button
                          className={`bld-chip bld-exp-row-toggle${on ? " bld-chip--on" : ""}`}
                          disabled={blocked}
                          title={blocked ? elig!.reasons.join("; ") : undefined}
                          onClick={(e) => { e.stopPropagation(); toggle(f.id); }}
                        >
                          {on ? "selected" : "select"}
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="bld-exp-row-body">
                        {(cost || f.range || f.duration || f.feat_dc || f.uses) && (
                          <div className="bld-note" style={{ margin: "0 0 8px" }}>
                            {[
                              cost && `Cost: ${cost}`,
                              f.range && `Range: ${f.range}`,
                              f.duration && `Duration: ${f.duration}`,
                              f.feat_dc && `DC: ${f.feat_dc}`,
                              f.uses && `Uses: ${f.uses.count} / ${f.uses.recharge.replace(/_/g, " ")}`,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {pills.length > 0 && (
                          <div className="bld-exp-row-badges" style={{ margin: "0 0 8px" }}>
                            {pills.map((p, i) => (
                              <span key={i} className={`bld-source-badge${p.met ? "" : " bld-source-badge--warn"}`}>
                                {p.met ? "✓ " : "✗ "}{p.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <Markdown text={f.description} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

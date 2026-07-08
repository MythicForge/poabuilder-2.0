import { useState } from "react";
import { REGISTRY } from "../../../core/data-registry.ts";
import { DetailPane, FeatureCard, StatPill } from "../detail-pane.tsx";
import type { StepProps } from "../step.ts";

export function ProfessionStep({ draft, update }: StepProps) {
  const professions = [...REGISTRY.professions.values()];
  const chosen = draft.build.profession_id;
  const [inspected, setInspected] = useState<string | null>(chosen || null);

  if (professions.length === 0) {
    return <div className="bld-empty">No professions loaded yet. Drop new-format profession JSON into <code>data/professions/</code>.</div>;
  }

  const active = professions.find((p) => p.id === inspected) ?? professions.find((p) => p.id === chosen) ?? professions[0];
  const paths = active ? REGISTRY.pathsOf(active.id) : [];
  const startingFeats = active?.feats?.filter((f) => f.tier === 0) ?? [];

  return (
    <div className="bld-master-detail">
      <div className="bld-master-list">
        {professions.map((p) => {
          const on = p.id === chosen;
          return (
            <button
              key={p.id}
              className={`bld-pick bld-pick--compact${on ? " bld-pick--on" : ""}`}
              onMouseEnter={() => setInspected(p.id)}
              onFocus={() => setInspected(p.id)}
              onClick={() => update((d) => { d.build.profession_id = on ? "" : p.id; })}
            >
              <div className="bld-pick-name">{p.name}</div>
              <div className="bld-pick-meta">{(p.favored_attributes ?? []).join(" · ") || "—"}</div>
            </button>
          );
        })}
      </div>

      {active && (
        <DetailPane
          eyebrow={active.id === chosen ? "Selected profession" : "Profession"}
          title={active.name}
          pills={
            <>
              <StatPill label={`Vitality ${active.vitality.base}`} accent />
              {(active.favored_attributes ?? []).map((a) => <StatPill key={a} label={a} />)}
              {active.resources?.map((r) => <StatPill key={r.id} label={r.name} />)}
            </>
          }
        >
          {active.description && <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{active.description}</p>}
          {paths.length > 0 && (
            <div className="bld-note" style={{ margin: 0 }}>
              Paths: {paths.map((p) => p.name).join(", ")} — chosen later via feats.
            </div>
          )}
          {startingFeats.length > 0 && (
            <div>
              <div className="bld-field-label">Starting features</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {startingFeats.map((f) => <FeatureCard key={f.id} feat={f} />)}
              </div>
            </div>
          )}
        </DetailPane>
      )}
    </div>
  );
}

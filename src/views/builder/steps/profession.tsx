import { REGISTRY } from "../../../core/data-registry.ts";
import type { StepProps } from "../step.ts";

export function ProfessionStep({ draft, update }: StepProps) {
  const professions = [...REGISTRY.professions.values()];
  const chosen = draft.build.profession_id;

  if (professions.length === 0) {
    return <div className="bld-empty">No professions loaded yet. Drop new-format profession JSON into <code>data/professions/</code>.</div>;
  }

  return (
    <div className="bld-grid">
      {professions.map((p) => {
        const on = p.id === chosen;
        return (
          <button
            key={p.id}
            className={`bld-pick${on ? " bld-pick--on" : ""}`}
            onClick={() => update((d) => { d.build.profession_id = on ? "" : p.id; })}
          >
            <div className="bld-pick-name">{p.name}</div>
            <div className="bld-pick-meta">
              {(p.favored_attributes ?? []).join(" · ") || "—"}
              {p.paths?.length ? ` · ${p.paths.map((x) => x.name).join("/")}` : ""}
            </div>
            {p.description && <div className="bld-pick-desc">{p.description.slice(0, 160)}</div>}
          </button>
        );
      })}
    </div>
  );
}

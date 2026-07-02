import { REGISTRY } from "../../../core/data-registry.ts";
import { ATTRIBUTES } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

export function AttributesStep({ draft, update, computed }: StepProps) {
  const attrs = draft.build.attributes;
  const budget = computed.attributeBudget;
  const over = budget.spent > budget.earned;

  const bump = (key: (typeof ATTRIBUTES)[number], delta: number) =>
    update((d) => { d.build.attributes[key] = d.build.attributes[key] + delta; });

  const prof = REGISTRY.professions.get(draft.build.profession_id);
  const skillSpec = prof?.proficiencies?.skills;
  const from = Array.isArray(skillSpec) ? skillSpec : skillSpec?.from ?? [];
  const count = Array.isArray(skillSpec) ? skillSpec.length : skillSpec?.count ?? 0;
  const picked = new Set(draft.build.skills.proficiencies);

  const toggleSkill = (name: string) =>
    update((d) => {
      const set = new Set(d.build.skills.proficiencies);
      if (set.has(name)) set.delete(name);
      else if (set.size < count || count === 0) set.add(name);
      d.build.skills.proficiencies = [...set];
    });

  return (
    <div>
      <div className="bld-field-label">Attributes</div>
      {ATTRIBUTES.map((key) => (
        <div className="bld-meter" key={key}>
          <span className="bld-meter-name">{key}</span>
          <span className="bld-stepper">
            <button onClick={() => bump(key, -1)}>−</button>
            <span className="bld-stepper-val">{attrs[key]}</span>
            <button onClick={() => bump(key, 1)}>+</button>
          </span>
        </div>
      ))}
      <div className={`bld-budget${over ? " bld-budget--over" : ""}`}>
        Points spent {budget.spent} / {budget.earned} earned
      </div>

      <div className="bld-field-label" style={{ marginTop: 28 }}>
        Skill Proficiencies {count ? `(choose ${count})` : ""}
      </div>
      {from.length === 0 ? (
        <div className="bld-empty">Pick a profession to see its skill options.</div>
      ) : (
        <div className="bld-grid">
          {from.map((s) => {
            const on = picked.has(s);
            return (
              <button
                key={s}
                className={`bld-pick${on ? " bld-pick--on" : ""}`}
                onClick={() => toggleSkill(s)}
                style={{ padding: "10px 14px" }}
              >
                <div className="bld-pick-name" style={{ fontSize: 16, margin: 0 }}>{s}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

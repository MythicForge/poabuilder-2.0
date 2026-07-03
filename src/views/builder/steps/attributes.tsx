import { REGISTRY } from "../../../core/data-registry.ts";
import { ATTRIBUTES, SKILLS } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

const ATTR_CAP = 12; // hard cap per attribute (REFERENCE.md)
const EXPERTISE_CAP = 3; // Trained → Expert → Master

export function AttributesStep({ draft, update, computed }: StepProps) {
  const attrs = draft.build.attributes;
  const aBudget = computed.attributeBudget;
  const aOver = aBudget.spent > aBudget.earned;
  const aRemaining = aBudget.earned - aBudget.spent;

  const bump = (key: (typeof ATTRIBUTES)[number], delta: number) =>
    update((d) => {
      const next = d.build.attributes[key] + delta;
      if (next < 0 || next > ATTR_CAP) return;
      if (delta > 0 && aRemaining <= 0) return;
      d.build.attributes[key] = next;
    });

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

  const sBudget = computed.skillPointBudget;
  const sSpent = sBudget.spent;
  const sRemaining = sBudget.earned - sSpent;
  const sOver = sSpent > sBudget.earned;

  const eBudget = computed.expertisePointBudget;
  const eSpent = eBudget.spent;
  const eRemaining = eBudget.earned - eSpent;
  const eOver = eSpent > eBudget.earned;

  const bumpPoints = (skill: string, delta: number) =>
    update((d) => {
      const next = (d.build.skills.points[skill] ?? 0) + delta;
      if (next < 0) return;
      if (delta > 0 && sRemaining <= 0) return;
      d.build.skills.points[skill] = next;
    });

  const bumpExpertise = (skill: string, delta: number) =>
    update((d) => {
      const cur = d.build.skills.expertise_bumps[skill] ?? 0;
      const next = cur + delta;
      const proficient = d.build.skills.proficiencies.includes(skill) ? 1 : 0;
      if (next < 0 || proficient + next > EXPERTISE_CAP) return;
      if (delta > 0 && eRemaining <= 0) return;
      d.build.skills.expertise_bumps[skill] = next;
    });

  return (
    <div>
      <div className="bld-field-label">Attributes</div>
      {ATTRIBUTES.map((key) => (
        <div className="bld-meter" key={key}>
          <span className="bld-meter-name">{key}</span>
          <span className="bld-stepper">
            <button disabled={attrs[key] <= 0} onClick={() => bump(key, -1)}>−</button>
            <span className="bld-stepper-val">{attrs[key]}</span>
            <button disabled={aRemaining <= 0 || attrs[key] >= ATTR_CAP} onClick={() => bump(key, 1)}>+</button>
          </span>
        </div>
      ))}
      <div className={`bld-budget${aOver ? " bld-budget--over" : ""}`}>
        Points spent {aBudget.spent} / {aBudget.earned} earned{aRemaining > 0 ? ` · ${aRemaining} left` : ""}
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

      <div className="bld-field-label" style={{ marginTop: 28 }}>Skill Points &amp; Expertise</div>
      {SKILLS.map((s) => {
        const points = draft.build.skills.points[s] ?? 0;
        const bumps = draft.build.skills.expertise_bumps[s] ?? 0;
        const proficient = picked.has(s) ? 1 : 0;
        return (
          <div className="bld-meter" key={s}>
            <span className="bld-meter-name" style={{ width: 96 }}>{s}</span>
            <span className="bld-skill-ctl">
              <span className="bld-skill-lbl">dice</span>
              <span className="bld-stepper">
                <button disabled={points <= 0} onClick={() => bumpPoints(s, -1)}>−</button>
                <span className="bld-stepper-val" style={{ fontSize: 16, minWidth: 26 }}>{points}</span>
                <button disabled={sRemaining <= 0} onClick={() => bumpPoints(s, 1)}>+</button>
              </span>
            </span>
            <span className="bld-skill-ctl">
              <span className="bld-skill-lbl">expertise</span>
              <span className="bld-stepper">
                <button disabled={bumps <= 0} onClick={() => bumpExpertise(s, -1)}>−</button>
                <span className="bld-stepper-val" style={{ fontSize: 16, minWidth: 26 }}>{bumps}</span>
                <button disabled={eRemaining <= 0 || proficient + bumps >= EXPERTISE_CAP} onClick={() => bumpExpertise(s, 1)}>+</button>
              </span>
            </span>
          </div>
        );
      })}
      <div className={`bld-budget${sOver ? " bld-budget--over" : ""}`}>
        Skill dice points spent {sSpent} / {sBudget.earned} earned{sRemaining > 0 ? ` · ${sRemaining} left` : ""}
      </div>
      <div className={`bld-budget${eOver ? " bld-budget--over" : ""}`}>
        Expertise points spent {eSpent} / {eBudget.earned} earned{eRemaining > 0 ? ` · ${eRemaining} left` : ""} (1 per tier gained)
      </div>
    </div>
  );
}

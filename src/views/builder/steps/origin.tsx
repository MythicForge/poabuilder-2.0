import { REGISTRY } from "../../../core/data-registry.ts";
import type { StepProps } from "../step.ts";

export function OriginStep({ draft, update }: StepProps) {
  const origins = [...REGISTRY.origins.values()];
  const chosenOrigin = draft.build.origin_id;
  const chosenVocation = draft.build.vocation_id;
  const vocations = chosenOrigin ? REGISTRY.vocationsOf(chosenOrigin) : [];

  if (origins.length === 0) {
    return <div className="bld-empty">No origins loaded yet. Drop new-format origin JSON into <code>data/origins/</code>.</div>;
  }

  return (
    <div>
      <div className="bld-field-label">Origin</div>
      <div className="bld-grid">
        {origins.map((o) => {
          const on = o.id === chosenOrigin;
          return (
            <button
              key={o.id}
              className={`bld-pick${on ? " bld-pick--on" : ""}`}
              onClick={() =>
                update((d) => {
                  if (on) { d.build.origin_id = ""; d.build.vocation_id = ""; }
                  else { d.build.origin_id = o.id; d.build.vocation_id = ""; }
                })
              }
            >
              <div className="bld-pick-name">{o.name}</div>
              <div className="bld-pick-meta">{o.vocations?.length ?? 0} vocations</div>
              {o.description && <div className="bld-pick-desc">{o.description.slice(0, 140)}</div>}
            </button>
          );
        })}
      </div>

      {chosenOrigin && (
        <>
          <div className="bld-field-label" style={{ marginTop: 26 }}>Vocation</div>
          {vocations.length === 0 ? (
            <div className="bld-empty">This origin has no vocations authored yet.</div>
          ) : (
            <div className="bld-grid">
              {vocations.map((v) => {
                const on = v.id === chosenVocation;
                const bonus = v.attribute_bonus;
                return (
                  <button
                    key={v.id}
                    className={`bld-pick${on ? " bld-pick--on" : ""}`}
                    onClick={() => update((d) => { d.build.vocation_id = on ? "" : v.id; })}
                  >
                    <div className="bld-pick-name">{v.name}</div>
                    <div className="bld-pick-meta">
                      {bonus ? `+${bonus.amount} ${bonus.attribute}` : "—"}
                      {v.spellcasting ? " · caster" : ""}
                    </div>
                    {v.description && <div className="bld-pick-desc">{v.description.slice(0, 140)}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

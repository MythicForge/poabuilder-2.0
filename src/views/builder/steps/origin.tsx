import { useState } from "react";
import { REGISTRY } from "../../../core/data-registry.ts";
import { DetailPane, FeatureCard, StatPill } from "../detail-pane.tsx";
import type { StepProps } from "../step.ts";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function OriginStep({ draft, update }: StepProps) {
  const origins = [...REGISTRY.origins.values()];
  const chosenOrigin = draft.build.origin_id;
  const chosenVocation = draft.build.vocation_id;
  const vocations = chosenOrigin ? REGISTRY.vocationsOf(chosenOrigin) : [];

  const [inspectedOrigin, setInspectedOrigin] = useState<string | null>(chosenOrigin || null);
  const [inspectedVocation, setInspectedVocation] = useState<string | null>(chosenVocation || null);

  if (origins.length === 0) {
    return <div className="bld-empty">No origins loaded yet. Drop new-format origin JSON into <code>data/origins/</code>.</div>;
  }

  const activeOrigin = origins.find((o) => o.id === (inspectedOrigin ?? chosenOrigin)) ?? origins[0];
  const originFeats = activeOrigin?.feats?.filter((f) => f.tier === 0) ?? [];
  const universalStarting = REGISTRY.universalOriginFeats?.filter((f) => f.tier === 0) ?? [];

  const activeVocation = vocations.find((v) => v.id === (inspectedVocation ?? chosenVocation)) ?? vocations[0];
  const vocationFeats = activeVocation?.feats?.filter((f) => f.tier === 0) ?? [];

  return (
    <div>
      <div className="bld-field-label">Origin</div>
      <div className="bld-master-detail">
        <div className="bld-master-list">
          {origins.map((o) => {
            const on = o.id === chosenOrigin;
            return (
              <button
                key={o.id}
                className={`bld-pick bld-pick--compact${on ? " bld-pick--on" : ""}`}
                onMouseEnter={() => setInspectedOrigin(o.id)}
                onFocus={() => setInspectedOrigin(o.id)}
                onClick={() =>
                  update((d) => {
                    if (on) { d.build.origin_id = ""; d.build.vocation_id = ""; }
                    else { d.build.origin_id = o.id; d.build.vocation_id = ""; }
                  })
                }
              >
                <div className="bld-pick-name">{o.name}</div>
                <div className="bld-pick-meta">{o.vocations?.length ?? 0} vocations</div>
              </button>
            );
          })}
        </div>

        {activeOrigin && (
          <DetailPane
            eyebrow={activeOrigin.id === chosenOrigin ? "Selected origin" : "Origin"}
            title={activeOrigin.name}
            pills={REGISTRY.vocationsOf(activeOrigin.id).map((v) => <StatPill key={v.id} label={v.name} />)}
          >
            {activeOrigin.description && (
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{activeOrigin.description}</p>
            )}
            {(originFeats.length > 0 || universalStarting.length > 0) && (
              <div>
                <div className="bld-field-label">Starting features</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...originFeats, ...universalStarting].map((f) => <FeatureCard key={f.id} feat={f} />)}
                </div>
              </div>
            )}
          </DetailPane>
        )}
      </div>

      {chosenOrigin && (
        <>
          <div className="bld-field-label" style={{ marginTop: 26 }}>Vocation</div>
          {vocations.length === 0 ? (
            <div className="bld-empty">This origin has no vocations authored yet.</div>
          ) : (
            <div className="bld-master-detail">
              <div className="bld-master-list">
                {vocations.map((v) => {
                  const on = v.id === chosenVocation;
                  const bonus = v.attribute_bonus;
                  return (
                    <button
                      key={v.id}
                      className={`bld-pick bld-pick--compact${on ? " bld-pick--on" : ""}`}
                      onMouseEnter={() => setInspectedVocation(v.id)}
                      onFocus={() => setInspectedVocation(v.id)}
                      onClick={() => update((d) => { d.build.vocation_id = on ? "" : v.id; })}
                    >
                      <div className="bld-pick-name">{v.name}</div>
                      <div className="bld-pick-meta" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {bonus && <StatPill label={`+${bonus.amount} ${capitalize(bonus.attribute)}`} accent />}
                        {v.spellcasting && <StatPill label={`${capitalize(v.spellcasting.caster_type)} caster`} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {activeVocation && (
                <DetailPane
                  eyebrow={activeVocation.id === chosenVocation ? "Selected vocation" : "Vocation"}
                  title={activeVocation.name}
                  pills={
                    <>
                      {activeVocation.attribute_bonus && (
                        <StatPill label={`+${activeVocation.attribute_bonus.amount} ${capitalize(activeVocation.attribute_bonus.attribute)}`} accent />
                      )}
                      {activeVocation.spellcasting && (
                        <StatPill
                          label={`${capitalize(activeVocation.spellcasting.caster_type)} · ${
                            typeof activeVocation.spellcasting.source === "string" ? capitalize(activeVocation.spellcasting.source) : "caster"
                          }`}
                        />
                      )}
                    </>
                  }
                >
                  {activeVocation.description && (
                    <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{activeVocation.description}</p>
                  )}
                  {vocationFeats.length > 0 && (
                    <div>
                      <div className="bld-field-label">Starting features</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {vocationFeats.map((f) => <FeatureCard key={f.id} feat={f} />)}
                      </div>
                    </div>
                  )}
                </DetailPane>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

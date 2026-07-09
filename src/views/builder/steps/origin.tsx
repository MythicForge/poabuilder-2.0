import { useState } from "react";
import { REGISTRY } from "../../../core/data-registry.ts";
import { DetailPane, FeatureCard, StatPill } from "../detail-pane.tsx";
import type { StepProps } from "../step.ts";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Origin → Vocation in one bounded frame: origins scroll on the left, the right
// detail pane carries the origin overview AND — once an origin is committed —
// the vocation chooser, so vocations sit beside the pick list, never far below.
export function OriginStep({ draft, update }: StepProps) {
  const origins = [...REGISTRY.origins.values()];
  const chosenOrigin = draft.build.origin_id;
  const chosenVocation = draft.build.vocation_id;

  const [inspected, setInspected] = useState<string | null>(chosenOrigin || null);

  if (origins.length === 0) {
    return <div className="bld-empty">No origins loaded yet. Drop new-format origin JSON into <code>data/origins/</code>.</div>;
  }

  const activeOrigin = origins.find((o) => o.id === (inspected ?? chosenOrigin)) ?? origins[0];
  const isChosen = activeOrigin.id === chosenOrigin;
  const vocations = REGISTRY.vocationsOf(activeOrigin.id);
  const originFeats = activeOrigin.feats?.filter((f) => f.tier === 0) ?? [];
  const universalStarting = REGISTRY.universalOriginFeats?.filter((f) => f.tier === 0) ?? [];

  const pickOrigin = (id: string, on: boolean) =>
    update((d) => {
      if (on) { d.build.origin_id = ""; d.build.vocation_id = ""; }
      else { d.build.origin_id = id; d.build.vocation_id = ""; }
    });
  const pickVocation = (id: string, on: boolean) =>
    update((d) => { d.build.vocation_id = on ? "" : id; });

  return (
    <div className="bld-master-detail">
      <div className="bld-master-list">
        {origins.map((o) => {
          const on = o.id === chosenOrigin;
          return (
            <button
              key={o.id}
              className={`bld-pick bld-pick--compact${on ? " bld-pick--on" : ""}`}
              onMouseEnter={() => setInspected(o.id)}
              onFocus={() => setInspected(o.id)}
              onClick={() => pickOrigin(o.id, on)}
            >
              <div className="bld-pick-name">{o.name}</div>
              <div className="bld-pick-meta">{o.vocations?.length ?? 0} vocations</div>
            </button>
          );
        })}
      </div>

      <DetailPane
        eyebrow={isChosen ? "Selected origin" : "Origin"}
        title={activeOrigin.name}
        pills={vocations.map((v) => <StatPill key={v.id} label={v.name} />)}
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

        <div className="bld-voc-section">
          <div className="bld-field-label">
            Vocation{isChosen ? "" : " — select this origin to choose"}
          </div>
          {vocations.length === 0 ? (
            <div className="bld-empty" style={{ padding: 16 }}>This origin has no vocations authored yet.</div>
          ) : !isChosen ? (
            <div className="bld-note" style={{ margin: 0 }}>
              Click <em>{activeOrigin.name}</em> on the left to lock it in, then pick a vocation here.
            </div>
          ) : (
            <div className="bld-voc-chooser">
              {vocations.map((v) => {
                const on = v.id === chosenVocation;
                const bonus = v.attribute_bonus;
                const vFeats = v.feats?.filter((f) => f.tier === 0) ?? [];
                return (
                  <div
                    key={v.id}
                    className={`bld-voc-card${on ? " bld-voc-card--on" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={on}
                    onClick={() => pickVocation(v.id, on)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickVocation(v.id, on); } }}
                  >
                    <div className="bld-voc-card-head">
                      <span className="bld-voc-card-name">{v.name}</span>
                      {bonus && <StatPill label={`+${bonus.amount} ${capitalize(bonus.attribute)}`} accent />}
                      {v.spellcasting && (
                        <StatPill
                          label={`${capitalize(v.spellcasting.caster_type)}${
                            typeof v.spellcasting.source === "string" ? ` · ${capitalize(v.spellcasting.source)}` : ""
                          }`}
                        />
                      )}
                      {on && <span className="bld-voc-card-check">✓ chosen</span>}
                    </div>
                    {v.description && <div className="bld-voc-card-desc">{v.description}</div>}
                    {on && vFeats.length > 0 && (
                      <div className="bld-voc-card-feats">
                        {vFeats.map((f) => <FeatureCard key={f.id} feat={f} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DetailPane>
    </div>
  );
}

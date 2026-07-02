import { REGISTRY } from "../../../core/data-registry.ts";
import { ATTRIBUTES } from "../../../core/types.ts";
import type { StepProps } from "../step.ts";

export function SummaryStep({ draft, computed }: StepProps) {
  const b = draft.build;
  const prof = REGISTRY.professions.get(b.profession_id)?.name ?? "—";
  const origin = REGISTRY.origins.get(b.origin_id)?.name ?? "—";
  const vocation = REGISTRY.vocations.get(b.vocation_id)?.name ?? "—";

  return (
    <div>
      <div className="bld-grid">
        <Stat label="Identity" value={draft.identity.name || "Unnamed"} />
        <Stat label="Tier" value={String(computed.tier)} />
        <Stat label="Profession" value={prof} />
        <Stat label="Origin / Vocation" value={`${origin} · ${vocation}`} />
      </div>

      <div className="bld-field-label" style={{ marginTop: 26 }}>Attributes</div>
      <div className="bld-grid">
        {ATTRIBUTES.map((k) => <Stat key={k} label={k} value={String(computed.attributes[k])} />)}
      </div>

      <div className="bld-field-label" style={{ marginTop: 26 }}>Defenses</div>
      <div className="bld-grid">
        {Object.entries(computed.defenses).map(([k, v]) => <Stat key={k} label={k} value={String(v)} />)}
      </div>

      <div className="bld-field-label" style={{ marginTop: 26 }}>Vitals</div>
      <div className="bld-grid">
        <Stat label="Vitality" value={String(computed.vitality.max)} />
        <Stat label="Wounds" value={String(computed.wounds.max)} />
        <Stat label="Ambition" value={`${computed.ambition.max} · ${computed.ambition.die}`} />
      </div>

      <div className="bld-field-label" style={{ marginTop: 26 }}>
        Warnings {computed.warnings.length ? `(${computed.warnings.length})` : ""}
      </div>
      {computed.warnings.length === 0 ? (
        <div className="bld-empty" style={{ color: "var(--vitality)" }}>Clean — ready to save.</div>
      ) : (
        <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--danger)", fontSize: 13, lineHeight: 1.6 }}>
          {computed.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bld-pick" style={{ cursor: "default" }}>
      <div className="bld-pick-meta" style={{ textTransform: "capitalize" }}>{label}</div>
      <div className="bld-pick-name" style={{ marginTop: 2 }}>{value}</div>
    </div>
  );
}

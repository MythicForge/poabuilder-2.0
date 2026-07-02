import type { StepProps } from "../step.ts";

// Skeleton: surfaces the spellcasting allowances the engine computes so the
// framework is wired, and leaves the actual sphere/spell/choice pickers as the
// fill-in-later slot (reuse the sheet's Feats/Spells pickers when authored).

export function ChoicesStep({ draft, computed }: StepProps) {
  const sc = computed.spellcasting;
  const choiceKeys = Object.keys(draft.build.choices ?? {});

  return (
    <div>
      <div className="bld-field-label">Spellcasting allowances</div>
      {sc ? (
        <div className="bld-grid">
          <Stat label="Caster" value={sc.casterType} />
          <Stat label="Known spells" value={String(sc.knownAllowance)} />
          <Stat label="Cantrips" value={String(sc.cantripAllowance)} />
          <Stat label="Prepared" value={String(sc.preparedAllowance)} />
          <Stat label="Spell DC" value={String(sc.spellDC)} />
          <Stat label="Spheres" value={sc.spheres.join(", ") || "—"} />
        </div>
      ) : (
        <div className="bld-empty">This build has no spellcasting grant.</div>
      )}

      <div className="bld-field-label" style={{ marginTop: 26 }}>Pending choices</div>
      {choiceKeys.length === 0 ? (
        <div className="bld-empty">No stored choices yet.</div>
      ) : (
        <ul className="bld-note" style={{ listStyle: "none", padding: "0 0 0 10px" }}>
          {choiceKeys.map((k) => (
            <li key={k}>{k}: {String(draft.build.choices[k])}</li>
          ))}
        </ul>
      )}

      <div className="bld-note">
        Sphere / cantrip / known-spell pickers and per-feat choice resolution land here —
        gated on the spell + choice pools being authored in the new format.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bld-pick" style={{ cursor: "default" }}>
      <div className="bld-pick-meta">{label}</div>
      <div className="bld-pick-name" style={{ marginTop: 2 }}>{value}</div>
    </div>
  );
}

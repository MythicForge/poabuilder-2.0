import { REGISTRY } from "../../../core/data-registry.ts";
import type { StepProps } from "../step.ts";

// Skeleton: previews the profession + origin starting-pack manifests. Turning
// pack entries into catalog items (category pickers / fuzzy name match) is the
// fill-in-later slot — see review/05-builder-wizard.md step 7.

export function PackStep({ draft }: StepProps) {
  const prof = REGISTRY.professions.get(draft.build.profession_id);
  const origin = REGISTRY.origins.get(draft.build.origin_id);

  return (
    <div>
      <Manifest title={prof ? `${prof.name} starting pack` : "Profession pack"} pack={prof?.starting_pack} />
      <Manifest title={origin ? `${origin.name} pack` : "Origin pack"} pack={origin?.pack} />
      <div className="bld-note">
        Pack entries become inventory items once the catalog-category pickers are wired.
        Until then this is a read-only manifest of what the chosen options grant.
      </div>
    </div>
  );
}

function Manifest({ title, pack }: { title: string; pack?: Record<string, unknown> }) {
  const entries = pack ? Object.entries(pack) : [];
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="bld-field-label">{title}</div>
      {entries.length === 0 ? (
        <div className="bld-empty">Nothing selected yet.</div>
      ) : (
        <div className="bld-grid">
          {entries.map(([k, v]) => (
            <div key={k} className="bld-pick" style={{ cursor: "default" }}>
              <div className="bld-pick-meta">{k}</div>
              <div className="bld-pick-desc" style={{ marginTop: 4 }}>
                {Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

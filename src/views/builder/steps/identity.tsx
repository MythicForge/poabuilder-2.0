import type { StepProps } from "../step.ts";

export function IdentityStep({ draft, update }: StepProps) {
  const id = draft.identity;
  return (
    <div>
      <div className="bld-field">
        <label className="bld-field-label" htmlFor="bld-name">Name</label>
        <input
          id="bld-name"
          className="bld-input"
          value={id.name}
          placeholder="Who are they?"
          onChange={(e) => update((d) => { d.identity.name = e.target.value; })}
        />
      </div>

      <div className="bld-field">
        <label className="bld-field-label" htmlFor="bld-tags">Tags</label>
        <input
          id="bld-tags"
          className="bld-input"
          value={id.tags.join(", ")}
          placeholder="comma, separated, descriptors"
          onChange={(e) =>
            update((d) => {
              d.identity.tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
            })
          }
        />
      </div>

      <div className="bld-field">
        <label className="bld-field-label" htmlFor="bld-portrait">Portrait URL</label>
        <input
          id="bld-portrait"
          className="bld-input"
          value={id.portrait ?? ""}
          placeholder="https://…  (or leave blank for a monogram)"
          onChange={(e) => update((d) => { d.identity.portrait = e.target.value || null; })}
        />
      </div>
    </div>
  );
}

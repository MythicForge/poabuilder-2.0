// Character Builder shell — a left-stepper wizard over a draft StoredCharacter.
// The engine (computeCharacter) does the math; each step is UI over existing
// rules. Steps are intentionally skeletal where they need content that isn't
// authored yet — the framework is complete and tolerates partial data.

import { useMemo, useState } from "react";
import "@ui/styles.css";
import "./builder.css";
import { CharStorage } from "../../core/storage.ts";
import { REGISTRY } from "../../core/data-registry.ts";
import { computeCharacter } from "../../core/compute.ts";
import { validateCharacter } from "../../core/validate-character.ts";
import type { StoredCharacter } from "../../core/types.ts";
import { ViewSwitcher } from "../view-switcher.tsx";
import { STEPS } from "./steps/index.ts";

function initialDraft(): StoredCharacter {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") ?? CharStorage.activeId();
  const existing = id ? CharStorage.get(id) : null;
  return existing ?? CharStorage.newFromTemplate("");
}

export function Builder() {
  const [draft, setDraft] = useState<StoredCharacter>(initialDraft);
  const [stepIx, setStepIx] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Engine warnings (data integrity) + build-legality issues, merged so the
  // footer badge and Summary step reflect everything a player must resolve.
  const computed = useMemo(() => {
    const c = computeCharacter(draft, REGISTRY);
    const issues = validateCharacter(draft, REGISTRY, c);
    return { ...c, warnings: [...c.warnings, ...issues] };
  }, [draft]);

  const update = (mutate: (d: StoredCharacter) => void) =>
    setDraft((d) => {
      const next = structuredClone(d);
      mutate(next);
      return next;
    });

  const step = STEPS[stepIx];
  const isFirst = stepIx === 0;
  const isLast = stepIx === STEPS.length - 1;

  const save = (thenOpenSheet: boolean) => {
    CharStorage.save(draft);
    CharStorage.setActive(draft.id);
    if (thenOpenSheet) {
      window.location.href = "sheet.html";
      return;
    }
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="bld">
      <header className="bld-top">
        <div className="bld-top-brand">
          <div className="bld-brand-eyebrow">Path of Ambition</div>
          <div className="bld-brand-title">Character Builder</div>
        </div>
        <div className="bld-top-name">
          <span className="bld-top-name-label">EDITING</span>
          <span className="bld-top-name-val">{draft.identity.name || "Unnamed"}</span>
        </div>
        <ViewSwitcher current="builder" charId={draft.id} />
      </header>

      <div className="bld-body">
        <nav className="bld-rail" aria-label="Creation steps">
          <ol className="bld-steps">
            {STEPS.map((s, i) => {
              const state = i === stepIx ? "active" : i < stepIx ? "done" : "todo";
              return (
                <li key={s.id}>
                  <button
                    className={`bld-step bld-step--${state}`}
                    onClick={() => setStepIx(i)}
                    aria-current={i === stepIx ? "step" : undefined}
                  >
                    <span className="bld-step-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="bld-step-label">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="bld-panel">
          <div className="bld-panel-head">
            <div className="bld-panel-eyebrow">
              Step {stepIx + 1} of {STEPS.length}
            </div>
            <h1 className="bld-panel-title">{step.title}</h1>
            <p className="bld-panel-blurb">{step.blurb}</p>
          </div>
          <div className="bld-panel-body">
            <step.Component draft={draft} update={update} computed={computed} />
          </div>
        </main>
      </div>

      <footer className="bld-foot">
        <div className="bld-foot-stat">
          <span className="bld-foot-stat-num">{computed.tier}</span>
          <span className="bld-foot-stat-lbl">TIER</span>
        </div>
        <div className="bld-foot-stat">
          <span
            className="bld-foot-stat-num"
            style={{ color: computed.warnings.length ? "var(--danger)" : "var(--vitality)" }}
          >
            {computed.warnings.length}
          </span>
          <span className="bld-foot-stat-lbl">WARNINGS</span>
        </div>
        {savedAt && <div className="bld-foot-saved">Saved {savedAt}</div>}
        <div className="bld-foot-nav">
          <button className="bld-btn" disabled={isFirst} onClick={() => setStepIx((i) => i - 1)}>
            Back
          </button>
          <button className="bld-btn bld-btn--ghost" onClick={() => save(false)}>
            Save
          </button>
          {isLast ? (
            <button className="bld-btn bld-btn--gold" onClick={() => save(true)}>
              Save &amp; Open Sheet
            </button>
          ) : (
            <button className="bld-btn bld-btn--gold" onClick={() => setStepIx((i) => i + 1)}>
              Next →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

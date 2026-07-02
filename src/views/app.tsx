// Phase-1 sheet shell: loads the active character (or the fixture as a dev
// fallback), computes, and renders a debug summary. Replaced by the full
// sheet UI in Phase 2.

import { useMemo, useState } from "react";
import { REGISTRY } from "../core/data-registry.ts";
import { computeCharacter } from "../core/compute.ts";
import { CharStorage } from "../core/storage.ts";
import type { StoredCharacter } from "../core/types.ts";
import brenFixture from "@data/characters/fixture-bren-tier2-fighter.json";

function loadInitial(): StoredCharacter {
  const activeId = CharStorage.activeId();
  const fromRoster = activeId ? CharStorage.get(activeId) : null;
  return fromRoster ?? (brenFixture as unknown as StoredCharacter);
}

export function App() {
  const [stored, setStoredRaw] = useState<StoredCharacter>(loadInitial);
  const setStored = (updater: (s: StoredCharacter) => StoredCharacter) => {
    setStoredRaw((prev) => {
      const next = updater(prev);
      CharStorage.save(next);
      return next;
    });
  };
  const c = useMemo(() => computeCharacter(stored, REGISTRY), [stored]);

  return (
    <div style={{ fontFamily: "monospace", padding: 24, color: "#ddd", background: "#141210", minHeight: "100vh" }}>
      <h1>{stored.identity.name} — Tier {c.tier}</h1>
      <p>
        {REGISTRY.professions.get(stored.build.profession_id)?.name} ·{" "}
        {REGISTRY.origins.get(stored.build.origin_id)?.name} ·{" "}
        {REGISTRY.vocations.get(stored.build.vocation_id)?.name}
      </p>
      <p>
        Brawn {c.attributes.brawn} | Finesse {c.attributes.finesse} | Mind {c.attributes.mind} | Will {c.attributes.will}
      </p>
      <p>
        Armor {c.defenses.Armor} | Fortitude {c.defenses.Fortitude} | Mental {c.defenses.Mental} | Will {c.defenses["Will Defense"]}
      </p>
      <p>
        Vitality {c.vitality.current}/{c.vitality.max} (+{c.vitality.temp} temp) | Wounds {c.wounds.current}/{c.wounds.max} | Ambition {c.ambition.current}/{c.ambition.max} ({c.ambition.die})
      </p>
      <button onClick={() => setStored((s) => ({ ...s, pools: { ...s.pools, vitality: Math.max(0, s.pools.vitality - 1) } }))}>
        −1 Vitality (persistence smoke test)
      </button>
      <h2>Skills</h2>
      <ul>{c.skills.map((s) => <li key={s.skill}>{s.skill}: {s.display} ({s.rank})</li>)}</ul>
      <h2>Resources</h2>
      <ul>{c.resources.map((r) => <li key={r.def.id}>{r.def.name}: {r.current}/{r.max}</li>)}</ul>
      {c.spellcasting && (
        <p>Spell DC {c.spellcasting.spellDC} | Reservoir max {c.spellcasting.reservoirMax} | Known {stored.build.known_spell_ids.length}/{c.spellcasting.knownAllowance}</p>
      )}
      <h2>Feats ({c.featCards.length})</h2>
      <ul>{c.featCards.map((f) => <li key={f.feat.id}>[{f.owner}] {f.feat.name}{f.starting ? " (starting)" : ""} — {f.activeBoons.length} active boons</li>)}</ul>
      {c.warnings.length > 0 && <pre style={{ color: "#e66" }}>{c.warnings.join("\n")}</pre>}
    </div>
  );
}

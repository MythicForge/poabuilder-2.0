// Alternate PoA sheet skin ("Codex") — a distinct read-only presentation of the
// SAME StoredCharacter + computeCharacter, proving the shared @ui tokens carry a
// second layout. This is a skin over PoA rules, NOT a different ruleset.

import { useMemo, useState } from "react";
import "@ui/styles.css";
import "./skin.css";
import { REGISTRY } from "../../core/data-registry.ts";
import { computeCharacter } from "../../core/compute.ts";
import { CharStorage } from "../../core/storage.ts";
import { ATTRIBUTES, type AttributeKey, type StoredCharacter } from "../../core/types.ts";
import brenFixture from "@data/characters/fixture-bren-tier2-fighter.json";

function loadInitial(): StoredCharacter {
  const fixture = brenFixture as unknown as StoredCharacter;
  const activeId = CharStorage.activeId();
  return (activeId ? CharStorage.get(activeId) : null) ?? CharStorage.get(fixture.id) ?? fixture;
}

const ATTR_ABBR: Record<AttributeKey, string> = { brawn: "BRW", finesse: "FIN", mind: "MND", will: "WIL" };

export function SkinSheet() {
  const [stored] = useState<StoredCharacter>(loadInitial);
  const c = useMemo(() => computeCharacter(stored, REGISTRY), [stored]);

  const prof = REGISTRY.professions.get(stored.build.profession_id)?.name;
  const origin = REGISTRY.origins.get(stored.build.origin_id)?.name;
  const vocation = REGISTRY.vocations.get(stored.build.vocation_id)?.name;
  const tags = [prof, origin, vocation].filter(Boolean) as string[];

  return (
    <div className="codex">
      <div className="codex-crumbs">
        <a className="codex-crumb" href="index.html">← Roster</a>
        <a className="codex-crumb" href="sheet.html">Full sheet →</a>
      </div>

      <header className="codex-hero">
        <div className="codex-portrait">
          {stored.identity.portrait
            ? <img src={stored.identity.portrait} alt="" />
            : <span>{(stored.identity.name || "?")[0]}</span>}
        </div>
        <div className="codex-titleblock">
          <div className="codex-eyebrow">Tier {c.tier} · {stored.build.feats_purchased} feats</div>
          <h1 className="codex-name">{stored.identity.name || "Unnamed"}</h1>
          <div className="codex-tags">{tags.join("  ·  ") || "no profession chosen"}</div>
        </div>
      </header>

      <section className="codex-abilities">
        {ATTRIBUTES.map((key) => (
          <div className="codex-plaque" key={key}>
            <div className="codex-plaque-abbr">{ATTR_ABBR[key]}</div>
            <div className="codex-plaque-score">{c.attributes[key]}</div>
            <div className="codex-plaque-name">{key}</div>
          </div>
        ))}
      </section>

      <section className="codex-tiles">
        <Tile label="Armor" value={c.defenses.Armor} />
        <Tile label="Vitality" value={c.vitality.max} sub={`${c.vitality.current} now`} />
        <Tile label="Wounds" value={c.wounds.max} sub={`${c.wounds.current} taken`} />
        <Tile label="Ambition" value={c.ambition.max} sub={c.ambition.die} />
      </section>

      <div className="codex-columns">
        <section className="codex-panel">
          <h2 className="codex-panel-title">Defenses</h2>
          {(Object.entries(c.defenses) as [string, number][]).map(([k, v]) => (
            <div className="codex-line" key={k}>
              <span>{k}</span><span className="codex-line-val">{v}</span>
            </div>
          ))}
        </section>

        <section className="codex-panel">
          <h2 className="codex-panel-title">V.I.T.A.L.S.</h2>
          {c.skills.map((s) => (
            <div className="codex-line" key={s.skill}>
              <span>{s.skill}</span>
              <span className="codex-line-val">{s.display}<span className="codex-line-rank"> {s.rank}</span></span>
            </div>
          ))}
        </section>
      </div>

      {c.spellcasting && (
        <section className="codex-panel" style={{ marginTop: 16 }}>
          <h2 className="codex-panel-title">Spellcasting</h2>
          <div className="codex-line"><span>Spell DC</span><span className="codex-line-val">{c.spellcasting.spellDC}</span></div>
          <div className="codex-line"><span>Reservoir</span><span className="codex-line-val">{c.spellcasting.reservoirMax}</span></div>
          <div className="codex-line"><span>Known / Prepared</span><span className="codex-line-val">{c.spellcasting.knownAllowance} / {c.spellcasting.preparedAllowance}</span></div>
        </section>
      )}

      <footer className="codex-foot">Codex skin — read-only view · edit on the full sheet or builder</footer>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="codex-tile">
      <div className="codex-tile-label">{label}</div>
      <div className="codex-tile-val">{value}</div>
      {sub && <div className="codex-tile-sub">{sub}</div>}
    </div>
  );
}

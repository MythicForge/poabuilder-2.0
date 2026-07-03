// Alternate PoA sheet skin ("Codex") — an editable play-view of the SAME
// StoredCharacter + computeCharacter. Two-layer state like the full sheet:
// `stored` is the only mutable state, `c` recomputes and auto-saves. Play-time
// trackers (pools, conditions, renown) + identity are editable here; build
// choices (attributes, feats, skills) and computed values stay read-only —
// those live in the Builder / are derived.

import { useEffect, useMemo, useRef, useState } from "react";
import "@ui/styles.css";
import "./skin.css";
import { REGISTRY } from "../../core/data-registry.ts";
import { computeCharacter } from "../../core/compute.ts";
import { CharStorage } from "../../core/storage.ts";
import { ATTRIBUTES, type AttributeKey, type StoredCharacter } from "../../core/types.ts";
import { ConditionsBar } from "../../shared/condition-bar.tsx";
import { ViewSwitcher } from "../view-switcher.tsx";
import brenFixture from "@data/characters/fixture-bren-tier2-fighter.json";

function loadInitial(): StoredCharacter {
  const fixture = brenFixture as unknown as StoredCharacter;
  const activeId = CharStorage.activeId();
  const char = (activeId ? CharStorage.get(activeId) : null) ?? CharStorage.get(fixture.id) ?? fixture;
  CharStorage.setActive(char.id);
  return char;
}

const ATTR_ABBR: Record<AttributeKey, string> = { brawn: "BRW", finesse: "FIN", mind: "MND", will: "WIL" };

export function SkinSheet() {
  const [stored, setStored] = useState<StoredCharacter>(loadInitial);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { CharStorage.save(stored); }, [stored]);

  const c = useMemo(() => computeCharacter(stored, REGISTRY), [stored]);

  const prof = REGISTRY.professions.get(stored.build.profession_id)?.name;
  const origin = REGISTRY.origins.get(stored.build.origin_id)?.name;
  const vocation = REGISTRY.vocations.get(stored.build.vocation_id)?.name;
  const tags = [prof, origin, vocation].filter(Boolean) as string[];

  const setPool = (key: "vitality" | "wounds" | "ambition", n: number, max: number) =>
    setStored((s) => ({ ...s, pools: { ...s.pools, [key]: Math.max(0, Math.min(max, n)) } }));
  const setRenown = (n: number) =>
    setStored((s) => ({ ...s, play: { ...s.play, renown: Math.max(0, n) } }));
  const uploadPortrait = (file: File) => {
    const r = new FileReader();
    r.onload = () => setStored((s) => ({ ...s, identity: { ...s.identity, portrait: r.result as string } }));
    r.readAsDataURL(file);
  };

  return (
    <div className="codex">
      <div className="codex-crumbs">
        <ViewSwitcher current="codex" charId={stored.id} />
      </div>

      <header className="codex-hero">
        <div
          className="codex-portrait"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) uploadPortrait(f); }}
          title="Click or drag to set portrait"
          style={{ cursor: "pointer" }}
        >
          {stored.identity.portrait
            ? <img src={stored.identity.portrait} alt="" />
            : <span>{(stored.identity.name || "?")[0]}</span>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPortrait(f); e.target.value = ""; }} />
        </div>
        <div className="codex-titleblock">
          <div className="codex-eyebrow">
            Tier {c.tier} · {stored.build.feats_purchased} feats · Renown
            <span className="codex-pm" onClick={() => setRenown(stored.play.renown - 1)}>−</span>
            {stored.play.renown}
            <span className="codex-pm" onClick={() => setRenown(stored.play.renown + 1)}>+</span>
          </div>
          <input
            className="codex-name codex-name-input"
            value={stored.identity.name}
            placeholder="Unnamed"
            onChange={(e) => setStored((s) => ({ ...s, identity: { ...s.identity, name: e.target.value } }))}
          />
          <div className="codex-tags">{tags.join("  ·  ") || "no profession chosen"}</div>
        </div>
      </header>

      <ConditionsBar
        conditions={stored.conditions}
        catalog={[...REGISTRY.conditions.values()]}
        onChange={(next) => setStored((s) => ({ ...s, conditions: next }))}
      />

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
        <PoolTile label="Vitality" cur={c.vitality.current} max={c.vitality.max}
          sub={c.vitality.temp ? `+${c.vitality.temp} temp` : undefined}
          onChange={(n) => setPool("vitality", n, c.vitality.max)} />
        <PoolTile label="Wounds" cur={c.wounds.current} max={c.wounds.max} danger
          onChange={(n) => setPool("wounds", n, c.wounds.max)} />
        <PoolTile label="Ambition" cur={c.ambition.current} max={c.ambition.max} sub={c.ambition.die}
          onChange={(n) => setPool("ambition", n, c.ambition.max)} />
      </section>

      <div className="codex-columns">
        <section className="codex-panel">
          <h2 className="codex-panel-title">Defenses</h2>
          {(Object.entries(c.defenses) as [string, number][]).map(([k, v]) => (
            <div className="codex-line" key={k}><span>{k}</span><span className="codex-line-val">{v}</span></div>
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

      <footer className="codex-foot">Codex — editable play view · attributes, feats & inventory live in the Builder / full sheet</footer>
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

function PoolTile({ label, cur, max, sub, danger, onChange }: {
  label: string; cur: number; max: number; sub?: string; danger?: boolean; onChange: (n: number) => void;
}) {
  return (
    <div className="codex-tile" style={danger && cur >= max ? { borderColor: "var(--danger)" } : undefined}>
      <div className="codex-tile-label">{label}</div>
      <div className="codex-tile-pool">
        <span className="codex-pm" onClick={() => onChange(cur - 1)}>−</span>
        <span className="codex-tile-val">{cur}</span>
        <span className="codex-pm" onClick={() => onChange(cur + 1)}>+</span>
        <span className="codex-tile-max">/ {max}</span>
      </div>
      {sub && <div className="codex-tile-sub">{sub}</div>}
    </div>
  );
}

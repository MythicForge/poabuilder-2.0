// Top character bar: breadcrumbs, identity row (portrait / name / tags),
// TIER · FEATS · RENOWN cluster, conditions bar.

import { useRef } from "react";
import type { ComputedCharacter, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { ConditionsBar } from "../shared/condition-bar.tsx";
import { ViewSwitcher } from "./view-switcher.tsx";

interface CharBarProps {
  stored: StoredCharacter;
  c: ComputedCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

export function CharBar({ stored, c, setStored }: CharBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPortrait = (file: File) => {
    const reader = new FileReader();
    reader.onload = () =>
      setStored((s) => ({ ...s, identity: { ...s.identity, portrait: reader.result as string } }));
    reader.readAsDataURL(file);
  };

  const professionName = REGISTRY.professions.get(stored.build.profession_id)?.name ?? stored.build.profession_id;
  const originName = REGISTRY.origins.get(stored.build.origin_id)?.name ?? stored.build.origin_id;
  const vocationName = REGISTRY.vocations.get(stored.build.vocation_id)?.name ?? stored.build.vocation_id;
  const tags = [professionName, originName, vocationName].filter(Boolean);

  return (
    <div className="char-bar">
      <div className="char-bar-crumbs">
        <ViewSwitcher current="sheet" charId={stored.id} />
      </div>

      <div className="top">
        <div className="top-left" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            className="header-portrait-thumb"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f && f.type.startsWith("image/")) uploadPortrait(f);
            }}
            title="Click or drag to set portrait"
            style={{ cursor: "pointer" }}
          >
            {stored.identity.portrait ? (
              <img src={stored.identity.portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)" }}>PORTRAIT</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPortrait(f);
                e.target.value = "";
              }}
            />
          </div>
          <div>
            <div className="name">{stored.identity.name || "Unnamed"}</div>
            <div className="tags">
              {tags.map((t, i) => (
                <span key={t}>
                  <span>{t}</span>
                  {i < tags.length - 1 && <span className="sep"> · </span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="top-right">
          <div className="hbar-stats">
            <div className="hbar-stat">
              <div className="hbar-lbl">TIER</div>
              <div className="hbar-val">{c.tier}</div>
            </div>
            <div className="hbar-divider" />
            <div className="hbar-stat">
              <div className="hbar-lbl">FEATS</div>
              <div className="hbar-val">{stored.build.feats_purchased}</div>
            </div>
            <div className="hbar-divider" />
            <div className="hbar-stat" title="Renown — spend to purchase feats">
              <div className="hbar-lbl">RENOWN</div>
              <div className="hbar-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="pm" style={{ cursor: "pointer", fontSize: 13 }}
                  onClick={() => setStored((s) => ({ ...s, play: { ...s.play, renown: Math.max(0, s.play.renown - 1) } }))}>−</span>
                {stored.play.renown}
                <span className="pm" style={{ cursor: "pointer", fontSize: 13 }}
                  onClick={() => setStored((s) => ({ ...s, play: { ...s.play, renown: s.play.renown + 1 } }))}>+</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConditionsBar
        conditions={stored.conditions}
        catalog={[...REGISTRY.conditions.values()]}
        onChange={(next) => setStored((s) => ({ ...s, conditions: next }))}
      />
    </div>
  );
}

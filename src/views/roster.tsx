// Roster hub: character cards (open/duplicate/delete), new-from-template,
// import/export via the portable envelope.

import { useRef, useState } from "react";
import "../shared/styles.css";
import { CharStorage } from "../core/storage.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { computeCharacter } from "../core/compute.ts";
import { exportCharacter, importCharacter } from "../core/export.ts";
import type { StoredCharacter } from "../core/types.ts";

export function Roster() {
  const [list, setList] = useState(() => CharStorage.loadAll());
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setList(CharStorage.loadAll());

  const open = (id: string) => {
    CharStorage.setActive(id);
    window.location.href = "sheet.html";
  };

  const build = (id: string) => {
    CharStorage.setActive(id);
    window.location.href = `builder.html?id=${encodeURIComponent(id)}`;
  };

  const create = () => {
    const c = CharStorage.newFromTemplate("");
    CharStorage.save(c);
    build(c.id);
  };

  const doExport = (c: StoredCharacter) => {
    const blob = new Blob([exportCharacter(c)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(c.identity.name || "character").replace(/\s+/g, "-").toLowerCase()}.poa.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (file: File) => {
    try {
      const char = importCharacter(await file.text());
      if (CharStorage.get(char.id)) char.id = `char-${Date.now().toString(36)}`;
      CharStorage.save(char);
      refresh();
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="sheet" style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <div className="top" style={{ marginBottom: 20 }}>
        <div className="top-left">
          <div className="name">Path of Ambition</div>
          <div className="tags"><span>CHARACTER ROSTER</span></div>
        </div>
        <div className="top-right" style={{ gap: 10 }}>
          <button className="rest-btn" onClick={create}><span className="name">+ New Character</span></button>
          <button className="rest-btn" onClick={() => fileRef.current?.click()}><span className="name">Import</span></button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {list.map((ch) => {
          const c = computeCharacter(ch, REGISTRY);
          const profession = REGISTRY.professions.get(ch.build.profession_id)?.name ?? "—";
          const origin = REGISTRY.origins.get(ch.build.origin_id)?.name;
          return (
            <div className="card" key={ch.id} style={{ cursor: "pointer" }} onClick={() => open(ch.id)}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  className="header-portrait-thumb"
                  style={{ width: 52, height: 52, flexShrink: 0, overflow: "hidden", borderRadius: 8 }}
                >
                  {ch.identity.portrait
                    ? <img src={ch.identity.portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--gold-dim)", display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                        {(ch.identity.name || "?")[0]}
                      </span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--text)" }}>
                    {ch.identity.name || "Unnamed"}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
                    TIER {c.tier} · {profession}{origin ? ` · ${origin}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={() => open(ch.id)}>
                  <span className="name">Open</span>
                </button>
                <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={() => build(ch.id)}>
                  <span className="name">Build</span>
                </button>
                <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={() => { CharStorage.duplicate(ch.id); refresh(); }}>
                  <span className="name">Duplicate</span>
                </button>
                <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={() => doExport(ch)}>
                  <span className="name">Export</span>
                </button>
                <button
                  className="rest-btn"
                  style={{ padding: "2px 8px", marginLeft: "auto" }}
                  onClick={() => {
                    if (confirm(`Delete ${ch.identity.name || "this character"}? This cannot be undone.`)) {
                      CharStorage.remove(ch.id);
                      refresh();
                    }
                  }}
                >
                  <span className="name" style={{ color: "var(--danger)" }}>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, color: "var(--text-dim)" }}>
            No characters yet
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
            Create one, import a .poa.json export, or open the sheet page to use the dev fixture.
          </div>
        </div>
      )}
    </div>
  );
}

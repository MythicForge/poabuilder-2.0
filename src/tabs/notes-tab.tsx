// Notes tab: journal entries + biography fields + freeform notes.

import { useState } from "react";
import type { ComputedCharacter, StoredCharacter } from "../core/types.ts";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

const BIO_FIELDS = ["personality", "ideals", "bonds", "flaws", "backstory"] as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--card-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "6px 10px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  resize: "vertical",
};

export function NotesTab({ stored, setStored }: TabProps) {
  const [draftTitle, setDraftTitle] = useState("");

  const addEntry = () => {
    const now = new Date().toISOString();
    setStored((s) => ({
      ...s,
      notes: {
        ...s.notes,
        journal: [
          { id: `j-${Date.now().toString(36)}`, title: draftTitle || "Untitled", content: "", created_at: now, updated_at: now },
          ...s.notes.journal,
        ],
      },
    }));
    setDraftTitle("");
  };

  const updateEntry = (id: string, patch: Partial<{ title: string; content: string }>) =>
    setStored((s) => ({
      ...s,
      notes: {
        ...s.notes,
        journal: s.notes.journal.map((j) =>
          j.id === id ? { ...j, ...patch, updated_at: new Date().toISOString() } : j,
        ),
      },
    }));

  const removeEntry = (id: string) =>
    setStored((s) => ({ ...s, notes: { ...s.notes, journal: s.notes.journal.filter((j) => j.id !== id) } }));

  return (
    <>
      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Journal</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="new entry title…"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              style={{ ...inputStyle, width: 220 }}
            />
            <button className="rest-btn" style={{ padding: "2px 10px" }} onClick={addEntry}>
              <span className="name">+ Entry</span>
            </button>
          </div>
        </div>
        {stored.notes.journal.map((j) => (
          <div className="feat-row" key={j.id}>
            <div className="row-1">
              <input
                value={j.title}
                onChange={(e) => updateEntry(j.id, { title: e.target.value })}
                style={{ ...inputStyle, width: 260, fontWeight: 600 }}
              />
              <span className="src">{new Date(j.updated_at).toLocaleDateString()}</span>
              <span className="x" style={{ marginLeft: "auto", cursor: "pointer" }} onClick={() => removeEntry(j.id)}>✕</span>
            </div>
            <textarea
              value={j.content}
              rows={3}
              onChange={(e) => updateEntry(j.id, { content: e.target.value })}
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </div>
        ))}
      </div>

      <div className="list-card">
        <div className="card-header"><div className="card-title">Biography</div></div>
        {BIO_FIELDS.map((f) => (
          <div key={f} style={{ padding: "4px 10px 8px" }}>
            <div className="lbl" style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>
              {f}
            </div>
            <textarea
              value={stored.notes.biography[f]}
              rows={f === "backstory" ? 5 : 2}
              onChange={(e) =>
                setStored((s) => ({
                  ...s,
                  notes: { ...s.notes, biography: { ...s.notes.biography, [f]: e.target.value } },
                }))
              }
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <div className="list-card">
        <div className="card-header"><div className="card-title">Notes</div></div>
        <div style={{ padding: "4px 10px 10px" }}>
          <textarea
            value={stored.notes.freeform}
            rows={5}
            onChange={(e) => setStored((s) => ({ ...s, notes: { ...s.notes, freeform: e.target.value } }))}
            style={inputStyle}
          />
        </div>
      </div>
    </>
  );
}

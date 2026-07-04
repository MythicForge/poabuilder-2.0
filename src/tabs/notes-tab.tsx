// Notes tab: journal entries (list/edit) + biography fields + freeform notes.

import { useRef, useState } from "react";
import type { JournalEntry, StoredCharacter } from "../core/types.ts";

interface TabProps {
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

type Section = "journal" | "biography";
type JournalView = { mode: "list" } | { mode: "edit"; id: string };

const BIO_FIELDS = ["personality", "ideals", "bonds", "flaws", "backstory"] as const;
const JOURNAL_EXPORT_TYPE = "poa-journal-entry";

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

const subTabStyle: React.CSSProperties = { padding: "8px 14px", fontSize: 12 };

function excerpt(text: string, len = 72): string {
  const flat = text.trim().replace(/\s+/g, " ");
  return flat.length > len ? `${flat.slice(0, len)}…` : flat;
}

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "entry";
}

// ── Journal: list view ──────────────────────────────────────────────────────

function JournalList({
  entries,
  search,
  setSearch,
  onOpen,
  onNew,
  onImportClick,
  importError,
}: {
  entries: JournalEntry[];
  search: string;
  setSearch: (v: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onImportClick: () => void;
  importError: string | null;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? entries.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.content.toLowerCase().includes(q) ||
          (j.author_name ?? "").toLowerCase().includes(q),
      )
    : entries;

  return (
    <div className="list-card">
      <div className="card-header">
        <div className="card-title">Journal</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="search entries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 180 }}
          />
          <button className="rest-btn" style={{ padding: "2px 10px" }} onClick={onImportClick}>
            <span className="name">Import Note</span>
          </button>
          <button className="rest-btn" style={{ padding: "2px 10px" }} onClick={onNew}>
            <span className="name">+ New Entry</span>
          </button>
        </div>
      </div>
      {importError && (
        <div style={{ padding: "4px 10px", color: "var(--danger, #c66)", fontSize: 11, fontFamily: "var(--mono)" }}>
          {importError}
        </div>
      )}
      {filtered.length === 0 && (
        <div style={{ padding: "16px 10px", color: "var(--text-faint)", fontSize: 12 }}>
          {entries.length === 0 ? "No journal entries yet." : "No entries match your search."}
        </div>
      )}
      {filtered.map((j) => (
        <div className="feat-row" key={j.id} style={{ cursor: "pointer" }} onClick={() => onOpen(j.id)}>
          <div className="row-1">
            <span className="name" style={{ fontFamily: "var(--serif)", fontStyle: "italic" }}>{j.title}</span>
            <span className="src">{new Date(j.updated_at).toLocaleDateString()}</span>
          </div>
          {j.content.trim() && (
            <div className="desc" style={{ color: "var(--text-dim)" }}>{excerpt(j.content)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Journal: edit view ──────────────────────────────────────────────────────

function JournalEdit({
  entry,
  onBack,
  onChange,
  onDelete,
  onShare,
  shared,
}: {
  entry: JournalEntry;
  onBack: () => void;
  onChange: (patch: Partial<Pick<JournalEntry, "title" | "content">>) => void;
  onDelete: () => void;
  onShare: () => void;
  shared: boolean;
}) {
  return (
    <div className="list-card">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="x" style={{ cursor: "pointer" }} onClick={onBack}>← Back</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {shared && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>Downloaded</span>}
          <button className="rest-btn" style={{ padding: "2px 10px" }} onClick={onShare}>
            <span className="name">Share</span>
          </button>
          <button
            className="rest-btn"
            style={{ padding: "2px 10px" }}
            onClick={() => {
              if (window.confirm(`Delete "${entry.title}"?`)) onDelete();
            }}
          >
            <span className="name">Delete</span>
          </button>
        </div>
      </div>
      <div style={{ padding: "4px 10px 10px" }}>
        <input
          value={entry.title}
          onChange={(e) => onChange({ title: e.target.value })}
          style={{ ...inputStyle, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 16, marginBottom: 8 }}
        />
        <textarea
          value={entry.content}
          onChange={(e) => {
            onChange({ content: e.target.value });
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          style={{ ...inputStyle, resize: "none", overflow: "hidden", minHeight: 200 }}
        />
        <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
          Created {new Date(entry.created_at).toLocaleString()} · Updated {new Date(entry.updated_at).toLocaleString()}
          {entry.author_name ? ` · ${entry.author_name}` : ""}
        </div>
      </div>
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────

export function NotesTab({ stored, setStored }: TabProps) {
  const [section, setSection] = useState<Section>("journal");
  const [journalView, setJournalView] = useState<JournalView>({ mode: "list" });
  const [search, setSearch] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const switchSection = (s: Section) => {
    setSection(s);
    setJournalView({ mode: "list" });
    setSearch("");
    setImportError(null);
  };

  const addEntry = () => {
    const now = new Date().toISOString();
    const id = `j-${Date.now().toString(36)}`;
    setStored((s) => ({
      ...s,
      notes: {
        ...s.notes,
        journal: [{ id, title: "Untitled", content: "", created_at: now, updated_at: now }, ...s.notes.journal],
      },
    }));
    setJournalView({ mode: "edit", id });
  };

  const updateEntry = (id: string, patch: Partial<Pick<JournalEntry, "title" | "content">>) =>
    setStored((s) => ({
      ...s,
      notes: {
        ...s.notes,
        journal: s.notes.journal.map((j) =>
          j.id === id ? { ...j, ...patch, updated_at: new Date().toISOString() } : j,
        ),
      },
    }));

  const removeEntry = (id: string) => {
    setStored((s) => ({ ...s, notes: { ...s.notes, journal: s.notes.journal.filter((j) => j.id !== id) } }));
    setJournalView({ mode: "list" });
  };

  const shareEntry = (entry: JournalEntry) => {
    const payload = {
      type: JOURNAL_EXPORT_TYPE,
      version: 1,
      title: entry.title,
      content: entry.content,
      character_name: stored.identity.name,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(stored.identity.name || "character")}-${slug(entry.title)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setShared(true);
    setTimeout(() => setShared(false), 2200);
  };

  const importFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (raw.type !== JOURNAL_EXPORT_TYPE || typeof raw.title !== "string" || typeof raw.content !== "string") {
        throw new Error("Not a Path of Ambition journal entry file.");
      }
      const now = new Date().toISOString();
      const id = `j-${Date.now().toString(36)}`;
      const entry: JournalEntry = {
        id,
        title: raw.title,
        content: raw.content,
        created_at: now,
        updated_at: now,
        author_name: typeof raw.character_name === "string" ? raw.character_name : undefined,
      };
      setStored((s) => ({ ...s, notes: { ...s.notes, journal: [entry, ...s.notes.journal] } }));
      setImportError(null);
      setJournalView({ mode: "edit", id });
    } catch (e) {
      setImportError((e as Error).message || "Import failed.");
    }
  };

  const activeEntry =
    journalView.mode === "edit" ? stored.notes.journal.find((j) => j.id === journalView.id) : undefined;

  return (
    <>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab${section === "journal" ? " active" : ""}`} style={subTabStyle} onClick={() => switchSection("journal")}>
          Journal
        </button>
        <button className={`tab${section === "biography" ? " active" : ""}`} style={subTabStyle} onClick={() => switchSection("biography")}>
          Biography
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
          e.target.value = "";
        }}
      />

      {section === "journal" &&
        (journalView.mode === "list" || !activeEntry ? (
          <JournalList
            entries={stored.notes.journal}
            search={search}
            setSearch={setSearch}
            onOpen={(id) => setJournalView({ mode: "edit", id })}
            onNew={addEntry}
            onImportClick={() => fileRef.current?.click()}
            importError={importError}
          />
        ) : (
          <JournalEdit
            entry={activeEntry}
            onBack={() => setJournalView({ mode: "list" })}
            onChange={(patch) => updateEntry(activeEntry.id, patch)}
            onDelete={() => removeEntry(activeEntry.id)}
            onShare={() => shareEntry(activeEntry)}
            shared={shared}
          />
        ))}

      {section === "biography" && (
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
          <div style={{ padding: "4px 10px 10px" }}>
            <div className="lbl" style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>
              notes
            </div>
            <textarea
              value={stored.notes.freeform}
              rows={5}
              onChange={(e) => setStored((s) => ({ ...s, notes: { ...s.notes, freeform: e.target.value } }))}
              style={inputStyle}
            />
          </div>
        </div>
      )}
    </>
  );
}

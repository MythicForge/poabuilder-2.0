"use client";

/**
 * NotesTab — journal entries + character biography.
 *
 * Extracted from CharacterSheet.renderNotesTab() (REFACTOR_PLAN R2).
 * Journal view state (list/edit, active entry, search, draft fields) is
 * tab-local; entry content is persisted immediately on every keystroke via
 * `persist`, so nothing is lost when the tab unmounts.
 */
import { useState } from "react";
import type {
  Character,
  JournalEntry,
  BiographyFields,
} from "@/lib/characterTypes";

interface NotesTabProps {
  char: Character;
  persist: (patch: Partial<Character>) => void;
}

/** Wall-clock timestamp. Module-scope so call sites stay render-pure. */
function nowTs() {
  return Date.now();
}

function genJeId() {
  return `je_${nowTs()}_${Math.random().toString(36).slice(2, 6)}`;
}

function formatEntryDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function excerpt(text: string, max = 72) {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max).trimEnd() + "…";
}

export default function NotesTab({ char: c, persist }: NotesTabProps) {
  const [journalView, setJournalView] = useState<"list" | "edit">("list");
  const [activeJournalId, setActiveJournalId] = useState<string | null>(null);
  const [journalSearch, setJournalSearch] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalDeletePending, setJournalDeletePending] = useState<
    string | null
  >(null);

  const journal = c.journal ?? [];
  const bio = c.biography ?? {
    personality: "",
    ideals: "",
    bonds: "",
    flaws: "",
    backstory: "",
  };

  function openEntry(entry: JournalEntry) {
    setActiveJournalId(entry.id);
    setJournalTitle(entry.title);
    setJournalContent(entry.content);
    setJournalView("edit");
  }

  function newEntry() {
    const now = nowTs();
    const entry: JournalEntry = {
      id: genJeId(),
      title: "",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    persist({ journal: [entry, ...journal] });
    setActiveJournalId(entry.id);
    setJournalTitle("");
    setJournalContent("");
    setJournalView("edit");
  }

  function saveEntryField(field: "title" | "content", value: string) {
    if (!activeJournalId) return;
    persist({
      journal: journal.map((e) =>
        e.id === activeJournalId
          ? { ...e, [field]: value, updatedAt: nowTs() }
          : e,
      ),
    });
  }

  function deleteEntry(id: string) {
    persist({ journal: journal.filter((e) => e.id !== id) });
    if (id === activeJournalId) setJournalView("list");
    setJournalDeletePending(null);
  }

  function exportEntry(entry: JournalEntry) {
    const payload = JSON.stringify(
      {
        type: "poa-journal-entry",
        version: 1,
        title: entry.title || "Untitled",
        content: entry.content,
        characterName: c.name,
        exportedAt: nowTs(),
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (s: string) => s.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${slug(c.name || "character")}-${slug(entry.title || "entry")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importEntry(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.type !== "poa-journal-entry") return;
        const now = nowTs();
        const entry: JournalEntry = {
          id: genJeId(),
          title: parsed.title ?? "Imported Entry",
          content: parsed.content ?? "",
          createdAt: now,
          updatedAt: now,
        };
        persist({ journal: [entry, ...(c.journal ?? [])] });
      } catch {
        /* invalid file, ignore */
      }
    };
    reader.readAsText(file);
  }

  function updateBio(field: keyof BiographyFields, value: string) {
    persist({ biography: { ...bio, [field]: value } });
  }

  const bioSectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  };

  const bioLabelStyle: React.CSSProperties = {
    fontSize: "0.62rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    fontFamily: "var(--font-heading)",
  };

  const bioTextareaStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    fontSize: "0.85rem",
    fontFamily: "var(--font-body)",
    border: "1px solid var(--border)",
    borderRadius: "0.375rem",
    backgroundColor: "var(--bg-card)",
    color: "var(--text)",
    resize: "vertical",
    minHeight: "64px",
    lineHeight: 1.55,
    boxSizing: "border-box",
  };

  const filteredEntries = journalSearch.trim()
    ? journal.filter((e) => {
        const q = journalSearch.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q)
        );
      })
    : [...journal].sort((a, b) => b.updatedAt - a.updatedAt);

  // ── Edit view ──
  if (journalView === "edit" && activeJournalId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => setJournalView("list")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "0.78rem",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            ← Journal
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              const entry = journal.find((e) => e.id === activeJournalId);
              if (entry) exportEntry(entry);
            }}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "0.25rem",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "0.72rem",
              padding: "0.2rem 0.5rem",
            }}
          >
            Export
          </button>
          <button
            onClick={() => setJournalDeletePending(activeJournalId)}
            style={{
              background: "none",
              border: "1px solid rgb(var(--fail-rgb) / 0.4)",
              borderRadius: "0.25rem",
              cursor: "pointer",
              color: "var(--fail)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "0.72rem",
              padding: "0.2rem 0.5rem",
            }}
          >
            Delete
          </button>
        </div>
        {journalDeletePending === activeJournalId && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              backgroundColor: "rgb(var(--fail-rgb) / 0.08)",
              border: "1px solid rgb(var(--fail-rgb) / 0.4)",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "0.8rem",
              color: "var(--fail)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Delete this entry?
            <button
              onClick={() => deleteEntry(activeJournalId)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--fail)",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "0.78rem",
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setJournalDeletePending(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "0.78rem",
              }}
            >
              Cancel
            </button>
          </div>
        )}
        <input
          type="text"
          value={journalTitle}
          onChange={(e) => {
            setJournalTitle(e.target.value);
            saveEntryField("title", e.target.value);
          }}
          placeholder="Entry title…"
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            fontSize: "1rem",
            fontFamily: "var(--font-heading)",
            fontStyle: "italic",
            fontWeight: 700,
            border: "none",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "transparent",
            color: "var(--text)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {(() => {
          const entry = journal.find((e) => e.id === activeJournalId);
          return (
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {entry ? `Last edited ${formatEntryDate(entry.updatedAt)}` : ""}
            </div>
          );
        })()}
        <textarea
          value={journalContent}
          onChange={(e) => {
            setJournalContent(e.target.value);
            saveEntryField("content", e.target.value);
          }}
          placeholder="Write your entry…"
          style={{
            width: "100%",
            minHeight: "280px",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            fontFamily: "var(--font-body)",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            backgroundColor: "var(--bg-card)",
            color: "var(--text)",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.65,
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Journal */}
      <div>
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--c-spell)",
            fontFamily: "var(--font-heading)",
            marginBottom: "0.5rem",
            paddingLeft: "0.625rem",
            borderLeft: "3px solid var(--c-spell)",
          }}
        >
          Journal
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            type="text"
            placeholder="Search entries…"
            value={journalSearch}
            onChange={(e) => setJournalSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "0.375rem 0.625rem",
              fontSize: "0.8rem",
              fontFamily: "var(--font-body)",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-card)",
              color: "var(--text)",
              outline: "none",
            }}
          />
          <button
            onClick={newEntry}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "var(--primary)",
              color: "var(--text-on-primary)",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "0.78rem",
              whiteSpace: "nowrap",
            }}
          >
            + New Entry
          </button>
          <label style={{ cursor: "pointer" }}>
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) importEntry(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.375rem 0.625rem",
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              Import
            </span>
          </label>
        </div>
        {filteredEntries.length === 0 ? (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              padding: "0.5rem 0",
            }}
          >
            {journalSearch ? "No entries match." : "No journal entries yet."}
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => openEntry(entry)}
                style={{
                  padding: "0.625rem 0.875rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  transition: "border-color 0.12s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontStyle: "italic",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: "var(--text)",
                    }}
                  >
                    {entry.title || "Untitled"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-heading)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatEntryDate(entry.updatedAt)}
                  </span>
                </div>
                {entry.content && (
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      marginTop: "0.25rem",
                      lineHeight: 1.4,
                    }}
                  >
                    {excerpt(entry.content)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Biography */}
      <div>
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--c-origin)",
            fontFamily: "var(--font-heading)",
            marginBottom: "0.75rem",
            paddingLeft: "0.625rem",
            borderLeft: "3px solid var(--c-origin)",
          }}
        >
          Biography
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
        >
          {(
            ["personality", "ideals", "bonds", "flaws", "backstory"] as const
          ).map((field) => (
            <div key={field} style={bioSectionStyle}>
              <div style={bioLabelStyle}>
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </div>
              <textarea
                value={bio[field]}
                onChange={(e) => updateBio(field, e.target.value)}
                placeholder={`${field.charAt(0).toUpperCase() + field.slice(1)}…`}
                style={{
                  ...bioTextareaStyle,
                  minHeight: field === "backstory" ? "120px" : "64px",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

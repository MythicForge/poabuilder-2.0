import React, { useState, useRef, useEffect, useCallback } from "react";
import type { StoredChar, ComputedChar } from "../core/types";
import type { JournalEntry } from "../core/types";
import type { CampaignRules } from "../core/campaign-rules";
import { PluginRegistry } from "../features/plugin-registry";

interface NotesTabProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  rules: CampaignRules;
}

type Section = "journal" | "biography";
type JournalView = { mode: "list" } | { mode: "edit"; id: string };

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function excerpt(text: string, max = 72): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "…";
}

// ── Module-level components (avoids remount-on-render focus loss) ─────────────

interface ListProps {
  journal: JournalEntry[];
  search: string;
  setSearch: (v: string) => void;
  importError: string;
  onOpenEntry: (id: string) => void;
  onCreateEntry: () => void;
  onImport: (file: File) => void;
}

function JournalList({
  journal,
  search,
  setSearch,
  importError,
  onOpenEntry,
  onCreateEntry,
  onImport,
}: ListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filtered = journal.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      (e.authorName?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search entries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "var(--card-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "6px 10px",
            color: "var(--text)",
            fontFamily: "var(--sans)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={onCreateEntry}
          style={{
            background: "var(--gold-dim)",
            border: "1px solid var(--gold)",
            borderRadius: 4,
            padding: "6px 12px",
            color: "var(--gold-bright)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + New Entry
        </button>
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            color: "var(--text-faint)",
            fontFamily: "var(--sans)",
            fontSize: 13,
            padding: "20px 0",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {search ? "No entries match your search." : "No journal entries yet. Write your first."}
        </div>
      )}

      {filtered.map((entry) => (
        <button
          key={entry.id}
          onClick={() => onOpenEntry(entry.id)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 3,
            padding: "10px 4px",
            background: "none",
            border: "none",
            borderBottom: "1px solid var(--border-soft)",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,169,106,0.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 17,
              color: entry.title ? "var(--text)" : "var(--text-faint)",
            }}
          >
            {entry.title || "Untitled Entry"}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--text-faint)",
              textTransform: "uppercase",
            }}
          >
            {formatDate(entry.updatedAt)}
            {entry.authorName && (
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  textTransform: "none",
                  letterSpacing: 0,
                  fontSize: 12,
                  color: "var(--gold-dim)",
                  marginLeft: 8,
                }}
              >
                · {entry.authorName}
              </span>
            )}
            {entry.content && (
              <span
                style={{
                  fontFamily: "var(--sans)",
                  fontStyle: "italic",
                  textTransform: "none",
                  letterSpacing: 0,
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginLeft: 8,
                }}
              >
                · {excerpt(entry.content)}
              </span>
            )}
          </div>
        </button>
      ))}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "5px 12px",
            color: "var(--text-faint)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          Import Note
        </button>
        {importError && (
          <div style={{ color: "var(--danger)", fontFamily: "var(--sans)", fontSize: 12 }}>
            {importError}
          </div>
        )}
      </div>
    </div>
  );
}

interface EditProps {
  entry: JournalEntry;
  shareToast: boolean;
  onBack: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateContent: (content: string) => void;
  onShare: () => void;
  onDelete: () => void;
}

function JournalEdit({
  entry,
  shareToast,
  onBack,
  onUpdateTitle,
  onUpdateContent,
  onShare,
  onDelete,
}: EditProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, []);

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
    onUpdateContent(e.target.value);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          {shareToast && (
            <span
              style={{
                position: "absolute",
                top: -26,
                right: 0,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--vitality)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Downloaded
            </span>
          )}
          <button
            onClick={onShare}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 10px",
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Share
          </button>
          <button
            onClick={onDelete}
            style={{
              background: "none",
              border: "1px solid var(--danger-dim)",
              borderRadius: 4,
              padding: "4px 10px",
              color: "var(--danger)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <input
        type="text"
        value={entry.title}
        onChange={(e) => onUpdateTitle(e.target.value)}
        placeholder="Entry title…"
        style={{
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--border-soft)",
          padding: "4px 0 8px",
          color: "var(--text)",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 24,
          width: "100%",
          outline: "none",
        }}
      />

      <textarea
        ref={textareaRef}
        value={entry.content}
        onChange={handleContentChange}
        placeholder="Write your entry…"
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "0",
          color: "var(--text)",
          fontFamily: "var(--sans)",
          fontSize: 14,
          lineHeight: 1.7,
          resize: "none",
          outline: "none",
          minHeight: 200,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      />

      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          paddingTop: 8,
          borderTop: "1px solid var(--border-soft)",
        }}
      >
        Created {formatDate(entry.createdAt)}
        {entry.updatedAt !== entry.createdAt && (
          <span style={{ marginLeft: 12 }}>· Edited {formatDate(entry.updatedAt)}</span>
        )}
      </div>
    </div>
  );
}

// ── Main tab component ────────────────────────────────────────────────────────

export function NotesTab5e({ c, stored, setStored, rules }: NotesTabProps) {
  const [section, setSection] = useState<Section>("journal");
  const [view, setView] = useState<JournalView>({ mode: "list" });
  const [search, setSearch] = useState("");
  const [importError, setImportError] = useState("");
  const [shareToast, setShareToast] = useState(false);

  const journal: JournalEntry[] = stored.notes.journal ?? [];

  const updateJournal = useCallback(
    (entries: JournalEntry[]) =>
      setStored((s) => ({ ...s, notes: { ...s.notes, journal: entries } })),
    [setStored]
  );

  const handleCreateEntry = useCallback(() => {
    const base: JournalEntry = {
      id: genId(),
      title: "",
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      authorName: stored.name || undefined,
    };
    const entry = PluginRegistry.applyJournalEntryCreate(base, stored);
    setStored((s) => ({
      ...s,
      notes: { ...s.notes, journal: [entry, ...(s.notes.journal ?? [])] },
    }));
    setView({ mode: "edit", id: entry.id });
  }, [stored, setStored]);

  const handleUpdateTitle = useCallback(
    (id: string, title: string) =>
      setStored((s) => ({
        ...s,
        notes: {
          ...s.notes,
          journal: (s.notes.journal ?? []).map((e) =>
            e.id === id ? { ...e, title, updatedAt: Date.now() } : e
          ),
        },
      })),
    [setStored]
  );

  const handleUpdateContent = useCallback(
    (id: string, content: string) =>
      setStored((s) => ({
        ...s,
        notes: {
          ...s.notes,
          journal: (s.notes.journal ?? []).map((e) =>
            e.id === id ? { ...e, content, updatedAt: Date.now() } : e
          ),
        },
      })),
    [setStored]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm("Delete this journal entry? This cannot be undone.")) return;
      updateJournal((stored.notes.journal ?? []).filter((e) => e.id !== id));
      setView({ mode: "list" });
    },
    [stored.notes.journal, updateJournal]
  );

  const handleShare = useCallback(
    (entry: JournalEntry) => {
      const pluginExtras = PluginRegistry.buildJournalExportExtras(entry, stored);
      const payload = JSON.stringify(
        {
          type: "bg3-journal-entry",
          version: 1,
          title: entry.title || "Untitled",
          content: entry.content,
          characterName: stored.name || undefined,
          playerName: stored.player || undefined,
          exportedAt: Date.now(),
          ...(Object.keys(pluginExtras).length > 0 ? { pluginExtras } : {}),
        },
        null,
        2
      );
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug = (s: string) => s.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const parts = [
        stored.player && slug(stored.player),
        stored.name && slug(stored.name),
        slug(entry.title || "journal-entry"),
      ].filter(Boolean);
      const filename = parts.join("-");
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2200);
    },
    []
  );

  const handleImport = useCallback(
    (file: File) => {
      setImportError("");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.type !== "bg3-journal-entry") {
            setImportError("Not a valid journal entry file.");
            return;
          }
          const pluginPatch = PluginRegistry.applyJournalImport(parsed);
          if (pluginPatch === null) {
            setImportError("A plugin rejected this journal entry.");
            return;
          }
          const entry: JournalEntry = {
            id: genId(),
            title: parsed.title ?? "Imported Entry",
            content: parsed.content ?? "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            authorName: parsed.characterName || undefined,
            ...pluginPatch,
          };
          setStored((s) => ({
            ...s,
            notes: { ...s.notes, journal: [entry, ...(s.notes.journal ?? [])] },
          }));
          setView({ mode: "edit", id: entry.id });
        } catch {
          setImportError("Could not read file. Make sure it's a valid .json export.");
        }
      };
      reader.readAsText(file);
    },
    [setStored]
  );

  const switchSection = (s: Section) => {
    setSection(s);
    setView({ mode: "list" });
    setSearch("");
    setImportError("");
  };

  const sectionTab = (id: Section, label: string) => (
    <button
      onClick={() => switchSection(id)}
      style={{
        background: "none",
        border: "none",
        padding: "6px 16px",
        cursor: "pointer",
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: section === id ? "var(--gold)" : "var(--text-faint)",
        borderBottom: section === id ? "2px solid var(--gold)" : "2px solid transparent",
        transition: "color 0.15s, border-color 0.15s",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );

  type NoteTextField = "personality" | "ideals" | "bonds" | "flaws" | "backstory";
  const bioField = (key: NoteTextField, label: string) => (
    <div className="notes-section" key={key}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <textarea
        value={stored.notes[key] ?? ""}
        onChange={(e) =>
          setStored((s) => ({ ...s, notes: { ...s.notes, [key]: e.target.value } }))
        }
        rows={4}
        style={{
          width: "100%",
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "8px 10px",
          color: "var(--text)",
          fontFamily: "var(--sans)",
          fontSize: 13,
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );

  // Slot helper — mirrors SlotRender in app-5e.tsx
  function renderSlot(
    slotId: "notesJournal" | "notesBiography",
    fallback: React.ReactNode,
  ): React.ReactNode {
    const slot = PluginRegistry.getSlot(slotId);
    if (!slot) return fallback;
    const { pluginId, component: Comp } = slot;
    const pluginData = stored.pluginData?.[pluginId] ?? {};
    const setPluginData = (patch: Record<string, unknown>) =>
      setStored((s) => ({
        ...s,
        pluginData: {
          ...s.pluginData,
          [pluginId]: { ...(s.pluginData?.[pluginId] ?? {}), ...patch },
        },
      }));
    return (
      <Comp
        c={c}
        stored={stored}
        setStored={setStored}
        rules={rules}
        pluginData={pluginData}
        setPluginData={setPluginData}
      />
    );
  }

  const editEntry =
    view.mode === "edit" ? journal.find((e) => e.id === view.id) : undefined;

  return (
    <div className="list-card">
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-soft)",
          marginBottom: 16,
          gap: 0,
        }}
      >
        {sectionTab("journal", "Journal")}
        {sectionTab("biography", "Biography")}
      </div>

      {section === "biography" &&
        renderSlot(
          "notesBiography",
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {bioField("personality", "Personality")}
            {bioField("ideals", "Ideals")}
            {bioField("bonds", "Bonds")}
            {bioField("flaws", "Flaws")}
            {bioField("backstory", "Backstory")}
          </div>,
        )}

      {section === "journal" &&
        renderSlot(
          "notesJournal",
          <>
            {view.mode === "list" && (
              <JournalList
                journal={journal}
                search={search}
                setSearch={setSearch}
                importError={importError}
                onOpenEntry={(id) => setView({ mode: "edit", id })}
                onCreateEntry={handleCreateEntry}
                onImport={handleImport}
              />
            )}
            {view.mode === "edit" && editEntry && (
              <JournalEdit
                entry={editEntry}
                shareToast={shareToast}
                onBack={() => setView({ mode: "list" })}
                onUpdateTitle={(title) => handleUpdateTitle(view.id, title)}
                onUpdateContent={(content) => handleUpdateContent(view.id, content)}
                onShare={() => handleShare(editEntry)}
                onDelete={() => handleDelete(view.id)}
              />
            )}
          </>,
        )}
    </div>
  );
}

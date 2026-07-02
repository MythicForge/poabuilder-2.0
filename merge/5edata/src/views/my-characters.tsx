import React, { useState, useRef } from "react";
import { CharStorage } from "../core/storage";
import type { StoredChar } from "../core/types";
import { DrivePanel } from "../features/drive-sync-ui";
import { DRIVE_CLIENT_ID } from "../features/drive-client-id";
import { getDriveState } from "../features/drive-sync";

function CharCard({
  c,
  active,
  onOpen,
  onDelete,
}: {
  c: StoredChar;
  active: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const classLabel = c.classes
    .map((cl) => `${cl.name} ${cl.level}`)
    .join(" / ");
  const totalLevel = c.classes.reduce((t, cl) => t + (cl.level ?? 0), 0);
  const lastMod = c._lastModified
    ? new Date(c._lastModified).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      style={{
        background: "var(--card)",
        border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
        borderRadius: 8,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: active ? "0 0 0 1px var(--gold-dim)" : "none",
        position: "relative",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            fontFamily: "var(--mono)",
            fontSize: 8,
            letterSpacing: "0.12em",
            color: "var(--gold)",
          }}
        >
          ACTIVE
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 22,
          color: "var(--gold)",
          fontStyle: "italic",
          lineHeight: 1.2,
        }}
      >
        {c.name || "Unnamed Character"}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
        }}
      >
        {c.race.name || "—"}
      </div>
      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 12,
          color: "var(--text)",
        }}
      >
        {classLabel || "No class"} · Level {totalLevel}
      </div>
      {c.campaign && (
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 11,
            color: "var(--text-faint)",
            fontStyle: "italic",
          }}
        >
          {c.campaign}
        </div>
      )}
      {lastMod && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--text-faint)",
            marginTop: 4,
          }}
        >
          Last played {lastMod}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => onOpen(c.id)}
          style={{
            flex: 1,
            padding: "7px 0",
            background: active ? "var(--gold-dim)" : "var(--card-2)",
            border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
            borderRadius: 5,
            color: active ? "var(--gold-bright)" : "var(--text)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            cursor: "pointer",
            fontWeight: active ? 600 : 400,
          }}
        >
          {active ? "RESUME →" : "OPEN →"}
        </button>
        <button
          onClick={() => onDelete(c.id)}
          style={{
            padding: "7px 12px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 5,
            color: "var(--text-faint)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function AppMyChars() {
  const [roster, setRoster] = useState<StoredChar[]>(() =>
    CharStorage.getRoster(),
  );
  const activeId = CharStorage.getActiveId();
  const importRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !parsed.id ||
          !Array.isArray(parsed.classes)
        ) {
          alert("Invalid character file.");
          return;
        }
        const char = parsed as StoredChar;
        const existing = CharStorage.getRoster().find((c) => c.id === char.id);
        if (
          existing &&
          !confirm(`"${existing.name || "Unnamed"}" already exists. Overwrite?`)
        )
          return;
        CharStorage.saveChar(char);
        setRoster(CharStorage.getRoster());
      } catch {
        alert("Could not parse file.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const sorted = [...roster].sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    return (b._lastModified ?? 0) - (a._lastModified ?? 0);
  });

  const openChar = (id: string) => {
    CharStorage.setActiveId(id);
    if (getDriveState().connected) {
      // Flush any pending push then navigate — DrivePanel handles this event
      window.dispatchEvent(
        new CustomEvent("bg3:sync-then-navigate", {
          detail: { href: "sheet.html" },
        }),
      );
    } else {
      window.location.href = "sheet.html";
    }
  };

  const deleteChar = (id: string) => {
    if (!confirm("Delete this character permanently?")) return;
    CharStorage.deleteChar(id);
    setRoster(CharStorage.getRoster());
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 20px 80px" }}>
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 36,
            color: "var(--gold)",
            fontStyle: "italic",
            lineHeight: 1.1,
          }}
        >
          My Characters
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--text-faint)",
            letterSpacing: "0.14em",
            marginTop: 4,
          }}
        >
          Character Roster
        </div>
      </div>

      {sorted.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {sorted.map((c) => (
            <CharCard
              key={c.id}
              c={c}
              active={c.id === activeId}
              onOpen={openChar}
              onDelete={deleteChar}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: "var(--serif)",
            fontSize: 20,
            color: "var(--text-faint)",
            fontStyle: "italic",
          }}
        >
          No characters yet — build your first one below.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
        <button
          onClick={() => importRef.current?.click()}
          style={{
            padding: "12px 22px",
            background: "var(--card-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-muted)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            letterSpacing: "0.14em",
            cursor: "pointer",
          }}
        >
          IMPORT CHARACTER
        </button>
        <button
          onClick={() => {
            window.location.href = "gm.html";
          }}
          style={{
            padding: "12px 22px",
            background: "var(--card-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-muted)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            letterSpacing: "0.14em",
            cursor: "pointer",
          }}
        >
          GM VIEW →
        </button>
        <button
          onClick={() => {
            window.location.href = "builder.html?new=1";
          }}
          style={{
            padding: "12px 28px",
            background: "var(--gold-dim)",
            border: "1px solid var(--gold)",
            borderRadius: 6,
            color: "var(--gold-bright)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            letterSpacing: "0.14em",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + BUILD NEW CHARACTER
        </button>
      </div>
      <DrivePanel
        clientId={DRIVE_CLIENT_ID}
        onRosterChange={(merged) => setRoster(merged)}
      />
    </div>
  );
}

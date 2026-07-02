// GM Toolbox — root view.
// Two-column war table: Party Watch (left) + Encounter Tracker (right).
// Builds normalized PartyMember[] from the local roster today; a Firebase
// live listener will merge session players into the same shape later
// (see gm-view-spec.md, steps 3/5/6).

import { useEffect, useMemo, useState } from "react";
import { REGISTRY_PROMISE, loadBestiary, loadBestiaryFluff } from "../core/data-registry";
import { computeCharacter } from "../core/data-5e";
import { CharStorage } from "../core/storage";
import type { StoredChar, BestiaryEntry, MonsterFluff } from "../core/types";
import { loadGmState, saveGmState, clearEncounter } from "../core/gm-storage";
import type { GmEncounter, GmState } from "../core/gm-types";
import { GmPartyPanel } from "../tabs/gm-party";
import type { PartyMember } from "../tabs/gm-party";
import { buildResources, snapshotFromComputed } from "../core/party-snapshot";
import type { SessionPlayer } from "../core/party-snapshot";
import { GmEncounterPanel } from "../tabs/gm-encounter";
import { StatBlockPanel } from "../tabs/gm-statblock";
import { FIREBASE_READY } from "../features/firebase-config";
import {
  createSession,
  endSession,
  subscribeToPlayers,
} from "../features/session-sync";

function buildPartyFromRoster(roster: StoredChar[]): PartyMember[] {
  return roster.map((s) => {
    const c = computeCharacter(s);
    return {
      id: s.id,
      name: c.name,
      classLabel: c.classLabel,
      totalLevel: c.totalLevel,
      hp: { current: c.hp.current, max: c.hp.max, temp: c.hp.temp },
      conditions: c.activeConditions ?? [],
      deathSaves: c.deathSaves,
      resources: buildResources(c),
      live: false,
      sheet: snapshotFromComputed(s.id, c, s.currency).sheet,
    };
  });
}

export function AppGm() {
  const [ready, setReady] = useState(false);
  const [roster, setRoster] = useState<StoredChar[]>([]);
  const [bestiary, setBestiary] = useState<BestiaryEntry[]>([]);
  const [fluff, setFluff] = useState<MonsterFluff[]>([]);
  const [gm, setGm] = useState<GmState>(() => loadGmState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [livePlayers, setLivePlayers] = useState<SessionPlayer[]>([]);

  // Wait for the data registry (computeCharacter needs class/race tables),
  // then preload the bestiary so persisted monster cards can resolve stat blocks.
  useEffect(() => {
    REGISTRY_PROMISE.then(() => {
      setRoster(CharStorage.getRoster());
      setReady(true);
      loadBestiary().then(setBestiary);
      loadBestiaryFluff().then(setFluff);
    });
  }, []);

  // Refresh party when the local roster changes (e.g. another tab edits a sheet).
  useEffect(() => {
    const refresh = () => setRoster(CharStorage.getRoster());
    window.addEventListener("bg3:roster-changed", refresh);
    return () => window.removeEventListener("bg3:roster-changed", refresh);
  }, []);

  // Subscribe to live session players whenever a session is active.
  useEffect(() => {
    if (!FIREBASE_READY || !gm.sessionId) {
      setLivePlayers([]);
      return;
    }
    return subscribeToPlayers(gm.sessionId, setLivePlayers);
  }, [gm.sessionId]);

  // Merge local roster with live session players — live wins by id.
  const members = useMemo(() => {
    if (!ready) return [];
    const map = new Map<string, PartyMember>();
    for (const m of buildPartyFromRoster(roster)) map.set(m.id, m);
    for (const p of livePlayers) {
      map.set(p.charId, {
        id: p.charId,
        name: p.name,
        classLabel: p.classes,
        totalLevel: p.totalLevel,
        hp: p.hp,
        conditions: p.conditions ?? [],
        deathSaves: p.deathSaves,
        resources: p.resources ?? [],
        live: true,
        sheet: p.sheet,
      });
    }
    return Array.from(map.values());
  }, [ready, roster, livePlayers]);

  const updateEncounter = (encounter: GmEncounter) => {
    setGm((prev) => {
      const next = { ...prev, encounter };
      saveGmState(next);
      return next;
    });
  };

  const endEncounter = () => setGm((prev) => clearEncounter(prev));

  const startSession = async () => {
    const password =
      window.prompt("Set a session password (leave blank for none):") ?? "";
    try {
      const id = await createSession(password);
      setGm((prev) => {
        const next = { ...prev, sessionId: id };
        saveGmState(next);
        return next;
      });
    } catch {
      alert("Could not create a session. Check the Firebase setup.");
    }
  };

  const stopSession = () => {
    if (!confirm("End the session? Connected players will be disconnected."))
      return;
    const id = gm.sessionId;
    setGm((prev) => {
      const next = { ...prev, sessionId: null };
      saveGmState(next);
      return next;
    });
    if (id) void endSession(id);
  };

  // Resolve the selected combatant (may have been removed) + its bestiary entry.
  const selectedCombatant =
    gm.encounter.combatants.find((c) => c.id === selectedId) ?? null;
  const selectedEntry = selectedCombatant?.creatureName
    ? (bestiary.find(
        (b) =>
          b.name === selectedCombatant.creatureName &&
          b.source === selectedCombatant.creatureSource,
      ) ?? null)
    : null;
  const selectedMember =
    selectedCombatant?.type === "player"
      ? members.find((m) => m.id === selectedCombatant.charId) ?? null
      : null;
  const selectedFluff = selectedCombatant?.creatureName
    ? (fluff.find(
        (f) =>
          f.name === selectedCombatant.creatureName &&
          f.source === selectedCombatant.creatureSource,
      ) ??
      fluff.find((f) => f.name === selectedCombatant.creatureName) ??
      null)
    : null;

  // When the initiative arrow advances, surface the active actor's stat block.
  const activeCombatantId =
    gm.encounter.started && gm.encounter.combatants[gm.encounter.activeTurnIndex]
      ? gm.encounter.combatants[gm.encounter.activeTurnIndex].id
      : null;
  useEffect(() => {
    if (activeCombatantId) setSelectedId(activeCombatantId);
  }, [activeCombatantId]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 22,
          color: "var(--text-faint)",
        }}
      >
        Setting the table…
      </div>
    );
  }

  return (
    <div
      style={{ maxWidth: 1640, margin: "0 auto", padding: "28px 20px 80px" }}
    >
      {/* Header / GM screen banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 18,
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => (window.location.href = "index.html")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ← MY CHARACTERS
          </button>
          <div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 30,
                color: "var(--gold)",
                lineHeight: 1,
              }}
            >
              GM Toolbox
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "var(--text-faint)",
                marginTop: 3,
              }}
            >
              5e GM Encounter Tracker
            </div>
          </div>
        </div>

        {/* Session controls */}
        {!FIREBASE_READY ? (
          <div
            title="Live player sync requires Firebase setup (see firebase-dev-instructions.md)"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--text-faint)",
              border: "1px dashed var(--border)",
              borderRadius: 6,
              padding: "7px 12px",
            }}
          >
            ○ SESSION SYNC — NOT CONFIGURED
          </div>
        ) : gm.sessionId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => navigator.clipboard?.writeText(gm.sessionId!)}
              title="Copy session code"
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                letterSpacing: "0.16em",
                color: "var(--vitality)",
                background: "var(--card-2)",
                border: "1px solid var(--vitality-dim)",
                borderRadius: 6,
                padding: "7px 14px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ● SESSION {gm.sessionId} ⧉
            </button>
            <button
              onClick={stopSession}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--danger)",
                background: "transparent",
                border: "1px solid var(--danger-dim)",
                borderRadius: 6,
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              END SESSION
            </button>
          </div>
        ) : (
          <button
            onClick={startSession}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "var(--gold-bright)",
              background: "var(--gold-dim)",
              border: "1px solid var(--gold)",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + NEW SESSION
          </button>
        )}
      </div>

      {/* War table */}
      <div className="gm-grid">
        <GmPartyPanel members={members.filter((m) => m.live)} />
        <GmEncounterPanel
          encounter={gm.encounter}
          members={members}
          bestiary={bestiary}
          fluff={fluff}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={updateEncounter}
          onEnd={endEncounter}
        />
        <div className="gm-statblock-col">
          <div className="gm-statblock">
            <StatBlockPanel
              combatant={selectedCombatant}
              entry={selectedEntry}
              fluff={selectedFluff}
              member={selectedMember}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

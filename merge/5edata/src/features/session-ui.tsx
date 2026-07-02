// GM session join/leave controls for the player sheet header, plus the live
// push of the player's display snapshot to Firebase while connected.

import React, { useEffect, useState } from "react";
import { FIREBASE_READY } from "./firebase-config";
import {
  joinSession,
  leaveSession,
  getStoredSession,
  pushPlayerData,
} from "./session-sync";
import type { JoinResult, StoredSession } from "./session-sync";
import { snapshotFromComputed } from "../core/party-snapshot";
import type { ComputedChar, StoredChar } from "../core/types";

const pill: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  color: "var(--text-muted)",
};

export function SessionPanel({
  charId,
  computed,
  currency,
}: {
  charId: string;
  computed: ComputedChar;
  currency: StoredChar["currency"];
}) {
  const [session, setSession] = useState<StoredSession | null>(() => getStoredSession());
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Push a fresh snapshot whenever the character changes while connected.
  useEffect(() => {
    if (!session || session.charId !== charId) return;
    pushPlayerData(session.sessionId, charId, snapshotFromComputed(charId, computed, currency));
  }, [session, charId, computed, currency]);

  if (!FIREBASE_READY) return null;

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    const result: JoinResult = await joinSession(code, password, charId);
    setBusy(false);
    if (result === "ok") {
      setSession(getStoredSession());
      setModalOpen(false);
      setCode("");
      setPassword("");
    } else if (result === "not-found") {
      setError("No session with that code.");
    } else {
      setError("Wrong password.");
    }
  };

  const disconnect = () => {
    leaveSession();
    setSession(null);
  };

  if (session) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...pill, color: "var(--vitality)", cursor: "default", borderColor: "var(--vitality-dim)" }}>
          ● SESSION {session.sessionId}
        </span>
        <button style={pill} onClick={disconnect} title="Disconnect from the GM session">
          LEAVE
        </button>
      </div>
    );
  }

  return (
    <>
      <button style={pill} onClick={() => setModalOpen(true)}>
        JOIN SESSION
      </button>
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal-box" style={{ maxWidth: 360 }}>
            <div className="modal-head">
              <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Join a GM Session</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Session code (e.g. K7X2PQ)"
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Password (if required)"
                style={inputStyle}
              />
              {error && (
                <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--danger)" }}>{error}</div>
              )}
              <button
                onClick={submit}
                disabled={busy || !code.trim()}
                style={{
                  padding: "9px 16px",
                  background: "var(--gold-dim)",
                  border: "1px solid var(--gold)",
                  borderRadius: 6,
                  color: "var(--gold-bright)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  fontWeight: 600,
                  cursor: busy || !code.trim() ? "not-allowed" : "pointer",
                  opacity: busy || !code.trim() ? 0.5 : 1,
                }}
              >
                {busy ? "CONNECTING…" : "CONNECT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontFamily: "var(--sans)",
  fontSize: 14,
};

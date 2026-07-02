// GM live session sync over Firebase Realtime Database.
// One-directional v1: players push display snapshots, the GM observes.
// Passwords are plaintext table-gating (the 6-char code is the real barrier),
// not real auth — see phase-2-gm-sync-build.md.

import { ref, set, get, remove, onValue, off } from "firebase/database";
import { db, FIREBASE_READY } from "./firebase-config";
import type { SessionPlayer } from "../core/party-snapshot";

const SESSION_KEY = "bg3_session";
// No ambiguous glyphs (0/O, 1/I) so codes are easy to read aloud at the table.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface StoredSession {
  sessionId: string;
  charId: string;
}

export type JoinResult = "ok" | "bad-password" | "not-found";

function genSessionId(): string {
  let id = "";
  for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return id;
}

// ── GM side ──────────────────────────────────────────────────────────────────

export async function createSession(password = ""): Promise<string> {
  if (!FIREBASE_READY) throw new Error("Firebase not configured");
  const id = genSessionId();
  await set(ref(db, `sessions/${id}/meta`), {
    password: password ?? "",
    createdAt: Date.now(),
  });
  return id;
}

export async function endSession(sessionId: string): Promise<void> {
  if (!FIREBASE_READY) return;
  await remove(ref(db, `sessions/${sessionId}`));
}

/** Subscribe to the live player roster. Returns an unsubscribe function. */
export function subscribeToPlayers(
  sessionId: string,
  cb: (players: SessionPlayer[]) => void,
): () => void {
  if (!FIREBASE_READY) return () => {};
  const playersRef = ref(db, `sessions/${sessionId}/players`);
  const handler = onValue(playersRef, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, SessionPlayer>;
    cb(Object.values(val));
  });
  return () => off(playersRef, "value", handler);
}

// ── Player side ──────────────────────────────────────────────────────────────

export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function joinSession(
  rawId: string,
  password: string,
  charId: string,
): Promise<JoinResult> {
  if (!FIREBASE_READY) return "not-found";
  const sessionId = rawId.trim().toUpperCase();
  const metaSnap = await get(ref(db, `sessions/${sessionId}/meta`));
  if (!metaSnap.exists()) return "not-found";
  const meta = metaSnap.val() as { password?: string };
  if (meta.password && meta.password !== password) return "bad-password";
  localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId, charId }));
  return "ok";
}

export function pushPlayerData(
  sessionId: string,
  charId: string,
  snapshot: SessionPlayer,
): void {
  if (!FIREBASE_READY) return;
  void set(ref(db, `sessions/${sessionId}/players/${charId}`), snapshot);
}

export function leaveSession(): void {
  const stored = getStoredSession();
  if (stored && FIREBASE_READY) {
    void remove(ref(db, `sessions/${stored.sessionId}/players/${stored.charId}`));
  }
  localStorage.removeItem(SESSION_KEY);
}

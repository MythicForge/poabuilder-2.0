import type { StoredChar } from './types';

const ROSTER_KEY = 'bg3_roster';
const ACTIVE_KEY = 'bg3_active';
const LEGACY_KEY = 'bg3_character';
const TOMBSTONES_KEY = 'bg3_tombstones';
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getTombstones(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TOMBSTONES_KEY) ?? '{}');
  } catch { return {}; }
}

export function saveTombstones(t: Record<string, number>): void {
  localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(t));
}

function pruneTombstones(t: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const out: Record<string, number> = {};
  for (const [id, ts] of Object.entries(t)) if (ts >= cutoff) out[id] = ts;
  return out;
}

function getRoster(): StoredChar[] {
  try {
    return JSON.parse(localStorage.getItem(ROSTER_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveRoster(roster: StoredChar[]): void {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
}

function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

function getActiveChar(): StoredChar | null {
  // Migrate legacy single-char key
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const char = JSON.parse(legacy) as StoredChar;
      if (char?.id) {
        saveChar(char);
        setActiveId(char.id);
        localStorage.removeItem(LEGACY_KEY);
        return char;
      }
    } catch { /* ignore */ }
  }

  const id = getActiveId();
  if (!id) return null;
  return getRoster().find(c => c.id === id) ?? null;
}

function saveChar(char: StoredChar): void {
  const roster = getRoster();
  const idx = roster.findIndex(c => c.id === char.id);
  const entry = { ...char, _lastModified: Date.now() };
  if (idx >= 0) {
    roster[idx] = entry;
  } else {
    roster.push(entry);
  }
  saveRoster(roster);
  window.dispatchEvent(new CustomEvent('bg3:roster-changed'));
}

function deleteChar(id: string): void {
  saveRoster(getRoster().filter(c => c.id !== id));
  if (getActiveId() === id) localStorage.removeItem(ACTIVE_KEY);
  saveTombstones(pruneTombstones({ ...getTombstones(), [id]: Date.now() }));
  window.dispatchEvent(new CustomEvent('bg3:roster-changed'));
}

export const CharStorage = {
  getRoster,
  saveRoster,
  getActiveChar,
  getActiveId,
  setActiveId,
  saveChar,
  deleteChar,
  getTombstones,
  saveTombstones,
};

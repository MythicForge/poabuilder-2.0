// GM Toolbox — localStorage persistence for the GM's encounter state.
// Mirrors the patterns in src/core/storage.ts (named helpers, graceful parse).

import { blankEncounter, blankGmState } from "./gm-types";
import type { GmState } from "./gm-types";

const GM_KEY = "bg3_gm_state";

export function loadGmState(): GmState {
  try {
    const raw = localStorage.getItem(GM_KEY);
    if (!raw) return blankGmState();
    const parsed = JSON.parse(raw) as Partial<GmState>;
    const encounter = parsed.encounter ?? blankEncounter();
    // Migrate legacy combatant.conditions (string[]) → Record<string, ConditionState>
    encounter.combatants = (encounter.combatants ?? []).map((c) => ({
      ...c,
      conditions: Array.isArray(c.conditions)
        ? Object.fromEntries((c.conditions as string[]).map((n) => [n, {}]))
        : (c.conditions ?? {}),
    }));
    return {
      sessionId: parsed.sessionId ?? null,
      encounter,
    };
  } catch {
    return blankGmState();
  }
}

export function saveGmState(state: GmState): void {
  try {
    localStorage.setItem(GM_KEY, JSON.stringify(state));
  } catch {
    /* quota or serialization failure — non-fatal */
  }
}

/** Reset the encounter to a blank slate, preserving any active session id. */
export function clearEncounter(state: GmState): GmState {
  const next: GmState = { sessionId: state.sessionId, encounter: blankEncounter() };
  saveGmState(next);
  return next;
}

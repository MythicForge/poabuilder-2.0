// GM Toolbox — shared types for the encounter tracker + party watch.
// See gm-view-spec.md for the full feature spec.

import type { ConditionState } from "./types";

export interface GmCombatant {
  id: string;
  name: string;
  type: "monster" | "player";
  initiative: number | null;
  // GM-applied conditions, same model as the player condition bar.
  conditions: Record<string, ConditionState>;
  dead?: boolean;
  // Monster-only
  hpMax?: number;
  hpCurrent?: number;
  ac?: number;
  cr?: string;
  // Link back to the bestiary entry so the expanded card can show stats/actions
  creatureName?: string;
  creatureSource?: string;
  // Player-only — matches a StoredChar.id (local roster) or Firebase player key
  charId?: string;
}

export interface GmEncounter {
  round: number;
  activeTurnIndex: number;
  combatants: GmCombatant[];
  started: boolean;
}

export interface GmState {
  sessionId: string | null;
  encounter: GmEncounter;
}

export function blankEncounter(): GmEncounter {
  return { round: 1, activeTurnIndex: 0, combatants: [], started: false };
}

export function blankGmState(): GmState {
  return { sessionId: null, encounter: blankEncounter() };
}

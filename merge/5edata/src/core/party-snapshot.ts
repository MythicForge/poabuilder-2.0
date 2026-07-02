// Shared StoredChar→display-snapshot mapping. Used by the GM view (local roster)
// and the player sheet's session push, so the GM sees identical fields whether a
// character is local or streamed live over Firebase.

import type { ComputedChar, StoredChar } from "./types";
import type { PartyResource } from "../tabs/gm-party";

// Fuller sheet snapshot for the GM's "view player sheet" panel.
export interface PlayerSheetSnapshot {
  ac: number;
  initiative: number;
  speedFt: number;
  passivePerception: number;
  passiveInsight: number;
  abilities: Record<string, { score: number; mod: number; save: number; prof: boolean }>;
  skills: { name: string; mod: number; prof: "none" | "prof" | "expert" }[];
  currency: { pp: number; gp: number; sp: number; cp: number };
  hitDice: string;
  slots: { level: number; max: number; current: number }[];
  pactSlots: { max: number; current: number; level: number } | null;
}

// Display-safe snapshot pushed to Firebase — never the full StoredChar.
export interface SessionPlayer {
  charId: string;
  name: string;
  totalLevel: number;
  classes: string; // classLabel
  hp: { current: number; max: number; temp: number };
  conditions: string[];
  resources: PartyResource[];
  deathSaves: { successes: number; failures: number };
  sheet?: PlayerSheetSnapshot;
  _lastUpdated: number;
}

export function buildResources(c: ComputedChar): PartyResource[] {
  const rows: PartyResource[] = [];
  for (const sl of c.spellcasting.slots ?? []) {
    rows.push({ label: `L${sl.level}`, current: sl.current, max: sl.max });
  }
  const pact = c.spellcasting.pactSlots;
  if (pact) rows.push({ label: "Pact", current: pact.current, max: pact.max });

  const simple: [string, { current: number; max: number } | null | undefined][] = [
    ["Bardic", c.resources.bardicInspiration],
    ["Rage", c.resources.rages],
    ["Ki", c.resources.kiPoints],
    ["Sorc", c.resources.sorceryPoints],
  ];
  for (const [label, r] of simple) {
    if (r) rows.push({ label, current: r.current, max: r.max });
  }
  for (const cu of c.resources.custom ?? []) {
    rows.push({ label: cu.name, current: cu.current, max: cu.max });
  }
  return rows;
}

export function snapshotFromComputed(
  charId: string,
  c: ComputedChar,
  currency: StoredChar["currency"],
): SessionPlayer {
  return {
    charId,
    name: c.name,
    totalLevel: c.totalLevel,
    classes: c.classLabel,
    hp: { current: c.hp.current, max: c.hp.max, temp: c.hp.temp },
    conditions: c.activeConditions ?? [],
    resources: buildResources(c),
    deathSaves: c.deathSaves,
    sheet: {
      ac: c.ac,
      initiative: c.initiative,
      speedFt: c.speedFt,
      passivePerception: c.passive.perception,
      passiveInsight: c.passive.insight,
      abilities: c.abilities,
      skills: c.skills.map((s) => ({ name: s.name, mod: s.mod, prof: s.prof })),
      currency: currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 },
      hitDice: String(Object.values(c.hitDiceRemaining).reduce((a, b) => a + b, 0)),
      slots: c.spellcasting.slots ?? [],
      pactSlots: c.spellcasting.pactSlots,
    },
    _lastUpdated: Date.now(),
  };
}

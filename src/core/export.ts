// Portable character envelope + versioned migration pipeline
// (pattern from builder-1.0 lib/character-export, reimplemented).

import type { StoredCharacter } from "./types.ts";

export const CURRENT_SCHEMA_VERSION = 1;

export interface CharacterEnvelope {
  app: "poa-sheet";
  schemaVersion: number;
  exportedAt: string;
  character: StoredCharacter;
}

// index = fromVersion; migrations[1] upgrades v1 → v2, etc.
const MIGRATIONS: Record<number, (c: Record<string, unknown>) => Record<string, unknown>> = {};

export function exportCharacter(char: StoredCharacter): string {
  const env: CharacterEnvelope = {
    app: "poa-sheet",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    character: char,
  };
  return JSON.stringify(env, null, 2);
}

export function importCharacter(json: string): StoredCharacter {
  const env = JSON.parse(json) as Partial<CharacterEnvelope>;
  if (env.app !== "poa-sheet" || !env.character) {
    throw new Error("Not a Path of Ambition character export");
  }
  let version = env.schemaVersion ?? 1;
  let raw = env.character as unknown as Record<string, unknown>;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from schema v${version}`);
    raw = step(raw);
    version++;
  }
  const char = raw as unknown as StoredCharacter;
  char.schema_version = CURRENT_SCHEMA_VERSION;
  return char;
}

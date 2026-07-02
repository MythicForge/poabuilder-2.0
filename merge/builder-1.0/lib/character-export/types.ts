import type { Character } from '../characterTypes';

export const CURRENT_SCHEMA_VERSION = 1;

export interface CharacterExportEnvelope {
  schemaVersion: number;
  exportedAt: string;
  professionSnapshot: ProfessionSnapshot[];
  character: Character;
}

export interface ProfessionSnapshot {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface UnresolvedProfession {
  original: ProfessionSnapshot;
  usedIn: string[];
}

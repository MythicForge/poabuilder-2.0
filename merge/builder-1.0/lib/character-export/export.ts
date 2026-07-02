import type { Character } from '../characterTypes';
import type { CharacterExportEnvelope } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';

export function buildExportEnvelope(
  character: Character,
  professions: Array<{ id: string; name: string }>
): CharacterExportEnvelope {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    professionSnapshot: professions.map((p) => ({ id: p.id, name: p.name })),
    character,
  };
}

export function triggerDownload(filename: string, data: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

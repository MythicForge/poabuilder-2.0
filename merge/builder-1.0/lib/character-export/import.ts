import type { CharacterExportEnvelope } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';

export function parseExportFile(raw: string): CharacterExportEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  return validateEnvelope(parsed);
}

function validateEnvelope(data: unknown): CharacterExportEnvelope {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('schemaVersion' in data) ||
    !('character' in data) ||
    !('professionSnapshot' in data)
  ) {
    throw new Error('File is not a valid character export.');
  }
  const envelope = data as CharacterExportEnvelope;
  if (envelope.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error('Export was created with a newer version of this app. Update to import.');
  }
  return envelope;
}

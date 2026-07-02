import type { CharacterExportEnvelope } from '../types';
import { CURRENT_SCHEMA_VERSION } from '../types';

const migrations: Record<number, (e: unknown) => unknown> = {
  1: (e) => e,
};

export function runMigrations(envelope: CharacterExportEnvelope): CharacterExportEnvelope {
  let current: unknown = envelope;
  let version = envelope.schemaVersion;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version + 1];
    if (!migrate) throw new Error(`No migration from schema v${version}`);
    current = migrate(current);
    version++;
  }

  return current as CharacterExportEnvelope;
}

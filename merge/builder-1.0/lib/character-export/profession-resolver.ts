import type { Character } from '../characterTypes';
import type { CharacterExportEnvelope, UnresolvedProfession } from './types';

export interface ResolveResult {
  character: Character;
  unresolved: UnresolvedProfession[];
}

export function resolveProfessions(
  envelope: CharacterExportEnvelope,
  currentProfessions: Array<{ id: string; name: string }>,
  manualRemaps: Record<string, string> = {}
): ResolveResult {
  const byId = new Map(currentProfessions.map((p) => [p.id, p]));
  const byNameLower = new Map(currentProfessions.map((p) => [p.name.toLowerCase(), p]));

  const unresolved: UnresolvedProfession[] = [];

  function resolve(
    exportedId: string,
    fieldPath: string
  ): { id: string; name: string } | null {
    if (manualRemaps[exportedId]) {
      const prof = byId.get(manualRemaps[exportedId]);
      if (prof) return prof;
    }

    const exact = byId.get(exportedId);
    if (exact) return exact;

    const snapshot = envelope.professionSnapshot.find((p) => p.id === exportedId);
    if (snapshot) {
      const byName = byNameLower.get(snapshot.name.toLowerCase());
      if (byName) return byName;
    }

    const existing = unresolved.find((u) => u.original.id === exportedId);
    if (existing) {
      existing.usedIn.push(fieldPath);
    } else {
      unresolved.push({
        original: snapshot ?? { id: exportedId, name: exportedId },
        usedIn: [fieldPath],
      });
    }
    return null;
  }

  const character = structuredClone(envelope.character);

  if (character.professionId) {
    const resolved = resolve(character.professionId, 'professionId');
    if (resolved) {
      character.professionId = resolved.id;
      character.professionName = resolved.name;
    }
  }

  return { character, unresolved };
}

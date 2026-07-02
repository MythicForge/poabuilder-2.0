'use client';

import { useRef, useState } from 'react';
import type { Character } from '@/lib/characterTypes';
import type { CharacterExportEnvelope, UnresolvedProfession } from '@/lib/character-export/types';
import { parseExportFile } from '@/lib/character-export/import';
import { runMigrations } from '@/lib/character-export/schema-migrations';
import { resolveProfessions } from '@/lib/character-export/profession-resolver';
import ProfessionRemapModal from './ProfessionRemapModal';

interface Props {
  professions: Array<{ id: string; name: string }>;
  onImport: (character: Character) => void;
}

interface PendingRemap {
  envelope: CharacterExportEnvelope;
  unresolved: UnresolvedProfession[];
  partialCharacter: Character;
}

export default function ImportButton({ professions, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRemap | null>(null);

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const envelope = parseExportFile(raw);
        const migrated = runMigrations(envelope);
        const { character, unresolved } = resolveProfessions(migrated, professions);

        if (unresolved.length > 0) {
          setPending({ envelope: migrated, unresolved, partialCharacter: character });
        } else {
          onImport(character);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed.');
      }
    };
    reader.readAsText(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleRemapConfirm(manualRemaps: Record<string, string>) {
    if (!pending) return;
    const { character } = resolveProfessions(pending.envelope, professions, manualRemaps);
    setPending(null);
    onImport(character);
  }

  function handleRemapCancel() {
    setPending(null);
    setError(null);
  }

  return (
    <>
      <label
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.625rem 1.25rem',
          backgroundColor: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9rem',
        }}
        title="Import character from JSON"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
        </svg>
        Import
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleChange}
          style={{ display: 'none' }}
          aria-label="Import character JSON file"
        />
      </label>

      {error && (
        <p style={{
          color: 'var(--danger, #e05252)',
          fontSize: '0.82rem',
          margin: '0.5rem 0 0',
        }}>
          {error}
        </p>
      )}

      {pending && (
        <ProfessionRemapModal
          unresolved={pending.unresolved}
          currentProfessions={professions}
          onConfirm={handleRemapConfirm}
          onCancel={handleRemapCancel}
        />
      )}
    </>
  );
}

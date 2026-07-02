'use client';

import type { Character } from '@/lib/characterTypes';
import { buildExportEnvelope, triggerDownload } from '@/lib/character-export/export';

interface Props {
  character: Character;
  professions: Array<{ id: string; name: string }>;
}

export default function ExportButton({ character, professions }: Props) {
  function handleExport() {
    const envelope = buildExportEnvelope(character, professions);
    const filename = `${character.name || 'character'}-export.json`;
    triggerDownload(filename, JSON.stringify(envelope, null, 2));
  }

  return (
    <button
      onClick={handleExport}
      style={{
        padding: '0.4rem 0.625rem',
        backgroundColor: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        fontSize: '0.8rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
      }}
      aria-label={`Export ${character.name}`}
      title="Export character"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

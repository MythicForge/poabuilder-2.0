'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadCharacters, deleteCharacter, saveCharacter } from '@/lib/characterStorage';
import type { Character } from '@/lib/characterTypes';
import ExportButton from './ExportButton';
import ImportButton from './ImportButton';

interface Props {
  professions: Array<{ id: string; name: string }>;
}

export default function CharacterList({ professions }: Props) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCharacters(loadCharacters());
    setMounted(true);
  }, []);

  function handleImport(char: Character) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...rest } = char;
    saveCharacter(rest);
    setCharacters(loadCharacters());
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteCharacter(id);
    setCharacters(loadCharacters());
  }

  if (!mounted) return null;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <Link
          href="/characters/new"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '7px 14px',
            background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dim) 100%)',
            color: '#1c1409',
            border: '1px solid var(--gold)',
            borderRadius: '8px', textDecoration: 'none',
            fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.75rem',
            letterSpacing: '0.04em',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New Character
        </Link>
        <ImportButton professions={professions} onImport={handleImport} />
      </div>

      {characters.length === 0 ? (
        <div style={{
          padding: '3rem 2rem', textAlign: 'center',
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)', borderRadius: '12px',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.3 }}>⚔</div>
          <p style={{
            fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontWeight: 500,
            fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem',
          }}>
            No characters yet
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Create your first adventurer.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {characters.map((char) => (
            <div
              key={char.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '1rem', padding: '1rem 1.25rem',
                backgroundColor: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: '12px', flexWrap: 'wrap',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Portrait glyph tile */}
              <div style={{
                width: '42px', height: '42px', borderRadius: '8px',
                backgroundColor: 'var(--bg-2)',
                border: '1px solid rgb(var(--gold-rgb) / 0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold)', fontSize: '1.2rem', flexShrink: 0,
              }}>
                ⚔
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontStyle: 'italic',
                    fontWeight: 500, fontSize: '1.05rem', color: 'var(--text-primary)',
                  }}>
                    {char.name || 'Unnamed Adventurer'}
                  </span>
                  <span style={{
                    fontSize: '9.5px', fontWeight: 600, fontFamily: 'var(--font-mono)',
                    letterSpacing: '1.4px', textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: '12px',
                    backgroundColor: 'rgb(var(--gold-rgb) / 0.09)',
                    color: 'var(--gold)',
                    border: '1px solid rgb(var(--gold-rgb) / 0.40)',
                  }}>
                    Tier {char.tier}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                  {[char.professionName, char.originName && `${char.originName}${char.vocationName ? ` (${char.vocationName})` : ''}`]
                    .filter(Boolean).join(' · ')}
                </div>
                {char.currentVitality !== undefined && char.maxVitality && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                    Vitality {char.currentVitality}/{char.maxVitality} · Renown {char.renown ?? 0}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <Link
                  href={`/characters/${char.id}`}
                  style={{
                    padding: '7px 14px',
                    backgroundColor: 'transparent',
                    color: 'var(--gold)',
                    border: '1px solid var(--border-hi)',
                    borderRadius: '8px', textDecoration: 'none',
                    fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: '0.75rem',
                  }}
                >
                  Open →
                </Link>
                <ExportButton character={char} professions={professions} />
                <button
                  onClick={() => handleDelete(char.id, char.name)}
                  style={{
                    padding: '7px 10px', backgroundColor: 'transparent',
                    color: 'var(--text-tertiary)', border: '1px solid var(--border)',
                    borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  aria-label={`Delete ${char.name}`}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fail)'; e.currentTarget.style.borderColor = 'rgb(var(--fail-rgb) / 0.50)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

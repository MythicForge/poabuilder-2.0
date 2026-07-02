'use client';

import { useState } from 'react';
import type { UnresolvedProfession } from '@/lib/character-export/types';

interface Props {
  unresolved: UnresolvedProfession[];
  currentProfessions: Array<{ id: string; name: string }>;
  onConfirm: (manualRemaps: Record<string, string>) => void;
  onCancel: () => void;
}

const KEEP_ORIGINAL = '__keep__';

export default function ProfessionRemapModal({ unresolved, currentProfessions, onConfirm, onCancel }: Props) {
  const [remaps, setRemaps] = useState<Record<string, string>>(() =>
    Object.fromEntries(unresolved.map((u) => [u.original.id, KEEP_ORIGINAL]))
  );

  function handleConfirm() {
    const manualRemaps: Record<string, string> = {};
    for (const [exportedId, choice] of Object.entries(remaps)) {
      if (choice !== KEEP_ORIGINAL) {
        manualRemaps[exportedId] = choice;
      }
    }
    onConfirm(manualRemaps);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-heading)', fontSize: '1.1rem',
          fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem',
        }}>
          Unresolved Professions
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
          These professions from the export don&apos;t match any current profession. Remap each or keep the original ID.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {unresolved.map((u) => (
            <div
              key={u.original.id}
              style={{
                padding: '0.875rem',
                backgroundColor: 'var(--bg-nav)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 600,
                  fontSize: '0.9rem', color: 'var(--text)',
                }}>
                  {u.original.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  used in: {u.usedIn.join(', ')}
                </span>
              </div>
              <select
                value={remaps[u.original.id] ?? KEEP_ORIGINAL}
                onChange={(e) =>
                  setRemaps((prev) => ({ ...prev, [u.original.id]: e.target.value }))
                }
                style={{
                  width: '100%',
                  padding: '0.375rem 0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <option value={KEEP_ORIGINAL}>Keep original ID</option>
                {currentProfessions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
            }}
          >
            Cancel import
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
            }}
          >
            Confirm import
          </button>
        </div>
      </div>
    </div>
  );
}

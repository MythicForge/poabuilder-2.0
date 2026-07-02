import type {} from 'react';
import condData from './conditions-calc-data.json';

interface ConditionEffect {
  text: string;
  negative: boolean;
}

interface ConditionEntry {
  isNegative: boolean;
  isBeneficial?: boolean;
  isMixed?: boolean;
  missingDoc?: boolean;
  summary: string;
  effects: ConditionEffect[];
  bg3Note?: string;
}

const CONDITIONS = condData.conditions as Record<string, ConditionEntry>;

function WarnIcon() {
  return (
    <span
      aria-label="warning"
      style={{ fontSize: 11, marginRight: 4, lineHeight: 1 }}
    >⚠</span>
  );
}

function BenefitIcon() {
  return (
    <span
      aria-label="beneficial"
      style={{ fontSize: 11, marginRight: 4, lineHeight: 1 }}
    >✦</span>
  );
}

function MixedIcon() {
  return (
    <span
      aria-label="mixed"
      style={{ fontSize: 11, marginRight: 4, lineHeight: 1 }}
    >◈</span>
  );
}

interface ConditionCardProps {
  name: string;
  entry: ConditionEntry;
}

function ConditionCard({ name, entry }: ConditionCardProps) {
  const isNeg = entry.isNegative;
  const isBen = entry.isBeneficial;
  const isMix = entry.isMixed;

  const borderColor = isNeg
    ? 'var(--danger)'
    : isBen
    ? 'var(--vitality)'
    : 'var(--gold-dim)';

  const nameColor = isNeg
    ? 'var(--danger)'
    : isBen
    ? 'var(--vitality)'
    : 'var(--gold)';

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        background: 'var(--card-2)',
        borderRadius: '0 4px 4px 0',
        padding: '8px 12px',
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {isNeg && <WarnIcon />}
        {isBen && <BenefitIcon />}
        {isMix && <MixedIcon />}
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: nameColor,
            fontWeight: 600,
          }}
        >
          {name}
        </span>
        {entry.missingDoc && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--gold-dim)',
              border: '1px solid var(--gold-dim)',
              borderRadius: 3,
              padding: '1px 4px',
              marginLeft: 4,
            }}
          >
            INCOMPLETE
          </span>
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 11,
          color: isNeg ? 'var(--danger)' : isBen ? 'var(--vitality)' : 'var(--text)',
          marginBottom: 6,
          lineHeight: 1.4,
          opacity: 0.85,
        }}
      >
        {entry.summary}
      </div>

      {/* Effects list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entry.effects.map((eff, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              fontFamily: 'var(--sans)',
              fontSize: 10.5,
              lineHeight: 1.4,
              color: eff.negative ? 'var(--danger)' : 'var(--vitality)',
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1, opacity: 0.7 }}>
              {eff.negative ? '▸' : '✓'}
            </span>
            <span>{eff.text}</span>
          </div>
        ))}
      </div>

      {/* BG3 note */}
      {entry.bg3Note && (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--mono)',
            fontSize: 9.5,
            color: 'var(--gold-dim)',
            letterSpacing: '0.04em',
            lineHeight: 1.4,
            borderTop: '1px solid var(--border-faint)',
            paddingTop: 5,
          }}
        >
          BG3: {entry.bg3Note}
        </div>
      )}
    </div>
  );
}

interface ConditionsCalcProps {
  activeConditions: Set<string>;
}

export function ConditionsCalc({ activeConditions }: ConditionsCalcProps) {
  if (activeConditions.size === 0) return null;

  const active = Array.from(activeConditions).sort((a, b) => {
    const aEntry = CONDITIONS[a];
    const bEntry = CONDITIONS[b];
    // Negative first, then mixed, then beneficial
    const score = (e: ConditionEntry | undefined) =>
      !e ? 1 : e.isNegative ? 0 : e.isMixed ? 1 : 2;
    return score(aEntry) - score(bEntry);
  });

  const negCount = active.filter(n => CONDITIONS[n]?.isNegative).length;
  const hasMixed = active.some(n => CONDITIONS[n]?.isMixed);

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 14px 12px',
        background: 'var(--card)',
        borderRadius: 4,
        border: '1px solid var(--border)',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-faint)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          Active Effects
        </span>
        {negCount > 0 && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--danger)',
              letterSpacing: '0.06em',
            }}
          >
            ⚠ {negCount} negative
          </span>
        )}
        {hasMixed && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--gold)',
              letterSpacing: '0.06em',
            }}
          >
            ◈ mixed
          </span>
        )}
      </div>

      {/* Condition cards */}
      {active.map(name => {
        const entry = CONDITIONS[name];
        if (!entry) {
          // Unknown condition — show placeholder
          return (
            <div
              key={name}
              style={{
                borderLeft: '3px solid var(--border)',
                background: 'var(--card-2)',
                borderRadius: '0 4px 4px 0',
                padding: '8px 12px',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  {name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: 'var(--gold-dim)',
                    border: '1px solid var(--gold-dim)',
                    borderRadius: 3,
                    padding: '1px 4px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  NO DATA
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 10.5,
                  color: 'var(--text-faint)',
                  marginTop: 4,
                }}
              >
                No mechanical data available for this condition.
              </div>
            </div>
          );
        }
        return <ConditionCard key={name} name={name} entry={entry} />;
      })}
    </div>
  );
}

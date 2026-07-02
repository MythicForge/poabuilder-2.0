interface Props {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, eyebrow, subtitle, count, countLabel, children }: Props) {
  return (
    <div style={{ paddingBottom: '1.5rem', marginBottom: '1.75rem' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {eyebrow && (
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '2.4px',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ color: 'var(--gold)' }}>◆</span>
              {eyebrow}
            </p>
          )}
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: '3.5rem',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            letterSpacing: '-0.8px',
            margin: 0,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{
              color: 'var(--text-secondary)',
              marginTop: '0.625rem',
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.65,
              maxWidth: '620px',
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {count !== undefined && (
          <span style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border-hi)',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: 'var(--gold)',
            whiteSpace: 'nowrap',
            alignSelf: 'flex-start',
            marginTop: '0.5rem',
            letterSpacing: '0.04em',
          }}>
            {count} {(countLabel ?? 'entries').toUpperCase()}
          </span>
        )}
      </div>
      {children && <div style={{ marginTop: '1rem' }}>{children}</div>}
      {/* Fading gold divider */}
      <div style={{
        marginTop: '1.25rem',
        height: '1px',
        background: 'linear-gradient(90deg, var(--gold) 0%, var(--border) 60%, transparent 100%)',
      }} />
    </div>
  );
}

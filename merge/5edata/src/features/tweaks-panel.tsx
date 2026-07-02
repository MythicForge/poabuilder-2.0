import React from 'react';

const STYLE = `
  @keyframes twk-in {
    from { opacity:0; transform:translateY(8px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)   scale(1); }
  }

  .twk-panel {
    position: fixed; right: 16px; top: 52px; z-index: 9999;
    width: 272px;
    max-height: calc(100vh - 100px);
    display: flex; flex-direction: column;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 7px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px var(--border-faint);
    overflow: hidden;
    animation: twk-in 0.18s cubic-bezier(0.23,1,0.32,1) both;
  }

  /* gold accent rule at top */
  .twk-panel::before {
    content: '';
    display: block;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
    flex-shrink: 0;
  }

  .twk-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px 10px 14px;
    border-bottom: 1px solid var(--border-faint);
    flex-shrink: 0;
  }
  .twk-hd-title {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
    font-weight: 500;
  }
  .twk-x {
    appearance: none; border: none;
    background: transparent;
    color: var(--text-faint);
    width: 20px; height: 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, color 0.12s;
    padding: 0;
  }
  .twk-x:hover { background: var(--card-2); color: var(--text); }

  .twk-body {
    padding: 6px 14px 14px;
    display: flex; flex-direction: column; gap: 2px;
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .twk-sect {
    font-family: var(--mono);
    font-size: 8.5px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gold-dim);
    padding: 12px 0 6px;
    border-bottom: 1px solid var(--border-faint);
    margin-bottom: 4px;
  }
  .twk-sect:first-child { padding-top: 8px; }

  .twk-row-h {
    display: flex; align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 5px 0;
  }
  .twk-lbl {
    font-family: var(--sans);
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.3;
    flex: 1;
  }

  /* Toggle pill */
  .twk-toggle {
    position: relative;
    width: 30px; height: 17px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--card-2);
    transition: background 0.18s, border-color 0.18s;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .twk-toggle[data-on="1"] {
    background: var(--vitality-dim);
    border-color: var(--vitality);
  }
  .twk-toggle i {
    position: absolute;
    top: 2px; left: 2px;
    width: 11px; height: 11px;
    border-radius: 50%;
    background: var(--text-faint);
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.18s;
    pointer-events: none;
  }
  .twk-toggle[data-on="1"] i {
    transform: translateX(13px);
    background: var(--vitality);
  }

  /* Stepper */
  .twk-step {
    display: flex; align-items: center; gap: 5px;
  }
  .twk-step-btn {
    appearance: none; border: 1px solid var(--border);
    background: var(--card-2);
    color: var(--text-muted);
    width: 22px; height: 22px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
    transition: border-color 0.12s, color 0.12s;
  }
  .twk-step-btn:hover:not(:disabled) { border-color: var(--gold-dim); color: var(--gold); }
  .twk-step-btn:disabled { opacity: 0.3; cursor: default; }
  .twk-step-val {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--gold);
    min-width: 22px;
    text-align: center;
  }
`;

type TweakValues = Record<string, boolean | number | string>;

const TWEAKS_STORAGE_KEY = 'bg3_tweaks';

export function useTweaks<T extends TweakValues>(
  defaults: T,
): [T, (key: keyof T, val: T[keyof T]) => void] {
  const [values, setValues] = React.useState<T>(() => {
    try {
      const saved = localStorage.getItem(TWEAKS_STORAGE_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });
  const setTweak = React.useCallback((key: keyof T, val: T[keyof T]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem(TWEAKS_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [values, setTweak];
}

interface TweaksPanelProps {
  title?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function TweaksPanel({ title = 'Settings', children, open: openProp, onOpenChange }: TweaksPanelProps) {
  const [openInternal, setOpenInternal] = React.useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openInternal;
  const setOpen = controlled ? (onOpenChange ?? (() => {})) : setOpenInternal;

  return (
    <>
      <style>{STYLE}</style>
      {open && (
        <div className="twk-panel">
          <div className="twk-hd">
            <span className="twk-hd-title">{title}</span>
            <button className="twk-x" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="twk-body">{children}</div>
        </div>
      )}
    </>
  );
}

interface TweakSectionProps {
  label: string;
  children?: React.ReactNode;
}

export function TweakSection({ label, children }: TweakSectionProps) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

interface TweakToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function TweakToggle({ label, value, onChange }: TweakToggleProps) {
  return (
    <div className="twk-row-h">
      <div className="twk-lbl">{label}</div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? '1' : '0'}
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  );
}

interface TweakStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

export function TweakStepper({ label, value, min, max, onChange }: TweakStepperProps) {
  return (
    <div className="twk-row-h">
      <div className="twk-lbl">{label}</div>
      <div className="twk-step">
        <button
          type="button"
          className="twk-step-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >−</button>
        <span className="twk-step-val">{value}</span>
        <button
          type="button"
          className="twk-step-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >+</button>
      </div>
    </div>
  );
}

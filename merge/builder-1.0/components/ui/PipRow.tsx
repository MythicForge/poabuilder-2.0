"use client";

/**
 * PipRow — renders N pips with M filled (Ambition, Wounds, custom resources).
 *
 * ≤ maxPips: interactive pip squares — click pip i to set value to i+1, or
 *   click the current-highest filled pip to clear it back by one.
 * > maxPips: collapses to a compact "filled / total" readout with +/− steppers.
 *
 * Visual variants map to the `.poa-pip` classes in globals.css (R0):
 *   variant="resource" → gold fill (Ambition, spell points)
 *   variant="wound"    → red round fill (Wounds)
 */
import Icon from "./Icon";

interface PipRowProps {
  total: number;
  filled: number;
  onChange?: (next: number) => void;
  variant?: "resource" | "wound";
  maxPips?: number;
  label?: string;
}

export default function PipRow({
  total,
  filled,
  onChange,
  variant = "resource",
  maxPips = 12,
  label,
}: PipRowProps) {
  const clamp = (n: number) => Math.max(0, Math.min(total, n));
  const set = (n: number) => onChange?.(clamp(n));

  const round = variant === "wound" ? "round" : "";
  const fillClass = variant === "wound" ? "wound" : "";

  if (total > maxPips) {
    return (
      <div className="poa-piprow-numeric" style={numericWrap}>
        {label && <span className="poa-label">{label}</span>}
        <button
          type="button"
          aria-label="decrease"
          style={stepBtn}
          disabled={!onChange || filled <= 0}
          onClick={() => set(filled - 1)}
        >
          <Icon name="minus" size={13} />
        </button>
        <span style={numericValue}>
          {filled}
          <span style={numericTotal}> / {total}</span>
        </span>
        <button
          type="button"
          aria-label="increase"
          style={stepBtn}
          disabled={!onChange || filled >= total}
          onClick={() => set(filled + 1)}
        >
          <Icon name="plus" size={13} />
        </button>
      </div>
    );
  }

  return (
    <div style={pipWrap} role="group" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled;
        return (
          <button
            key={i}
            type="button"
            aria-label={`${label ?? "pip"} ${i + 1}`}
            aria-pressed={isFilled}
            disabled={!onChange}
            onClick={() => set(i + 1 === filled ? i : i + 1)}
            className={`poa-pip ${round} ${fillClass} ${isFilled ? "filled" : ""}`.trim()}
            style={{
              cursor: onChange ? "pointer" : "default",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}

const pipWrap: React.CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "center",
};

const numericWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const stepBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--card-2)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const numericValue: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 20,
  color: "var(--gold)",
  minWidth: 48,
  textAlign: "center",
};

const numericTotal: React.CSSProperties = {
  fontSize: 14,
  color: "var(--text-faint)",
};

"use client";

/**
 * SettingsPanel — display-preferences popover for the character sheet
 * (REFACTOR_PLAN R8). Segmented controls for theme and density.
 */
import { useTheme } from "./ThemeProvider";
import type { Density } from "@/lib/useTweaks";

interface SettingsPanelProps {
  onClose: () => void;
  density: Density;
  setDensity: (d: Density) => void;
}

export default function SettingsPanel({
  onClose,
  density,
  setDensity,
}: SettingsPanelProps) {
  const { theme, toggle } = useTheme();

  return (
    <>
      {/* Click-away scrim */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 80 }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Display settings"
        className="poa-card"
        style={{
          position: "fixed",
          right: "3.75rem",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 81,
          width: "220px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        <div
          className="poa-label-gold"
          style={{ marginBottom: "12px" }}
        >
          Display
        </div>

        <Field label="Theme">
          <Segmented
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            value={theme}
            onChange={(v) => {
              if (v !== theme) toggle();
            }}
          />
        </Field>

        <Field label="Density">
          <Segmented
            options={[
              { value: "comfortable", label: "Cozy" },
              { value: "compact", label: "Compact" },
            ]}
            value={density}
            onChange={(v) => setDensity(v as Density)}
          />
        </Field>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        className="poa-label"
        style={{ fontSize: "10px", marginBottom: "5px" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: "4px",
        padding: "3px",
        background: "var(--card-2)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "5px 0",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 600,
              transition: "background 0.12s, color 0.12s",
              background: active ? "var(--gold)" : "transparent",
              color: active ? "var(--bg)" : "var(--text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

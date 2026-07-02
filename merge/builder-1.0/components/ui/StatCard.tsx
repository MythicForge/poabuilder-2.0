"use client";

/**
 * StatCard — icon + label + large value + optional sub-label tile.
 *
 * Replaces the repeated inline stat tiles across Combat / header / spells.
 * Uses the `.poa-card` shell with mono label and serif value, matching the
 * existing visual language. `tone` shifts the value color.
 */
import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: IconName;
  tone?: "default" | "gold" | "muted";
  onClick?: () => void;
}

export default function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  onClick,
}: StatCardProps) {
  const valueColor =
    tone === "gold"
      ? "var(--gold)"
      : tone === "muted"
        ? "var(--text-dim)"
        : "var(--text-primary)";

  return (
    <div
      className="poa-card poa-card-tight"
      onClick={onClick}
      style={{
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        className="poa-label"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          marginBottom: 3,
        }}
      >
        {icon && <Icon name={icon} size={12} color="var(--gold)" />}
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.05,
          color: valueColor,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="poa-label"
          style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

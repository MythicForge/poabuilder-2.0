// UI primitives (ported from 5edata, PoA-agnostic).

import React, { useMemo } from "react";
import { marked } from "marked";
import {
  Shield, ShieldOff, ShieldX, Zap, Footprints, BookText, Heart, Skull, Swords, Star, Box,
  Backpack, SquarePen, Sword, CircleUserRound, FlaskRound, ChevronRight,
  ChevronLeft, ChevronUp, ChevronDown, Shirt, BowArrow, Waypoints, Sparkle,
  ScrollText, DiamondPlus, Flame, Droplets, Dices, Weight, Moon, Sun, Coffee,
} from "lucide-react";

marked.setOptions({ breaks: true });

interface MarkdownProps {
  text: string;
  className?: string;
}
// Renders game-data description strings (bold, lists, tables — see
// spell-schema.json's "description: markdown string"). Content is
// authored data, not user input.
export function Markdown({ text, className = "" }: MarkdownProps) {
  const html = useMemo(() => marked.parse(text ?? "", { async: false }) as string, [text]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

interface SpinnerProps {
  onUp?: () => void;
  onDown?: () => void;
}
export function Spinner({ onUp, onDown }: SpinnerProps) {
  return (
    <span className="spinner">
      <span onClick={onUp}>▲</span>
      <span onClick={onDown}>▼</span>
    </span>
  );
}

interface PillProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function Pill({ children, className = "", style }: PillProps) {
  return (
    <span className={`tag ${className}`} style={style}>
      {children}
    </span>
  );
}

interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}
export function StatCard({ icon, label, value, sub, valueClass = "" }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="lbl">
        {icon && <span className="ic">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={`v ${valueClass}`}>
        <span>{value}</span>
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

interface PipTrackerProps {
  current: number;
  max: number;
  onChange: (n: number) => void;
  label?: string;
  die?: string;
}
// Click pip i -> fill up to i+1; re-click the last filled pip -> decrement by
// one. Above max 20 (reservoir at high tier, homebrew), falls back to a
// numeric −/current/max/+ counter — too many boxes to be usable as pips.
export function PipTracker({ current, max, onChange, label, die }: PipTrackerProps) {
  const clamp = (n: number) => Math.max(0, Math.min(max, n));
  const head = (
    <>
      {label && <span style={{ color: "var(--text-faint)" }}>{label}</span>}
      {die && <span className="rc-chip-count">{die}</span>}
    </>
  );
  if (max > 20) {
    return (
      <span style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "var(--mono)", fontSize: 11 }}>
        {head}
        <span className="pm" style={{ cursor: "pointer" }} onClick={() => onChange(clamp(current - 1))}>−</span>
        <span>{current}/{max}</span>
        <span className="pm" style={{ cursor: "pointer" }} onClick={() => onChange(clamp(current + 1))}>+</span>
      </span>
    );
  }
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "var(--mono)", fontSize: 11 }}>
      {head}
      <span className="rc-pips">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`rc-pip${i < current ? " filled" : ""}`}
            onClick={() => onChange(clamp(i < current ? i : i + 1))}
          />
        ))}
      </span>
    </span>
  );
}

interface IconProps {
  kind: string;
  size?: number;
}
export function Icon({ kind, size = 12 }: IconProps) {
  const p = { size, strokeWidth: 1.6 };
  switch (kind) {
    case "shield": return <Shield {...p} />;
    case "shield-off": return <ShieldOff {...p} />;
    case "shield-x": return <ShieldX {...p} />;
    case "bolt": return <Zap {...p} />;
    case "boot": return <Footprints {...p} />;
    case "book": return <BookText {...p} />;
    case "prof-icon": return <DiamondPlus {...p} />;
    case "heart": return <Heart {...p} />;
    case "skull": return <Skull {...p} />;
    case "swords": return <Swords {...p} />;
    case "star": return <Star {...p} />;
    case "bag": return <Box {...p} />;
    case "inventory": return <Backpack {...p} />;
    case "note": return <SquarePen {...p} />;
    case "sword": return <Sword {...p} />;
    case "helm": return <CircleUserRound {...p} />;
    case "potion": return <FlaskRound {...p} />;
    case "chevron-right": return <ChevronRight {...p} />;
    case "chevron-left": return <ChevronLeft {...p} />;
    case "chevron-up": return <ChevronUp {...p} />;
    case "chevron-down": return <ChevronDown {...p} />;
    case "armor-class": return <Shirt {...p} />;
    case "weapon-ranged": return <BowArrow {...p} />;
    case "magic-item": return <Sparkle {...p} />;
    case "spellcasting": return <ScrollText {...p} />;
    case "path": return <Waypoints {...p} />;
    case "flame": return <Flame {...p} />;
    case "drop": return <Droplets {...p} />;
    case "dice": return <Dices {...p} />;
    case "weight": return <Weight {...p} />;
    case "moon": return <Moon {...p} />;
    case "sun": return <Sun {...p} />;
    case "coffee": return <Coffee {...p} />;
    default: return null;
  }
}

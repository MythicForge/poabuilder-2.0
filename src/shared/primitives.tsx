// UI primitives (ported from 5edata, PoA-agnostic).

import React from "react";
import {
  Shield, Zap, Footprints, BookText, Heart, Skull, Swords, Star, Box,
  Backpack, SquarePen, Sword, CircleUserRound, FlaskRound, ChevronRight,
  ChevronLeft, ChevronUp, ChevronDown, Shirt, BowArrow, Waypoints, Sparkle,
  ScrollText, DiamondPlus, Flame, Droplets, Dices, Weight, Moon, Sun, Coffee,
} from "lucide-react";

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

interface IconProps {
  kind: string;
  size?: number;
}
export function Icon({ kind, size = 12 }: IconProps) {
  const p = { size, strokeWidth: 1.6 };
  switch (kind) {
    case "shield": return <Shield {...p} />;
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

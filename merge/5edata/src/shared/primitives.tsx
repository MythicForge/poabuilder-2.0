import React from "react";
import {
  Shield,
  Zap,
  Footprints,
  BookText,
  Heart,
  Skull,
  Swords,
  Star,
  Box,
  Backpack,
  SquarePen,
  Sword,
  CircleUserRound,
  Hand,
  Torus,
  Road,
  Gem,
  FlaskRound,
  GripVertical,
  Ellipsis,
  EllipsisVertical,
  Rows3,
  StickyNote,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Shirt,
  BowArrow,
  Waypoints,
  Sparkle,
  Check,
  DiamondPlus,
  X,
  ScrollText,
  DraftingCompass,
} from "lucide-react";
import type { RegistryItem } from "../core/types";
import { isItemProficient } from "../core/item-resolve";

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
export function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass = "",
}: StatCardProps) {
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
    case "shield":
      return <Shield {...p} />;
    case "bolt":
      return <Zap {...p} />;
    case "boot":
      return <Footprints {...p} />;
    case "book":
      return <BookText {...p} />;
    case "prof-icon":
      return <DiamondPlus {...p} />;
    case "heart":
      return <Heart {...p} />;
    case "skull":
      return <Skull {...p} />;
    case "swords":
      return <Swords {...p} />;
    case "star":
      return <Star {...p} />;
    case "bag":
      return <Box {...p} />;
    case "inventory":
      return <Backpack {...p} />;
    case "note":
      return <SquarePen {...p} />;
    case "sword":
      return <Sword {...p} />;
    case "helm":
      return <CircleUserRound {...p} />;
    case "gloves":
      return <Hand {...p} />;
    case "boots":
      return <Footprints {...p} />;
    case "ring":
      return <Torus {...p} />;
    case "cloak":
      return <Road {...p} />;
    case "amulet":
      return <Gem {...p} />;
    case "potion":
      return <FlaskRound {...p} />;
    case "grip":
      return <GripVertical {...p} />;
    case "dots-h":
      return <Ellipsis {...p} />;
    case "dots-v":
      return <EllipsisVertical {...p} />;
    case "rows":
      return <Rows3 {...p} />;
    case "cards":
      return <StickyNote {...p} />;
    case "chevron-right":
      return <ChevronRight {...p} />;
    case "chevron-left":
      return <ChevronLeft {...p} />;
    case "chevron-up":
      return <ChevronUp {...p} />;
    case "chevron-down":
      return <ChevronDown {...p} />;
    case "armor-class":
      return <Shirt {...p} />;
    case "weapon-ranged":
      return <BowArrow {...p} />;
    case "magic-item":
      return <Sparkle {...p} />;
    case "spellcasting":
      return <ScrollText {...p} />;
    case "path":
      return <Waypoints {...p} />;
    case "drafting-compass":
      return <DraftingCompass {...p} />;
    default:
      return null;
  }
}

interface ProfBadgeProps {
  item: RegistryItem;
  weaponProfs: string[];
  armorProfs: string[];
  size?: number;
}

/** Green check / red X indicating whether the character is proficient with this weapon or armor. Returns null for non-weapon/armor items. */
export function ProfBadge({
  item,
  weaponProfs,
  armorProfs,
  size = 12,
}: ProfBadgeProps) {
  const type = (item.type ?? "").replace(/\|.*/, "");
  const isGear =
    item.weapon ||
    item.armor ||
    ["M", "R", "HA", "MA", "LA", "S"].includes(type);
  if (!isGear) return null;
  const prof = isItemProficient(item, weaponProfs, armorProfs);
  return (
    <span
      title={prof ? "Proficient" : "Not proficient"}
      style={{
        color: prof ? "var(--vitality)" : "var(--danger)",
        lineHeight: 1,
        display: "inline-flex",
      }}
    >
      {prof ? (
        <Check size={size} strokeWidth={2.5} />
      ) : (
        <X size={size} strokeWidth={2.5} />
      )}
    </span>
  );
}

"use client";

/**
 * Icon — thin wrapper around lucide-react.
 *
 * Two usage modes:
 *   <Icon icon={Heart} size={14} />          // pass a Lucide component directly
 *   <Icon name="heart" size={14} />          // or use the curated name registry
 *
 * Registry covers the icons the sheet reaches for repeatedly. Add to ICONS
 * as new needs appear rather than importing Lucide ad-hoc across components.
 */
import {
  Heart,
  Shield,
  Swords,
  Sparkles,
  Dices,
  Flame,
  Zap,
  Package,
  BookOpen,
  Scroll,
  Star,
  Plus,
  Minus,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Footprints,
  Eye,
  Crosshair,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  heart: Heart,
  shield: Shield,
  swords: Swords,
  sparkles: Sparkles,
  dice: Dices,
  flame: Flame,
  zap: Zap,
  package: Package,
  book: BookOpen,
  scroll: Scroll,
  star: Star,
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  footprints: Footprints,
  eye: Eye,
  crosshair: Crosshair,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  icon?: LucideIcon;
  name?: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Icon({
  icon,
  name,
  size = 16,
  color = "currentColor",
  strokeWidth = 2,
  className,
  style,
}: IconProps) {
  const Cmp = icon ?? (name ? ICONS[name] : undefined);
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
    />
  );
}

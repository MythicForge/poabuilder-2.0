// Shared bestiary field extractors — used by the Vassals tab and the GM
// encounter tracker to read 5etools monster entries consistently.

import type { BestiaryEntry } from "./types";

export const bestiaryType = (e: BestiaryEntry): string => {
  if (!e.type) return "unknown";
  return typeof e.type === "string"
    ? e.type
    : ((e.type as { type: string }).type ?? "unknown");
};

export const bestiaryCR = (e: BestiaryEntry): string => {
  if (!e.cr) return "?";
  return typeof e.cr === "string" ? e.cr : (e.cr as { cr: string }).cr;
};

export const crToNum = (cr: string): number =>
  (
    ({ "0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 }) as Record<
      string,
      number
    >
  )[cr] ?? (parseFloat(cr) || 0);

export const bestiaryAC = (e: BestiaryEntry, profBonus = 0): number => {
  const a = e.ac[0];
  if (typeof a === "number") return a;
  const obj = a as { ac?: number; special?: string };
  if (typeof obj.ac === "number") return obj.ac;
  if (obj.special) {
    const pbMatch = obj.special.match(/(\d+)\s*\+\s*PB/i);
    if (pbMatch) return parseInt(pbMatch[1]) + profBonus;
    const numMatch = obj.special.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1]);
  }
  return 10;
};

// Groups FeatCards by their (source, owner) bucket in the fixed build-order
// used by both the Features tab rail and the Combat tab ledger.

import type { FeatCard, FeatSource } from "../core/types.ts";

export const SOURCE_ORDER: FeatSource[] = ["profession", "path", "origin", "vocation", "universal"];

export interface FeatGroup {
  key: string;
  source: FeatSource;
  owner: string;
  label: string;
  cards: FeatCard[];
}

export function labelForGroup(source: FeatSource, owner: string): string {
  switch (source) {
    case "profession":
      return `Profession — ${owner}`;
    case "origin":
      return `Origin — ${owner}`;
    case "vocation":
      return `Vocation — ${owner}`;
    case "path":
    case "universal":
      return owner;
  }
}

export function groupFeatCards(cards: FeatCard[]): FeatGroup[] {
  const groups = new Map<string, FeatGroup>();
  for (const card of cards) {
    const key = `${card.source}:${card.owner}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, source: card.source, owner: card.owner, label: labelForGroup(card.source, card.owner), cards: [] };
      groups.set(key, g);
    }
    g.cards.push(card);
  }
  return [...groups.values()].sort((a, b) => {
    const rank = SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source);
    return rank !== 0 ? rank : a.owner.localeCompare(b.owner);
  });
}

// Coin math for PoA's three-coin purse (gold/silver/copper). Ported from the
// 5e cards-view currency architecture: normalize to copper for all math,
// greedy re-split (largest denomination first) for display.
// Assumed ratio 1 gold = 10 silver = 100 copper — unverified in rules data,
// flag if it turns out wrong (see .claude/inventory-cards-plan.md §8).

export type Coins = { gold: number; silver: number; copper: number };

export function totalCp(c: Coins): number {
  return c.gold * 100 + c.silver * 10 + c.copper;
}

export function fromCp(n: number): Coins {
  const cp = Math.max(0, Math.floor(n));
  const gold = Math.floor(cp / 100);
  const silver = Math.floor((cp % 100) / 10);
  const copper = cp % 10;
  return { gold, silver, copper };
}

export function spend(c: Coins, delta: Coins): Coins {
  return fromCp(totalCp(c) - totalCp(delta));
}

// No re-split: gaining coins adds to each denomination directly so the
// player's existing coins aren't silently consolidated.
export function gain(c: Coins, delta: Coins): Coins {
  return {
    gold: c.gold + delta.gold,
    silver: c.silver + delta.silver,
    copper: c.copper + delta.copper,
  };
}

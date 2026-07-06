import { describe, expect, it } from "vitest";
import { fromCp, gain, spend, totalCp, type Coins } from "./currency.ts";

describe("currency", () => {
  it("round-trips totalCp/fromCp", () => {
    const c: Coins = { gold: 3, silver: 7, copper: 4 };
    expect(fromCp(totalCp(c))).toEqual(c);
  });

  it("spend borrows from higher coins via the cp round-trip", () => {
    const purse: Coins = { gold: 1, silver: 0, copper: 0 };
    expect(spend(purse, { gold: 0, silver: 0, copper: 5 })).toEqual({ gold: 0, silver: 9, copper: 5 });
  });

  it("clamps spend at zero instead of going negative", () => {
    const purse: Coins = { gold: 0, silver: 0, copper: 3 };
    expect(spend(purse, { gold: 1, silver: 0, copper: 0 })).toEqual({ gold: 0, silver: 0, copper: 0 });
  });

  it("gain adds per-denomination without re-splitting", () => {
    const purse: Coins = { gold: 1, silver: 15, copper: 20 };
    expect(gain(purse, { gold: 0, silver: 0, copper: 5 })).toEqual({ gold: 1, silver: 15, copper: 25 });
  });

  it("fromCp floors fractional and negative input to zero coins", () => {
    expect(fromCp(-50)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(fromCp(123.9)).toEqual({ gold: 1, silver: 2, copper: 3 });
  });
});

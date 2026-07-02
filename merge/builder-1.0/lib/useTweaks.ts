"use client";

/**
 * useTweaks — localStorage-backed display preferences for the character sheet
 * (REFACTOR_PLAN R8). Theme lives in ThemeProvider; this covers the rest.
 *
 * Each tweak is mirrored onto a `data-*` attribute on <html> so CSS can react
 * without prop-threading. Currently: density (comfortable | compact).
 */
import { useCallback, useEffect, useState } from "react";

export type Density = "comfortable" | "compact";

const DENSITY_KEY = "poa-density";

function isDensity(v: string | null): v is Density {
  return v === "comfortable" || v === "compact";
}

export function useTweaks() {
  // Lazy initializer reads localStorage on the client's first render (this is a
  // client-only-rendered component, so there's no hydration branch to mismatch).
  const [density, setDensityState] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    const stored = localStorage.getItem(DENSITY_KEY);
    return isDensity(stored) ? stored : "comfortable";
  });

  // Mirror onto <html data-density> for CSS — external-system sync only.
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    localStorage.setItem(DENSITY_KEY, next);
  }, []);

  return { density, setDensity };
}

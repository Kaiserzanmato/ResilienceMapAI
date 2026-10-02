"use client";
import { useSyncExternalStore } from "react";

/** SSR-safe media query subscription (no setState-in-effect flicker).
 * Defaults to `serverFallback` on first server/client render, then syncs to
 * the real match once mounted. */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback
  );
}

/** Shared desktop/mobile breakpoint for components that branch on layout in JS
 * (Modal handles its own mobile/desktop split purely via CSS and doesn't need this). */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)", true);

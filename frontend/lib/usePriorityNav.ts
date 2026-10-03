"use client";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Measures how many of `itemCount` items (priority order, most important
 * first) fit inside a flex row without overflowing, reserving room for a
 * trailing "more" trigger whenever not everything fits. Re-measures via
 * ResizeObserver, so it reacts to the window resizing *and* to sibling
 * elements (a longer persona label, the label/icon-only breakpoint) changing
 * how much room is actually left — not just a fixed pixel guess.
 *
 * Requires a hidden measurement row (`measureRef`) rendering the same items
 * with the same classes as the visible row: a `display: none` item reports 0
 * width, which would make the fitted count flicker upward every pass, so the
 * measurement row stays laid out (`visibility: hidden`, taken out of flow via
 * `absolute`) purely so its items' real widths can be read.
 */
export function usePriorityNav(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(itemCount);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recompute = () => {
      const available = container.clientWidth;
      const moreWidth = moreRef.current?.offsetWidth ?? 0;
      const left = measure.getBoundingClientRect().left;
      const items = Array.from(measure.children) as HTMLElement[];
      let fit = items.length;
      for (let i = 0; i < items.length; i++) {
        const right = items[i].getBoundingClientRect().right - left;
        const isLast = i === items.length - 1;
        // The last item never needs to reserve room for "More" — there's
        // nothing left to hide behind it if it itself fits.
        const budget = isLast ? available : available - moreWidth;
        if (right > budget) {
          fit = i;
          break;
        }
      }
      setVisibleCount(fit);
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    recompute();
    return () => ro.disconnect();
  }, [itemCount]);

  return { containerRef, measureRef, moreRef, visibleCount };
}

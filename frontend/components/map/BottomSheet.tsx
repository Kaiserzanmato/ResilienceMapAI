"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { nearestSnap, PEEK_PX, SHEET_SNAPS, SNAP_LABEL, snapHeight, type SheetSnap } from "@/lib/sheet-snap";

export type { SheetSnap };

/**
 * Draggable bottom sheet with three snap points: peek (~70px), mid (45dvh) and full (90dvh).
 * Drag the handle, or use it as a slider with the arrow keys. The tallest snap is 90dvh, or less when the nav and search bar need the room. Only the sheet itself takes pointer
 * events; the map stays directly touchable around it. Sits above the footer and honours the
 * home-indicator safe area.
 */
export function BottomSheet({
  snap, onSnapChange, label, children, className,
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const [cap, setCap] = useState(Infinity);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(vh);
      // Room under the top controls (nav, search bar), which sit above the page in z-order.
      const root = rootRef.current;
      if (!root) return;
      let top = 0;
      for (const el of document.querySelectorAll<HTMLElement>('[data-map-obstruction="top"]')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) top = Math.max(top, rect.bottom);
      }
      setCap(vh - (parseFloat(getComputedStyle(root).bottom) || 0) - top - 8);
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    // The nav and search bar can change height after mount (fonts, wrapping), which moves the cap.
    const observer = new ResizeObserver(() => requestAnimationFrame(update));
    document.querySelectorAll('[data-map-obstruction="top"]').forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  const height = dragHeight ?? snapHeight(snap, viewportHeight, cap);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: snapHeight(snap, viewportHeight, cap) };
  }, [snap, viewportHeight, cap]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = drag.current.startHeight + (drag.current.startY - e.clientY);
    setDragHeight(Math.min(snapHeight("full", viewportHeight, cap), Math.max(PEEK_PX, next)));
  }, [viewportHeight, cap]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const moved = Math.abs(drag.current.startY - e.clientY);
    drag.current = null;
    if (dragHeight !== null && moved > 4) onSnapChange(nearestSnap(dragHeight, viewportHeight, cap));
    setDragHeight(null);
  }, [dragHeight, onSnapChange, viewportHeight, cap]);

  const step = (direction: 1 | -1) => {
    const next = SHEET_SNAPS[SHEET_SNAPS.indexOf(snap) + direction];
    if (next) onSnapChange(next);
  };

  return (
    <div
      ref={rootRef}
      data-testid="risk-sheet"
      data-snap={snap}
      data-map-obstruction="bottom"
      role="region"
      aria-label={label}
      className={cn(
        "glass-strong pointer-events-auto absolute inset-x-0 z-[var(--z-panels)] flex flex-col overflow-hidden rounded-t-3xl",
        dragHeight === null && "transition-[height] duration-300 ease-[var(--motion-spring)] motion-reduce:transition-none",
        className
      )}
      style={{
        bottom: "calc(var(--footer-h) + var(--safe-bottom))",
        height,
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
      }}
    >
      <div
        role="slider"
        tabIndex={0}
        aria-label="Resize risk assessment"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={SHEET_SNAPS.indexOf(snap)}
        aria-valuetext={SNAP_LABEL[snap]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
          else if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
        }}
        onDoubleClick={() => onSnapChange(snap === "full" ? "mid" : "full")}
        className="focus-ring flex h-5 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[color-mix(in_srgb,var(--fg)_28%,transparent)]" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">{children}</div>
    </div>
  );
}

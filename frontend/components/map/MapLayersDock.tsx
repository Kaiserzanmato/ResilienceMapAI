"use client";
import { Layers } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { DataSourceWidget } from "./DataSourceWidget";
import { IntelligenceMarkersWidget } from "./IntelligenceMarkersWidget";
import { LayerControlWidget } from "./LayerControlWidget";
import { RiskLegend } from "./RiskLegend";

/** Desktop breakpoint: the layer stack is docked. Below it, it is an off-canvas flyout with a backdrop. */
const DOCK_QUERY = "(min-width: 1024px)";

/** Sits under the search row, shared by the stack and its floating button so reopening does not jump. */
const TOP = "calc(var(--banner-h) + var(--nav-h) + 96px)";

/**
 * The left overlay. On desktop (>= 1024px) the whole stack slides off-screen when collapsed and a floating
 * "Map Layers" button brings it back. On tablets, unfolded foldables and phones it is a dismissible flyout
 * (backdrop, Escape, close button). Only the cards take pointer events, so the map stays directly touchable.
 */
export function MapLayersDock() {
  const isDock = useMediaQuery(DOCK_QUERY, true);
  const [dockOpen, setDockOpen] = useState(true);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const open = isDock ? dockOpen : flyoutOpen;
  const setOpen = useCallback((value: boolean) => (isDock ? setDockOpen(value) : setFlyoutOpen(value)), [isDock]);
  const fabRef = useRef<HTMLButtonElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);

  // Flyout: Escape closes it. Focus moves in on open and back to the button on close.
  useEffect(() => {
    if (isDock || !flyoutOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFlyoutOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDock, flyoutOpen]);

  useEffect(() => {
    if (open && !wasOpen.current) stackRef.current?.querySelector<HTMLElement>("button, select, [role=switch]")?.focus();
    else if (!open && wasOpen.current) fabRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {!isDock && (
        <button
          type="button"
          tabIndex={flyoutOpen ? 0 : -1}
          aria-label="Close Map Layers"
          onClick={() => setFlyoutOpen(false)}
          className={cn(
            "absolute inset-0 z-[var(--z-popups)] bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 motion-reduce:transition-none",
            flyoutOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          )}
        />
      )}

      <div
        ref={stackRef}
        data-map-overlay
        data-map-obstruction="left"
        data-testid="layers-dock"
        data-open={open}
        data-mode={isDock ? "dock" : "flyout"}
        aria-hidden={!open}
        className={cn(
          "pointer-events-none absolute left-0 flex flex-col gap-3 overflow-y-auto overscroll-contain pr-2",
          "transition-[transform,visibility] duration-300 ease-[var(--motion-spring)] motion-reduce:transition-none",
          isDock ? "z-[var(--z-panels)]" : "z-[var(--z-popups)]",
          open ? "translate-x-0 visible" : "-translate-x-full invisible"
        )}
        style={{
          top: TOP,
          maxHeight: "calc(var(--vh100) - var(--banner-h) - var(--nav-h) - var(--footer-h) - var(--safe-bottom) - 120px)",
          paddingLeft: "max(0.75rem, var(--safe-left))",
          paddingBottom: "12px",
          // Hide only after the slide-out has finished.
          transitionDelay: open ? "0s" : "0s, 300ms",
        }}
      >
        <div className="pointer-events-auto shrink-0">
          <LayerControlWidget onCollapse={() => setOpen(false)} collapseStyle={isDock ? "chevron" : "close"} />
        </div>
        <div className="pointer-events-auto shrink-0">
          <IntelligenceMarkersWidget />
        </div>
        <div className="pointer-events-auto shrink-0">
          <DataSourceWidget />
        </div>
        <div className="pointer-events-auto">
          <RiskLegend />
        </div>
      </div>

      <button
        ref={fabRef}
        type="button"
        data-map-overlay
        data-map-obstruction="left"
        data-testid="layers-fab"
        aria-label="Map Layers"
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
        className={cn(
          "glass-strong focus-ring pointer-events-auto absolute z-[var(--z-popups)] flex h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-[13px] font-semibold shadow-[var(--elevation-2)]",
          "transition-[opacity,transform] duration-200 motion-reduce:transition-none",
          open ? "pointer-events-none invisible scale-90 opacity-0" : "visible scale-100 opacity-100"
        )}
        style={{ top: TOP, left: "max(1rem, var(--safe-left))" }}
      >
        <Layers size={16} className="text-[var(--accent)]" aria-hidden="true" />
        Map Layers
      </button>
    </>
  );
}

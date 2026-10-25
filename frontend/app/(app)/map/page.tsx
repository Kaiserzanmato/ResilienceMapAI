"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BottomSheet, type SheetSnap } from "@/components/map/BottomSheet";
import { MapLayersDock } from "@/components/map/MapLayersDock";
import { RiskSummaryChip } from "@/components/map/RiskSummaryChip";
import { RiskSummaryWidget } from "@/components/map/RiskSummaryWidget";
import { MapCommandBar } from "@/components/map/MapCommandBar";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useAppStore } from "@/lib/store";
import { buildMapTarget, getOfficialSourcesByCountry } from "@/lib/map-target-builder";
import { assessmentQueryKey, fetchAssessment } from "@/lib/queries/assessment";

// Lazy-load the map (heaviest bundle) per performance requirements
const RiskMap = dynamic(() => import("@/components/map/RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--fg-muted)]">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  const { selected, setRisk, setActiveTarget, aiOpen, aiPanelWidth, personaMenuOpen } = useAppStore();
  const isPhone = !useMediaQuery("(min-width: 768px)", false);
  const isXl = useMediaQuery("(min-width: 1280px)", false);
  // Minimize and snap state belong to one selection: a new location opens the panel fresh, so they are
  // keyed by it rather than reset from an effect.
  const selectionKey = selected ? `${selected.lat},${selected.lng}` : null;
  const [minimizedFor, setMinimizedFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ key: string | null; snap: SheetSnap }>({ key: null, snap: "mid" });
  const minimized = selectionKey !== null && minimizedFor === selectionKey;
  const snap = sheet.key === selectionKey ? sheet.snap : "mid";
  // Fetch risk whenever a location is selected (click or search)
  const { data: risk } = useQuery({
    queryKey: assessmentQueryKey(selected),
    queryFn: () => fetchAssessment(selected!),
    enabled: !!selected,
  });

  // A new selection invalidates whatever the store holds for the previous one. Without this the
  // previous click's assessment (name, coordinates) stayed in the store until the new fetch
  // resolved, and for ever if it failed, so AI context and exports could describe the wrong spot.
  useEffect(() => {
    setRisk(null);
    setActiveTarget(null);
  }, [selected?.lat, selected?.lng, selected?.name, selected?.countryCode, setRisk, setActiveTarget]);

  useEffect(() => {
    if (risk && selected) {
      // Store risk data in state
      setRisk(risk);

      // Build and store MapTarget for AI agent alignment (architecture: resilience_map_architecture.pdf)
      const officialSources = getOfficialSourcesByCountry(selected.countryCode || "XX");
      const mapTarget = buildMapTarget(selected, risk, officialSources);
      setActiveTarget(mapTarget);
    }
  }, [risk, selected, setRisk, setActiveTarget]);

  // The persona menu and, below xl, the AI panel take the space the summary uses.
  const showSummary = !!selected && !personaMenuOpen && (isXl || !aiOpen);
  // Below xl the summary sits under the search row (it would collide with the "Run AI Risk Assessment" button).
  const rightTop = isXl ? "calc(var(--banner-h) + var(--nav-h) + 36px)" : "calc(var(--banner-h) + var(--nav-h) + 96px)";

  return (
    <div
      className="h-viewport fixed inset-x-0 top-0"
      style={{ "--ai-panel-w": `${aiPanelWidth}px` } as React.CSSProperties}
    >
      {/* Map fills the entire viewport beneath all overlays */}
      <RiskMap />

      {/* Floating Command Bar — the single unified location search/select
          control (map click, dropdown search, or preset) all read/write the
          same `selected` store value, so there is exactly one place a user
          searches for or sees the current location. */}
      <MapCommandBar />

      {/* Left overlay: docked stack on desktop, off-canvas flyout below 1024px. */}
      <MapLayersDock />

      {/* Right overlay (tablet and desktop): the full panel, or a chip once minimized. */}
      {showSummary && !isPhone && (
        <div
          data-map-overlay
          data-map-obstruction="right"
          className="pointer-events-none absolute z-[var(--z-panels)]"
          style={{ top: rightTop, right: aiOpen ? "calc(var(--ai-panel-w) + 1.5rem)" : "max(1rem, var(--safe-right))" }}
        >
          <div className="pointer-events-auto">
            {minimized && risk ? (
              <RiskSummaryChip
                name={risk.location_name}
                score={risk.overall.score}
                level={risk.overall.level}
                color={risk.overall.color}
                onExpand={() => setMinimizedFor(null)}
              />
            ) : (
              <RiskSummaryWidget onMinimize={() => setMinimizedFor(selectionKey)} />
            )}
          </div>
        </div>
      )}

      {/* Phones and folded screens: a draggable bottom sheet (peek, 45dvh, 90dvh). */}
      {showSummary && isPhone && (
        <BottomSheet
          snap={snap}
          onSnapChange={(next) => setSheet({ key: selectionKey, snap: next })}
          label="Hazard risk assessment"
        >
          <RiskSummaryWidget variant="sheet" />
        </BottomSheet>
      )}
    </div>
  );
}

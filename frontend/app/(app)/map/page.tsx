"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { DataSourceWidget } from "@/components/map/DataSourceWidget";
import { IntelligenceMarkersWidget } from "@/components/map/IntelligenceMarkersWidget";
import { LayerControlWidget } from "@/components/map/LayerControlWidget";
import { RiskLegend } from "@/components/map/RiskLegend";
import { RiskSummaryWidget } from "@/components/map/RiskSummaryWidget";
import { SearchBar } from "@/components/map/SearchBar";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { buildMapTarget, getOfficialSourcesByCountry } from "@/lib/map-target-builder";
import { toRiskAssessment } from "@/lib/assessment-adapter";

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
  const { selected, setRisk, setActiveTarget, aiOpen, aiPanelWidth } = useAppStore();
  // Fetch risk whenever a location is selected (click or search)
  const { data: risk } = useQuery({
    queryKey: ["assessment", selected?.lat, selected?.lng, selected?.name, selected?.countryCode],
    queryFn: async () => toRiskAssessment(await api.assessLocation({
      lat: selected!.lat,
      lng: selected!.lng,
      name: selected?.name,
      country_code: selected?.countryCode,
      geometry_type: "point",
    })),
    enabled: !!selected,
  });

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

  return (
    <div
      className="fixed inset-0 top-0"
      style={{ "--ai-panel-w": `${aiPanelWidth}px` } as React.CSSProperties}
    >
      {/* Map fills the entire viewport beneath all overlays */}
      <RiskMap />

      {/* Search below the navigation for tablet and mobile. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-[calc(var(--banner-h)+var(--nav-h)+36px)] z-30 flex justify-center px-3 xl:hidden ${
          aiOpen ? "md:right-[calc(var(--ai-panel-w)+1.5rem)]" : ""
        }`}
      >
        <div className="pointer-events-auto w-full max-w-md">
          <SearchBar />
        </div>
      </div>

      {/* Desktop uses one grid for search + summary. The auto-sized summary
          column keeps search out of the summary's actual space, while the
          shared AI width reserves the expanded panel's space. */}
      <div
        className="pointer-events-none absolute left-3 top-[calc(var(--banner-h)+var(--nav-h)+36px)] z-30 hidden grid-cols-[minmax(0,1fr)_auto] gap-3 xl:grid"
        style={{ right: aiOpen ? "calc(var(--ai-panel-w) + 1.5rem)" : "4rem" }}
      >
        <div className="pointer-events-auto min-w-0 w-full max-w-md justify-self-center">
          <SearchBar />
        </div>
        <div className="pointer-events-auto">
          <RiskSummaryWidget />
        </div>
      </div>

      {/* Left widget stack (desktop/tablet). All sidebar cards, including the
          legend, share one bounded scroll region so short viewports cannot
          make cards overlap or leave a card unusable behind the legend. */}
      <div
        className="pointer-events-none absolute left-3 z-20 hidden flex-col gap-3 overflow-y-auto overscroll-contain pr-2 md:flex"
        style={{
          // Keep controls below the search/summary row so the grid can shrink
          // safely when the desktop AI panel is widened.
          top: "calc(var(--banner-h) + var(--nav-h) + 96px)",
          maxHeight: "calc(100vh - var(--banner-h) - var(--nav-h) - var(--footer-h) - 180px)",
          paddingBottom: "12px",
        }}
      >
        <div className="pointer-events-auto shrink-0">
          <LayerControlWidget />
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

      {/* Risk summary — desktop: top right; mobile: above footer */}
      <div
        className="pointer-events-none absolute inset-x-0 z-20 px-3 md:inset-x-auto md:right-3 md:px-0"
        style={{
          bottom: "calc(var(--footer-h) + 8px)",
          top: "auto",
        }}
      >
        <div
          className={`pointer-events-auto md:hidden ${aiOpen ? "hidden" : "block"}`}
          style={{ paddingBottom: "0" }}
        >
          <RiskSummaryWidget />
        </div>
      </div>
      {/* Tablet: AI and full summary are mutually exclusive. Desktop summary
          is rendered by the header grid above. */}
      <div
        className={`pointer-events-none absolute z-20 hidden xl:hidden ${aiOpen ? "md:hidden" : "md:block"}`}
        style={{
          top: "calc(var(--banner-h) + var(--nav-h) + 36px)",
          right: "4rem",
        }}
      >
        <div className="pointer-events-auto">
          <RiskSummaryWidget />
        </div>
      </div>

      {/* Mobile: compact layer controls */}
      <div
        className="pointer-events-none absolute left-3 z-20 md:hidden"
        style={{ top: "calc(var(--banner-h) + var(--nav-h) + 96px)" }}
      >
        <div className="pointer-events-auto">
          <LayerControlWidget />
        </div>
      </div>
    </div>
  );
}

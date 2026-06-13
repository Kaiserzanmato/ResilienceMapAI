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
  const { selected, setRisk } = useAppStore();

  // Fetch risk whenever a location is selected (click or search)
  const { data: risk } = useQuery({
    queryKey: ["risk", selected?.lat, selected?.lng, selected?.name],
    queryFn: () => api.locationRisk(selected!.lat, selected!.lng, selected?.name),
    enabled: !!selected,
  });

  useEffect(() => {
    if (risk) setRisk(risk);
  }, [risk, setRisk]);

  return (
    <div className="fixed inset-0 top-0">
      {/* Map fills the entire viewport beneath all overlays */}
      <RiskMap />

      {/* Floating search — top center, below banner + nav */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--banner-h)+var(--nav-h)+36px)] z-30 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-md">
          <SearchBar />
        </div>
      </div>

      {/* Left widget stack (desktop/tablet) — constrained to avoid legend overlap */}
      <div
        className="pointer-events-none absolute left-3 z-20 hidden flex-col gap-3 md:flex overflow-y-auto"
        style={{
          top: "calc(var(--banner-h) + var(--nav-h) + 36px)",
          maxHeight: "calc(100vh - var(--banner-h) - var(--nav-h) - var(--footer-h) - 260px)",
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
      </div>

      {/* Legend — above footer, bottom-left */}
      <div
        className="pointer-events-none fixed left-3 z-20 hidden md:block"
        style={{ bottom: "calc(var(--footer-h) + 12px)" }}
      >
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
          className="md:hidden pointer-events-auto"
          style={{ paddingBottom: "0" }}
        >
          <RiskSummaryWidget />
        </div>
      </div>
      {/* Risk summary desktop — top right */}
      <div
        className="pointer-events-none absolute right-3 z-20 hidden md:block"
        style={{ top: "calc(var(--banner-h) + var(--nav-h) + 36px)" }}
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

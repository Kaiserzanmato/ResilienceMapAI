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
      {/* Map fills the viewport beneath the floating nav */}
      <RiskMap />

      {/* Floating search — top center, below nav */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--nav-h)+24px)] z-30 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-md">
          <SearchBar />
        </div>
      </div>

      {/* Left widget stack (desktop/tablet) — flex-col with max-height to prevent overlap */}
      <div className="pointer-events-none absolute left-3 top-[calc(var(--nav-h)+24px)] z-20 hidden flex-col gap-3 md:flex max-h-[calc(100vh-var(--nav-h)-200px)] overflow-y-auto">
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

      {/* Legend — positioned to avoid overlap with left widgets */}
      <div className="pointer-events-none fixed bottom-3 left-3 z-20 hidden md:block">
        <div className="pointer-events-auto">
          <RiskLegend />
        </div>
      </div>

      {/* Risk summary — desktop: top right; mobile: bottom sheet */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 md:inset-x-auto md:right-3 md:top-[calc(var(--nav-h)+24px)] md:bottom-auto md:px-0 md:pb-0">
        <div className="pointer-events-auto">
          <RiskSummaryWidget />
        </div>
      </div>

      {/* Mobile: compact layer controls */}
      <div className="pointer-events-none absolute left-3 top-[calc(var(--nav-h)+84px)] z-20 md:hidden">
        <div className="pointer-events-auto">
          <LayerControlWidget />
        </div>
      </div>
    </div>
  );
}

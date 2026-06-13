"use client";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  PRIORITIZED_LOCATIONS,
  PrioritizedLocation,
  getLocationsSortedByRisk,
} from "@/lib/prioritized-locations";
import { useAppStore } from "@/lib/store";
import { riskColor } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { PrioritizedLocationInsight } from "./PrioritizedLocationInsight";

/**
 * Intelligence Markers widget: dropdown selector for prioritized high-risk locations
 * with expandable historical insight cards.
 */
export function IntelligenceMarkersWidget() {
  const setSelected = useAppStore((s) => s.setSelected);
  const [selectedLocation, setSelectedLocation] = useState<PrioritizedLocation | null>(
    PRIORITIZED_LOCATIONS[0] || null
  );

  const sortedLocations = getLocationsSortedByRisk();

  const handleSelectLocation = (location: PrioritizedLocation) => {
    setSelectedLocation(location);
    // Focus the map on the selected location
    setSelected({
      lat: location.lat,
      lng: location.lng,
      name: location.name,
    });
  };

  return (
    <div className="space-y-3">
      {/* Dropdown Selector */}
      <GlassCard strong className="w-60 overflow-hidden">
        <div className="px-4 py-3">
          <label
            htmlFor="prioritized-location-select"
            className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] block mb-2"
          >
            Prioritized High-Risk Area
          </label>
          <div className="relative">
            <select
              id="prioritized-location-select"
              value={selectedLocation?.id || ""}
              onChange={(e) => {
                const loc = PRIORITIZED_LOCATIONS.find((l) => l.id === e.target.value);
                if (loc) handleSelectLocation(loc);
              }}
              aria-label="Select a prioritized high-risk area"
              className="focus-ring w-full appearance-none cursor-pointer rounded-lg border border-[var(--surface-border)] bg-[var(--surface-solid)] px-3 py-2.5 text-[13px] font-medium pr-8 transition-all hover:border-[var(--accent)]"
            >
              {sortedLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} — {location.score} ({location.level} Risk)
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--fg-muted)]"
              aria-hidden="true"
            />
          </div>
        </div>
      </GlassCard>

      {/* Insight Widget for Selected Location */}
      {selectedLocation && <PrioritizedLocationInsight location={selectedLocation} />}
    </div>
  );
}

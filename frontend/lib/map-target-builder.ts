/**
 * MapTarget Builder - Converts location + risk data + sources into unified state object
 * for AI agent alignment per resilience_map_architecture.pdf Section 6.1
 */

import type { MapTarget, SelectedLocation } from "./store";
import type { RiskAssessment } from "./types";
import { compressHazardScores } from "./hazard-utils";

/**
 * Build MapTarget from location and risk assessment.
 * Called when map is clicked or location is selected via search.
 */
export function buildMapTarget(
  location: SelectedLocation,
  risk: RiskAssessment,
  officialSources: string[] = []
): MapTarget {
  // Quantize coordinates to 3 decimal places (~110m precision) per spec
  const lat = Math.round(location.lat * 1000) / 1000;
  const lng = Math.round(location.lng * 1000) / 1000;

  // Compress hazard scores to array format for token efficiency
  const hazardScores = compressHazardScores(risk.hazards);

  return {
    latitude: lat,
    longitude: lng,
    cityName: location.name || `${lat}, ${lng}`,
    countryCode: location.countryCode || "XX",
    hazardScores,
    officialSources,
    timestamp: Date.now(),
  };
}

/**
 * Get official sources for a location based on country code.
 * Implements dynamic source routing per Section 2 of architecture.
 */
export function getOfficialSourcesByCountry(countryCode: string): string[] {
  // Country-specific source routing (to be expanded with all 249 countries)
  const countrySourcesMap: Record<string, string[]> = {
    // Philippines
    PH: [
      "https://www.pagasa.dost.gov.ph (Tropical Cyclone & Weather)",
      "https://www.phivolcs.dost.gov.ph (Seismic & Volcanic)",
      "https://georisk.gov.ph (Geohazard Mapping)",
    ],
    // United States
    US: [
      "https://api.weather.gov (NOAA Weather)",
      "https://www.nhc.noaa.gov (Hurricane Center)",
      "https://earthquake.usgs.gov (Earthquake Hazards)",
      "https://www.fema.gov (Disaster Management)",
    ],
    // Japan
    JP: [
      "https://www.jma.go.jp (JMA Typhoon/Earthquake)",
      "https://www.data.jma.go.jp (Japan Meteorological Data)",
    ],
    // Indonesia
    ID: [
      "https://www.bmkg.go.id (BMKG Weather & Volcano)",
      "https://www.bnpb.go.id (National Disaster Management)",
    ],
    // Default global fallback
    XX: [
      "https://www.gdacs.org (Global Disaster Alert System)",
      "https://data.humdata.org (Humanitarian Data Exchange)",
      "https://www.acleddata.com (Conflict Events)",
    ],
  };

  return countrySourcesMap[countryCode] || countrySourcesMap.XX;
}

/**
 * Format MapTarget context for AI agent system prompt injection.
 * Per Section 7.1 of architecture.
 */
export function formatMapTargetForPrompt(target: MapTarget): string {
  const sourcesList = target.officialSources.join("; ");

  return `[ACTIVE GEOPOLITICAL VIEWPORT]
Country: ${target.countryCode}
Region/City: ${target.cityName}
Coordinates: ${target.latitude}, ${target.longitude}

[INJECTED SYSTEM TELEMETRY DATA]
Hazard Metrics: ${JSON.stringify(target.hazardScores)}

[AUTHORIZED GROUNDING SOURCE SITES]
${sourcesList || "(No sources configured)"}`;
}

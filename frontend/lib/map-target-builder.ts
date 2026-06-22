/**
 * MapTarget Builder - Converts location + risk data + sources into unified state object
 * for AI agent alignment per resilience_map_architecture.pdf Section 6.1
 */

import type { MapTarget, SelectedLocation } from "./store";
import type { RiskAssessment } from "./types";
import { compressHazardScores } from "./hazard-utils";
import { getRiskReference, formatReferenceForPrompt } from "./risk-reference";

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
 * Pulls from risk-reference.json dataset first, falls back to globals.
 */
export function getOfficialSourcesByCountry(countryCode: string): string[] {
  const ref = getRiskReference(countryCode);
  if (ref?.sources?.length) return ref.sources;

  // Global fallback
  return [
    "https://www.gdacs.org (Global Disaster Alert System)",
    "https://data.humdata.org (Humanitarian Data Exchange)",
    "https://www.acleddata.com (Conflict Events)",
  ];
}

/**
 * Format MapTarget context for AI agent system prompt injection.
 * Includes research reference data if available for the country.
 * Per Section 7.1 of architecture.
 */
export function formatMapTargetForPrompt(target: MapTarget): string {
  const sourcesList = target.officialSources.join("; ");
  const ref = getRiskReference(target.countryCode);
  const referenceBlock = ref ? formatReferenceForPrompt(ref) : null;

  return [
    `[ACTIVE GEOPOLITICAL VIEWPORT]`,
    `Country: ${target.countryCode}`,
    `Region/City: ${target.cityName}`,
    `Coordinates: ${target.latitude}, ${target.longitude}`,
    ``,
    `[INJECTED SYSTEM TELEMETRY DATA]`,
    `Hazard Metrics: ${JSON.stringify(target.hazardScores)}`,
    ``,
    `[AUTHORIZED GROUNDING SOURCE SITES]`,
    sourcesList || "(No sources configured)",
    referenceBlock ? `\n${referenceBlock}` : "",
  ]
    .join("\n")
    .trim();
}

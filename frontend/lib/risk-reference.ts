/**
 * Risk Reference Store — pre-parsed static dataset from resiliencemap-research-dataset.md
 * Provides country-level risk data for AI agent context injection.
 * DO NOT fetch at runtime from .md — data is pre-parsed into risk-reference.json.
 */

import riskReferenceData from "@/data/risk-reference.json";

export type RiskLevel =
  | "EXTREME"
  | "VERY HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "VERY LOW";

export type OverallRisk = "CRITICAL" | "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW" | "SAFE" | "SAFEST";

export interface RiskReference {
  country: string;
  countryCode: string;
  worldRiskIndex?: number | null;
  informScore?: number | null;
  ndGainScore?: number | null;
  naturalRiskLevel: RiskLevel;
  politicalRiskLevel: RiskLevel | "VERY LOW";
  climateRiskLevel: RiskLevel;
  overallRisk: OverallRisk;
  hazardBreakdown: {
    earthquake: RiskLevel | "VERY LOW";
    tsunami: RiskLevel | "VERY LOW";
    volcanic: RiskLevel | "VERY LOW";
    cyclone: RiskLevel | "VERY LOW";
    drought: RiskLevel | "VERY LOW";
    flood: RiskLevel | "VERY LOW";
    seaLevelRise: RiskLevel | "VERY LOW";
    wildfire: RiskLevel | "VERY LOW";
  };
  historicalEvents: string[];
  sources: string[];
}

// Build the lookup map at module load time (O(1) access per query)
const _store = new Map<string, RiskReference>(
  (riskReferenceData.countries as RiskReference[]).map((c) => [c.countryCode, c])
);

/** Look up reference data by ISO 3166-1 alpha-2 country code. */
export function getRiskReference(countryCode: string): RiskReference | null {
  return _store.get(countryCode.toUpperCase()) ?? null;
}

/** Format reference data as a compact context block for AI system prompt injection. */
export function formatReferenceForPrompt(ref: RiskReference): string {
  const hazards = Object.entries(ref.hazardBreakdown)
    .filter(([, level]) => level !== "VERY LOW" && level !== "LOW")
    .map(([hazard, level]) => `${hazard}: ${level}`)
    .join(", ");

  const scores = [
    ref.worldRiskIndex != null ? `WRI: ${ref.worldRiskIndex}%` : null,
    ref.informScore != null ? `INFORM: ${ref.informScore}/10` : null,
    ref.ndGainScore != null ? `ND-GAIN: ${ref.ndGainScore}/100` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const events = ref.historicalEvents.slice(0, 3).join("; ");

  return [
    `[RESEARCH_REFERENCE: ${ref.country} (${ref.countryCode})]`,
    `Overall Risk: ${ref.overallRisk} | Natural: ${ref.naturalRiskLevel} | Political: ${ref.politicalRiskLevel} | Climate: ${ref.climateRiskLevel}`,
    scores ? `Index Scores: ${scores}` : null,
    hazards ? `Elevated Hazards: ${hazards}` : null,
    events ? `Notable Events: ${events}` : null,
    `Authorized Sources: ${ref.sources.slice(0, 3).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Get sources list for a country (for Official Sources widget). */
export function getSourcesForCountry(countryCode: string): string[] {
  return getRiskReference(countryCode)?.sources ?? [];
}

/** Get overall risk color class for UI display. */
export function getRiskColor(level: OverallRisk | RiskLevel | string): string {
  switch (level) {
    case "CRITICAL":
    case "EXTREME":
      return "var(--risk-extreme)";
    case "VERY HIGH":
      return "var(--risk-high)";
    case "HIGH":
      return "var(--risk-high)";
    case "MEDIUM":
      return "var(--risk-medium)";
    case "LOW":
    case "SAFE":
    case "SAFEST":
      return "var(--risk-low)";
    case "VERY LOW":
      return "var(--risk-low)";
    default:
      return "var(--fg-muted)";
  }
}

export const globalRankings = riskReferenceData.globalRankings;

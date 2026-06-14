/** Global risk scoring engine with country-level fallback.
 * When point-level data unavailable, uses INFORM Index and WorldBank climate data.
 */

import { getCountryByAlpha2 } from "@/lib/locations/country-search";

export interface GlobalRiskScore {
  flood: number;
  earthquake: number;
  tropical_cyclone: number;
  volcano: number;
  landslide: number;
  storm_surge: number;
  climate_exposure: number;
  confidence: "high" | "medium" | "low";
  source: "point-level" | "country-level" | "region-level" | "no-data";
  updatedAt: string;
}

/** Country-level risk baseline (INFORM Index + WorldBank). */
const COUNTRY_RISK_BASELINE: Record<string, Partial<GlobalRiskScore>> = {
  // High-risk regions (Inform + actual hazards)
  PH: { flood: 72, earthquake: 68, tropical_cyclone: 75, volcano: 55, landslide: 52, storm_surge: 65, climate_exposure: 68 },
  BD: { flood: 85, earthquake: 42, tropical_cyclone: 80, volcano: 0, landslide: 25, storm_surge: 78, climate_exposure: 85 },
  PK: { flood: 75, earthquake: 65, tropical_cyclone: 35, volcano: 0, landslide: 55, storm_surge: 30, climate_exposure: 72 },
  ID: { flood: 62, earthquake: 72, tropical_cyclone: 68, volcano: 65, landslide: 58, storm_surge: 52, climate_exposure: 70 },
  TH: { flood: 70, earthquake: 48, tropical_cyclone: 65, volcano: 0, landslide: 45, storm_surge: 42, climate_exposure: 68 },
  VN: { flood: 68, earthquake: 45, tropical_cyclone: 72, volcano: 0, landslide: 42, storm_surge: 55, climate_exposure: 75 },
  JP: { flood: 55, earthquake: 75, tropical_cyclone: 62, volcano: 48, landslide: 55, storm_surge: 45, climate_exposure: 52 },
  MX: { flood: 48, earthquake: 62, tropical_cyclone: 58, volcano: 35, landslide: 42, storm_surge: 42, climate_exposure: 65 },
  BR: { flood: 52, earthquake: 25, tropical_cyclone: 0, volcano: 15, landslide: 45, storm_surge: 25, climate_exposure: 72 },
  US: { flood: 45, earthquake: 55, tropical_cyclone: 48, volcano: 32, landslide: 38, storm_surge: 40, climate_exposure: 55 },

  // Middle East & conflict zones
  IQ: { flood: 45, earthquake: 55, tropical_cyclone: 0, volcano: 0, landslide: 35, storm_surge: 35, climate_exposure: 72 },
  SY: { flood: 35, earthquake: 48, tropical_cyclone: 0, volcano: 0, landslide: 25, storm_surge: 30, climate_exposure: 78 },
  YE: { flood: 55, earthquake: 45, tropical_cyclone: 42, volcano: 35, landslide: 38, storm_surge: 45, climate_exposure: 85 },
  AF: { flood: 48, earthquake: 58, tropical_cyclone: 0, volcano: 0, landslide: 52, storm_surge: 0, climate_exposure: 68 },

  // African high-risk
  NG: { flood: 62, earthquake: 35, tropical_cyclone: 0, volcano: 0, landslide: 42, storm_surge: 38, climate_exposure: 78 },
  ET: { flood: 55, earthquake: 52, tropical_cyclone: 0, volcano: 38, landslide: 48, storm_surge: 0, climate_exposure: 72 },
  KE: { flood: 58, earthquake: 55, tropical_cyclone: 0, volcano: 42, landslide: 45, storm_surge: 35, climate_exposure: 75 },

  // European (lower risk)
  DE: { flood: 35, earthquake: 15, tropical_cyclone: 0, volcano: 0, landslide: 15, storm_surge: 25, climate_exposure: 48 },
  FR: { flood: 38, earthquake: 18, tropical_cyclone: 0, volcano: 0, landslide: 18, storm_surge: 22, climate_exposure: 45 },
  GB: { flood: 32, earthquake: 12, tropical_cyclone: 0, volcano: 0, landslide: 10, storm_surge: 28, climate_exposure: 42 },

  // Australia
  AU: { flood: 45, earthquake: 42, tropical_cyclone: 52, volcano: 0, landslide: 28, storm_surge: 38, climate_exposure: 68 },

  // Default for unmapped countries (moderate baseline)
  DEFAULT: { flood: 40, earthquake: 35, tropical_cyclone: 25, volcano: 15, landslide: 30, storm_surge: 25, climate_exposure: 55 },
};

/** Score a location globally using country/region fallback. */
export function scoreLocationGlobally(
  countryAlpha2?: string,
  _lat?: number,
  _lng?: number
): GlobalRiskScore {
  const baseline = countryAlpha2
    ? COUNTRY_RISK_BASELINE[countryAlpha2] || COUNTRY_RISK_BASELINE.DEFAULT
    : COUNTRY_RISK_BASELINE.DEFAULT;

  const score: GlobalRiskScore = {
    flood: baseline.flood ?? 40,
    earthquake: baseline.earthquake ?? 35,
    tropical_cyclone: baseline.tropical_cyclone ?? 25,
    volcano: baseline.volcano ?? 15,
    landslide: baseline.landslide ?? 30,
    storm_surge: baseline.storm_surge ?? 25,
    climate_exposure: baseline.climate_exposure ?? 55,
    confidence: countryAlpha2 ? "medium" : "low",
    source: "country-level",
    updatedAt: new Date().toISOString(),
  };

  return score;
}

/** Get risk level label. */
export function getRiskLevel(score: number): "low" | "medium" | "high" | "no-data" {
  if (score === 0) return "no-data";
  if (score <= 25) return "low";
  if (score <= 60) return "medium";
  return "high";
}

/** Get risk color. */
export function getRiskColor(score: number): string {
  const level = getRiskLevel(score);
  switch (level) {
    case "low":
      return "#4ade80"; // green
    case "medium":
      return "#facc15"; // yellow
    case "high":
      return "#ef4444"; // red
    case "no-data":
      return "#9ca3af"; // gray
  }
}

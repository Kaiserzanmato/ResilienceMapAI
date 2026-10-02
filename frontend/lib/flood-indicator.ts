/** Satellite-observed flood indicator for the risk panel. Pure (no runtime imports) so it is
 * unit-tested with node:test (tests/flood-indicator.test.mjs).
 *
 * The indicator is the share of the captured box that is flooded, scaled so that half the
 * box under water is 100, then reduced for age and for an unfiltered capture:
 *   - age: full weight up to 7 days, falling linearly to 0.25 at 30 days; older than 30
 *     days is "stale": evidence is shown but no score is given and it is left out of Overall.
 *   - unfiltered (permanent water could not be removed): open water includes rivers and
 *     lakes, so the indicator is capped at the top of Medium (60).
 * It is a satellite observation, not an official flood map or a modelled return period. */
import type { Bbox, FloodExtentProps } from "./flood-evidence";
import type { HazardScore, RiskAssessment, RiskLevel } from "./types";

export const FULL_WEIGHT_DAYS = 7;
export const STALE_DAYS = 30;
export const MIN_RECENCY = 0.25;
export const FULL_SCORE_SHARE = 0.5;
export const UNFILTERED_CAP = 60;
export const DEFAULT_BOX_HA = 2_500; // the 5 km capture box
export const FLOOD_LABEL = "satellite-observed, not an official flood map";
export const NO_CAPTURE_TEXT = "No satellite capture yet: flag flooding here";

const MS_PER_DAY = 86_400_000;

export interface FloodIndicator {
  /** null when the scene is stale. */
  score: number | null;
  /** Flooded hectares: flood_ha when filtered, else all open water (includes permanent water). */
  floodHa: number;
  /** Permanent water removed, ha; null when unfiltered. */
  permanentExcludedHa: number | null;
  filtered: boolean;
  boxHa: number;
  /** floodHa / boxHa, 0..1 */
  share: number;
  ageDays: number;
  recency: number;
  stale: boolean;
  sceneDate: string;
}

/** Area of the capture box in ha from its bbox (falls back to the 5 km default). */
export function boxAreaHa(bbox: Bbox | null | undefined): number {
  if (!bbox) return DEFAULT_BOX_HA;
  const [w, s, e, n] = bbox;
  const widthKm = (e - w) * 111.32 * Math.cos((((s + n) / 2) * Math.PI) / 180);
  const heightKm = (n - s) * 111.32;
  const ha = widthKm * heightKm * 100;
  return Number.isFinite(ha) && ha > 0 ? ha : DEFAULT_BOX_HA;
}

export function recencyWeight(ageDays: number): number {
  if (ageDays <= FULL_WEIGHT_DAYS) return 1;
  if (ageDays >= STALE_DAYS) return MIN_RECENCY;
  return 1 - ((1 - MIN_RECENCY) * (ageDays - FULL_WEIGHT_DAYS)) / (STALE_DAYS - FULL_WEIGHT_DAYS);
}

export function floodIndicator(props: FloodExtentProps, now: Date = new Date()): FloodIndicator {
  const total = props.total_water_ha ?? props.water_area_m2 / 10_000;
  const filtered = props.flood_ha != null;
  const floodHa = filtered ? (props.flood_ha as number) : total;
  const boxHa = boxAreaHa(props.aoi_bbox);
  const share = Math.min(1, Math.max(0, floodHa / boxHa));
  const ageDays = Math.max(0, (now.getTime() - new Date(props.acquired_at).getTime()) / MS_PER_DAY);
  const recency = recencyWeight(ageDays);
  const stale = ageDays > STALE_DAYS;
  let score: number | null = null;
  if (!stale) {
    score = Math.round(100 * Math.min(1, share / FULL_SCORE_SHARE) * recency);
    if (!filtered) score = Math.min(score, UNFILTERED_CAP);
  }
  return {
    score, floodHa, filtered, boxHa, share, ageDays, recency, stale,
    permanentExcludedHa: filtered ? Math.max(0, total - floodHa) : null,
    sceneDate: props.acquired_at.slice(0, 10),
  };
}

function level(score: number | null): RiskLevel {
  if (score === null) return { score: null, level: "No Data", color: "gray" };
  if (score <= 25) return { score, level: "Low", color: "green" };
  if (score <= 60) return { score, level: "Medium", color: "yellow" };
  return { score, level: "High", color: "red" };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** The Flood row's evidence line. */
export function floodRowNote(ind: FloodIndicator): string {
  const pct = Math.round(ind.share * 100);
  const when = `scene of ${ind.sceneDate}`;
  const how = ind.filtered
    ? `about ${fmt(ind.floodHa)} ha flooded (${fmt(ind.permanentExcludedHa ?? 0)} ha of permanent water excluded), ${pct}% of the captured box`
    : `about ${fmt(ind.floodHa)} ha of open water, ${pct}% of the captured box; unfiltered, may include permanent water`;
  const old = ind.stale ? ` Older than ${STALE_DAYS} days, so not scored.` : "";
  return `${how}, ${when}.${old} ${FLOOD_LABEL[0].toUpperCase()}${FLOOD_LABEL.slice(1)}.`;
}

/** The assessment with its Flood hazard replaced by what the satellite saw (or by an honest
 * "no capture yet"), and Overall, the hazard count and the drivers recomputed. Overall uses
 * the same rule as the adapter: the mean of the hazards that have a score. */
export function applyFloodCapture(risk: RiskAssessment, capture: FloodExtentProps | null, now: Date = new Date()): RiskAssessment {
  const base = risk.hazards.flood;
  if (!base) return risk;
  let flood: HazardScore;
  if (!capture) {
    flood = { ...base, ...level(null), coverage_status: "unavailable", reason_code: "no_satellite_capture", note: NO_CAPTURE_TEXT };
  } else {
    const ind = floodIndicator(capture, now);
    flood = {
      ...base, ...level(ind.score),
      coverage_status: ind.stale ? "stale" : "available",
      reason_code: ind.stale ? "satellite_capture_stale" : "satellite_capture",
      indicative_score: null, // the zone-model number would contradict the observation
      note: floodRowNote(ind),
      satellite: true,
    };
  }
  const hazards = { ...risk.hazards, flood };
  const scored = Object.entries(hazards).filter((e): e is [string, HazardScore & { score: number }] => e[1].score !== null);
  const overall = scored.length ? Math.round(scored.reduce((sum, [, h]) => sum + h.score, 0) / scored.length) : null;
  const drivers = scored.filter(([, h]) => h.score > 25).sort((a, b) => b[1].score - a[1].score).slice(0, 3).map(([, h]) => h.label);
  return {
    ...risk, hazards, overall: level(overall),
    components_available: scored.length,
    components_total: risk.components_total ?? Object.keys(hazards).length,
    main_drivers: drivers.length ? drivers : risk.main_drivers,
  };
}

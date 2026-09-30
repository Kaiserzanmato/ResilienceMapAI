export interface RiskLevel {
  score: number | null;
  level: "Low" | "Medium" | "High" | "No Data";
  color: "green" | "yellow" | "red" | "gray";
}

/** Closed vocabulary from docs/SPRINT_1_COVERAGE_AND_PUBLIC_DISPLAY_DECISION.md section 4. */
export type CoverageStatus =
  | "available"
  | "not_applicable"
  | "out_of_coverage"
  | "unknown"
  | "unavailable"
  | "stale"
  | "expired"
  | "suppressed";

export interface HazardScore extends RiskLevel {
  label: string;
  coverage_status?: CoverageStatus;
  reason_code?: string;
  /** Curated/baseline value shown only as an unverified indicator, never as `score`. */
  indicative_score?: number | null;
  indicative_source_type?: string;
}

export interface RiskAssessment {
  location_name: string;
  latitude: number;
  longitude: number;
  overall: RiskLevel;
  /** How many hazard components contributed to `overall` (null overall when 0). */
  components_available?: number;
  components_total?: number;
  hazards: Record<string, HazardScore>;
  main_drivers: string[];
  nearest_zone: {
    name: string;
    country: string;
    population: number;
    critical_facilities: number;
    schools: number;
    hospitals: number;
  } | null;
  data_coverage: "covered" | "regional" | "limited";
  confidence: "High" | "Medium" | "Low";
  generated_at: string;
  methodology: string;
  engine_version: string;
}

export interface AssessmentHazard {
  hazard: string;
  label: string;
  classification: string;
  score: number | null;
  confidence: "none" | "low" | "medium" | "high";
  coverage_status: CoverageStatus;
  reason_code?: string;
  registry_coverage?: string | null;
  indicative_score?: number | null;
  indicative_source_type?: string;
  indicative_confidence?: string;
  sources: Array<{ name: string; publication_date?: string; reliability?: string }>;
  evidence: Array<{ source: string; timestamp: string }>;
  limitations: string[];
}

export interface GlobalAssessment {
  location: { name: string; latitude: number; longitude: number; country_code: string | null };
  assessment_geometry: { type: string; fallback_used: boolean; confidence: string; default_buffers_m: number[] };
  hazards: Record<string, AssessmentHazard>;
  multi_hazard_summary: {
    highest_priority_hazards: string[];
    coverage_score: number;
    components_available?: number;
    components_total?: number;
  };
  scoring_version: string;
  coverage_registry_version: string;
  generated_at: string;
  disclaimer: string;
}

export interface GroundingSource {
  name: string;
  agency: string;
  updated: string;
  confidence: string;
  url: string;
}

export interface AIResponse {
  answer: string;
  model: string;
  persona: string;
  sources: GroundingSource[];
  confidence: string;
  flagged_input: boolean;
  disclaimer: string;
  risk?: RiskAssessment | null;
}

export interface InsightSource {
  source_name: string;
  agency: string;
  url: string;
  verified?: boolean;
  confidence_category: string;
}

export interface InsightResponse {
  title: string;
  summary: string;
  notice?: string;
  hazard_type?: string;
  sources: InsightSource[];
  confidence_category?: string;
  timestamp?: string;
}

export interface HazardEvent {
  id: string;
  name: string;
  type: string;
  year: number;
  lat: number;
  lng: number;
  location: string;
  severity: string;
  source: string;
}

export interface ActiveAlert {
  id: string;
  title: string;
  hazard: string;
  area: string;
  lat: number;
  lng: number;
  severity: string;
  issued: string;
  source: string;
}

export interface CurrentEvent {
  event_id: string;
  provider_event_id: string;
  provider: "usgs-earthquake" | "gdacs" | "nasa-eonet" | "reliefweb";
  source_tier: number;
  hazard_type: string;
  title: string;
  geometry: { type: string; coordinates: unknown } | null;
  latitude: number | null;
  longitude: number | null;
  severity: string | null;
  magnitude: number | null;
  magnitude_unit: string | null;
  event_time: string | null;
  updated_at: string | null;
  retrieved_at: string;
  source_url: string | null;
  official: boolean;
  confidence: string | null;
  related_event_ids: string[];
}

export interface CurrentEventsResponse {
  enabled: boolean;
  events: CurrentEvent[];
  pagination: { limit: number; offset: number; next_offset: number | null; total: number };
  refreshed_at: string | null;
  providers: Record<string, { status: string; latency_ms: number; last_successful_refresh: string | null }>;
}

export interface Dataset {
  id: string;
  name: string;
  agency: string;
  category: string;
  updated: string;
  confidence: string;
  url: string;
  records: number;
  status: string;
}

export interface GeocodeResult {
  name: string;
  country?: string;
  lat: number;
  lng: number;
  countryAlpha2?: string;
  formatted_address?: string;
  display_name?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: Pick<AIResponse, "model" | "sources" | "confidence" | "disclaimer">;
}

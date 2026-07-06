/**
 * Resilience Knowledge Layer — structured records from the July 2026 Strategic
 * Assessment (Global Geopolitical Instability, Climate Risks, and Public Health
 * Crisis Report). Pre-parsed into knowledge-events.json; never fetched at runtime
 * from the source document.
 *
 * Same architecture pattern as risk-reference.ts: in-memory index built at module
 * load, O(1)-ish lookup by ISO country code, compact prompt formatting for the
 * AI agent evidence pack.
 */

import knowledgeData from "@/data/knowledge-events.json";

export type EvidenceState =
  | "official_warning"
  | "official_observation"
  | "forecast"
  | "satellite_detection"
  | "humanitarian_report"
  | "historical_record"
  | "baseline_indicator"
  | "research_interpretation";

export type Freshness = "live" | "near_real_time" | "current" | "stale" | "reference";

export interface KnowledgeEvent {
  id: string;
  title: string;
  summary: string;
  hazardCategory: string;
  riskDomain: string;
  status: string;
  severity: string;
  confidence: string;
  geoScope: {
    level: string;
    countryCodes: string[];
    locality?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  latestVerifiedUpdate: string;
  monitoringActions: string;
  sources: string[];
  evidence: { state: EvidenceState; freshness: Freshness };
  tags: string[];
}

export interface StructuralLayer {
  id: string;
  title: string;
  summary: string;
  scope: string;
  countryCodes?: string[];
  sources: string[];
  evidence: { state: EvidenceState; freshness: Freshness };
}

export const KNOWLEDGE_REVISION: string = knowledgeData.knowledgeRevision;
export const SOURCE_SNAPSHOT_AT: string = knowledgeData.sourceSnapshotAt;
export const KNOWLEDGE_DOCUMENT_TITLE: string = knowledgeData.documentTitle;

const EVENTS = knowledgeData.events as KnowledgeEvent[];
const STRUCTURAL_LAYERS = knowledgeData.structuralLayers as StructuralLayer[];

// Country code → events index, built once at module load
const _byCountry = new Map<string, KnowledgeEvent[]>();
for (const ev of EVENTS) {
  for (const code of ev.geoScope.countryCodes) {
    const list = _byCountry.get(code) ?? [];
    list.push(ev);
    _byCountry.set(code, list);
  }
}

/** All active watchlist events (for dashboards / global views). */
export function getAllKnowledgeEvents(): KnowledgeEvent[] {
  return EVENTS;
}

/** Structural (long-term) climate layers. */
export function getStructuralLayers(): StructuralLayer[] {
  return STRUCTURAL_LAYERS;
}

/** Events relevant to an ISO 3166-1 alpha-2 country code. */
export function getKnowledgeForCountry(countryCode: string): KnowledgeEvent[] {
  return _byCountry.get(countryCode.toUpperCase()) ?? [];
}

/** Structural layers applying to a country (regional layers list explicit codes; global layers always apply). */
export function getStructuralLayersForCountry(countryCode: string): StructuralLayer[] {
  const code = countryCode.toUpperCase();
  return STRUCTURAL_LAYERS.filter(
    (l) => l.scope === "global" || (l.countryCodes ?? []).includes(code)
  );
}

/**
 * Compact evidence pack for AI system prompt injection.
 * Kept tight: mapTargetContext is capped at 4000 chars server-side, so this
 * block includes at most `maxEvents` events with truncated summaries.
 */
export function formatKnowledgeForPrompt(countryCode: string, maxEvents = 3): string | null {
  const events = getKnowledgeForCountry(countryCode).slice(0, maxEvents);
  const layers = getStructuralLayersForCountry(countryCode).filter((l) => l.scope !== "global");

  if (events.length === 0 && layers.length === 0) return null;

  const lines: string[] = [
    `[ACTIVE GLOBAL WATCHLIST — ${SOURCE_SNAPSHOT_AT} STRATEGIC ASSESSMENT]`,
  ];

  for (const ev of events) {
    const summary = ev.summary.length > 300 ? ev.summary.slice(0, 297) + "..." : ev.summary;
    lines.push(
      `• ${ev.title} — ${ev.severity} / ${ev.status} (${ev.evidence.state}, ${ev.evidence.freshness})`,
      `  ${summary}`,
      `  Verified: ${ev.latestVerifiedUpdate} | Sources: ${ev.sources.slice(0, 3).join(", ")}`
    );
  }

  for (const layer of layers.slice(0, 1)) {
    lines.push(`• Structural: ${layer.title} — ${layer.summary.slice(0, 200)}`);
  }

  lines.push(`Knowledge revision: ${KNOWLEDGE_REVISION}`);
  return lines.join("\n");
}

/**
 * Canonical export snapshot builder.
 *
 * At export initiation this reads the current application state exactly once
 * and freezes it into an immutable ReportSnapshot. Every export format
 * (TXT/MD/CSV — and the fields shared with the server-generated PDF) derives
 * from this single snapshot, so an export can never mix values or citations
 * from a previous location or filter state.
 */

import type { MapTarget } from "./store";
import type { RiskAssessment } from "./types";
import {
  KNOWLEDGE_REVISION,
  SOURCE_SNAPSHOT_AT,
  getKnowledgeForCountry,
} from "./resilience-knowledge";
import { getRiskReference } from "./risk-reference";
import type { ReportSnapshot, SnapshotSource } from "./report-formats";

export const REPORT_SCHEMA_VERSION = "1.0";

const DISCLAIMERS = [
  "ResilienceMap AI provides indicative, evidence-based risk intelligence. It is not an emergency warning or dispatch service.",
  "Risk scores are deterministic engine outputs from official public datasets — always follow guidance from local authorities (e.g. PAGASA, PHIVOLCS, NDRRMC, USGS, NOAA).",
  "Watchlist evidence reflects the cited knowledge revision and verification dates; conditions may have changed since.",
];

function newReportId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Parse "Agency — https://url" / "https://url (Label)" source strings. */
function parseSourceString(raw: string): { label: string; url?: string } {
  const dash = raw.match(/^(.+?)\s*—\s*(https?:\/\/\S+)$/);
  if (dash) return { label: dash[1].trim(), url: dash[2].trim() };
  const urlFirst = raw.match(/^(https?:\/\/\S+)\s+\((.+?)\)$/);
  if (urlFirst) return { label: urlFirst[2].trim(), url: urlFirst[1].trim() };
  if (raw.startsWith("http")) return { label: raw, url: raw };
  return { label: raw };
}

export function buildReportSnapshot(input: {
  risk: RiskAssessment;
  activeTarget: MapTarget | null;
  persona: string;
}): ReportSnapshot {
  const { risk, activeTarget, persona } = input;
  const countryCode = activeTarget?.countryCode ?? "XX";

  // Evidence: July 2026 watchlist events for this country (same records the
  // AI agent receives via mapTargetContext — one shared knowledge layer).
  const events = getKnowledgeForCountry(countryCode);

  // Sources: official agency sources for the country + evidence sources,
  // de-duplicated, with stable S1..Sn ids for citation references.
  const sourceStrings = new Set<string>();
  const ref = getRiskReference(countryCode);
  for (const s of activeTarget?.officialSources ?? []) sourceStrings.add(s);
  for (const s of ref?.sources ?? []) sourceStrings.add(s);
  for (const ev of events) for (const s of ev.sources) sourceStrings.add(s);

  const sources: SnapshotSource[] = Array.from(sourceStrings).map((raw, i) => {
    const parsed = parseSourceString(raw);
    return { id: `S${i + 1}`, label: parsed.label, url: parsed.url };
  });

  return Object.freeze({
    schemaVersion: REPORT_SCHEMA_VERSION,
    reportId: newReportId(),
    generatedAt: new Date().toISOString(),
    appName: "ResilienceMap AI",

    context: {
      locationName: risk.location_name,
      countryCode,
      latitude: risk.latitude,
      longitude: risk.longitude,
      persona,
      knowledgeRevision: KNOWLEDGE_REVISION,
      sourceSnapshotAt: SOURCE_SNAPSHOT_AT,
    },

    deterministicRisk: {
      overallScore: risk.overall.score,
      classification: risk.overall.level,
      hazardScores: Object.values(risk.hazards).map((h) => ({
        hazard: h.label,
        score: h.score,
        classification: h.level,
      })),
      mainDrivers: risk.main_drivers ?? [],
      confidence: risk.confidence,
      dataCoverage: risk.data_coverage,
    },

    evidence: events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      summary: ev.summary,
      hazardCategory: ev.hazardCategory,
      severity: ev.severity,
      status: ev.status,
      evidenceState: ev.evidence.state,
      confidence: ev.confidence,
      freshness: ev.evidence.freshness,
      verifiedUpdate: ev.latestVerifiedUpdate,
      sources: ev.sources,
    })),

    sources,
    disclaimers: DISCLAIMERS,

    status: {
      // Curated knowledge is dated, not streaming: "current" when active
      // watchlist evidence exists for the location, "reference" otherwise.
      freshness: (events.length > 0 ? "current" : "reference") as ReportSnapshot["status"]["freshness"],
      containsStaleData: false,
      containsUnavailableData: risk.overall.score === null,
    },
  });
}

/** Trigger a client download for generated text content. */
export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

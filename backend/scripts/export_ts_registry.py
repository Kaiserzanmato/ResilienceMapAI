#!/usr/bin/env python3
"""Regenerate frontend/data-sources/registry/sources.registry.ts from the
backend's SOURCE_REGISTRY (backend/app/data_sources/registry/sources_registry.py).

The backend registry is the single source of truth — it's what actually
drives connectors, sync health, and the audit log (see
backend/app/data_sources/sync/). The TS file is a generated artifact for the
frontend's admin UI and AI-grounding context; it should never be hand-edited.

Usage (from the backend/ directory):
    .venv/bin/python scripts/export_ts_registry.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data_sources.registry.sources_registry import SOURCE_REGISTRY, RiskSource  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_PATH = REPO_ROOT / "frontend" / "data-sources" / "registry" / "sources.registry.ts"

_COVERAGE_TS = {"country": "country-specific", "global": "global", "regional": "regional"}

HEADER = '''\
// GENERATED FILE — do not hand-edit.
//
// Source of truth: backend/app/data_sources/registry/sources_registry.py
// Regenerate with: backend/.venv/bin/python backend/scripts/export_ts_registry.py
//
// New sources start life in the Python dataclass, not here — this file only
// mirrors it for the frontend's admin UI and AI-grounding context.

export type RiskDomain =
  | "natural_hazards"
  | "climate"
  | "humanitarian"
  | "conflict_security"
  | "aviation"
  | "maritime"
  | "infrastructure"
  | "supply_chain"
  | "force_majeure";

export type ConfidenceCategory =
  | "official_warning"
  | "official_observation"
  | "model_forecast"
  | "satellite_detection"
  | "humanitarian_report"
  | "conflict_event_dataset"
  | "historical_record"
  | "climate_projection"
  | "aviation_advisory"
  | "maritime_security_alert"
  | "economic_indicator"
  | "manual_curated_record";

export type AccessType =
  | "api"
  | "rss"
  | "geojson"
  | "csv"
  | "kml"
  | "shapefile"
  | "download"
  | "portal"
  | "manual";

export type SyncStatus = "success" | "failed" | "partial" | "disabled";
export type Coverage = "global" | "regional" | "country-specific";
export type TrustLevel = 1 | 2 | 3 | 4 | 5;

export type Region =
  | "africa"
  | "americas"
  | "asia"
  | "europe"
  | "oceania"
  | "southeast_asia"
  | "south_asia"
  | "east_asia"
  | "middle_east";

export interface RiskSource {
  id: string;
  name: string;
  organization: string;
  url: string;
  docsUrl?: string;
  accessType: AccessType;
  coverage: Coverage;
  countrySpecific?: string[];
  regions?: string[];
  domains: RiskDomain[];
  trustLevel: TrustLevel;
  confidenceCategory: ConfidenceCategory;
  enabled: boolean;
  autoSyncEnabled: boolean;
  syncFrequencyMinutes?: number;
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncStatus?: SyncStatus;
  nextSyncAt?: string;
  requiresApiKey?: boolean;
  requiresRegistration?: boolean;
  rateLimitNotes?: string;
  licenseNotes?: string;
}

export const SOURCE_REGISTRY: RiskSource[] = [
'''

FOOTER = '''\
];

/** Return sources applicable for a given country and domain. */
export function getSourcesForContext(
  country?: string,
  domain?: RiskDomain
): RiskSource[] {
  return SOURCE_REGISTRY.filter((s) => {
    if (!s.enabled) return false;
    const domainMatch = !domain || s.domains.includes(domain);
    const coverageMatch =
      s.coverage === "global" ||
      (s.coverage === "country-specific" && !!country && s.countrySpecific?.includes(country)) ||
      s.coverage === "regional";
    return domainMatch && coverageMatch;
  });
}

/** Return the highest-trust sources for a context (trust level 1 first). */
export function getPrioritizedSources(
  country?: string,
  domain?: RiskDomain
): RiskSource[] {
  return getSourcesForContext(country, domain).sort(
    (a, b) => a.trustLevel - b.trustLevel
  );
}
'''


def _ts_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _ts_string_array(values: list[str]) -> str:
    return "[" + ", ".join(_ts_string(v) for v in values) + "]"


def _source_to_ts(source: RiskSource) -> str:
    lines = ["  {"]
    lines.append(f"    id: {_ts_string(source.id)},")
    lines.append(f"    name: {_ts_string(source.name)},")
    lines.append(f"    organization: {_ts_string(source.organization)},")
    lines.append(f"    url: {_ts_string(source.url)},")
    if source.docs_url:
        lines.append(f"    docsUrl: {_ts_string(source.docs_url)},")
    lines.append(f"    accessType: {_ts_string(source.access_type)},")
    lines.append(f"    coverage: {_ts_string(_COVERAGE_TS.get(source.coverage, source.coverage))},")
    if source.countries:
        lines.append(f"    countrySpecific: {_ts_string_array(source.countries)},")
    if source.regions:
        lines.append(f"    regions: {_ts_string_array(source.regions)},")
    lines.append(f"    domains: {_ts_string_array(source.domains)},")
    lines.append(f"    trustLevel: {source.trust_level},")
    lines.append(f"    confidenceCategory: {_ts_string(source.confidence_category)},")
    lines.append(f"    enabled: {'true' if source.enabled else 'false'},")
    lines.append(f"    autoSyncEnabled: {'true' if source.auto_sync_enabled else 'false'},")
    if source.sync_frequency_minutes is not None:
        lines.append(f"    syncFrequencyMinutes: {source.sync_frequency_minutes},")
    if source.requires_api_key:
        lines.append("    requiresApiKey: true,")
    if source.requires_registration:
        lines.append("    requiresRegistration: true,")
    if source.rate_limit_notes:
        lines.append(f"    rateLimitNotes: {_ts_string(source.rate_limit_notes)},")
    if source.license_notes:
        lines.append(f"    licenseNotes: {_ts_string(source.license_notes)},")
    lines.append("  },")
    return "\n".join(lines)


def main() -> None:
    body = "\n".join(_source_to_ts(s) for s in SOURCE_REGISTRY)
    OUTPUT_PATH.write_text(HEADER + body + "\n" + FOOTER)
    print(f"Wrote {len(SOURCE_REGISTRY)} sources to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

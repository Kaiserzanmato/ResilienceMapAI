/** Honest no-data labels for the risk panel (SPRINT_1 coverage decision, section 4).
 * Pure; no imports (tests/hazard-status.test.mjs). Keyed primarily by reason_code, which
 * is specific about *why* a hazard has no score; coverage_status is a fallback for the
 * few statuses that are not represented by one of the reason codes below. There is no
 * generic "temporarily unavailable" catch-all: every reason the backend can report gets
 * its own honest line. */

const REASON_LABELS: Record<string, string> = {
  licence_pending: "Pending PHIVOLCS data permission",
  no_connected_source: "No connected source yet",
  not_covered: "Not covered by current sources",
  stale: "Data stale",
  // Wildfire's own closed-vocabulary reason codes (app/services/wildfire_scoring.py)
  // are already specific; both mean the same thing to a reader as "stale".
  fire_data_stale: "Data stale",
  fire_history_too_short: "Data stale",
  no_verified_evidence: "No verified evidence here",
  country_unresolved: "Country not resolved",
  outside_modelled_coverage: "Not covered by this source",
  fire_data_unavailable: "No connected source yet",
  outside_firms_area: "Not covered by this source",
  no_satellite_capture: "No capture yet",
  // Flood's own reason code (lib/flood-indicator.ts) for a capture older than STALE_DAYS.
  satellite_capture_stale: "Data stale",
};

const STATUS_LABELS: Record<string, string> = {
  not_applicable: "Not applicable",
  expired: "Expired; not used",
  suppressed: "Unavailable for this view",
  // Fallback for any other stale reason code this map does not name explicitly.
  stale: "Data stale",
};

export function statusLabel(reasonCode: string | undefined, coverageStatus: string | undefined): string {
  if (reasonCode && reasonCode in REASON_LABELS) return REASON_LABELS[reasonCode];
  if (coverageStatus && coverageStatus in STATUS_LABELS) return STATUS_LABELS[coverageStatus];
  return "Data status unknown";
}

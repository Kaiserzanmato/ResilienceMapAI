import assert from "node:assert/strict";
import { test } from "node:test";
import { statusLabel } from "../lib/hazard-status.ts";

test("each reason code maps to its own honest label, not a generic catch-all", () => {
  assert.equal(statusLabel("licence_pending", "unavailable"), "Pending PHIVOLCS data permission");
  assert.equal(statusLabel("no_connected_source", "unavailable"), "No connected source yet");
  assert.equal(statusLabel("not_covered", "out_of_coverage"), "Not covered by current sources");
  assert.equal(statusLabel("stale", "stale"), "Data stale");
  assert.equal(statusLabel("no_satellite_capture", "unavailable"), "No capture yet");
});

test("wildfire's own stale reason codes read the same as the generic stale label", () => {
  assert.equal(statusLabel("fire_data_stale", "stale"), "Data stale");
  assert.equal(statusLabel("fire_history_too_short", "stale"), "Data stale");
});

test("flood's stale-capture reason code reads as Data stale, by name and by coverage_status fallback", () => {
  assert.equal(statusLabel("satellite_capture_stale", "stale"), "Data stale");
  // Even an unnamed reason code falls back to "Data stale" when coverage_status is "stale",
  // so a future stale reason the frontend doesn't know by name yet is never mislabeled.
  assert.equal(statusLabel("some_future_stale_reason", "stale"), "Data stale");
});

test("an unlisted reason code falls back to the coverage_status label, never 'Temporarily unavailable'", () => {
  assert.equal(statusLabel(undefined, "not_applicable"), "Not applicable");
  assert.equal(statusLabel(undefined, "expired"), "Expired; not used");
  assert.equal(statusLabel(undefined, "suppressed"), "Unavailable for this view");
  assert.equal(statusLabel("something_new", "unavailable"), "Data status unknown");
  assert.equal(statusLabel(undefined, undefined), "Data status unknown");
  // Never the old blanket wording for a plain "unavailable" status.
  assert.notEqual(statusLabel("no_connected_source", "unavailable"), "Temporarily unavailable");
});

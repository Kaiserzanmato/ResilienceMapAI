import assert from "node:assert/strict";
import { test } from "node:test";
import { toRiskAssessment } from "../lib/assessment-adapter.ts";

const hazard = (label, score, extra = {}) => ({
  hazard: label.toLowerCase(), label, classification: "x", score, confidence: "medium",
  coverage_status: score === null ? "unavailable" : "available", sources: [], evidence: [], limitations: [], ...extra,
});
const assessment = (hazards) => ({
  location: { name: "Legazpi", latitude: 13.14, longitude: 123.74, country_code: "PH" },
  hazards,
  multi_hazard_summary: { highest_priority_hazards: ["volcano"], coverage_score: 20, components_available: 0, components_total: 3 },
  generated_at: "2026-10-02T00:00:00Z", coverage_registry_version: "x", scoring_version: "x", disclaimer: "x",
});

test("Wildfire and Volcanic scores feed Overall and the 'N of 13' count, with their evidence note and link", () => {
  const risk = toRiskAssessment(assessment({
    earthquake: hazard("Earthquake", 39),
    volcano: hazard("Volcanic Activity", 45, {
      note: "Mayon is an active volcano 14.6 km away.", link: { label: "PHIVOLCS volcano bulletins", url: "https://www.phivolcs.dost.gov.ph/" },
    }),
    wildfire: hazard("Wildfire", 15, { note: "1 detection within 10 km in the last 7 days." }),
    flood: hazard("Flood", null),
  }));
  assert.equal(risk.components_available, 3);
  assert.equal(risk.components_total, 4);
  assert.equal(risk.overall.score, Math.round((39 + 45 + 15) / 3));
  assert.equal(risk.hazards.volcano.score, 45);
  assert.equal(risk.hazards.volcano.note, "Mayon is an active volcano 14.6 km away.");
  assert.equal(risk.hazards.volcano.link.url, "https://www.phivolcs.dost.gov.ph/");
  assert.equal(risk.hazards.wildfire.note, "1 detection within 10 km in the last 7 days.");
  assert.equal("note" in risk.hazards.earthquake, false);
});

test("hazards without data stay no-data and are not counted as zero", () => {
  const risk = toRiskAssessment(assessment({
    earthquake: hazard("Earthquake", 39),
    volcano: hazard("Volcanic Activity", null),
    wildfire: hazard("Wildfire", null, { coverage_status: "stale", reason_code: "fire_history_too_short" }),
  }));
  assert.equal(risk.components_available, 1);
  assert.equal(risk.overall.score, 39);
  assert.equal(risk.hazards.wildfire.score, null);
  assert.equal(risk.hazards.wildfire.coverage_status, "stale");
});

test("a Volcanic indicative number never reaches the UI, even if an older backend still sends one", () => {
  const risk = toRiskAssessment(assessment({
    volcano: hazard("Volcanic Activity", null, { indicative_score: 86, indicative_source_type: "curated-zone-model" }),
    flood: hazard("Flood", null, { indicative_score: 42, indicative_source_type: "curated-zone-model" }),
  }));
  assert.equal(risk.hazards.volcano.score, null);
  assert.equal(risk.hazards.volcano.indicative_score, null);
  assert.equal(risk.hazards.volcano.indicative_source_type, undefined);
  assert.equal(risk.hazards.flood.indicative_score, 42); // other hazards keep their labelled baseline
});

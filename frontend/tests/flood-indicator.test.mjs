import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyFloodCapture, boxAreaHa, floodIndicator, floodRowNote, NO_CAPTURE_TEXT, recencyWeight, UNFILTERED_CAP,
} from "../lib/flood-indicator.ts";
import { orderHazards } from "../lib/hazard-panel.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/candaba-extent.json", import.meta.url), "utf8"));
const BOX = fixture.features[0].properties.aoi_bbox; // the real 5 km Candaba box
const day = (n) => new Date(Date.parse("2026-09-19T10:06:13Z") + n * 86_400_000);
const capture = (over = {}) => ({
  id: 3, source: "s1-rtc-pc", scene_id: "S1", acquired_at: "2026-09-19T10:06:13Z", aoi_bbox: BOX,
  water_area_m2: 11_872_000, total_water_ha: 1224.5, flood_ha: 1187.2, permanent_water_filtered: true, ...over,
});
const level = (score) => ({ score, level: score === null ? "No Data" : score <= 25 ? "Low" : score <= 60 ? "Medium" : "High", color: "gray" });
const risk = () => ({
  location_name: "Candaba", latitude: 15.09, longitude: 120.83, overall: level(39), components_available: 1, components_total: 13,
  hazards: {
    earthquake: { label: "Earthquake", ...level(39) },
    volcano: { label: "Volcanic Activity", ...level(null), coverage_status: "unavailable" },
    flood: { label: "Flood", ...level(null), coverage_status: "unavailable", reason_code: "no_verified_evidence", indicative_score: 42 },
  },
  main_drivers: ["Earthquake"], nearest_zone: null, data_coverage: "limited", confidence: "Low", generated_at: "x", methodology: "x", engine_version: "x",
});

test("the capture box area comes from its bbox (about 2,500 ha for 5 km)", () => {
  assert.ok(Math.abs(boxAreaHa(BOX) - 2500) < 25);
  assert.equal(boxAreaHa(null), 2500);
});

test("recency: full weight to 7 days, decaying to 0.25 at 30", () => {
  assert.equal(recencyWeight(0), 1);
  assert.equal(recencyWeight(7), 1);
  assert.ok(recencyWeight(18.5) > 0.25 && recencyWeight(18.5) < 1);
  assert.equal(recencyWeight(30), 0.25);
});

test("a fresh filtered capture scores from the flooded share of the box", () => {
  const ind = floodIndicator(capture(), day(2));
  assert.equal(ind.filtered, true);
  assert.equal(Math.round(ind.permanentExcludedHa), 37);
  assert.ok(ind.share > 0.47 && ind.share < 0.49);
  assert.equal(ind.score, 95); // 47.5% of the box is flooded; half the box is 100
  assert.equal(floodIndicator(capture({ flood_ha: 25 }), day(2)).score, 2); // 1% of the box
  assert.equal(floodIndicator(capture({ flood_ha: 0 }), day(2)).score, 0);
});

test("an older scene counts for less, and past 30 days it is stale and unscored", () => {
  const fresh = floodIndicator(capture(), day(5)).score;
  const aging = floodIndicator(capture(), day(20)).score;
  assert.ok(aging < fresh, `${aging} < ${fresh}`);
  assert.equal(floodIndicator(capture(), day(30)).score, Math.round(95 * 0.25));
  const stale = floodIndicator(capture(), day(31));
  assert.equal(stale.stale, true);
  assert.equal(stale.score, null);
});

test("an unfiltered capture uses total water and is capped, because it may be a river", () => {
  const ind = floodIndicator(capture({ flood_ha: null, permanent_water_filtered: false }), day(2));
  assert.equal(ind.filtered, false);
  assert.equal(ind.floodHa, 1224.5);
  assert.equal(ind.score, UNFILTERED_CAP);
  // a pre-0007 record has no total_water_ha at all: it falls back to water_area_m2
  const legacy = floodIndicator({ ...capture(), total_water_ha: undefined, flood_ha: undefined, water_area_m2: 12_244_600 }, day(2));
  assert.equal(Math.round(legacy.floodHa), 1224);
  assert.equal(legacy.score, UNFILTERED_CAP);
});

test("the row note states ha, permanent water excluded, share, scene date and the not-official label", () => {
  const note = floodRowNote(floodIndicator(capture(), day(2)));
  assert.match(note, /about 1,187 ha flooded \(37 ha of permanent water excluded\), 47% of the captured box, scene of 2026-09-19\./);
  assert.match(note, /Satellite-observed, not an official flood map\.$/);
  const unfiltered = floodRowNote(floodIndicator(capture({ flood_ha: null }), day(2)));
  assert.match(unfiltered, /unfiltered, may include permanent water/);
  assert.match(floodRowNote(floodIndicator(capture(), day(40))), /Older than 30 days, so not scored\./);
});

test("with a capture, Flood is scored, joins Overall, and the hazard count goes up", () => {
  const out = applyFloodCapture(risk(), capture(), day(13)); // the real Candaba scene is 13 days old today
  assert.equal(out.hazards.flood.score, 76);
  assert.equal(out.hazards.flood.coverage_status, "available");
  assert.equal(out.hazards.flood.satellite, true);
  assert.equal(out.hazards.flood.indicative_score, null); // the zone-model number would contradict the observation
  assert.equal(out.components_available, 2);
  assert.equal(out.components_total, 13);
  assert.equal(out.overall.score, Math.round((39 + 76) / 2));
  assert.deepEqual(out.main_drivers, ["Flood", "Earthquake"]);
  assert.equal(risk().hazards.flood.score, null); // input untouched
});

test("with no capture, Flood stays visible, unscored, and says to flag", () => {
  const out = applyFloodCapture(risk(), null);
  assert.equal(out.hazards.flood.score, null);
  assert.equal(out.hazards.flood.reason_code, "no_satellite_capture");
  assert.equal(out.hazards.flood.note, NO_CAPTURE_TEXT);
  assert.match(out.hazards.flood.note, /flag flooding here/);
  assert.equal(out.components_available, 1);
  assert.equal(out.overall.score, 39);
});

test("a stale capture is shown but not scored and not in Overall", () => {
  const out = applyFloodCapture(risk(), capture(), day(45));
  assert.equal(out.hazards.flood.score, null);
  assert.equal(out.hazards.flood.coverage_status, "stale");
  assert.match(out.hazards.flood.note, /not scored/);
  assert.equal(out.components_available, 1);
  assert.equal(out.overall.score, 39);
});

test("an unfiltered capture is flagged in the row and capped in Overall", () => {
  const out = applyFloodCapture(risk(), capture({ flood_ha: null }), day(2));
  assert.equal(out.hazards.flood.score, UNFILTERED_CAP);
  assert.match(out.hazards.flood.note, /unfiltered/);
});

test("a risk with no flood hazard is returned as is", () => {
  const r = risk();
  delete r.hazards.flood;
  assert.equal(applyFloodCapture(r, capture(), day(2)), r);
});

test("layer Flood puts the Flood row first; Overall Risk sorts rows by score, unscored last", () => {
  const out = applyFloodCapture(risk(), capture(), day(13));
  assert.equal(orderHazards(out.hazards, "flood")[0].key, "flood");
  assert.equal(orderHazards(out.hazards, "flood")[0].active, true);
  assert.deepEqual(orderHazards(out.hazards, "overall").map((h) => h.key), ["flood", "earthquake", "volcano"]);
  // no capture: Flood has no score, so it sits with the unscored rows in original order
  assert.deepEqual(orderHazards(applyFloodCapture(risk(), null).hazards, "overall").map((h) => h.key), ["earthquake", "volcano", "flood"]);
});

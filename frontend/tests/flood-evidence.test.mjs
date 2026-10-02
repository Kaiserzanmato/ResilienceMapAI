// Candaba is the real production capture (extent #3, Sentinel-1, 2026-09-19, ~1,224 ha).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  aoiCollection, bboxContains, describeFloodArea, coverageBbox, distanceToBboxKm, findFloodCapture, geometryBbox, markerCollection,
  nearestCapture, pointBboxParam, summarizeCapture, viewportBboxParam,
} from "../lib/flood-evidence.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/candaba-extent.json", import.meta.url), "utf8"));
const candaba = fixture.features[0];
const FLAG = { lat: 15.0921, lng: 120.8275 };        // where the real flag was saved (the panel's coordinates)
const CLICKED_PIN = { lat: 15.0893, lng: 120.8896 }; // the pin the user clicked: ~4.6 km east of the capture box

test("a spot inside the capture box finds the Candaba capture", () => {
  assert.equal(findFloodCapture([candaba], FLAG.lat, FLAG.lng)?.properties.id, 3);
  // even a corner of the box with no water near it is covered
  const [w, s] = candaba.properties.aoi_bbox;
  assert.equal(findFloodCapture([candaba], s + 0.001, w + 0.001)?.properties.id, 3);
});

test("the clicked pin east of the box is not covered, so it gets no evidence", () => {
  assert.equal(findFloodCapture([candaba], CLICKED_PIN.lat, CLICKED_PIN.lng), null);
  assert.equal(findFloodCapture([], FLAG.lat, FLAG.lng), null);
  assert.equal(findFloodCapture(undefined, FLAG.lat, FLAG.lng), null);
});

test("an older response without aoi_bbox falls back to the water polygons' bounds", () => {
  const props = { ...candaba.properties };
  delete props.aoi_bbox;
  const legacy = { ...candaba, properties: props };
  assert.deepEqual(coverageBbox(legacy), geometryBbox(candaba.geometry));
  const polygonCentre = geometryBbox(candaba.geometry);
  assert.equal(findFloodCapture([legacy], (polygonCentre[1] + polygonCentre[3]) / 2, (polygonCentre[0] + polygonCentre[2]) / 2)?.properties.id, 3);
});

test("the newest covering capture wins", () => {
  const older = { ...candaba, properties: { ...candaba.properties, id: 1, acquired_at: "2026-09-01T00:00:00Z" } };
  const newer = { ...candaba, properties: { ...candaba.properties, id: 9, acquired_at: "2026-09-25T00:00:00Z" } };
  assert.equal(findFloodCapture([older, newer, candaba], FLAG.lat, FLAG.lng)?.properties.id, 9);
});

test("the evidence line states source, scene date and area, and never a score", () => {
  const summary = summarizeCapture(candaba.properties);
  assert.equal(summary.sourceLabel, "Sentinel-1 radar");
  assert.equal(summary.sceneDate, "2026-09-19");
  assert.equal(summary.hectares, 1224);
  // the stored production extent predates the permanent-water filter, so it says so
  assert.equal(summary.text, "Sentinel-1 radar, scene of 2026-09-19: about 1,224 ha of open water in the captured 5 km box. "
    + "Permanent water (rivers, lakes, fishponds) could not be excluded for this capture.");
  assert.doesNotMatch(summary.text, /\d+\s*\/\s*100|score/i);
  assert.match(summarizeCapture({ ...candaba.properties, water_area_m2: 0 }).text, /no open water/);
});

test("coordinates are lon/lat inside Luzon", () => {
  const [w, s, e, n] = geometryBbox(candaba.geometry);
  assert.ok(w > 120 && e < 121.5 && s > 14.5 && n < 15.5, "x is longitude, y is latitude");
  assert.ok(bboxContains(candaba.properties.aoi_bbox, FLAG.lat, FLAG.lng));
});

test("capture boxes and markers are built from the capture box centre", () => {
  const [box] = aoiCollection([candaba]).features;
  const ring = box.geometry.coordinates[0];
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring[4]);
  const [marker] = markerCollection([candaba]).features;
  const [lng, lat] = marker.geometry.coordinates;
  assert.ok(bboxContains(candaba.properties.aoi_bbox, lat, lng));
  assert.equal(aoiCollection(undefined).features.length, 0);
});

test("the viewport query is padded, rounded and capped like the API", () => {
  assert.equal(viewportBboxParam([120.7, 15.0, 121.0, 15.2]), "120,14.5,121.5,16");
  assert.equal(viewportBboxParam([-180, -80, 180, 80]), null);   // whole world: the API would answer 422
  assert.equal(viewportBboxParam([100, 5, 130, 25]), null);      // 30 degrees wide
  assert.equal(pointBboxParam(15.09, 120.83, 0.1), "120.73,14.99,120.93,15.19");
});

test("the clicked pin is about 4.4 km from the capture, close enough to point the user at it", () => {
  const near = nearestCapture([candaba], CLICKED_PIN.lat, CLICKED_PIN.lng);
  assert.equal(near.feature.properties.id, 3);
  assert.ok(near.distanceKm > 4 && near.distanceKm < 5, `got ${near.distanceKm}`);
  assert.equal(distanceToBboxKm(candaba.properties.aoi_bbox, FLAG.lat, FLAG.lng), 0); // inside the box
  assert.equal(nearestCapture([candaba], 14.0, 121.5), null);                         // ~170 km away
  assert.equal(nearestCapture(undefined, FLAG.lat, FLAG.lng), null);
});

test("a filtered capture headlines flooding and states the permanent water excluded", () => {
  const props = { ...candaba.properties, total_water_ha: 1224.5, flood_ha: 1187.2, permanent_water_filtered: true };
  const area = describeFloodArea(props);
  assert.deepEqual([area.hectares, area.filtered, area.unfilteredNote], [1187, true, null]);
  assert.equal(area.text, "about 1,187 ha of flooding (37 ha of permanent water excluded)");
  assert.equal(summarizeCapture(props).text,
    "Sentinel-1 radar, scene of 2026-09-19: about 1,187 ha of flooding (37 ha of permanent water excluded) in the captured 5 km box.");
  assert.match(describeFloodArea({ ...props, flood_ha: 0 }).text, /^no flooding detected beyond permanent water \(1,2\d\d ha/);
});

test("an unfiltered capture falls back to total water with an unfiltered note", () => {
  const area = describeFloodArea({ water_area_m2: 123_400, total_water_ha: 12.34, flood_ha: null, permanent_water_filtered: false });
  assert.deepEqual([area.hectares, area.filtered], [12, false]);
  assert.match(area.unfilteredNote, /could not be excluded/);
});

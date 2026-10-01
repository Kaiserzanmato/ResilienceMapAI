import assert from "node:assert/strict";
import { test } from "node:test";
import { LAYER_TO_HAZARD, orderHazards } from "../lib/hazard-panel.ts";

const hazards = { earthquake: { n: "Earthquake" }, volcano: {}, flood: { n: "Flood" }, tropical_cyclone: {}, coastal_exposure: {} };
const keys = (layer) => orderHazards(hazards, layer).map((h) => h.key);

test("the selected layer's hazard comes first and is marked active", () => {
  assert.deepEqual(keys("flood"), ["flood", "earthquake", "volcano", "tropical_cyclone", "coastal_exposure"]);
  const [first, second] = orderHazards(hazards, "flood");
  assert.equal(first.active, true);
  assert.equal(second.active, false);
});

test("storm surge maps to the coastal_exposure hazard", () => {
  assert.equal(LAYER_TO_HAZARD.storm_surge, "coastal_exposure");
  assert.equal(keys("storm_surge")[0], "coastal_exposure");
});

test("overall, unknown or missing layers keep the original order with nothing highlighted", () => {
  for (const layer of ["overall", "nonsense", ""]) {
    assert.deepEqual(keys(layer), Object.keys(hazards));
    assert.ok(orderHazards(hazards, layer).every((h) => !h.active));
  }
  assert.deepEqual(orderHazards({ earthquake: {} }, "flood").map((h) => h.key), ["earthquake"]); // layer's hazard absent
});

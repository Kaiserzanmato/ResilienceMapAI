import assert from "node:assert/strict";
import test from "node:test";
import { nearestSnap, snapHeight } from "../lib/sheet-snap.ts";

test("snap heights are a 70px peek, 45% and 90% of the viewport", () => {
  assert.equal(snapHeight("min", 844), 70);
  assert.equal(snapHeight("mid", 800), 360);
  assert.equal(snapHeight("full", 800), 720);
});

test("a dragged height settles on the nearest snap point", () => {
  assert.equal(nearestSnap(60, 800), "min");
  assert.equal(nearestSnap(150, 800), "min");
  assert.equal(nearestSnap(230, 800), "mid");
  assert.equal(nearestSnap(500, 800), "mid");
  assert.equal(nearestSnap(560, 800), "full");
  assert.equal(nearestSnap(900, 800), "full");
});

test("a cap keeps the sheet clear of the controls above it", () => {
  assert.equal(snapHeight("full", 844, 600), 600);
  assert.equal(snapHeight("mid", 844, 600), 844 * 0.45);
  assert.equal(snapHeight("mid", 390, 162), 162);
  assert.equal(snapHeight("min", 390, 40), 70); // the peek is never capped away
  assert.equal(nearestSnap(590, 844, 600), "full");
});

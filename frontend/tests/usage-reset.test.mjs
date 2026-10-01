import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration, formatResetClock, secondsUntil } from "../lib/usage-reset.ts";

const at = (h, m, day = 1) => new Date(2026, 9, day, h, m, 0).getTime(); // local time, Oct 2026

test("no reset time means nothing to count down", () => {
  assert.equal(secondsUntil(null, at(12, 0)), 0);
  assert.equal(secondsUntil("not a date", at(12, 0)), 0);
});

test("a reset time in the past counts down to zero, never negative", () => {
  const reset = new Date(at(14, 58)).toISOString();
  assert.equal(secondsUntil(reset, at(14, 0)), 58 * 60);
  assert.equal(secondsUntil(reset, at(14, 58)), 0);
  assert.equal(secondsUntil(reset, at(15, 30)), 0);   // "Resets at 02:58 PM" shown at 3:30 PM was the bug
});

test("durations round up and never show 60 minutes", () => {
  assert.equal(formatDuration(0), "now");
  assert.equal(formatDuration(1), "1m");
  assert.equal(formatDuration(3599), "1h 0m");
  assert.equal(formatDuration(5 * 3600 - 20), "5h 0m");
  assert.equal(formatDuration(3 * 3600 + 61), "3h 2m");
});

test("a reset later today shows a clock time; another day also shows the date", () => {
  const sameDay = formatResetClock(new Date(at(19, 55)).toISOString(), at(14, 0), "en-US");
  assert.match(sameDay, /^0?7:55 PM$/);
  const nextDay = formatResetClock(new Date(at(0, 0, 2)).toISOString(), at(14, 0), "en-US");
  assert.match(nextDay, /^Oct 2, 12:00 AM$/);
});

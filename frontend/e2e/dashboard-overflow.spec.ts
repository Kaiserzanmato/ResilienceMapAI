import { expect, test } from "./fixtures";

// The dashboard's chart grids (`grid gap-3 lg:grid-cols-3`) had no explicit
// column count below `lg`, so the implicit single-column track sized itself
// to its content's intrinsic width instead of the viewport — a classic CSS
// grid blowout. 390 is the width that first exposed it (iPhone 12/13/14);
// 360, 768 and 1280 are kept as general no-horizontal-scroll guards.
const WIDTHS = [360, 390, 768, 1280];

for (const width of WIDTHS) {
  test(`dashboard fits at ${width}px: no horizontal page overflow`, async ({ app }) => {
    await app.setViewportSize({ width, height: 800 });
    await app.goto("/dashboard");

    const scrollWidth = await app.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}

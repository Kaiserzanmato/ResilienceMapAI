import { expect, selectTacloban, test } from "./fixtures";

// The map overlays must collapse, expand and never block the map canvas on every form factor:
// phone, tablet, unfolded foldable, laptop and wide desktop.
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "foldable", width: 820, height: 1180 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "desktop", width: 1920, height: 1080 },
];

/** True when the topmost element at this fraction of the viewport belongs to the map canvas. */
async function hasWebGL2(page: import("@playwright/test").Page) {
  return page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
}

async function mapIsUnderPoint(page: import("@playwright/test").Page, x: number, y: number) {
  return page.evaluate(([fx, fy]) => {
    const hit = document.elementFromPoint(window.innerWidth * fx, window.innerHeight * fy);
    return !!hit?.closest('[role="application"]');
  }, [x, y]);
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.skip(({ isMobile }) => isMobile, "mobile projects run at their own device size in layering.spec.ts");
    test.use({ viewport: { width: size.width, height: size.height } });
    const docked = size.width >= 1024;

    test("Map Layers collapses and reopens, and the map stays under the overlays", async ({ app }) => {
      await app.goto("/map");
      await expect(app.getByRole("application", { name: "Risk intelligence map" })).toBeAttached({ timeout: 30_000 });
      const dock = app.getByTestId("layers-dock");
      const fab = app.getByTestId("layers-fab");

      if (docked) {
        await expect(dock).toBeVisible();
        await expect(dock).toHaveAttribute("data-mode", "dock");
        await expect(fab).toBeHidden();
        await dock.getByRole("button", { name: "Collapse Map Layers" }).click();
        await expect(dock).toHaveAttribute("data-open", "false");
        await expect(dock).toBeHidden(); // slid fully off-screen, not just faded
        await expect(fab).toBeVisible();
        const box = (await fab.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        await fab.click();
        await expect(dock).toBeVisible();
      } else {
        // A flyout: closed by default, with the floating button on screen.
        await expect(dock).toHaveAttribute("data-mode", "flyout");
        await expect(dock).toBeHidden();
        await expect(fab).toBeVisible();
        if (await hasWebGL2(app)) expect(await mapIsUnderPoint(app, 0.5, 0.6)).toBe(true);
        await fab.click();
        await expect(dock).toBeVisible();
        await expect(dock.getByRole("heading", { name: "Map Layers" })).toBeVisible();
        // Escape, the close button and the backdrop each dismiss it.
        await app.keyboard.press("Escape");
        await expect(dock).toBeHidden();
        await fab.click();
        await dock.getByRole("button", { name: "Close Map Layers" }).click();
        await expect(dock).toBeHidden();
        await fab.click();
        await app.locator("button[aria-label='Close Map Layers']").first().click({ position: { x: size.width - 20, y: size.height * 0.3 } });
        await expect(dock).toBeHidden();
      }
      // The overlay container is click-through: the map is directly touchable beside the cards.
      // Without WebGL2 (headless Firefox on a GPU-less runner) the page shows a notice instead of a map.
      if (await hasWebGL2(app)) expect(await mapIsUnderPoint(app, 0.5, 0.6)).toBe(true);
      expect(await app.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    });

    if (size.width >= 768) {
      test("risk panel minimizes to a chip and reopens", async ({ app }) => {
        await selectTacloban(app);
        const minimize = app.getByRole("button", { name: "Minimize risk summary" });
        await expect(minimize).toBeVisible();
        // A long place name wraps instead of being cut off at the card edge.
        const title = app.getByRole("heading", { name: /Tacloban/ }).first();
        const titleBox = (await title.boundingBox())!;
        expect(titleBox.x).toBeGreaterThanOrEqual(0);
        await minimize.click();
        const chip = app.getByTestId("risk-chip");
        await expect(chip).toBeVisible();
        await expect(chip).toContainText("Tacloban");
        await expect(app.getByRole("button", { name: "Close risk summary" })).toBeHidden();
        const box = (await chip.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        await chip.click();
        await expect(app.getByRole("button", { name: "Minimize risk summary" })).toBeVisible();
        await expect(chip).toBeHidden();
      });
    } else {
      test("risk summary is a bottom sheet with three snap points", async ({ app }) => {
        await selectTacloban(app);
        const sheet = app.getByTestId("risk-sheet");
        await expect(sheet).toBeVisible();
        await expect(sheet).toHaveAttribute("data-snap", "mid");
        const handle = app.getByRole("slider", { name: "Resize risk assessment" });
        const height = async () => (await sheet.boundingBox())!.height;
        await expect.poll(height).toBeCloseTo(size.height * 0.45, -1);

        await handle.focus();
        await app.keyboard.press("ArrowDown");
        await expect(sheet).toHaveAttribute("data-snap", "min");
        await expect.poll(height).toBeCloseTo(70, -1);
        // Peek: the score pill and name are still readable.
        await expect(sheet.getByText("Tacloban").first()).toBeVisible();

        await app.keyboard.press("ArrowUp");
        await app.keyboard.press("ArrowUp");
        await expect(sheet).toHaveAttribute("data-snap", "full");
        // At most 90dvh, and never under the nav or search bar above it.
        await expect.poll(async () => (await height()) <= size.height * 0.9 + 1).toBe(true);
        await expect.poll(async () => (await sheet.boundingBox())!.y).toBeGreaterThan(100);
        expect(await height()).toBeGreaterThan(size.height * 0.45);
        // The handle is on screen and not covered.
        expect(await app.evaluate(() => {
          const el = document.querySelector('[role="slider"]')!;
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        })).toBe(true);
      });
    }
  });
}

test("dragging the sheet handle settles on a snap point", async ({ app, browserName }) => {
  test.skip(browserName === "webkit", "pointer capture drag is exercised on Chromium and Firefox");
  await app.setViewportSize({ width: 390, height: 844 });
  await selectTacloban(app);
  const sheet = app.getByTestId("risk-sheet");
  const handle = (await app.getByRole("slider", { name: "Resize risk assessment" }).boundingBox())!;
  const x = handle.x + handle.width / 2;
  await app.mouse.move(x, handle.y + 8);
  await app.mouse.down();
  await app.mouse.move(x, handle.y + 300, { steps: 8 });
  await app.mouse.up();
  await expect(sheet).toHaveAttribute("data-snap", "min");
});

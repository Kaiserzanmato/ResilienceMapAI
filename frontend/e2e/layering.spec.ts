import { expect, intersects, isUncovered, obstructionBoxes, selectTacloban, test } from "./fixtures";

const SIZES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function openInsights(app: import("@playwright/test").Page) {
  await selectTacloban(app);
  const insights = app.getByRole("button", { name: /insights/i }).first();
  await expect(insights).toBeVisible();
  await insights.click();
  await expect(app.getByTestId("modal")).toBeVisible();
}

async function openEvacCard(app: import("@playwright/test").Page) {
  await selectTacloban(app);
  const toggle = app.getByText(/Show Nearest Evacuation Centers/i).first();
  // On phones the Map Layers card starts collapsed.
  if (!(await toggle.isVisible())) await app.getByRole("button", { name: /Map Layers/ }).click();
  await toggle.click();
  await expect(app.getByTestId("evac-card")).toBeVisible({ timeout: 30_000 });
  await app.waitForTimeout(2200); // let the fly-to finish so the card has settled
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.skip(({ isMobile }) => isMobile, "mobile projects run at their own device size below");
    test.use({ viewport: size });

    test("Insights dialog header and close button are never covered", async ({ app }) => {
      await openInsights(app);
      expect(await isUncovered(app, '[data-testid="modal-header"]')).toBe(true);
      expect(await isUncovered(app, '[data-testid="modal"] button[aria-label^="Close"]')).toBe(true);
      await expect.poll(async () => {
        const d = (await app.getByTestId("modal").boundingBox())!;
        return d.y >= -0.5 && d.y + d.height <= size.height + 0.5 && d.x + d.width <= size.width + 0.5;
      }).toBe(true);
    });

    test("evacuation card does not overlap any floating control", async ({ app }) => {
      await openEvacCard(app);
      const card = await app.getByTestId("evac-card").boundingBox();
      const box = { left: card!.x, top: card!.y, right: card!.x + card!.width, bottom: card!.y + card!.height };
      for (const obstruction of await obstructionBoxes(app)) expect(intersects(box, obstruction), JSON.stringify({ box, obstruction })).toBe(false);
      expect(await isUncovered(app, '[data-testid="evac-card"] h3')).toBe(true);
      expect(await isUncovered(app, '[data-testid="evac-card"] button[aria-label*="lose"]')).toBe(true);
    });
  });
}

test.describe("native device size", () => {
  test("Insights dialog is fully visible", async ({ app, viewport }) => {
    await openInsights(app);
    expect(await isUncovered(app, '[data-testid="modal-header"]')).toBe(true);
    expect(await isUncovered(app, '[data-testid="modal"] button[aria-label^="Close"]')).toBe(true);
    // The dialog scales in; check its final box.
    await expect.poll(async () => {
      const dialog = await app.getByTestId("modal").boundingBox();
      return dialog!.y + dialog!.height;
    }).toBeLessThanOrEqual(viewport!.height + 0.5);
  });

  test("evacuation card clears the floating controls", async ({ app }) => {
    await openEvacCard(app);
    const card = await app.getByTestId("evac-card").boundingBox();
    const box = { left: card!.x, top: card!.y, right: card!.x + card!.width, bottom: card!.y + card!.height };
    for (const obstruction of await obstructionBoxes(app)) expect(intersects(box, obstruction)).toBe(false);
  });
});

test.describe("Insights dialog behaviour", () => {
  test("Esc closes it, focus is trapped, background does not scroll, the body scrolls inside", async ({ app }) => {
    await openInsights(app);
    await expect(app.getByTestId("modal").getByRole("button", { name: /^Close/ })).toBeFocused();
    for (let i = 0; i < 12; i++) await app.keyboard.press("Tab");
    expect(await app.evaluate(() => !!document.activeElement?.closest('[data-testid="modal"]'))).toBe(true);
    expect(await app.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
    const scrolls = await app.evaluate(() => {
      const body = document.querySelector('[data-testid="modal"] > div:last-child') as HTMLElement;
      return body.scrollHeight > body.clientHeight;
    });
    expect(scrolls).toBe(true);
    await app.keyboard.press("Escape");
    await expect(app.getByTestId("modal")).toHaveCount(0);
  });

  test("close button works and tap target is at least 44px", async ({ app }) => {
    await openInsights(app);
    const close = app.getByTestId("modal").getByRole("button", { name: /^Close/ });
    // The dialog scales in; measure once it has settled.
    await expect.poll(async () => (await close.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => (await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(app.getByTestId("modal")).toHaveCount(0);
  });

  test("reduced motion: the dialog still opens and closes", async ({ app }) => {
    await app.emulateMedia({ reducedMotion: "reduce" });
    await openInsights(app);
    await app.keyboard.press("Escape");
    await expect(app.getByTestId("modal")).toHaveCount(0);
  });
});

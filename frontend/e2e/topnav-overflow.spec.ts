import { expect, test } from "./fixtures";

// The widths the responsive design is meant to support, plus the exact window
// (1280-1319px) where TopNav's desktop nav used to overflow — Tailwind's xl
// breakpoint, and not coincidentally Playwright's own default viewport.
const WIDTHS = [360, 768, 1024, 1280, 1366, 1440, 1920];

for (const width of WIDTHS) {
  test(`TopNav fits at ${width}px: no page overflow, every header control inside the viewport`, async ({ app }) => {
    await app.setViewportSize({ width, height: 800 });
    await app.goto("/dashboard");

    // document.scrollWidth misses this exact bug: `header` is position:fixed, so
    // content overflowing past the viewport edge never widens the scrollable
    // document at all. Kept anyway as a general no-horizontal-scroll guard.
    const scrollWidth = await app.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);

    // The real check: every control inside the fixed header — nav links, the
    // "More" trigger if present, persona selector, theme toggle, mobile menu
    // button — has its full box inside [0, width].
    const offenders = await app.evaluate(() => {
      const header = document.querySelector('header[data-map-obstruction="top"]');
      if (!header) return [];
      return [...header.querySelectorAll<HTMLElement>("a, button")]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0) // skip display:none items (e.g. md:hidden mobile button on desktop)
        .filter(({ r }) => r.left < -0.5 || r.right > window.innerWidth + 0.5)
        .map(({ el, r }) => ({
          label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName,
          left: Math.round(r.left),
          right: Math.round(r.right),
        }));
    });
    expect(offenders, JSON.stringify(offenders)).toEqual([]);
  });
}

test.describe("TopNav priority overflow", () => {
  test("below the nav-labels breakpoint, links show icon-only", async ({ app }) => {
    await app.setViewportSize({ width: 1024, height: 800 });
    await app.goto("/dashboard");
    const dashboardLink = app.getByRole("link", { name: "Dashboard" });
    await expect(dashboardLink).toBeVisible();
    // The label span exists (for a11y + measurement) but is hidden below 1440px.
    await expect(dashboardLink.locator("span")).toBeHidden();
  });

  test("at and above the nav-labels breakpoint, links show icon+label", async ({ app }) => {
    await app.setViewportSize({ width: 1920, height: 800 });
    await app.goto("/dashboard");
    const dashboardLink = app.getByRole("link", { name: "Dashboard" });
    await expect(dashboardLink.locator("span")).toBeVisible();
    await expect(dashboardLink.locator("span")).toHaveText("Dashboard");
  });

  test("the lowest-priority link moves into the More menu when space runs out, and stays reachable", async ({ app }) => {
    // Narrow enough, at the icon+label breakpoint, that not all 8 links fit.
    await app.setViewportSize({ width: 1440, height: 800 });
    await app.goto("/dashboard");

    const more = app.getByRole("button", { name: "More navigation links" });
    await expect(more).toBeVisible();
    await more.click();
    const menu = app.getByRole("menu", { name: "More navigation links" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeVisible();

    await menu.getByRole("menuitem", { name: "Settings" }).click();
    await expect(app).toHaveURL(/\/settings$/);
    await expect(menu).toHaveCount(0);
  });

  test("persona selector, search and theme toggle stay reachable at every width", async ({ app }) => {
    for (const width of [360, 1024, 1280, 1920]) {
      await app.setViewportSize({ width, height: 800 });
      await app.goto("/map");
      await expect(app.getByRole("button", { name: /^Persona:/ })).toBeVisible();
      await expect(app.getByRole("button", { name: "Change theme" })).toBeVisible();
      await expect(app.getByRole("button", { name: "Search or select a location" })).toBeVisible();
    }
  });
});

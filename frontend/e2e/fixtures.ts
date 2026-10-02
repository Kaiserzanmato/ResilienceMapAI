import { expect, test as base, type Page } from "@playwright/test";

/** Every backend call is answered here, so the suite needs no running API and no network. */
const hazard = (label: string, score: number | null) => ({
  hazard: label.toLowerCase(), label, classification: score === null ? "no-data" : "medium", score,
  confidence: score === null ? "none" : "medium", coverage_status: score === null ? "unavailable" : "available",
  sources: [], evidence: [], limitations: [],
});

export const TACLOBAN = { name: "Tacloban", country: "Philippines", lat: 11.2444, lng: 125.0039, countryAlpha2: "PH", formatted_address: "Tacloban, Leyte, Philippines" };

const assessment = {
  location: { name: "Tacloban", latitude: TACLOBAN.lat, longitude: TACLOBAN.lng, country_code: "PH" },
  hazards: { earthquake: hazard("Earthquake", 39), flood: hazard("Flood", null), wildfire: hazard("Wildfire", 6) },
  multi_hazard_summary: { highest_priority_hazards: ["earthquake"], coverage_score: 20, components_available: 2, components_total: 3 },
  generated_at: "2026-10-02T00:00:00Z", coverage_registry_version: "x", scoring_version: "x", disclaimer: "x",
};

const longInsight = {
  title: "Insights",
  summary: Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1}: a long intelligence summary line used to prove the dialog body scrolls inside its own area.`).join(" "),
  notice: "Screening result, not an official advisory.",
  hazard_type: "Overall",
  sources: Array.from({ length: 12 }, (_, i) => ({ source_name: `Source ${i + 1}`, agency: "Agency", url: "https://example.test", verified: true })),
  confidence_category: "medium_confidence",
  timestamp: "2026-10-02T00:00:00Z",
};

export async function mockBackend(page: Page) {
  // Uncaught page errors are printed so a browser-specific crash is diagnosable from the CI log.
  page.on("pageerror", (error) => console.log(`[pageerror] ${error.message}`));
  // Map tiles and fonts: never leave the machine.
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  await page.route(/^https?:\/\/(?!localhost)/, (route) =>
    route.request().resourceType() === "image" || /\.(png|jpg|pbf)(\?|$)/.test(route.request().url())
      ? route.fulfill({ status: 200, contentType: "image/png", body: PNG })
      : route.abort()
  );
  await page.route("http://localhost:8000/**", (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.pathname === "/api/geocode") return json({ results: [TACLOBAN] });
    if (url.pathname === "/api/assessments") return json(assessment);
    if (url.pathname === "/api/generate-insights") return json({ insight: longInsight });
    if (url.pathname === "/api/usage-status") return json({ insights: { bucket: "insights", limit: 10, used: 0, remaining: 10, resets_at: null }, chat: { bucket: "chat", limit: 10, used: 0, remaining: 10, resets_at: null } });
    if (url.pathname.startsWith("/api/flood")) return json({ type: "FeatureCollection", features: [], captures: [], flags: [] });
    return json({ events: [], alerts: [], results: [], datasets: [], features: [] });
  });
}

/** Search "Tacloban", pick it, and wait for the risk panel. */
export async function selectTacloban(page: Page) {
  await page.goto("/map");
  await page.getByRole("button", { name: "Search or select a location" }).click();
  await page.getByLabel("Filter location").fill("Tacloban");
  await page.getByRole("listbox", { name: "Search results" }).getByRole("option", { name: /Tacloban/ }).click();
}

/** Boxes of every floating control that must never sit on top of a dialog or popup. */
export async function obstructionBoxes(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-map-obstruction]")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
  );
}

export const intersects = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** True when the element at the centre of each locator is that locator (or inside it): nothing covers it. */
export async function isUncovered(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const points = [[0.5, 0.5], [0.1, 0.2], [0.9, 0.2], [0.1, 0.8], [0.9, 0.8]];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
      return !!hit && el.contains(hit);
    });
  }, selector);
}

export const test = base.extend<{ app: Page }>({
  app: async ({ page }, provide) => {
    await mockBackend(page);
    await provide(page);
  },
});
export { expect };

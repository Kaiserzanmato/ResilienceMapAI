import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "firefox",
      // Headless Firefox on CI has no GPU: force software WebGL so MapLibre can start.
      use: { ...devices["Desktop Firefox"], launchOptions: { firefoxUserPrefs: { "webgl.disabled": false, "webgl.force-enabled": true, "gfx.webrender.software": true } } },
    },
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "ipad", use: { ...devices["iPad (gen 7)"] } },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is quicker to start.
    command: process.env.CI
      ? `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build && npm run start -- --port ${PORT}`
      : `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/map`,
    reuseExistingServer: !process.env.CI,
    timeout: 420_000,
  },
});

import { expect, test } from "./fixtures";

test.describe("Persona switch", () => {
  test("header menu switches persona and it persists across reload", async ({ app }) => {
    await app.goto("/dashboard");

    // Default persona is Citizen.
    await expect(app.getByRole("button", { name: "Persona: Citizen" })).toBeVisible();

    await app.getByRole("button", { name: "Persona: Citizen" }).click();
    const menu = app.getByRole("menu", { name: "Insight persona" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Real Estate/ }).click();

    // Menu closes and the trigger now reflects the new persona.
    await expect(menu).toHaveCount(0);
    const trigger = app.getByRole("button", { name: "Persona: Real Estate" });
    await expect(trigger).toBeVisible();

    // Same store everywhere: Settings reflects it too, without its own picker.
    await app.goto("/settings");
    await expect(app.getByText("Current persona:")).toContainText("Real Estate");
    await expect(app.getByRole("heading", { name: "Default persona" })).toHaveCount(0);

    // Persisted to localStorage, survives a reload.
    await app.reload();
    await expect(app.getByRole("button", { name: "Persona: Real Estate" })).toBeVisible();
  });

  test("Escape closes the persona menu without changing the selection", async ({ app }) => {
    await app.goto("/dashboard");
    await app.getByRole("button", { name: "Persona: Citizen" }).click();
    const menu = app.getByRole("menu", { name: "Insight persona" });
    await expect(menu).toBeVisible();
    await app.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(app.getByRole("button", { name: "Persona: Citizen" })).toBeVisible();
  });
});

test.describe("Reduced motion", () => {
  test("persona menu (GlassMenu) still opens and closes", async ({ app }) => {
    await app.emulateMedia({ reducedMotion: "reduce" });
    await app.goto("/dashboard");

    const trigger = app.getByRole("button", { name: "Persona: Citizen" });
    await trigger.click();
    const menu = app.getByRole("menu", { name: "Insight persona" });
    await expect(menu).toBeVisible();

    await menu.getByRole("menuitem", { name: /Government/ }).click();
    await expect(menu).toHaveCount(0);
    await expect(app.getByRole("button", { name: "Persona: Government" })).toBeVisible();
  });

  test("theme menu (GlassMenu) still opens and closes", async ({ app }) => {
    await app.emulateMedia({ reducedMotion: "reduce" });
    await app.goto("/dashboard");

    const trigger = app.getByRole("button", { name: "Change theme" });
    // A plain .click() occasionally raced a post-load layout shift (dashboard KPI
    // cards populating) in CI's webkit/firefox, reporting the icon-only trigger as
    // transiently outside the viewport. Waiting for it attached+visible first, and
    // nudging the page to a known scroll position, gives the fixed header's layout
    // one settled frame before the actionability check runs.
    await expect(trigger).toBeVisible();
    await app.evaluate(() => window.scrollTo(0, 0));
    await trigger.click();
    const menu = app.getByRole("menu", { name: "Change theme" });
    await expect(menu).toBeVisible();
    await app.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
});

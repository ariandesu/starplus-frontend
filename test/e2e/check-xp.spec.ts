/**
 * XP on the self-check (staging, demo astronaut): the mission card starts at
 * 0 XP, a tile opens the daily run at that step, recording earns +10 XP, and
 * reduced motion shows the same text with no running animation.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function loginDemoAstronaut(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  if ((await page.getByTestId("demo-card-astronaut").count()) === 0) {
    test.skip(true, "demo login is switched off here");
  }
  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
}

test("mission card, tile deep-link and +10 XP moments", async ({ page }) => {
  test.setTimeout(300_000);
  await loginDemoAstronaut(page);

  // 1. /check shows 0 XP, Level 1 and 8 open tiles.
  await page.goto(`${BASE_URL}/check?crew=demo-astronaut`);
  await expect(page.getByTestId("mission-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("xp-total")).toContainText("0 / 100 XP", { timeout: 30_000 });
  await expect(page.getByTestId("xp-level")).toContainText("Level 1");
  await expect(page.getByTestId("xp-level")).toContainText("Cadet");
  await expect(page.locator('[data-testid^="mission-tile-"]')).toHaveCount(8);
  await expect(page.getByTestId("mission-tile-heart_rate")).toContainText("+10 XP");

  // 2. The heart-rate tile opens /check/daily at heart rate.
  await page.getByTestId("mission-tile-heart_rate").click();
  await expect(page).toHaveURL(/\/check\/daily.*step=heart_rate/);
  await expect(page.getByRole("heading", { name: "Heart rate" })).toBeVisible({ timeout: 15_000 });

  // 3. Record it, wait for the run to advance, then see xp-gain with "+10 XP".
  await page.locator('input[inputmode="decimal"]').first().fill("62");
  await page.getByRole("button", { name: "Record and next" }).click();
  await expect(page.getByTestId("daily-progress")).toContainText("Step 2 of 8");
  await expect(page.getByTestId("xp-gain")).toContainText("+10 XP");

  // 4. Record blood pressure, and again wait for the advance past the chip alone.
  await expect(page.getByRole("heading", { name: "Blood pressure" })).toBeVisible({ timeout: 15_000 });
  const inputs = page.locator('input[inputmode="decimal"]');
  await inputs.nth(0).fill("118");
  await inputs.nth(1).fill("76");
  await page.getByRole("button", { name: "Record and next" }).click();
  await expect(page.getByTestId("daily-progress")).toContainText("Step 3 of 8");
  await expect(page.getByTestId("xp-gain")).toContainText("+10 XP");

  // 5. Back on /check: 20 XP, and those two tiles are done.
  await page.goto(`${BASE_URL}/check?crew=demo-astronaut`);
  await expect(page.getByTestId("xp-total")).toContainText("20 / 100 XP", { timeout: 30_000 });
  await expect(page.getByTestId("mission-tile-heart_rate")).toContainText("Done");
  await expect(page.getByTestId("mission-tile-blood_pressure")).toContainText("Done");
  await expect(page.getByTestId("mission-tile-sleep_hours")).toContainText("+10 XP");
});

test("reduced motion shows +10 XP text with no running animation", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await loginDemoAstronaut(page);
    await page.goto(`${BASE_URL}/check/daily?crew=demo-astronaut`);
    await expect(page.getByRole("heading", { name: "Heart rate" })).toBeVisible({ timeout: 30_000 });
    await page.locator('input[inputmode="decimal"]').first().fill("64");
    await page.getByRole("button", { name: "Record and next" }).click();
    const chip = page.getByTestId("xp-gain");
    await expect(chip).toContainText("+10 XP");
    expect(await chip.evaluate((el) => el.getAnimations().length)).toBe(0);
  } finally {
    await context.close();
  }
});

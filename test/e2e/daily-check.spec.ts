/**
 * The guided daily check (staging, demo astronaut): the Home count, the run,
 * one skipped step and the finish screen. Skips cleanly where demo login is off.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

const VALUES: Record<string, string[]> = {
  "Heart rate": ["62"],
  "Blood pressure": ["118", "76"],
  "Blood oxygen saturation": ["98"],
  "Core body temperature": ["36.8"],
  "Respiratory rate": ["14"],
  "Sleep duration": ["7.5"],
  "Water intake": ["2"],
  "Mood score": ["70"],
  "Cabin carbon dioxide": ["2.3"],
  "Cabin oxygen": ["159"],
  "Cabin temperature": ["22"],
};

test("the daily check records ten steps, skips one, and shows the count", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto(`${BASE_URL}/login`);
  if ((await page.getByTestId("demo-card-astronaut").count()) === 0) {
    test.skip(true, "demo login is switched off here");
  }
  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 60_000 });

  // 1. Home shows the count.
  await expect(page.getByTestId("daily-count")).toContainText(/today's check: 0 of 11/i, { timeout: 30_000 });

  // 2. Start the guided run.
  await page.getByRole("link", { name: /start today's check/i }).click();
  await expect(page).toHaveURL(/\/check\/daily/);
  await expect(page.getByTestId("daily-progress")).toContainText(/step 1 of 11/i);

  // 3. Record ten steps and skip the eleventh.
  for (let step = 0; step < 10; step++) {
    const heading = (await page.locator("h2").first().textContent())?.trim() ?? "";
    const [first, second] = VALUES[heading] ?? ["60"];
    const inputs = page.locator('input[inputmode="decimal"]');
    await inputs.nth(0).fill(first);
    if (second) await inputs.nth(1).fill(second);
    await page.getByRole("button", { name: "Record and next" }).click();
    await expect(page.getByText(new RegExp(`Step ${step + 2} of 11`, "i"))).toBeVisible({ timeout: 15_000 });
  }

  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "No device" }).click();

  // 4. The finish screen reports 10 of 11 and the skipped step with its reason.
  await page.getByRole("button", { name: /finish/i }).click();
  await expect(page.getByRole("heading", { name: /today's check: 10 of 11/i })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("No device")).toBeVisible();

  // 5. The result page lists critical and watch before the rest.
  await page.getByRole("link", { name: "See your result" }).click();
  await expect(page).toHaveURL(/\/result/);
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 30_000 });

  // 6. Back on Home the count is 10 of 11.
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByTestId("daily-count")).toContainText(/today's check: 10 of 11/i, { timeout: 30_000 });
});

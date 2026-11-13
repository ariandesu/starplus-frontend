/**
 * "What to do" on a critical result (staging, demo astronaut): a critical low
 * glucose reading shows the advice block, the hazard link and the deep-linked
 * "Open Emergency"; the link opens the first low-blood-sugar step.
 * Skips cleanly where demo login is off.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

test("a critical low reading shows What to do and opens the first-aid steps", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto(`${BASE_URL}/login`);
  if ((await page.getByTestId("demo-card-astronaut").count()) === 0) {
    test.skip(true, "demo login is switched off here");
  }
  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });

  // 1. Record a critical low glucose reading through the manual form.
  await page.goto(`${BASE_URL}/check?crew=demo-astronaut`);
  await page.getByText("Enter a reading manually").click();
  await page.locator("#measure-select").selectOption("blood_glucose");
  await page.locator("#measure-blood_glucose").fill("40");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });

  // 2. The critical card shows What to do, the hazard link and Open Emergency.
  const card = page.locator("article", { hasText: "Blood glucose" }).first();
  await expect(card.getByText("What to do")).toBeVisible({ timeout: 30_000 });
  await expect(
    card.getByText(/needs fast sugar and the crew medical officer at once/)
  ).toBeVisible();
  await expect(card.getByRole("link", { name: /isolation and confinement/i })).toHaveAttribute(
    "href",
    /\/hazards#isolation-confinement/
  );
  const emergency = card.getByRole("link", { name: "Open Emergency" });
  await expect(emergency).toHaveAttribute("href", /\/emergency\?scenario=low-blood-sugar/);

  // 3. The link opens the first low-blood-sugar step.
  await emergency.click();
  await expect(page).toHaveURL(/\/emergency\?scenario=low-blood-sugar/);
  await expect(page.getByText(/step 1 of/i)).toBeVisible();
  await expect(page.getByText(/suspect it with shakiness/i)).toBeVisible();
});

/**
 * N1: coming back online must not reload the page or wipe a half-done
 * self-check. Needs a single-use staging code in STARPLUS_STAGING_CODE_ASTRO
 * (skips without it). Run against a staging build:
 *   npm run build:staging && STARPLUS_STAGING_CODE_ASTRO=<code> \
 *   npx playwright test test/e2e/offline-form.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";

const ASTRO_CODE = process.env.STARPLUS_STAGING_CODE_ASTRO;
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const CREW = "stg-astro-1";

test("offline typed value survives reconnect without reload", async ({ page, context }) => {
  test.skip(!ASTRO_CODE, "staging access code is absent");
  const navs: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navs.push(new URL(frame.url()).pathname);
  });

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/access code/i).fill(ASTRO_CODE!);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL(new RegExp(`crew=${CREW}`));

  await page.goto(`${BASE_URL}/check?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /self-check/i })).toBeVisible();
  await page.getByText("Enter a reading manually", { exact: true }).click();
  await page.locator("select#measure-select").selectOption("heart_rate");
  await page.locator("#measure-heart_rate").fill("72");

  await context.setOffline(true);
  await page.waitForTimeout(2000);
  await expect(page.locator("#measure-heart_rate")).toHaveValue("72");

  const navsBeforeReconnect = navs.length;
  await context.setOffline(false);
  await page.waitForTimeout(5000);
  expect(navs.slice(navsBeforeReconnect)).toEqual([]);
  await expect(page.locator("#measure-heart_rate")).toHaveValue("72");
});

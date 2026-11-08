/**
 * P1: queued readings send on their own after reconnecting — no Reports visit.
 * Needs a single-use staging code in STARPLUS_STAGING_CODE_ASTRO (skips
 * without it). Run against a staging build:
 *   npm run build:staging && STARPLUS_STAGING_CODE_ASTRO=<code> \
 *   npx playwright test test/e2e/offline-sync.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";

const ASTRO_CODE = process.env.STARPLUS_STAGING_CODE_ASTRO;
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const CREW = "stg-astro-1";

async function queuedOutboxCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("starplus-device");
        open.onerror = () => reject(new Error("idb-open-failed"));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("outbox", "readonly");
          const got = tx.objectStore("outbox").getAll();
          got.onsuccess = () => {
            const items = got.result as Array<{ state: string }>;
            resolve(items.filter((item) => item.state === "queued").length);
            db.close();
          };
          got.onerror = () => reject(new Error("idb-read-failed"));
        };
      })
  );
}

test("offline recorded reading syncs on reconnect without opening Reports", async ({
  page,
  context,
}) => {
  test.skip(!ASTRO_CODE, "staging access code is absent");
  test.setTimeout(180_000);

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/access code/i).fill(ASTRO_CODE!);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL(new RegExp(`crew=${CREW}`));

  await page.goto(`${BASE_URL}/check?crew=${CREW}`);
  await page.locator("select#measure-select").selectOption("heart_rate");
  await page.locator("#measure-heart_rate").fill("72");

  await context.setOffline(true);
  await page.getByRole("button", { name: /^record$/i }).click();
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible();
  expect(await queuedOutboxCount(page)).toBeGreaterThan(0);

  await context.setOffline(false);
  await expect
    .poll(() => queuedOutboxCount(page), { timeout: 30_000 })
    .toBe(0);
});

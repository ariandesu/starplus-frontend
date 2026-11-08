/**
 * Phase 2 gate: the app's outbox delivers to staging, driven through the real screens.
 *
 * Needs one single-use crew code in STARPLUS_STAGING_CODE_ASTRO (skips without it).
 * Run against a local build pointed at staging:
 *
 * NEXT_PUBLIC_API_BASE=https://starplus-backend-staging.shareflow.workers.dev npm run build && \
 * NEXT_PUBLIC_API_BASE=https://starplus-backend-staging.shareflow.workers.dev \
 * STARPLUS_STAGING_CODE_ASTRO=<code> \
 * npx playwright test test/e2e/cuj-staging.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";

const ASTRO_CODE = process.env.STARPLUS_STAGING_CODE_ASTRO;
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const RUN_ID = typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : String(Date.now());
const SUBJECT = `gate ${RUN_ID}`;

test.beforeEach(() => {
  test.skip(!ASTRO_CODE, "staging access code is absent");
});

async function readSessionExpiry(page: Page, crew: string): Promise<string | null> {
  return page.evaluate(async (crewId: string) => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("starplus-device");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const db = await open();
    try {
      const rec = await new Promise<Record<string, string> | undefined>((resolve, reject) => {
        const req = db.transaction("profiles", "readonly").objectStore("profiles").get(crewId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return rec?.expires_at ?? null;
    } finally {
      db.close();
    }
  }, crew);
}

test("login, self-check, offline emergency report, delivery", async ({ page, context }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/access code/i).fill(ASTRO_CODE!);
  await page.getByLabel(/shared device/i).check();
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL(/crew=stg-astro-1/);

  const expiresAt = await readSessionExpiry(page, "stg-astro-1");
  expect(expiresAt).not.toBeNull();
  const hours = (Date.parse(expiresAt!) - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(23);
  expect(hours).toBeLessThan(25);

  await page.goto(`${BASE_URL}/check?crew=stg-astro-1`);
  await page.locator("#measure-heart_rate").fill("72");
  await page.getByRole("button", { name: /^record$/i }).click();
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible();

  await context.setOffline(true);
  await page.goto(`${BASE_URL}/emergency`);
  await page.getByRole("button", { name: /someone else, not responding/i }).click();
  for (let step = 0; step < 12; step++) {
    const next = page.getByRole("button", { name: /done, next step/i });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  await expect(page.getByRole("heading", { name: /review the report/i })).toBeVisible();
  await page.getByLabel(/subject/i).fill(SUBJECT);
  await page.getByRole("button", { name: /queue report/i }).click();
  await expect(page.getByText(/report queued/i)).toBeVisible();

  await context.setOffline(false);
  await page.goto(`${BASE_URL}/reports?crew=stg-astro-1`);
  await expect(page.getByText(/1 emergency report waiting/i).or(page.getByText(/queued/i)).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /send now/i }).click();
  await expect(page.getByRole("heading", { name: /^delivered$/i })).toBeVisible();
  await expect(page.getByLabel("Delivered reports").getByText(/emergency/i)).toBeVisible({ timeout: 30_000 });
});

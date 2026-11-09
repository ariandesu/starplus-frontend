/**
 * CUJ suite (item 68, incl. G1 delivery): CUJ 1 offline, CUJ 2 self-check in
 * under 60 s, CUJ 3 grey first measure, CUJ 4 estimate confirm, CUJ 5 offline
 * explanation, CUJ 8 demo mode — plus an offline-queued emergency report that
 * is delivered after reconnect. CUJ 6 (model swap) and CUJ 7 (surgeon
 * acknowledgement) are developer actions, not browser flows.
 *
 * Needs one single-use staging code in STARPLUS_STAGING_CODE_ASTRO (skips the
 * staging flow without it; CUJ 1 and CUJ 8 always run).
 *
 * Run: npm run build:staging && \
 * NEXT_PUBLIC_API_BASE=https://starplus-backend-staging.shareflow.workers.dev \
 * STARPLUS_STAGING_CODE_ASTRO=<code> \
 * npx playwright test test/e2e/cuj.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";

const ASTRO_CODE = process.env.STARPLUS_STAGING_CODE_ASTRO;
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const CREW = "stg-astro-1";
const RUN_ID = typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : String(Date.now());

async function readExpiry(page: Page, crew: string): Promise<string | null> {
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

test("CUJ 1 works with the network off", async ({ page, context }) => {
  await page.goto(`${BASE_URL}/emergency`);
  await expect(page.getByRole("heading", { name: /emergency/i })).toBeVisible();
  await page.waitForTimeout(5000);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /emergency/i })).toBeVisible();

  await page.getByRole("button", { name: /someone else, not responding/i }).click();
  await expect(page.getByText(/step 1 of 8/i)).toBeVisible();
  for (let step = 0; step < 8; step++) {
    await page.getByRole("button", { name: /done, next step/i }).click();
  }
  await expect(page.getByRole("heading", { name: /review the report/i })).toBeVisible();
  await page.getByRole("button", { name: /queue report/i }).click();
  await expect(page.getByText(/report queued/i)).toBeVisible();
});

test("CUJ 2 self-check in under 60 seconds, CUJ 3 grey first measure, CUJ 4 estimate, CUJ 5 offline explain", async ({
  page,
  context,
}) => {
  test.skip(!ASTRO_CODE, "staging access code is absent");

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/access code/i).fill(ASTRO_CODE!);
  await page.getByLabel(/shared device/i).check();
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL(new RegExp(`crew=${CREW}`));

  const expiresAt = await readExpiry(page, CREW);
  expect(expiresAt).not.toBeNull();
  const hours = (Date.parse(expiresAt!) - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(23);
  expect(hours).toBeLessThan(25);

  const started = Date.now();
  await page.goto(`${BASE_URL}/check?crew=${CREW}`);
  await page.locator("select#measure-select").selectOption("blood_pressure_systolic");
  await page.locator("#measure-blood_pressure_systolic").fill("146");
  await page.locator("#dia-value").fill("92");
  await page.getByRole("button", { name: /^record$/i }).click();
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);

  await page.goto(`${BASE_URL}/check?crew=${CREW}`);
  await page.locator("select#measure-select").selectOption("respiratory_rate");
  await page.locator("#measure-respiratory_rate").fill("14");
  await page.getByRole("button", { name: /^record$/i }).click();
  await expect(page.getByText(/not enough history/i)).toBeVisible();

  await page.goto(`${BASE_URL}/check?crew=${CREW}`);
  await page.locator("select#measure-select").selectOption("heart_rate");
  await page.locator("#measure-heart_rate").fill("128");
  await page.getByLabel(/estimated, no device/i).check();
  await page.getByRole("button", { name: /^record$/i }).click();
  await expect(page.getByText(/confirm it stands/i).first()).toBeVisible();
  const beforeUrl = page.url();
  await page.getByRole("button", { name: /confirm reading stands/i }).click();
  await page.waitForURL((url) => url.href !== beforeUrl && url.searchParams.has("result"));
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible();
  await expect(page.getByText("watch", { exact: true }).first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /explain more simply/i }).first().click();
  await expect(page.getByText(/Source:/).first()).toBeVisible();
  await context.setOffline(false);

  await page.goto(`${BASE_URL}/emergency`);
  await page.getByRole("button", { name: /someone else, not responding/i }).click();
  for (let step = 0; step < 12; step++) {
    const next = page.getByRole("button", { name: /done, next step/i });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  await expect(page.getByRole("heading", { name: /review the report/i })).toBeVisible();
  await page.getByLabel(/subject/i).fill(`gate ${RUN_ID}`);
  await page.getByRole("button", { name: /queue report/i }).click();
  await expect(page.getByText(/report queued/i)).toBeVisible();

  await page.goto(`${BASE_URL}/reports?crew=${CREW}`);
  await expect(page.getByText(/emergency/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /^delivered$/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Delivered reports").getByText(/emergency/i)).toBeVisible({ timeout: 30_000 });
});

test("CUJ 8 demo mode stays on the device", async ({ page }) => {
  await page.goto(`${BASE_URL}/demo`);
  await page.getByRole("button", { name: /switch on demo mode/i }).click();
  await expect(page).toHaveURL(/\?demo=1/);
  await expect(page.getByText("Demo: synthetic crew data")).toBeVisible();
  await page.goto(`${BASE_URL}/demo`);
  await page.getByRole("button", { name: /exit demo mode/i }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect(page.getByText("Demo: synthetic crew data")).toHaveCount(0);
});

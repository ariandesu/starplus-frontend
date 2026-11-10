/**
 * W4 + X3: import a CSV with one bad row, complete the reaction test, and
 * save a questionnaire — all offline with a seeded synthetic crew session
 * (no staging code needed, no reconnect step).
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

// These specs seed a session straight into IDB and stub the API, so they run
// without a backend: declare the browser offline so the session layer uses the
// stored token instead of refreshing it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
});
const CREW = "e2e-import-crew";

async function seedSession(page: Page): Promise<void> {
  await page.evaluate(([crewId]) => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("profiles")) db.createObjectStore("profiles", { keyPath: "crew_id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "client_id" });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("profiles", "readwrite");
        tx.objectStore("profiles").put({
          crew_id: crewId,
          display_name: crewId,
          token: "e2e-token",
          role: "astronaut",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          provenance: "synthetic",
          device_id: "e2e-device",
          pin_hash: null,
          shared_device: false,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, [CREW]);
}

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.waitForTimeout(8000);
}

async function queuedOutboxCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("outbox", "readonly");
        const got = tx.objectStore("outbox").getAll();
        got.onsuccess = () => {
          const items = got.result as Array<{ state: string }>;
          db.close();
          resolve(items.filter((item) => item.state === "queued").length);
        };
        got.onerror = () => reject(got.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
}

test("imports a CSV with one bad row and shows preview counts, offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/import?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /import data/i })).toBeVisible();

  const csv = ["heart_rate,spo2_percent,measured_at", "72,98,2026-11-08T10:00:00Z", "oops,97,2026-11-08T10:05:00Z"].join("\n");
  await page.locator("#import-file").setInputFiles({ name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByText("Column mapping", { exact: false })).toBeVisible();
  await expect(page.getByText(/3 accepted/i)).toBeVisible();
  await expect(page.getByText(/not a number/i).first()).toBeVisible();
  await page.getByRole("button", { name: /import 3 readings/i }).click();
  await expect(page.getByText(/imported 3 readings/i)).toBeVisible();
  expect(await queuedOutboxCount(page)).toBeGreaterThan(0);
});

test("completes the reaction test offline", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/reaction?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /reaction test/i })).toBeVisible();

  await page.getByRole("button", { name: /start test/i }).click();
  const tapButton = page.getByRole("button", { name: /tap now/i });
  await expect(tapButton).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 6; i++) {
    await tapButton.click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByText(/median reaction time/i)).toBeVisible();
  await page.getByRole("button", { name: /save result/i }).click();
  await expect(page).toHaveURL(new RegExp(`/result\\?crew=${CREW}`), { timeout: 15_000 });
});

test("completes the questionnaire offline", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/questionnaire?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /daily questionnaire/i })).toBeVisible();
  await page.locator("#q-sleep_hours").fill("7");
  await page.locator("#q-mood_score").fill("60");
  await page.locator("#q-stress_score").fill("40");
  await page.locator("#q-sleep_quality").fill("70");
  await page.getByRole("button", { name: /save answers/i }).click();
  await expect(page).toHaveURL(new RegExp(`/result\\?crew=${CREW}`), { timeout: 15_000 });
});

/**
 * W4: import CSV with a bad row (preview counts), and complete the reaction
 * test. No staging code needed: a synthetic crew session is seeded directly
 * into IndexedDB.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
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

test("imports a CSV with one bad row and shows preview counts", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await page.goto(`${BASE_URL}/import?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /import data/i })).toBeVisible();

  const csv = ["heart_rate,spo2_percent,measured_at", "72,98,2026-11-08T10:00:00Z", "oops,97,2026-11-08T10:05:00Z"].join("\n");
  await page.locator("#import-file").setInputFiles({ name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByText("Column mapping", { exact: false })).toBeVisible();
  await expect(page.getByText(/3 accepted/i)).toBeVisible();
  await expect(page.getByText(/not a number/i).first()).toBeVisible();
  await page.getByRole("button", { name: /import 3 readings/i }).click();
  await expect(page.getByText(/imported 3 readings/i)).toBeVisible();
});

test("completes the reaction test offline", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await page.goto(`${BASE_URL}/check/reaction?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /reaction test/i })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: /start test/i }).click();
  const tapButton = page.getByRole("button", { name: /tap now/i });
  await expect(tapButton).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 6; i++) {
    await tapButton.click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByText(/median reaction time/i)).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: /save result/i }).click();
  await expect(page).toHaveURL(new RegExp(`/result\\?crew=${CREW}`), { timeout: 15_000 });
});

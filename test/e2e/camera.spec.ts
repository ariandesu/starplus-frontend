/**
 * Phase 6: the camera display page saves a typed reading, and the camera
 * heart-rate page saves a simulated signal — all offline.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const CREW = "e2e-camera-crew";

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

test("camera display saves a typed blood pressure pair offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/camera?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /camera check/i })).toBeVisible();
  await page.getByTestId("display-text").fill("120/80 mmHg");
  await expect(page.getByLabel("Metric").nth(0)).toHaveValue("blood_pressure_systolic");
  await expect(page.getByLabel("Value").nth(0)).toHaveValue("120");
  await expect(page.getByLabel("Metric").nth(1)).toHaveValue("blood_pressure_diastolic");
  await expect(page.getByLabel("Value").nth(1)).toHaveValue("80");
  await page.getByTestId("save").click();
  await expect(page).toHaveURL(new RegExp(`/result\\?crew=${CREW}`), { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

test("camera heart rate saves a simulated signal offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/camera-hr?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /camera heart rate/i })).toBeVisible();
  await page.getByTestId("simulator").click();
  await expect(page.getByTestId("estimate")).toContainText("Estimated heart rate: 72 bpm");
  await page.getByTestId("save").click();
  await expect(page).toHaveURL(new RegExp(`/result\\?crew=${CREW}`), { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

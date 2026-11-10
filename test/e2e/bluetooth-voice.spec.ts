/**
 * Y6: the Bluetooth simulator saves a BP pair offline, and the voice page is
 * greyed with its reason in browsers without speech recognition.
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
const CREW = "e2e-ble-voice-crew";

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

test("bluetooth simulator saves a blood pressure pair offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/bluetooth?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /bluetooth check/i })).toBeVisible();
  await expect(page.getByTestId("simulator")).toBeVisible();
  await page.getByTestId("simulator").click();
  await expect(page.getByText("blood_pressure_systolic: 120 mmHg").first()).toBeVisible();
  await expect(page.getByText("blood_pressure_diastolic: 80 mmHg").first()).toBeVisible();
  await page.getByTestId("save").click();
  await expect(page).toHaveURL(new RegExp(`/result\\?crew=${CREW}`), { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

test("voice page offers the mic when speech recognition exists", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/voice?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /voice check/i })).toBeVisible();
  await expect(page.getByTestId("mic")).toBeVisible();
  await context.setOffline(false);
});

test("voice page is greyed without speech recognition", async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addInitScript(() => {
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition"] as const) {
      try {
        Object.defineProperty(window, key, { value: undefined, configurable: true, writable: true });
      } catch {
        /* keep the original */
      }
    }
  });
  await page.goto(`${BASE_URL}/`);
  await seedSession(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto(`${BASE_URL}/check/voice?crew=${CREW}`);
  await expect(page.getByRole("heading", { name: /voice check/i })).toBeVisible();
  await expect(page.getByTestId("voice-unsupported")).toContainText("This browser has no speech recognition");
  await context.setOffline(false);
});

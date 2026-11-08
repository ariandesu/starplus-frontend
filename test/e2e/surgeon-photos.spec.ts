/**
 * AA3: the surgeon view shows attached photos as thumbnails, and reports a
 * 404 as an expired photo. Roles: only the sender and the flight surgeon
 * can fetch a photo (mission control and other astronauts get 403).
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const FMO = "e2e-fmo-crew";
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function seedSession(page: Page, crewId: string, role: string): Promise<void> {
  await page.evaluate(([id, crewRole]) => {
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
          crew_id: id,
          display_name: id,
          token: "e2e-token",
          role: crewRole,
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
  }, [crewId, role]);
}

const photoReport = {
  client_id: "11111111-1111-4111-8111-111111111111",
  device_id: "e2e-device",
  submitted_by: "some-crew",
  subject_crew_id: null,
  subject_label: "unknown crewmate",
  kind: "emergency",
  created_at: "2026-11-08T11:00:00Z",
  received_at: "2026-11-08T11:00:01Z",
  payload_json: JSON.stringify({
    scenario: "bleeding",
    steps: [],
    attachments: [
      { id: "e2e-photo-1", content_type: "image/png", size: 70 },
      { id: "e2e-photo-gone", content_type: "image/png", size: 70 },
    ],
  }),
  summary_text: null,
  summary_edited: 0,
  status: "delivered",
  acknowledged_by: null,
  acknowledged_at: null,
};

test("surgeon view shows photo thumbnails and expired photos", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/reports*", (route) => route.fulfill({ json: { reports: [photoReport] } }));
  await page.route("**/api/attachments/e2e-photo-1", (route) =>
    route.fulfill({ body: Buffer.from(PNG_1PX, "base64"), contentType: "image/png" })
  );
  await page.route("**/api/attachments/e2e-photo-gone", (route) => route.fulfill({ status: 404 }));

  await page.goto(`${BASE_URL}/`);
  await seedSession(page, FMO, "flight_medical_officer");
  await page.goto(`${BASE_URL}/surgeon?crew=${FMO}`);
  await expect(page.getByRole("heading", { name: /flight surgeon/i })).toBeVisible();
  await expect(page.getByTestId("photo-thumb")).toBeVisible();
  await expect(page.getByText("Photo expired (90 days)")).toBeVisible();
});

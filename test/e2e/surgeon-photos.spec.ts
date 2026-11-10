/**
 * Surgeon dashboard: the crew board lists astronauts with status and open
 * reports; the crew detail shows the timeline and attached photos, and
 * reports a 404 as an expired photo. Roles: only the sender and the flight
 * surgeon can fetch a photo (mission control and other astronauts get 403).
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
        const tx = db.transaction(["profiles", "settings"], "readwrite");
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
        tx.objectStore("settings").put({ key: "active_crew", value: id });
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

async function stubSurgeonApi(page: Page): Promise<void> {
  await page.addInitScript(
    ({ rosterJson, reportsJson, resultsJson, measurementsJson, png }) => {
      const text = (body: unknown): string => JSON.stringify(body);
      const originalFetch = window.fetch;
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (!url.includes("/api/")) return originalFetch(input as RequestInfo, init);
        if (url.includes("/api/crew/roster")) {
          return new Response(text(rosterJson), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/reports") && (!init || (init.method ?? "GET") === "GET")) {
          return new Response(text(reportsJson), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/crew/results")) {
          return new Response(text(resultsJson), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/crew/measurements")) {
          return new Response(text(measurementsJson), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/attachments/e2e-photo-1")) {
          const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
          return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers: { "Content-Type": "image/png" } });
        }
        if (url.includes("/api/attachments/e2e-photo-gone")) {
          return new Response("{}", { status: 404 });
        }
        return originalFetch(input as RequestInfo, init);
      }) as typeof window.fetch;
    },
    {
      rosterJson: roster,
      reportsJson: { reports: [photoReport] },
      resultsJson: {
        results: [detailResult],
        cursor: null,
      },
      measurementsJson: {
        measurements: [detailMeasurement, { ...detailMeasurement, client_id: "m-2" }],
        cursor: null,
      },
      png: PNG_1PX,
    }
  );
}

const roster = {
  crew: [
    {
      crew_id: "some-crew",
      name: "Some Crew",
      overall_status: "critical",
      last_check_in: "2026-11-08T12:00:00.000Z",
      checkin_days_7d: 5,
      open_reports: 1,
      vitals: [{ metric: "heart_rate", value: 182, unit: "bpm", status: "critical" }],
    },
    {
      crew_id: "some-crew-2",
      name: "No Data",
      overall_status: null,
      last_check_in: null,
      checkin_days_7d: 0,
      open_reports: 0,
      vitals: [],
    },
  ],
};

const detailResult = {
  client_id: "22222222-2222-4222-8222-222222222222",
  crew_id: "some-crew",
  assessed_at: "2026-11-08T12:00:00.000Z",
  overall_status: "critical",
  per_measure_json: JSON.stringify([
    {
      metric: "heart_rate",
      status: "critical",
      status_source: "safety_limit",
      reason_code: "limit_critical",
      values: {
        value: 182,
        unit: "bpm",
        client_id: "m-1",
        baseline_mean: null,
        baseline_n: 0,
        window_mean: null,
        z_score: null,
        trend: null,
        confirm_required: false,
        refuted: [],
      },
    },
  ]),
  model_advice_json: null,
  model_id: "none",
  model_version: "none",
  catalog_version: "1",
  kb_version: "none",
  inputs_hash: "abc",
  received_at: "2026-11-08T12:00:01Z",
};

const detailMeasurement = {
  client_id: "m-1",
  crew_id: "some-crew",
  metric: "heart_rate",
  value_num: 182,
  value_text: null,
  unit: "bpm",
  measured_at: "2026-11-08T12:00:00.000Z",
  received_at: "2026-11-08T12:00:01Z",
  source: "manual",
  device_id: "e2e-device",
  capture_id: null,
  is_estimate: 0,
  confirmed_by_user: 0,
  provenance: "synthetic",
  setting: "iss",
  phase: "inflight",
  phase_day: null,
  supersedes_client_id: null,
  voided: 0,
  catalog_version: "1",
  schema_version: 1,
};

test("surgeon dashboard shows the crew board with status and open reports", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/crew/roster*", (route) => route.fulfill({ json: roster }));
  await page.route("**/api/reports*", (route) => route.fulfill({ json: { reports: [photoReport] } }));

  await page.goto(`${BASE_URL}/login`);
  await stubSurgeonApi(page);
  await seedSession(page, FMO, "flight_medical_officer");
  await page.goto(`${BASE_URL}/surgeon`);
  await expect(page.getByRole("heading", { name: /flight surgeon/i })).toBeVisible();
  await expect(page.getByTestId("crew-card-some-crew")).toBeVisible();
  await expect(page.getByText("Some Crew", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 open report/)).toBeVisible();
  const badge = page.getByTestId("crew-card-some-crew-2").getByText("insufficient", { exact: true });
  await expect(badge).toBeVisible();
  const badgeColors = await badge.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(badgeColors.color).not.toBe(badgeColors.background);
});

test("crew detail shows the timeline, charts and photo thumbnails", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/crew/roster*", (route) => route.fulfill({ json: roster }));
  await page.route("**/api/reports*", (route) => route.fulfill({ json: { reports: [photoReport] } }));
  await page.route("**/api/crew/results*", (route) =>
    route.fulfill({ json: { results: [detailResult], cursor: null } })
  );
  await page.route("**/api/crew/measurements*", (route) =>
    route.fulfill({ json: { measurements: [detailMeasurement, { ...detailMeasurement, client_id: "m-2" }], cursor: null } })
  );
  // In-page fetch stub: on WebKit the service worker intermittently bypasses
  // page.route for attachments, so stub the photo bytes deterministically.
  await page.addInitScript((png) => {
    const originalFetch = window.fetch;
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/attachments/e2e-photo-1")) {
        const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
        return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers: { "Content-Type": "image/png" } });
      }
      if (url.includes("/api/attachments/e2e-photo-gone")) {
        return new Response("{}", { status: 404 });
      }
      return originalFetch(input as RequestInfo, init);
    }) as typeof window.fetch;
  }, PNG_1PX);

  await page.goto(`${BASE_URL}/login`);
  await stubSurgeonApi(page);
  await seedSession(page, FMO, "flight_medical_officer");
  await page.goto(`${BASE_URL}/surgeon/crew?id=some-crew`);
  await expect(page.getByRole("heading", { name: "Some Crew" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("critical", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("photo-thumb")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Photo expired (90 days)")).toBeVisible({ timeout: 30_000 });
});

test("reports inbox titles have no raw IDs", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/crew/roster*", (route) => route.fulfill({ json: roster }));
  await page.route("**/api/reports*", (route) => route.fulfill({ json: { reports: [photoReport] } }));

  await page.goto(`${BASE_URL}/login`);
  await stubSurgeonApi(page);
  await seedSession(page, FMO, "flight_medical_officer");
  await page.goto(`${BASE_URL}/surgeon/reports`);
  await expect(page.getByRole("heading", { name: /reports inbox/i })).toBeVisible();
  await expect(page.getByText("Emergency · Some Crew · 8 Nov")).toBeVisible();
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toContain("11111111-1111-4111-8111-111111111111");
  expect(body).not.toContain("some-crew");
});

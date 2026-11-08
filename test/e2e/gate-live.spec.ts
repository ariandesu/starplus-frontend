/**
 * Live Phase 2 gate against staging. Needs single-use codes in the environment:
 * STARPLUS_STAGING_CODE_ASTRO and STARPLUS_STAGING_CODE_FMO.
 * Skips entirely when they are absent. Each code works once; re-issue for reruns.
 *
 * Run: npm run build:staging && NEXT_PUBLIC_API_BASE=https://starplus-backend-staging.shareflow.workers.dev \
 *   STARPLUS_STAGING_CODE_ASTRO=<code> STARPLUS_STAGING_CODE_FMO=<code2> \
 *   npx playwright test test/e2e/gate-live.spec.ts --project=chromium
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const ASTRO_CODE = process.env.STARPLUS_STAGING_CODE_ASTRO;
const FMO_CODE = process.env.STARPLUS_STAGING_CODE_FMO;
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://starplus-backend-staging.shareflow.workers.dev";

const HOUR = 3_600_000;
let sequence = 0;
const uuid = () => `bbbbbbbb-cccc-4ddd-8eee-${String(sequence++).padStart(12, "0")}`;

let api: APIRequestContext;
let astroToken = "";
let fmoToken = "";
let reportId = "";

test.beforeAll(async ({ playwright }) => {
  test.skip(!ASTRO_CODE || !FMO_CODE, "staging access codes are absent");
  api = await playwright.request.newContext({ baseURL: BASE_URL });
});

test.afterAll(async () => {
  await api?.dispose();
});

test("astronaut login with shared:true gives a 24-hour session", async () => {
  const res = await api.post("/api/auth", {
    data: { code: ASTRO_CODE, device_id: "gate-rig", shared: true },
  });
  expect(res.status()).toBe(200);
  const session = (await res.json()) as { token: string; crew_id: string; expires_at: string };
  expect(session.crew_id).toBe("stg-astro-1");
  astroToken = session.token;
  const ttlHours = (Date.parse(session.expires_at) - Date.now()) / HOUR;
  expect(ttlHours).toBeGreaterThan(23);
  expect(ttlHours).toBeLessThan(25);
});

test("a self-check batch is accepted and syncs back", async () => {
  const measurement = {
    client_id: uuid(),
    crew_id: "stg-astro-1",
    metric: "heart_rate",
    value_num: 72,
    value_text: null,
    unit: "bpm",
    measured_at: new Date().toISOString(),
    received_at: "",
    source: "manual",
    device_id: "gate-rig",
    capture_id: null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: "real",
    setting: "iss",
    phase: "inflight",
    phase_day: 21,
    supersedes_client_id: null,
    voided: 0,
    catalog_version: "1",
    schema_version: 1,
  };
  const result = {
    client_id: uuid(),
    crew_id: "stg-astro-1",
    assessed_at: new Date().toISOString(),
    overall_status: "nominal",
    per_measure: [],
    model_advice: null,
    model_id: "none",
    model_version: "none",
    catalog_version: "1",
    kb_version: "none",
    inputs_hash: "gate",
    received_at: "",
  };
  const batch = await api.post("/api/measurements/batch", {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { schema_version: 1, catalog_version: "1", items: [measurement], results: [result] },
  });
  expect(batch.status()).toBe(200);
  const body = (await batch.json()) as { accepted: string[]; rejected: unknown[] };
  expect(body.rejected).toHaveLength(0);
  expect(body.accepted).toContain(measurement.client_id);

  const sync = await api.get("/api/sync", { headers: { Authorization: `Bearer ${astroToken}` } });
  expect(sync.status()).toBe(200);
  const synced = (await sync.json()) as { measurements: Array<{ client_id: string }> };
  expect(synced.measurements.map((m) => m.client_id)).toContain(measurement.client_id);
});

test("an emergency report is delivered", async () => {
  reportId = uuid();
  const posted = await api.post("/api/reports", {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: {
      client_id: reportId,
      device_id: "gate-rig",
      subject_crew_id: null,
      subject_label: "unknown crewmate",
      kind: "emergency",
      created_at: new Date().toISOString(),
      payload_json: { steps: [{ at: new Date().toISOString(), text: "gate check" }] },
    },
  });
  expect([200, 201]).toContain(posted.status());
});

test("the flight surgeon sees the report", async () => {
  const res = await api.post("/api/auth", {
    data: { code: FMO_CODE, device_id: "gate-rig" },
  });
  expect(res.status()).toBe(200);
  const session = (await res.json()) as { token: string; crew_id: string };
  expect(session.crew_id).toBe("stg-fmo-1");
  fmoToken = session.token;

  const listed = await api.get("/api/reports", {
    headers: { Authorization: `Bearer ${fmoToken}` },
  });
  expect(listed.status()).toBe(200);
  const body = (await listed.json()) as { reports: Array<{ client_id: string }> };
  expect(body.reports.map((report) => report.client_id)).toContain(reportId);
});

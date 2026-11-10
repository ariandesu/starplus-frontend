/**
 * The demo login survives rate limiting. Sign-in is stubbed at the fetch level
 * (page.route interception is unreliable under a service worker on some
 * browsers), so these run anywhere without a backend.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

const DEMO_USER = {
  id: "e2e-user",
  name: "Alex Rivera",
  email: "astronaut01@demo.starplus.local",
  emailVerified: true,
  username: "astronaut01",
  crew_id: "demo-astronaut",
  role: "astronaut",
  provenance: "synthetic",
  demo: true,
};

type StubMode = "flaky-once" | "always-429" | "count-only";

async function installDemoStub(page: import("@playwright/test").Page, mode: StubMode): Promise<void> {
  await page.addInitScript(
    ({ stubMode, user }: { stubMode: StubMode; user: unknown }) => {
      const state = { calls: 0 };
      (window as unknown as Record<string, unknown>).__demoStub = state;
      const originalFetch = window.fetch.bind(window);
      const sessionBody = () => ({
        user,
        session: { id: "e2e-session", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() },
      });
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method);
        if (url.includes("/api/auth/sign-in/username") && method.toUpperCase() === "POST") {
          state.calls += 1;
          if (stubMode === "always-429" || (stubMode === "flaky-once" && state.calls === 1)) {
            return new Response("{}", { status: 429, headers: { "Retry-After": "1" } });
          }
          if (stubMode === "flaky-once") {
            return new Response(JSON.stringify({ user, token: "e2e-demo-token" }), {
              status: 200,
              headers: { "Content-Type": "application/json", "set-auth-token": "e2e-demo-token" },
            });
          }
        }
        if (url.includes("/api/auth/get-session")) {
          return new Response(JSON.stringify(sessionBody()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/sync")) {
          return new Response(
            JSON.stringify({
              measurements: [],
              results: [],
              reports: [],
              reports_status: [],
              measurements_cursor: null,
              results_cursor: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input as RequestInfo, init);
      }) as typeof fetch;
    },
    { stubMode: mode, user: DEMO_USER }
  );
}

async function demoCalls(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () => ((window as unknown as Record<string, { calls: number } | undefined>).__demoStub?.calls ?? -1)
  );
}

test("a stubbed 429 shows the rate-limit error, then Login works", async ({ page }) => {
  test.setTimeout(120_000);
  await installDemoStub(page, "flaky-once");
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText(/too many tries/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  expect(await demoCalls(page)).toBe(2);
});

test("a permanent 429 keeps the error visible and the form usable", async ({ page }) => {
  test.setTimeout(120_000);
  await installDemoStub(page, "always-429");
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText(/too many tries/i)).toBeVisible({ timeout: 30_000 });
  expect(await demoCalls(page)).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeEnabled();
});

test("?demo= reuses a live demo session without a new request", async ({ page }) => {
  test.setTimeout(120_000);
  await installDemoStub(page, "count-only");
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
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
          crew_id: "demo-astronaut",
          display_name: "Alex Rivera",
          token: "e2e-demo-token",
          role: "astronaut",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          provenance: "synthetic",
          device_id: "e2e-device",
          pin_hash: null,
          shared_device: false,
          demo: true,
          username: "astronaut01",
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  await page.goto(`${BASE_URL}/login?demo=astronaut`);
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  expect(await demoCalls(page)).toBe(0);
});

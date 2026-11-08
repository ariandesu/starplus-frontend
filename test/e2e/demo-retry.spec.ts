/**
 * EE1: the demo login survives rate limiting. The demo call is stubbed at
 * the fetch level (page.route interception is unreliable under a service
 * worker on some browsers), so these run anywhere without a backend.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

const DEMO_SESSION = {
  token: "e2e-demo-token",
  crew_id: "demo-astronaut",
  role: "astronaut",
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  provenance: "synthetic",
  demo: true,
};

type StubMode = "flaky-once" | "always-429" | "count-only";

async function installDemoStub(page: import("@playwright/test").Page, mode: StubMode): Promise<void> {
  await page.addInitScript(
    ({ stubMode, session }: { stubMode: StubMode; session: unknown }) => {
      const state = { calls: 0 };
      (window as unknown as Record<string, unknown>).__demoStub = state;
      (window as unknown as Record<string, unknown>).__demoSession = session;
      const originalFetch = window.fetch.bind(window);
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method);
        if (url.includes("/api/auth/demo") && method.toUpperCase() === "POST") {
          state.calls += 1;
          if (stubMode === "always-429" || (stubMode === "flaky-once" && state.calls === 1)) {
            return new Response("{}", { status: 429, headers: { "Retry-After": "1" } });
          }
          if (stubMode === "flaky-once") {
            return new Response(JSON.stringify((window as unknown as Record<string, unknown>).__demoSession), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
        return originalFetch(input as RequestInfo, init);
      }) as typeof fetch;
    },
    { stubMode: mode, session: DEMO_SESSION }
  );
}

async function demoCalls(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () => ((window as unknown as Record<string, { calls: number } | undefined>).__demoStub?.calls ?? -1)
  );
}

test("a stubbed 429 shows retrying, then lands home", async ({ page }) => {
  test.setTimeout(120_000);
  await installDemoStub(page, "flaky-once");
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("demo-astronaut").click();
  await expect(page.getByText(/lots of people are trying the demo/i)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  expect(await demoCalls(page)).toBe(2);
});

test("a permanent 429 shows the error and a Try again button", async ({ page }) => {
  test.setTimeout(120_000);
  await installDemoStub(page, "always-429");
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("demo-astronaut").click();
  await expect(page.getByText(/lots of people are trying the demo/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible({ timeout: 30_000 });
  expect(await demoCalls(page)).toBeGreaterThanOrEqual(4);
  await expect(page.getByText(/still busy/i)).toBeVisible();
  await page.getByRole("button", { name: /try again/i }).click();
  await expect.poll(() => demoCalls(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(8);
  await expect(page.getByText(/still busy/i)).toBeVisible({ timeout: 30_000 });
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
          display_name: "demo-astronaut",
          token: "e2e-demo-token",
          role: "astronaut",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          provenance: "synthetic",
          device_id: "e2e-device",
          pin_hash: null,
          shared_device: false,
          demo: true,
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

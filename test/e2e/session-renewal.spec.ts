/**
 * Better Auth session renewal: the three role cards, one-tap demo links,
 * silent demo re-sign-in after expiry, the real "session ended" view, the
 * access-code redeem flow, and the network-first service worker.
 *
 * The demo tests need the demo backend (DEMO_LOGIN=on, DEMO_PASSWORD set at
 * build time). The redeem test also needs an admin key and skips without it.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const API_BASE = process.env.API_BASE ?? "http://localhost:8787";
const ADMIN_KEY = process.env.E2E_API_KEY ?? "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

async function demoAvailable(page: Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible();
  return DEMO_PASSWORD.length > 0 && (await page.getByTestId("demo-card-astronaut").count()) > 0;
}

async function seedExpiredProfile(
  page: Page,
  profile: { crewId: string; role: string; demo: boolean; username: string }
): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate((entry) => {
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
          crew_id: entry.crewId,
          display_name: entry.demo ? "Alex Rivera" : "Real Crew",
          token: "expired-token",
          role: entry.role,
          expires_at: "2000-01-01T00:00:00.000Z",
          provenance: entry.demo ? "synthetic" : "real",
          device_id: "e2e-device",
          pin_hash: null,
          shared_device: false,
          demo: entry.demo,
          username: entry.username,
        });
        tx.objectStore("settings").put({ key: "active_crew", value: entry.crewId });
        tx.objectStore("settings").put({ key: "last_active", value: new Date().toISOString() });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, profile);
}

test("each role card fills the login and lands on the right home", async ({ page }) => {
  test.setTimeout(180_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");

  // Astronaut: card fills username + password, Login lands on Today.
  await page.getByTestId("demo-card-astronaut").click();
  await expect(page.locator("#username")).toHaveValue("astronaut01");
  await expect(page.locator("#password")).toHaveValue(DEMO_PASSWORD);
  await expect(page.getByTestId("toggle-password")).toContainText("Show");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 60_000 });

  // Flight Medical Officer: the surgeon dashboard with four crew cards.
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("demo-card-fmo").click();
  await expect(page.locator("#username")).toHaveValue("fmo01");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/surgeon/, { timeout: 60_000 });
  await expect(page.locator('[data-testid^="crew-card-"]')).toHaveCount(4, { timeout: 60_000 });

  // Mission Control: same dashboard.
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("demo-card-mission").click();
  await expect(page.locator("#username")).toHaveValue("mc01");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/surgeon/, { timeout: 60_000 });
  await expect(page.locator('[data-testid^="crew-card-"]')).toHaveCount(4, { timeout: 60_000 });
});

test("/login?demo=surgeon opens the dashboard with no tap", async ({ page }) => {
  test.setTimeout(120_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await page.goto(`${BASE_URL}/login?demo=surgeon`);
  await expect(page).toHaveURL(/\/surgeon/, { timeout: 60_000 });
  await expect(page.locator('[data-testid^="crew-card-"]')).toHaveCount(4, { timeout: 60_000 });
});

test("an expired demo session re-signs in silently and shows history", async ({ page }) => {
  test.setTimeout(180_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await seedExpiredProfile(page, {
    crewId: "demo-astronaut",
    role: "astronaut",
    demo: true,
    username: "astronaut01",
  });
  await page.goto(`${BASE_URL}/history?crew=demo-astronaut`);
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 60_000 });
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toContain("Log in to continue");
  expect(body).not.toContain("Your session");
});

test("an expired real session shows the ended view with a prefilled sign-in", async ({ page }) => {
  test.setTimeout(120_000);
  await seedExpiredProfile(page, {
    crewId: "real-e2e-crew",
    role: "astronaut",
    demo: false,
    username: "real_member",
  });
  await page.goto(`${BASE_URL}/history?crew=real-e2e-crew`);
  await expect(page.getByTestId("session-expired")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/your session for real crew ended/i)).toBeVisible();
  await page.getByRole("link", { name: "Sign in again" }).click();
  await expect(page).toHaveURL(/\/login\?username=real_member/, { timeout: 15_000 });
  await expect(page.locator("#username")).toHaveValue("real_member");
});

test("redeem an access code, then log out and back in with it", async ({ page, request }) => {
  test.setTimeout(180_000);
  test.skip(!ADMIN_KEY, "needs E2E_API_KEY for the admin API");
  const crewId = `e2e-redeem-${Date.now()}`;
  const username = `e2e_member_${Date.now()}`;
  const password = "redeem-password-123";

  const crew = await request.post(`${API_BASE}/api/admin/crew`, {
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    data: { id: crewId, name: "Redeem Crew", role: "astronaut", provenance: "real" },
  });
  expect(crew.status()).toBe(201);
  const issued = await request.post(`${API_BASE}/api/admin/codes`, {
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    data: { crew_id: crewId },
  });
  expect(issued.status()).toBe(201);
  const { code } = (await issued.json()) as { code: string };

  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId("show-redeem").click();
  await page.locator("#access-code").fill(code);
  await page.locator("#redeem-username").fill(username);
  await page.locator("#redeem-password").fill(password);
  await page.getByRole("button", { name: "Redeem and sign in" }).click();
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 60_000 });

  const openMenu = page.getByRole("button", { name: /open menu/i });
  if ((await openMenu.count()) > 0) await openMenu.click();
  await page
    .locator('aside[aria-label="Main navigation"]')
    .getByRole("button", { name: "Log out", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 60_000 });
});

test("the service worker serves the network first and cached pages offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible();

  // Simulate a stale build in every cache entry for /login. Network-first must
  // still show the live page; a cache-first worker would show the stale copy.
  await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (!new URL(request.url).pathname.endsWith("/login")) continue;
        const response = await cache.match(request);
        if (!response) continue;
        const html = (await response.text()).replace("Select your mission role", "STALE-CACHED-BUILD");
        await cache.put(request, new Response(html, { headers: { "Content-Type": "text/html" } }));
      }
    }
  });

  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByText(/STALE-CACHED-BUILD/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible();

  // Offline still loads the cached page.
  await context.setOffline(true);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});

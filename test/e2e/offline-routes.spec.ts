/**
 * K1: offline navigations serve the precached page by path, whatever the query.
 * Installs the service worker from / only, then loads routes it has never seen
 * (fresh random queries), plus the in-app-navigation path to the self-check page.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const RUN = typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : "run1";

const ROUTES: Array<{ path: string; shows: RegExp }> = [
  { path: "/", shows: /STAR PLUS self-check/ },
  { path: "/login", shows: /Log in/ },
  { path: "/check", shows: /Go to login/ },
  { path: `/check?crew=probe-${RUN}`, shows: /Go to login/ },
  { path: "/result", shows: /Loading/ },
  { path: `/result?crew=probe-${RUN}&result=probe`, shows: /Loading/ },
  { path: "/reports", shows: /Reports/ },
  { path: `/reports?crew=probe-${RUN}`, shows: /Reports/ },
  { path: "/emergency", shows: /Emergency/ },
  { path: "/history", shows: /Go to login/ },
  { path: `/history?crew=probe-${RUN}`, shows: /History/ },
  { path: "/surgeon", shows: /Flight surgeon/ },
  { path: `/surgeon?crew=probe-${RUN}`, shows: /Flight surgeon/ },
  { path: "/settings", shows: /Settings/ },
  { path: "/demo", shows: /Demo mode/ },
];

async function waitForPrecachedResult(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(8000);
}

test("offline loads never-visited query URLs from the precache", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByRole("heading", { name: /STAR PLUS self-check/i })).toBeVisible();
  await waitForPrecachedResult(page);

  await context.setOffline(true);
  for (const route of ROUTES) {
    if (new URL(page.url()).pathname + new URL(page.url()).search !== route.path) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "commit" });
      await page.waitForURL(`${BASE_URL}${route.path}`, { timeout: 5_000 });
    }
    // Let hydration settle before asserting content.
    await page.waitForTimeout(1500);
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 10_000 });
  }
  await context.setOffline(false);
});

test("offline reload after in-app navigation to the self-check page", async ({ page, context }) => {
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByRole("heading", { name: /STAR PLUS self-check/i })).toBeVisible();
  await page.getByRole("button", { name: /open menu/i }).click();
  await page.getByRole("link", { name: /^self-check$/i }).click();
  await expect(page.getByText(/Go to login/i)).toBeVisible();
  await waitForPrecachedResult(page);

  await context.setOffline(true);
  await page.reload({ waitUntil: "commit" });
  await expect(page.getByText(/Go to login/i)).toBeVisible({ timeout: 10_000 });
  await context.setOffline(false);
});

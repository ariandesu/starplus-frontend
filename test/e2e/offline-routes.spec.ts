/**
 * K1: every app route loads offline, with and without a query string.
 * No login needed; runs against the local production build.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

const ROUTES: Array<{ path: string; shows: RegExp }> = [
  { path: "/", shows: /STAR PLUS self-check/ },
  { path: "/login", shows: /Log in/ },
  { path: "/check", shows: /Go to login/ },
  { path: "/check?crew=x", shows: /Go to login/ },
  { path: "/result", shows: /Loading/ },
  { path: "/result?crew=x&result=y", shows: /Loading/ },
  { path: "/reports", shows: /Reports/ },
  { path: "/reports?crew=x", shows: /Reports/ },
  { path: "/emergency", shows: /Emergency/ },
  { path: "/history", shows: /Go to login/ },
  { path: "/history?crew=x", shows: /History/ },
  { path: "/surgeon", shows: /Flight surgeon/ },
  { path: "/surgeon?crew=x", shows: /Flight surgeon/ },
  { path: "/settings", shows: /Settings/ },
  { path: "/demo", shows: /Demo mode/ },
];

test("every route loads with and without a query string, online and offline", async ({ page, context }) => {
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByRole("heading", { name: /STAR PLUS self-check/i })).toBeVisible();
  await page.waitForTimeout(8000);

  for (const route of ROUTES) {
    await page.goto(`${BASE_URL}${route.path}`);
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 10_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 10_000 });
    await context.setOffline(false);
  }
});

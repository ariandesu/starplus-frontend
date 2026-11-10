/**
 * Demo parity (staging, DEMO_LOGIN=on): the demo shows everything a real
 * astronaut and flight surgeon see — dashboard with 4 crew, Mia first;
 * Mia detail with timeline, charts, emergency photo, ack clearing the badge;
 * inbox without raw IDs; astronaut screens populated with progress > 0 and
 * no "synthetic" text except the banner; dashboard works offline.
 * Skips cleanly wherever the demo box is absent.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function demoAvailable(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible();
  return (await page.getByTestId("demo-card-astronaut").count()) > 0;
}

async function loginSurgeon(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(`${BASE_URL}/login?demo=surgeon`);
  await expect(page).toHaveURL(/\/surgeon/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
}

async function loginAstronaut(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(`${BASE_URL}/login?demo=astronaut`);
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(page.getByText(/loading demo history/i)).toBeHidden({ timeout: 60_000 });
}

test("role switch keeps the newest login active across astronaut and surgeon", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");

  await loginAstronaut(page);
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 30_000 });

  await loginSurgeon(page);
  await page.goto(`${BASE_URL}/surgeon`);
  await expect(page.getByTestId("crew-card-demo-crew-3")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("crew-card-demo-crew-3")).toContainText("critical");

  await loginAstronaut(page);
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 30_000 });
  const openMenu = page.getByRole("button", { name: /open menu/i });
  if ((await openMenu.count()) > 0) await openMenu.click();
  await page.locator('aside[aria-label="Main navigation"]').getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 30_000 });
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toContain("Log in to see history");
});

test("surgeon dashboard shows four crew cards, Mia first", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await loginSurgeon(page);

  await page.goto(`${BASE_URL}/surgeon`);
  await expect(page.getByRole("heading", { name: /flight surgeon/i })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-testid^="crew-card-"]')).toHaveCount(4, { timeout: 60_000 });
  for (const id of ["demo-astronaut", "demo-crew-2", "demo-crew-3", "demo-crew-4"]) {
    await expect(page.getByTestId(`crew-card-${id}`)).toBeVisible({ timeout: 60_000 });
  }
  const cards = page.locator('[data-testid^="crew-card-"]');
  await expect(cards.first()).toContainText("Mia Chen");
  await expect(page.getByTestId("crew-card-demo-crew-3")).toContainText("critical");
  await expect(page.getByTestId("crew-card-demo-crew-3")).toContainText("SpO2");
  await expect(page.getByTestId("crew-card-demo-crew-3")).toContainText("88");
  const names = ["Alex Rivera", "Sam Okafor", "Mia Chen", "Leo Haas"];
  for (const name of names) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toContain("demo-astronaut");
  expect(body).not.toContain("demo-crew-");
});

test("Mia detail shows timeline, charts and the emergency photo; ack clears the badge", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await loginSurgeon(page);

  await page.goto(`${BASE_URL}/surgeon/crew?id=demo-crew-3`);
  await expect(page.getByRole("heading", { name: "Mia Chen" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("critical", { exact: true }).first()).toBeVisible();
  await expect(page.locator("svg").first()).toBeVisible();
  const thumb = page.getByTestId("photo-thumb").first();
  await expect(thumb).toBeVisible({ timeout: 60_000 });
  expect(await thumb.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await page.goto(`${BASE_URL}/surgeon`);
  await expect(page.getByTestId("crew-card-demo-crew-3")).toContainText("open report", { timeout: 30_000 });
  await page.goto(`${BASE_URL}/surgeon/crew?id=demo-crew-3`);
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(2, { timeout: 30_000 });
  for (let i = 0; i < 3; i++) {
    const ack = page.getByRole("button", { name: "Acknowledge" });
    if ((await ack.count()) === 0) break;
    await ack.first().click();
    await page.waitForTimeout(1500);
  }
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(0, { timeout: 30_000 });
  await page.goto(`${BASE_URL}/surgeon`);
  await expect(page.getByTestId("crew-card-demo-crew-3")).not.toContainText("open report", { timeout: 30_000 });
});

test("acknowledgement is per session: a new login still sees the emergency open", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await loginSurgeon(page);

  await page.goto(`${BASE_URL}/surgeon/crew?id=demo-crew-3`);
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(2, { timeout: 60_000 });
  await page.getByRole("button", { name: "Acknowledge" }).first().click();
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(1, { timeout: 30_000 });

  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["profiles", "settings"], "readwrite");
        tx.objectStore("profiles").delete("demo-surgeon");
        tx.objectStore("settings").put({ key: "active_crew", value: "" });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  await page.goto(`${BASE_URL}/login?demo=surgeon`);
  await expect(page).toHaveURL(/\/surgeon/, { timeout: 30_000 });
  await page.goto(`${BASE_URL}/surgeon/crew?id=demo-crew-3`);
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(2, { timeout: 60_000 });
});

test("reports inbox has titles with crew names and no raw IDs", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await loginSurgeon(page);

  await page.goto(`${BASE_URL}/surgeon/reports`);
  await expect(page.getByRole("heading", { name: /reports inbox/i })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByText("Emergency · Mia Chen ·").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('section[aria-label="Reports inbox"] li')).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByText(/Routine · Mia Chen ·/).first()).toBeVisible();
  await expect(page.getByText(/Routine · Alex Rivera ·/).first()).toBeVisible();
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toContain("seed-demo-report");
  expect(body).not.toContain("demo-crew-");
  expect(body).not.toContain("demo-astronaut");
});

test("astronaut sees every screen populated, progress above zero, one banner", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await loginAstronaut(page);

  const screens: Array<{ path: string; shows: RegExp }> = [
    { path: "/", shows: /today/i },
    { path: "/check", shows: /what are you measuring/i },
    { path: "/history", shows: /^history$/i },
    { path: "/body", shows: /body map/i },
    { path: "/progress", shows: /^progress$/i },
    { path: "/reports", shows: /^reports$/i },
    { path: "/medicines", shows: /^medicines$/i },
    { path: "/settings", shows: /^settings$/i },
  ];
  for (const screen of screens) {
    await page.goto(`${BASE_URL}${screen.path}`);
    await expect(page.getByText(screen.shows).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("demo-banner")).toHaveText("Demo: synthetic crew data", { timeout: 30_000 });
    const texts = await page.getByText(/synthetic/i).all();
    expect(texts).toHaveLength(1);
  }

  await page.goto(`${BASE_URL}/progress`);
  await expect(page.getByText(/100% of expected/).first()).toBeVisible({ timeout: 30_000 });
  await page.goto(`${BASE_URL}/reports`);
  await expect(page.getByText(/Routine · .* · acknowledged/).first()).toBeVisible({ timeout: 30_000 });
});

test("offline: the surgeon dashboard loads from cache", async ({ page, context }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await loginSurgeon(page);

  await page.goto(`${BASE_URL}/surgeon`);
  await expect(page.getByTestId("crew-card-demo-crew-3")).toBeVisible({ timeout: 60_000 });
  await page.goto(`${BASE_URL}/surgeon/crew?id=demo-crew-3`);
  await expect(page.getByRole("heading", { name: "Mia Chen" })).toBeVisible({ timeout: 60_000 });

  await context.setOffline(true);
  await page.goto(`${BASE_URL}/surgeon`, { waitUntil: "commit" });
  await expect(page.getByTestId("crew-card-demo-crew-3")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/last updated/i).first()).toBeVisible();
  await page.goto(`${BASE_URL}/surgeon/crew?id=demo-crew-3`, { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Mia Chen" })).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});

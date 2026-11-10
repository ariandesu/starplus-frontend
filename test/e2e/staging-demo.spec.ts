/**
 * Demo login end to end (staging with DEMO_LOGIN=on and seeded demo data).
 * Skips cleanly wherever the demo box is absent (e.g. local runs without
 * the flag). The auditor runs this against staging after seeding.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function demoAvailable(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible();
  return (await page.getByTestId("demo-card-astronaut").count()) > 0;
}

async function resultIdAtOffset(page: import("@playwright/test").Page, crewId: string, offsetFromLatest: number): Promise<string> {
  return page.evaluate(
    ([id, offset]) => {
      return new Promise<string>((resolve, reject) => {
        const open = indexedDB.open(`starplus-${id}`);
        open.onsuccess = () => {
          const tx = open.result.transaction("results", "readonly");
          const got = tx.objectStore("results").getAll();
          got.onsuccess = () => {
            const rows = (got.result as Array<{ client_id: string; assessed_at: string }>).sort((a, b) =>
              a.assessed_at < b.assessed_at ? 1 : -1
            );
            open.result.close();
            if (rows.length <= offset) reject(new Error("not enough results stored"));
            else resolve(rows[offset].client_id);
          };
          got.onerror = () => reject(got.error);
        };
        open.onerror = () => reject(open.error);
      });
    },
    [crewId, offsetFromLatest] as const
  );
}

test("demo astronaut sees pre-filled history and opens the latest result", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");

  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(page.getByText(/loading demo history/i)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText(/overall:/i)).toBeVisible({ timeout: 30_000 });

  await page.goto(`${BASE_URL}/history?crew=demo-astronaut`);
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/baseline band/i).first()).toBeVisible();

  const resultId = await resultIdAtOffset(page, "demo-astronaut", 0);
  await page.goto(`${BASE_URL}/result?crew=demo-astronaut&result=${encodeURIComponent(resultId)}`);
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("watch", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/at or beyond a watch limit/i).first()).toBeVisible();
  await expect(page.getByText(/source:/i).first()).toBeVisible();
  await expect(page.getByText(/explain more simply/i).first()).toBeVisible();

  const criticalId = await resultIdAtOffset(page, "demo-astronaut", 2);
  await page.goto(`${BASE_URL}/result?crew=demo-astronaut&result=${encodeURIComponent(criticalId)}`);
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("critical", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/at or beyond a critical limit/i).first()).toBeVisible();

  await page.goto(`${BASE_URL}/reports`);
  await expect(page.getByRole("heading", { name: /^reports$/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('ul[aria-label="Delivered reports"] li')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByText(/Routine · .* · acknowledged/).first()).toBeVisible();
  const deliveredBody = (await page.textContent("body")) ?? "";
  expect(deliveredBody).not.toContain("seed-demo-report");
  expect(deliveredBody).not.toContain("demo-astronaut");
});

test("demo flight surgeon sees the dashboard with four crew cards", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");

  await page.goto(`${BASE_URL}/login?demo=surgeon`);
  await expect(page).toHaveURL(/\/surgeon/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();

  await page.goto(`${BASE_URL}/surgeon?crew=demo-surgeon`);
  await expect(page.getByRole("heading", { name: /flight surgeon/i })).toBeVisible();
  await expect(page.getByTestId("crew-card-demo-astronaut")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("crew-card-demo-crew-2")).toBeVisible();
  await expect(page.getByTestId("crew-card-demo-crew-3")).toBeVisible();
  await expect(page.getByTestId("crew-card-demo-crew-4")).toBeVisible();
  await expect(page.getByText("Mia Chen", { exact: true })).toBeVisible();
});

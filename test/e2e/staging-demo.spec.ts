/**
 * Demo login end to end (staging with DEMO_LOGIN=on and seeded demo data).
 * Skips cleanly wherever the demo box is absent (e.g. local runs without
 * the flag). The auditor runs this against staging after seeding.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function demoAvailable(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
  return (await page.getByTestId("demo-astronaut").count()) > 0;
}

async function latestResultId(page: import("@playwright/test").Page, crewId: string): Promise<string> {
  return page.evaluate(([id]) => {
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
          if (rows.length === 0) reject(new Error("no results stored"));
          else resolve(rows[0].client_id);
        };
        got.onerror = () => reject(got.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, [crewId]);
}

test("demo astronaut sees pre-filled history and opens the latest result", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");

  await page.getByTestId("demo-astronaut").click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(page.getByText(/loading demo history/i)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText(/overall:/i)).toBeVisible({ timeout: 30_000 });

  await page.goto(`${BASE_URL}/history?crew=demo-astronaut`);
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/baseline band/i).first()).toBeVisible();

  const resultId = await latestResultId(page, "demo-astronaut");
  await page.goto(`${BASE_URL}/result?crew=demo-astronaut&result=${encodeURIComponent(resultId)}`);
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("critical", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/at or beyond a critical limit/i).first()).toBeVisible();
  await expect(page.getByText(/source:/i).first()).toBeVisible();
  await expect(page.getByText(/explain more simply/i).first()).toBeVisible();
});

test("demo flight surgeon sees reports with a loaded photo", async ({ page }) => {
  test.setTimeout(300_000);
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");

  await page.goto(`${BASE_URL}/login?demo=surgeon`);
  await expect(page).toHaveURL(/crew=demo-surgeon/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();

  await page.goto(`${BASE_URL}/surgeon?crew=demo-surgeon`);
  await expect(page.getByRole("heading", { name: /flight surgeon/i })).toBeVisible();
  const thumb = page.getByTestId("photo-thumb").first();
  await expect(thumb).toBeVisible({ timeout: 60_000 });
  expect(await thumb.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

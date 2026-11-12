/**
 * Live AI consultancy (staging, demo astronaut): the medicine explainer is
 * fetched once then served from the device, and Q&A answers with a citation.
 * Needs the staging backend deployed with META_MODEL_API_KEY. Each browser
 * context is a fresh device, so the 10/hour budget is never a problem here.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function demoAvailable(page: Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("heading", { name: /select your mission role/i })).toBeVisible({ timeout: 30_000 });
  return (await page.getByTestId("demo-card-astronaut").count()) > 0;
}

async function loginDemoAstronaut(page: Page) {
  if (!(await demoAvailable(page))) test.skip(true, "demo login is switched off here");
  await page.getByTestId("demo-card-astronaut").click();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/crew=demo-astronaut/, { timeout: 30_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
}

async function latestResultId(page: Page): Promise<string> {
  return page.evaluate(() => {
    return new Promise<string>((resolve, reject) => {
      const open = indexedDB.open("starplus-demo-astronaut");
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
  });
}

test("medicine explainer fetches once, then serves the stored reply", async ({ page }) => {
  test.setTimeout(300_000);
  await loginDemoAstronaut(page);

  await page.goto(`${BASE_URL}/medicines?crew=demo-astronaut`);
  await expect(page.getByRole("heading", { name: /^medicines$/i })).toBeVisible({ timeout: 30_000 });
  const explainer = page.getByText("What is this?", { exact: true }).first();
  await explainer.scrollIntoViewIfNeeded();
  await explainer.click();
  await expect(page.getByText(/loading the explanation/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/loading the explanation/i).first()).toBeHidden({ timeout: 120_000 });
  await expect(page.getByText(/source:/i).first()).toBeVisible();
  await expect(page.getByText(/kept on this device/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /^medicines$/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saved on this device", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});

test("ask about your result answers with a citation", async ({ page }) => {
  test.setTimeout(300_000);
  await loginDemoAstronaut(page);
  await expect(page.getByText(/loading demo history/i)).toBeHidden({ timeout: 60_000 });

  const resultId = await latestResultId(page);
  await page.goto(`${BASE_URL}/result?crew=demo-astronaut&result=${encodeURIComponent(resultId)}`);
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 30_000 });

  await page.getByText("Ask about your result", { exact: true }).first().click();
  await page.locator("input[id^='ask-']").first().fill("Why does this measure matter?");
  await page.getByRole("button", { name: /^ask$/i }).click();
  await expect(page.getByText(/asking/i).first()).toBeHidden({ timeout: 120_000 });
  await expect(page.getByText(/source:/i).first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/the cited source above rules/i).first()).toBeVisible();
});

test("offline ask shows the unavailable message, not a failure", async ({ page, context }) => {
  test.setTimeout(300_000);
  await loginDemoAstronaut(page);
  const resultId = await latestResultId(page);
  await context.setOffline(true);
  try {
    await page.goto(`${BASE_URL}/result?crew=demo-astronaut&result=${encodeURIComponent(resultId)}`);
    await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 30_000 });
    await page.getByText("Ask about your result", { exact: true }).first().click();
    await page.locator("input[id^='ask-']").first().fill("Why does this measure matter?");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByText(/you are offline/i).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.setOffline(false);
  }
});

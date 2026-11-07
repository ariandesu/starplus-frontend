import { expect, test } from "@playwright/test";

test("CUJ 1 works with the network off", async ({ page, context }) => {
  await page.goto("/emergency");
  await expect(page.getByRole("heading", { name: /emergency/i })).toBeVisible();
  await page.waitForTimeout(3000);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /emergency/i })).toBeVisible();

  await page.getByRole("button", { name: /someone else, not responding/i }).click();
  await expect(page.getByText(/step 1 of 8/i)).toBeVisible();

  for (let step = 1; step <= 8; step++) {
    await page.getByRole("button", { name: /done, next step/i }).click();
  }
  await expect(page.getByRole("heading", { name: /review the report/i })).toBeVisible();

  await page.getByRole("button", { name: /queue report/i }).click();
  await expect(page.getByText(/report queued/i)).toBeVisible();
  await expect(page.getByText(/will send when the link returns/i)).toBeVisible();
});

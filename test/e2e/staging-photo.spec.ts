/**
 * BB1: end to end without mocks, gated on staging codes. The astronaut sends
 * an emergency report with a photo to staging; the flight surgeon opens the
 * surgeon view and sees a loaded thumbnail (naturalWidth > 0), which proves
 * the attachment GET carries working CORS headers. Skips without codes.
 */
import { expect, test } from "@playwright/test";

const ASTRO_CODE = process.env.STARPLUS_STAGING_CODE_ASTRO;
const FMO_CODE = process.env.STARPLUS_STAGING_CODE_FMO;
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const ASTRO_CREW = "stg-astro-1";
const FMO_CREW = "stg-fmo-1";

async function outboxCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    return new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const tx = open.result.transaction("outbox", "readonly");
        const got = tx.objectStore("outbox").getAll();
        got.onsuccess = () => {
          open.result.close();
          resolve((got.result as Array<{ state: string }>).filter((item) => item.state === "queued").length);
        };
        got.onerror = () => reject(got.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
}

test("astronaut photo report reaches the surgeon as a loaded thumbnail", async ({ browser }) => {
  test.skip(!ASTRO_CODE || !FMO_CODE, "staging access codes are absent");
  test.setTimeout(300_000);

  const ctxAstro = await browser.newContext();
  const astro = await ctxAstro.newPage();
  await astro.goto(`${BASE_URL}/login`);
  await astro.getByLabel(/access code/i).fill(ASTRO_CODE!);
  await astro.getByRole("button", { name: /^log in$/i }).click();
  await expect(astro).toHaveURL(new RegExp(`crew=${ASTRO_CREW}`));

  await astro.goto(`${BASE_URL}/emergency`);
  await expect(astro.getByRole("heading", { name: /emergency/i }).first()).toBeVisible();
  await astro.getByRole("button", { name: /severe bleeding/i }).click();
  for (let step = 0; step < 30; step++) {
    if (await astro.getByRole("heading", { name: /review the report/i }).count()) break;
    const next = astro.getByRole("button", { name: /done, next step/i });
    if (await next.count()) {
      await next.click();
      continue;
    }
    break;
  }
  if (!(await astro.getByRole("heading", { name: /review the report/i }).count())) {
    await astro.getByRole("button", { name: /finish and review report/i }).click();
  }
  await expect(astro.getByRole("heading", { name: /review the report/i })).toBeVisible();

  const cleanBase64 = await astro.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 4, 4);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  });
  await astro
    .getByTestId("photo")
    .setInputFiles([{ name: "wound.jpg", mimeType: "image/jpeg", buffer: Buffer.from(cleanBase64, "base64") }]);
  await expect(astro.getByTestId("photo-ready")).toBeVisible({ timeout: 15_000 });
  await astro.getByRole("button", { name: /queue report/i }).click();
  await expect(astro.getByRole("heading", { name: /report queued|report sent/i })).toBeVisible();
  await expect
    .poll(() => outboxCount(astro), { timeout: 120_000 })
    .toBe(0);
  await ctxAstro.close();

  const ctxFmo = await browser.newContext();
  const fmo = await ctxFmo.newPage();
  await fmo.goto(`${BASE_URL}/login`);
  await fmo.getByLabel(/access code/i).fill(FMO_CODE!);
  await fmo.getByRole("button", { name: /^log in$/i }).click();
  await expect(fmo).toHaveURL(new RegExp(`crew=${FMO_CREW}`));

  await fmo.goto(`${BASE_URL}/surgeon?crew=${FMO_CREW}`);
  await expect(fmo.getByRole("heading", { name: /flight surgeon/i })).toBeVisible();
  const thumb = fmo.getByTestId("photo-thumb").first();
  await expect(thumb).toBeVisible({ timeout: 60_000 });
  expect(await thumb.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await ctxFmo.close();
});

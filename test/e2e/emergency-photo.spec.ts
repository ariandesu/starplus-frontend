/**
 * AA4: an attached photo with EXIF metadata is always re-encoded to JPEG
 * without the EXIF segment before it is queued.
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

function withExif(jpeg: Buffer): Buffer {
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), Buffer.alloc(16, 0x41)]);
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, payload.length + 2]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

test("emergency photo is re-encoded to JPEG without EXIF", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  const cleanBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 4, 4);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  });
  const dirty = withExif(Buffer.from(cleanBase64, "base64"));
  expect(dirty.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(dirty.includes(Buffer.from("Exif\0\0", "binary"))).toBe(true);

  await page.goto(`${BASE_URL}/emergency`);
  await expect(page.getByRole("heading", { name: /emergency/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /severe bleeding/i }).click();
  for (let step = 0; step < 30; step++) {
    if (await page.getByRole("heading", { name: /review the report/i }).count()) break;
    const next = page.getByRole("button", { name: /done, next step/i });
    if (await next.count()) {
      await next.click();
      continue;
    }
    break;
  }
  if (!(await page.getByRole("heading", { name: /review the report/i }).count())) {
    await page.getByRole("button", { name: /finish and review report/i }).click();
  }
  await expect(page.getByRole("heading", { name: /review the report/i })).toBeVisible();
  await page.getByTestId("photo").setInputFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer: dirty }]);
  await expect(page.getByTestId("photo-ready")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /queue report/i }).click();
  await expect(page.getByRole("heading", { name: /report queued|report sent/i })).toBeVisible();

  const queuedBase64 = await page.evaluate(() => {
    return new Promise<string>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const tx = open.result.transaction("outbox", "readonly");
        const got = tx.objectStore("outbox").getAll();
        got.onsuccess = () => {
          for (const item of got.result as Array<{ payload?: { payload_json?: string } }>) {
            try {
              const payload = JSON.parse(item.payload?.payload_json ?? "{}") as {
                attachments?: Array<{ data_base64?: string }>;
              };
              const photo = payload.attachments?.[0]?.data_base64;
              if (photo) {
                open.result.close();
                resolve(photo);
                return;
              }
            } catch {
              /* keep looking */
            }
          }
          open.result.close();
          reject(new Error("no queued photo found"));
        };
        got.onerror = () => reject(got.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  const queued = Buffer.from(queuedBase64, "base64");
  expect([...queued.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  expect(queued.includes(Buffer.from("Exif\0\0", "binary"))).toBe(false);
  expect(queued.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
});

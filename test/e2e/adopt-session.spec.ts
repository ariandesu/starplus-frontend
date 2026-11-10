/**
 * Adopt-session: a valid on-device session without stored active_crew is
 * adopted automatically (one profile) or offered through "Continue as"
 * buttons (several profiles, PIN-gated on a shared device).
 * Seeds straight into IDB (no backend needed).
 */
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

// These specs exercise the on-device session layer with no backend, so they
// declare the browser offline (the online renewal path has its own spec).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
});

interface SeedProfile {
  crewId: string;
  role?: string;
  expiresAt?: string;
  pinHash?: string | null;
}

const SALT = "e2e-tests-only-salt";

function pinHash(pin: string): string {
  return createHash("sha256").update(`starplus-pin:${SALT}:${pin}`, "utf8").digest("hex");
}

async function seedProfiles(page: Page, profiles: SeedProfile[], shared: boolean, lastActive: string | null): Promise<void> {
  await page.evaluate(
    ([rows, isShared, last, salt]) => {
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
          for (const row of rows as SeedProfile[]) {
            tx.objectStore("profiles").put({
              crew_id: row.crewId,
              display_name: row.crewId,
              token: `token-${row.crewId}`,
              role: row.role ?? "astronaut",
              expires_at: row.expiresAt ?? "2030-01-01T00:00:00Z",
              provenance: "real",
              device_id: "e2e-device",
              pin_hash: row.pinHash ?? null,
              shared_device: false,
            });
          }
          tx.objectStore("settings").put({ key: "shared_device", value: isShared ? "true" : "false" });
          tx.objectStore("settings").put({ key: "pin_salt", value: salt });
          if (last) tx.objectStore("settings").put({ key: "last_active", value: last });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    },
    [profiles, shared, lastActive, SALT] as const
  );
}

test("a single stranded session is adopted without a login prompt", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/login`);
  await seedProfiles(page, [{ crewId: "adopt-solo" }], false, null);

  await page.goto(`${BASE_URL}/history`);
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /go to login/i })).toHaveCount(0);
});

test("several stranded sessions offer Continue as buttons", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/login`);
  await seedProfiles(page, [{ crewId: "adopt-one" }, { crewId: "adopt-two", role: "flight_medical_officer" }], false, null);

  await page.goto(`${BASE_URL}/history`);
  await expect(page.getByRole("button", { name: "Continue as adopt-one · astronaut" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Continue as adopt-two · Flight surgeon" })).toBeVisible();

  await page.getByRole("button", { name: "Continue as adopt-two · Flight surgeon" }).click();
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /continue as/i })).toHaveCount(0);
});

test("on a shared device the buttons ask for the profile PIN", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/login`);
  await seedProfiles(
    page,
    [
      { crewId: "adopt-pin-one", pinHash: pinHash("1234") },
      { crewId: "adopt-pin-two", pinHash: pinHash("1234") },
    ],
    true,
    new Date().toISOString()
  );

  await page.goto(`${BASE_URL}/history`);
  await expect(page.getByRole("button", { name: "Continue as adopt-pin-one" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continue as adopt-pin-one" }).click();
  await expect(page.getByLabel(/4-digit PIN/i)).toBeVisible();
  await page.getByLabel(/4-digit PIN/i).fill("1234");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /continue as/i })).toHaveCount(0);
});

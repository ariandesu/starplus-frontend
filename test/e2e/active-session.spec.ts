/**
 * Active session: useActiveCrew() keeps the crew across pages without ?crew=.
 * Seeds astronaut + flight-surgeon sessions straight into IDB (no backend
 * needed), then taps every menu item, direct-types + reloads + repeats
 * offline, and expires the session to check the logged-out views.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const ASTRONAUT = "e2e-active-astronaut";
const SURGEON = "e2e-active-surgeon";

async function seedCrew(page: Page, crewId: string, role: string): Promise<void> {
  await page.evaluate(
    ([id, crewRole]) => {
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
          tx.objectStore("profiles").put({
            crew_id: id,
            display_name: id,
            token: `token-${id}`,
            role: crewRole,
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
            provenance: "synthetic",
            device_id: "e2e-device",
            pin_hash: null,
            shared_device: false,
          });
          tx.objectStore("settings").put({ key: "active_crew", value: id });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    },
    [crewId, role] as const
  );
}

async function expireCrew(page: Page, crewId: string): Promise<void> {
  await page.evaluate(([id]) => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("profiles", "readwrite");
        const get = tx.objectStore("profiles").get(id);
        get.onsuccess = () => {
          const profile = get.result as { crew_id: string } | undefined;
          if (profile) {
            tx.objectStore("profiles").put({ ...profile, expires_at: "2000-01-01T00:00:00Z" });
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, [crewId]);
}

async function activeCrewSetting(page: Page): Promise<string> {
  return page.evaluate(() => {
    return new Promise<string>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("settings", "readonly");
        const get = tx.objectStore("settings").get("active_crew");
        get.onsuccess = () => {
          db.close();
          resolve((get.result as { value?: string } | undefined)?.value ?? "");
        };
        get.onerror = () => reject(get.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
}

async function tapMenu(page: Page, label: string): Promise<void> {
  const openMenu = page.getByRole("button", { name: /open menu/i });
  if ((await openMenu.count()) > 0) await openMenu.click();
  await page
    .locator('aside[aria-label="Main navigation"]')
    .getByRole("link", { name: label, exact: true })
    .click();
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function expectLoggedIn(page: Page): Promise<void> {
  await expect(page.getByRole("link", { name: /go to login/i })).toHaveCount(0);
  await expect(page.getByText("Try the demo", { exact: true })).toHaveCount(0);
}

test("menu taps keep the active crew without ?crew=", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);

  const items: Array<{ label: string; shows: RegExp }> = [
    { label: "Self-check", shows: /what are you measuring/i },
    { label: "History", shows: /^history$/i },
    { label: "Body", shows: /body map/i },
    { label: "Progress", shows: /^progress$/i },
    { label: "Reports", shows: /^reports$/i },
    { label: "Medicines", shows: /^medicines$/i },
    { label: "Emergency", shows: /no login needed/i },
    { label: "Settings", shows: /^settings$/i },
    { label: "Demo", shows: /demo mode/i },
  ];
  for (const item of items) {
    await tapMenu(page, item.label);
    await settled();
    await expect(page.getByText(item.shows).first()).toBeVisible({ timeout: 15_000 });
    await expectLoggedIn(page);
  }

  await tapMenu(page, "Home");
  await settled();
  await expect(page.getByRole("heading", { name: /today/i })).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);
});

test("surgeon gate keeps the role check on the stored crew", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/login`);
  await seedCrew(page, ASTRONAUT, "astronaut");
  await seedCrew(page, SURGEON, "flight_medical_officer");
  await page.evaluate(([id]) => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ key: "active_crew", value: id });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, [SURGEON]);

  await page.goto(`${BASE_URL}/surgeon`);
  await settled();
  await expect(page.getByRole("heading", { name: /flight surgeon/i })).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);
});

test("old ?crew= links work and unknown crews fall back to the stored crew", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");

  await page.goto(`${BASE_URL}/history?crew=${ASTRONAUT}`);
  await settled();
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);

  await page.goto(`${BASE_URL}/body?crew=no-such-crew`);
  await settled();
  await expect(page.getByText(/body map/i)).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);
});

test("typed routes survive reload and work offline", async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.waitForTimeout(8000);

  const routes: Array<{ path: string; shows: RegExp }> = [
    { path: "/body", shows: /body map/i },
    { path: "/history", shows: /^history$/i },
    { path: "/check", shows: /what are you measuring/i },
  ];
  for (const route of routes) {
    await page.goto(`${BASE_URL}${route.path}`);
    await settled();
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 15_000 });
    await expectLoggedIn(page);

    await page.reload();
    await settled();
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 15_000 });
    await expectLoggedIn(page);
  }

  await context.setOffline(true);
  for (const route of routes) {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "commit" });
    await settled();
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 15_000 });
    await expectLoggedIn(page);

    await page.reload({ waitUntil: "commit" });
    await settled();
    await expect(page.getByText(route.shows).first()).toBeVisible({ timeout: 15_000 });
    await expectLoggedIn(page);
  }
  await context.setOffline(false);
});

test("expired sessions fall back to logged-out views with Try the demo", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");
  await page.goto(`${BASE_URL}/body`);
  await expect(page.getByText(/body map/i)).toBeVisible({ timeout: 15_000 });

  await expireCrew(page, ASTRONAUT);
  await page.goto(`${BASE_URL}/body`);
  await expect(page.getByText("Try the demo", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  expect(await activeCrewSetting(page)).toBe("");

  for (const path of ["/history", "/check", "/"]) {
    await page.goto(`${BASE_URL}${path}`);
    await expect(page.getByText("Try the demo", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }
});

async function setShared(page: Page, shared: boolean, lastActive: string | null): Promise<void> {
  await page.evaluate(([isShared, last]) => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("starplus-device");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ key: "shared_device", value: isShared ? "true" : "false" });
        if (last) tx.objectStore("settings").put({ key: "last_active", value: last });
        else {
          const del = tx.objectStore("settings").delete("last_active");
          del.onsuccess = () => undefined;
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, [shared, lastActive] as const);
}

test("log out from the menu and settings ends the session", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");
  await page.goto(`${BASE_URL}/`);

  const openMenu = page.getByRole("button", { name: /open menu/i });
  await openMenu.click();
  const logoutItem = page.locator('aside[aria-label="Main navigation"]').getByRole("button", { name: "Log out", exact: true });
  await expect(logoutItem).toBeVisible();
  await logoutItem.click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByText("Try the demo", { exact: true })).toBeVisible();
  expect(await activeCrewSetting(page)).toBe("");

  await seedCrew(page, ASTRONAUT, "astronaut");
  await page.goto(`${BASE_URL}/settings`);
  await expect(page.getByText(`Signed in as ${ASTRONAUT}`)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByText("Try the demo", { exact: true })).toBeVisible();
  expect(await activeCrewSetting(page)).toBe("");
});

test("a shared device idle over 30 minutes asks for the PIN instead", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");

  await setShared(page, true, new Date(Date.now() - 31 * 60 * 1000).toISOString());
  await page.goto(`${BASE_URL}/body`);
  await expect(page.getByText("Try the demo", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  expect(await activeCrewSetting(page)).toBe("");

  await page.goto(`${BASE_URL}/body?crew=${ASTRONAUT}`);
  await expect(page.getByText("Try the demo", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  expect(await activeCrewSetting(page)).toBe("");

  await seedCrew(page, ASTRONAUT, "astronaut");
  await setShared(page, true, new Date().toISOString());
  await page.goto(`${BASE_URL}/body`);
  await expect(page.getByText(/body map/i)).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);

  await setShared(page, false, "2020-01-01T00:00:00Z");
  await page.goto(`${BASE_URL}/history`);
  await expect(page.getByText(/^history$/i).first()).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);
});

async function seedResults(page: Page, crewId: string, assessedAts: string[]): Promise<void> {
  await page.evaluate(([id, stamps]) => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(`starplus-${id}`);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("measurements")) db.createObjectStore("measurements", { keyPath: "client_id" });
        if (!db.objectStoreNames.contains("results")) db.createObjectStore("results", { keyPath: "client_id" });
        if (!db.objectStoreNames.contains("reports")) db.createObjectStore("reports", { keyPath: "client_id" });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("results", "readwrite");
        for (const [index, assessed_at] of stamps.entries()) {
          tx.objectStore("results").put({
            client_id: `res-${index}`,
            crew_id: id,
            assessed_at,
            overall_status: "nominal",
            per_measure: [],
            model_advice: null,
            model_id: "none",
            model_version: "none",
            catalog_version: "1",
            kb_version: "none",
            inputs_hash: "e2e",
            received_at: assessed_at,
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, [crewId, assessedAts] as const);
}

test("result without an ID opens the latest, or the empty state", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE_URL}/`);
  await seedCrew(page, ASTRONAUT, "astronaut");

  await page.goto(`${BASE_URL}/result`);
  await expect(page.getByText(/no result yet/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /start a self-check/i })).toBeVisible();
  await expectLoggedIn(page);

  await seedResults(page, ASTRONAUT, ["2026-11-07T12:00:00Z", "2026-11-08T12:00:00Z"]);
  await page.goto(`${BASE_URL}/result`);
  await expect(page.getByRole("heading", { name: /your result/i })).toBeVisible({ timeout: 15_000 });
  await expectLoggedIn(page);
});

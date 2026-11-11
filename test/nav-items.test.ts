import { describe, expect, it } from "vitest";
import { navItemsForRole } from "../src/lib/nav-items";

describe("navItemsForRole", () => {
  it("keeps the astronaut menu unchanged", () => {
    const labels = navItemsForRole("astronaut").map((item) => item.label);
    expect(labels).toEqual([
      "Home", "Self-check", "History", "Body", "Progress", "Medicines",
      "Emergency", "Reports", "Settings", "Demo", "Login",
    ]);
  });

  it("shows the dashboard menu to surgeons and mission control", () => {
    for (const role of ["flight_medical_officer", "mission_control"]) {
      const items = navItemsForRole(role);
      const labels = items.map((item) => item.label);
      expect(labels).toEqual(["Dashboard", "Crew", "Reports", "Emergency", "Medicines", "Settings"]);
      expect(items.find((item) => item.label === "Dashboard")?.href).toBe("/surgeon");
      expect(items.find((item) => item.label === "Crew")?.href).toBe("/surgeon/crew");
      expect(items.find((item) => item.label === "Reports")?.href).toBe("/surgeon/reports");
    }
  });

  it("hides astronaut-only screens from surgeons", () => {
    const labels = navItemsForRole("flight_medical_officer").map((item) => item.label);
    for (const hidden of ["Self-check", "History", "Body", "Progress", "Surgeon", "Home"]) {
      expect(labels).not.toContain(hidden);
    }
  });

  it("shows the full menu while logged out", () => {
    expect(navItemsForRole(null).map((item) => item.label)).toContain("Login");
    expect(navItemsForRole(null)).toHaveLength(11);
  });
});

import { describe, expect, it } from "vitest";
import { activeHref, groupNav } from "../src/components/navigation/nav-groups";
import { navItemsForRole, type NavEntry } from "../src/lib/nav-items";

const key = (item: NavEntry) => `${item.label}|${item.href}`;
const flat = (groups: ReturnType<typeof groupNav>) => groups.flatMap((group) => group.items);

describe("nav groups", () => {
  it("keeps every astronaut item exactly once", () => {
    const items = navItemsForRole("astronaut");
    const grouped = flat(groupNav(items, "astronaut"));
    expect(grouped).toHaveLength(items.length);
    expect(grouped.map(key).sort()).toEqual(items.map(key).sort());
  });

  it("keeps every surgeon item exactly once", () => {
    for (const role of ["flight_medical_officer", "mission_control"]) {
      const items = navItemsForRole(role);
      const grouped = flat(groupNav(items, role));
      expect(grouped).toHaveLength(items.length);
      expect(grouped.map(key).sort()).toEqual(items.map(key).sort());
    }
  });

  it("uses the astronaut layout for astronauts and logged-out visitors", () => {
    for (const role of ["astronaut", null]) {
      const groups = groupNav(navItemsForRole(role), role);
      expect(groups.map((group) => group.title)).toEqual(["Daily", "Care", "Device"]);
    }
  });

  it("uses the crew layout for surgeon roles", () => {
    for (const role of ["flight_medical_officer", "mission_control"]) {
      const groups = groupNav(navItemsForRole(role), role);
      expect(groups.map((group) => group.title)).toEqual(["Crew", "Care", "Device"]);
    }
  });

  it("puts an unknown item at the end of the last group", () => {
    const groups = groupNav(
      [
        { label: "Home", href: "/" },
        { label: "Mystery", href: "/mystery" },
      ],
      "astronaut"
    );
    const last = groups[groups.length - 1];
    expect(last.items[last.items.length - 1]).toEqual({ label: "Mystery", href: "/mystery" });
  });

  it("drops groups that end up empty", () => {
    const groups = groupNav([{ label: "Home", href: "/" }], "astronaut");
    expect(groups.map((group) => group.title)).toEqual(["Daily"]);
  });
});

describe("active nav href", () => {
  it("picks the longest matching href", () => {
    const items = navItemsForRole("flight_medical_officer");
    expect(activeHref("/surgeon/crew", items)).toBe("/surgeon/crew");
    expect(activeHref("/surgeon/reports", items)).toBe("/surgeon/reports");
    expect(activeHref("/surgeon", items)).toBe("/surgeon");
  });

  it("matches a base href for child routes", () => {
    expect(activeHref("/check/voice", navItemsForRole("astronaut"))).toBe("/check");
  });

  it("matches the root only at the root", () => {
    const items = navItemsForRole("astronaut");
    expect(activeHref("/", items)).toBe("/");
    expect(activeHref("/nope", items)).toBeNull();
  });
});

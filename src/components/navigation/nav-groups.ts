import type { NavEntry } from "@/lib/nav-items";

export type NavGroup = { title: string; items: NavEntry[] };

const SURGEON_LAYOUT: Record<string, string[]> = {
  Crew: ["Dashboard", "Crew", "Reports"],
  Care: ["Emergency", "Medicines"],
  Device: ["Settings"],
};

const ASTRONAUT_LAYOUT: Record<string, string[]> = {
  Daily: ["Home", "Self-check", "History", "Body", "Progress"],
  Care: ["Medicines", "Reports", "Emergency"],
  Device: ["Surgeon", "Settings", "Demo", "Login"],
};

function isSurgeonRole(role: string | null): boolean {
  return role === "flight_medical_officer" || role === "mission_control";
}

export function groupNav(items: NavEntry[], role: string | null): NavGroup[] {
  const layout = isSurgeonRole(role) ? SURGEON_LAYOUT : ASTRONAUT_LAYOUT;
  const titles = Object.keys(layout);
  const groups: NavGroup[] = titles.map((title) => ({ title, items: [] }));
  const leftovers: NavEntry[] = [];

  for (const item of items) {
    const index = titles.findIndex((title) => layout[title].includes(item.label));
    if (index === -1) {
      leftovers.push(item);
    } else {
      groups[index].items.push(item);
    }
  }

  if (leftovers.length > 0) {
    groups[groups.length - 1].items.push(...leftovers);
  }

  return groups.filter((group) => group.items.length > 0);
}

export function activeHref(pathname: string, items: NavEntry[]): string | null {
  let match: string | null = null;
  for (const item of items) {
    const hit =
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (hit && (match === null || item.href.length > match.length)) {
      match = item.href;
    }
  }
  return match;
}

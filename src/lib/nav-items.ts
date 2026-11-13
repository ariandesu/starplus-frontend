export interface NavEntry {
  label: string;
  href: string;
}

const ASTRONAUT_NAV: NavEntry[] = [
  { label: "Home", href: "/" },
  { label: "Self-check", href: "/check" },
  { label: "History", href: "/history" },
  { label: "Body", href: "/body" },
  { label: "Progress", href: "/progress" },
  { label: "Medicines", href: "/medicines" },
  { label: "Emergency", href: "/emergency" },
  { label: "Reports", href: "/reports" },
  { label: "Hazards", href: "/hazards" },
  { label: "Settings", href: "/settings" },
  { label: "Demo", href: "/demo" },
  { label: "Login", href: "/login" },
];

const SURGEON_NAV: NavEntry[] = [
  { label: "Dashboard", href: "/surgeon" },
  { label: "Crew", href: "/surgeon/crew" },
  { label: "Reports", href: "/surgeon/reports" },
  { label: "Emergency", href: "/emergency" },
  { label: "Medicines", href: "/medicines" },
  { label: "Hazards", href: "/hazards" },
  { label: "Settings", href: "/settings" },
];

/** Menu items for a session role (null while logged out). Astronauts are unchanged. */
export function navItemsForRole(role: string | null): NavEntry[] {
  if (role === "flight_medical_officer" || role === "mission_control") return SURGEON_NAV;
  return ASTRONAUT_NAV;
}

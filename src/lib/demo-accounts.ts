/**
 * The three shared demo logins. The passwords are public by design: the login
 * page shows them (masked) and the role cards fill them in. The value comes
 * from `NEXT_PUBLIC_DEMO_PASSWORD` at build time and must match the Worker's
 * `DEMO_PASSWORD` secret; neither is committed to git.
 */
export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

export type DemoCardKey = "astronaut" | "fmo" | "mission";

export interface DemoCard {
  key: DemoCardKey;
  title: string;
  username: string;
  role: string;
  crew_id: string;
  description: string;
}

export const DEMO_CARDS: DemoCard[] = [
  {
    key: "astronaut",
    title: "Astronaut",
    username: "astronaut01",
    role: "astronaut",
    crew_id: "demo-astronaut",
    description: "Alex Rivera's month of check-ins, results and reports.",
  },
  {
    key: "fmo",
    title: "Flight Medical Officer",
    username: "fmo01",
    role: "flight_medical_officer",
    crew_id: "demo-surgeon",
    description: "The crew board, crew detail and the reports inbox.",
  },
  {
    key: "mission",
    title: "Mission Control",
    username: "mc01",
    role: "mission_control",
    crew_id: "demo-mission",
    description: "The same crew board and reports inbox as the surgeon.",
  },
];

/** Maps the old `?demo=` and role names onto a card. */
export function demoCardForKey(key: string): DemoCard | undefined {
  if (key === "astronaut") return DEMO_CARDS[0];
  if (key === "surgeon" || key === "fmo" || key === "flight_medical_officer") return DEMO_CARDS[1];
  if (key === "mission" || key === "mission_control" || key === "mc") return DEMO_CARDS[2];
  return undefined;
}

export function demoCardForRole(role: string): DemoCard {
  return demoCardForKey(role) ?? DEMO_CARDS[0];
}

export function demoCardForUsername(username: string): DemoCard | undefined {
  const normalized = username.toLowerCase();
  return DEMO_CARDS.find((card) => card.username === normalized);
}

export function roleLabel(role: string): string {
  if (role === "flight_medical_officer") return "Flight surgeon";
  if (role === "mission_control") return "Mission control";
  return "astronaut";
}

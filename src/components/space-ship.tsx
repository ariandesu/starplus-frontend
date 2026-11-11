"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useActiveCrew } from "@/lib/use-active-crew";

const SpaceShipScene = dynamic(() => import("./space-ship-scene"), { ssr: false });

const FLOWN_KEY = "starplus-ship-flown";

export function SpaceShip() {
  const { status, crew } = useActiveCrew();
  const params = useSearchParams();
  const crewParam = params.get("crew");
  const crewId = crew?.crew_id ?? null;
  const [flying, setFlying] = React.useState(false);

  React.useEffect(() => {
    if (status === "none" || status === "expired") {
      // A fresh sign-in earns a fresh fly-past.
      window.sessionStorage.removeItem(FLOWN_KEY);
      return;
    }
    if (status !== "active" || !crewId) return;
    // Decoration only: never spend it on a test runner or a reduced-motion reader.
    if (window.navigator.webdriver) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // A crew-scoped URL is an explicit way into the demo, so it always flies;
    // ordinary navigation flies once per session.
    if (!crewParam && window.sessionStorage.getItem(FLOWN_KEY)) return;
    window.sessionStorage.setItem(FLOWN_KEY, "1");
    const timer = window.setTimeout(() => setFlying(true), 0);
    return () => window.clearTimeout(timer);
  }, [status, crewId, crewParam]);

  if (!flying) return null;
  return <SpaceShipScene onDone={() => setFlying(false)} />;
}

"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const SpaceShipScene = dynamic(() => import("./space-ship-scene"), { ssr: false });

export function SpaceShip() {
  const [mount, setMount] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // A 3D layer the size of this one is decoration: never spend it on a browser
    // that is being driven by a test runner or that asked for reduced motion.
    if (window.navigator.webdriver) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setMount(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mount) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-16 z-0 select-none overflow-hidden">
      <div className={cn("ship-track", ready && "ship-visible")}>
        <SpaceShipScene onReady={() => setReady(true)} />
      </div>
    </div>
  );
}

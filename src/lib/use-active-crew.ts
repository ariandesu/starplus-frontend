"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getActiveCrewId } from "./session";

export interface ActiveCrew {
  /** The active crew id, or null once loading has finished with no valid session. */
  crewId: string | null;
  /** False until IndexedDB has been read; pages show a loading state meanwhile. */
  ready: boolean;
}

/**
 * Single source of truth for the active crew member across pages.
 * Reads `?crew=` when it has a valid session on this device, otherwise the
 * stored active crew (set on login, cleared on logout or expiry). Works
 * offline: it only reads IndexedDB.
 */
export function useActiveCrew(): ActiveCrew {
  const params = useSearchParams();
  const urlCrew = params.get("crew");
  const [state, setState] = useState<ActiveCrew>({ crewId: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    getActiveCrewId(urlCrew)
      .then((crewId) => {
        if (!cancelled) setState({ crewId, ready: true });
      })
      .catch(() => {
        if (!cancelled) setState({ crewId: null, ready: true });
      });
    return () => {
      cancelled = true;
    };
  }, [urlCrew]);

  return state;
}

/**
 * The plain (non-React) equivalent for loaders and event handlers.
 */
export async function getActiveCrew(urlCrew: string | null): Promise<string | null> {
  return getActiveCrewId(urlCrew);
}

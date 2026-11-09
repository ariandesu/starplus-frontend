"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getActiveCrewId, listAdoptableCrews, type AdoptableCrew } from "./session";

export interface ActiveCrew {
  /** The active crew id, or null once loading has finished with no valid session. */
  crewId: string | null;
  /** False until IndexedDB has been read; pages show a loading state meanwhile. */
  ready: boolean;
  /** Valid on-device sessions to pick from when no single crew is active. */
  candidates: AdoptableCrew[];
  /** True when the session lookup itself failed (logged for diagnosis). */
  error: boolean;
}

/**
 * Single source of truth for the active crew member across pages.
 * Reads `?crew=` when it has a valid session on this device, otherwise the
 * stored active crew (set on login, cleared on logout or expiry). A single
 * stranded session is adopted; several surface as candidates for the profile
 * picker. Works offline: it only reads IndexedDB. A lookup failure throws
 * during render so the error boundary shows a reload prompt instead of a
 * logged-out view.
 */
export function useActiveCrew(): ActiveCrew {
  const params = useSearchParams();
  const urlCrew = params.get("crew");
  const [state, setState] = useState<ActiveCrew>({ crewId: null, ready: false, candidates: [], error: false });

  useEffect(() => {
    let cancelled = false;
    const resolve = () => {
      getActiveCrewId(urlCrew)
        .then(async (crew) => {
          if (cancelled) return;
          if (crew === "choose") {
            setState({ crewId: null, ready: true, candidates: await listAdoptableCrews().catch(() => []), error: false });
          } else {
            setState({ crewId: crew, ready: true, candidates: [], error: false });
          }
        })
        .catch((unknownError: unknown) => {
          console.error("active crew lookup failed", unknownError);
          if (!cancelled) setState({ crewId: null, ready: true, candidates: [], error: true });
        });
    };
    resolve();
    window.addEventListener("active-crew-changed", resolve);
    return () => {
      cancelled = true;
      window.removeEventListener("active-crew-changed", resolve);
    };
  }, [urlCrew]);

  if (state.error) {
    throw new Error("active crew lookup failed");
  }
  return state;
}

/**
 * The plain (non-React) equivalent for loaders and event handlers.
 */
export async function getActiveCrew(urlCrew: string | null): Promise<string | null> {
  const crew = await getActiveCrewId(urlCrew);
  return crew === "choose" ? null : crew;
}

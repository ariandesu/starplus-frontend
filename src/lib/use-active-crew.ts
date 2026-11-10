"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getActiveCrewId,
  getProfile,
  listAdoptableCrews,
  refreshSession,
  type AdoptableCrew,
  type SessionInfo,
} from "./session";

export type SessionStatus = "loading" | "active" | "choose" | "renewing" | "expired" | "none" | "error";

export interface SessionCrew {
  crew_id: string;
  name: string;
  role: string;
  demo: boolean;
}

export interface SessionState {
  status: SessionStatus;
  /** The active crew id, or null until a valid session is active. */
  crewId: string | null;
  /** The signed-in session while active (token included for direct callers). */
  session: SessionInfo | null;
  crew: SessionCrew | null;
  /** Better Auth username, used to prefill the login after a real expiry. */
  username: string | null;
  /** Why the session is not active (shown on the expired view). */
  reason: string | null;
  /** Valid on-device sessions to pick from when no single crew is active. */
  candidates: AdoptableCrew[];
  /** False until IndexedDB has been read; pages show a loading state meanwhile. */
  ready: boolean;
  /** True when the session lookup itself failed (logged for diagnosis). */
  error: boolean;
}

const EMPTY: SessionState = {
  status: "loading",
  crewId: null,
  session: null,
  crew: null,
  username: null,
  reason: null,
  candidates: [],
  ready: false,
  error: false,
};

function crewFromProfile(profile: { crew_id: string; display_name: string; role: string | null; demo?: boolean }): SessionCrew {
  return {
    crew_id: profile.crew_id,
    name: profile.display_name,
    role: profile.role ?? "astronaut",
    demo: profile.demo ?? false,
  };
}

/**
 * The one session layer: resolves the active crew from `?crew=` or the device,
 * renews the Better Auth session while in use, silently re-signs an expired
 * demo session in, and reports expired/none/choose so `<RequireSession>` can
 * draw the right view.
 */
export function useSession(): SessionState {
  const params = useSearchParams();
  const urlCrew = params.get("crew");
  const [state, setState] = useState<SessionState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      try {
        const crewId = await getActiveCrewId(urlCrew);
        if (cancelled) return;
        if (crewId === "choose") {
          const candidates = await listAdoptableCrews().catch(() => []);
          if (!cancelled) setState({ ...EMPTY, status: "choose", candidates, ready: true });
          return;
        }
        if (!crewId) {
          const candidates = await listAdoptableCrews().catch(() => []);
          const live = candidates.length > 0;
          if (!cancelled) {
            setState({ ...EMPTY, status: live ? "choose" : "none", candidates, ready: true });
          }
          return;
        }
        const profile = await getProfile(crewId);
        const crew = profile ? crewFromProfile(profile) : null;
        const locallyExpired = !profile?.expires_at || Date.parse(profile.expires_at) <= Date.now();
        if (locallyExpired && !cancelled) {
          setState({
            ...EMPTY,
            status: "renewing",
            crewId,
            crew,
            username: profile?.username ?? null,
            ready: true,
          });
        }
        const outcome = await refreshSession(crewId);
        if (cancelled) return;
        if (outcome.status === "active") {
          setState({
            ...EMPTY,
            status: "active",
            crewId: outcome.session.crew_id,
            session: outcome.session,
            crew: {
              crew_id: outcome.session.crew_id,
              name: outcome.session.name ?? outcome.session.crew_id,
              role: outcome.session.role,
              demo: outcome.session.demo,
            },
            username: outcome.session.username ?? null,
            ready: true,
          });
          return;
        }
        if (outcome.status === "expired") {
          setState({
            ...EMPTY,
            status: "expired",
            crewId: outcome.crew_id,
            crew: crew ?? { crew_id: outcome.crew_id, name: outcome.name, role: "astronaut", demo: outcome.demo },
            username: outcome.username,
            reason: `Your session for ${outcome.name} ended. Sign in again.`,
            ready: true,
          });
          return;
        }
        setState({ ...EMPTY, status: "none", ready: true });
      } catch (unknownError) {
        console.error("session lookup failed", unknownError);
        if (!cancelled) setState({ ...EMPTY, status: "error", ready: true, error: true });
      }
    };
    void resolve();
    window.addEventListener("active-crew-changed", resolve);
    return () => {
      cancelled = true;
      window.removeEventListener("active-crew-changed", resolve);
    };
  }, [urlCrew]);

  return state;
}

/** Backwards-compatible view used by the pages: the same state object. */
export function useActiveCrew(): SessionState {
  return useSession();
}

/**
 * The plain (non-React) equivalent for loaders and event handlers.
 */
export async function getActiveCrew(urlCrew: string | null): Promise<string | null> {
  const crew = await getActiveCrewId(urlCrew);
  return crew === "choose" ? null : crew;
}

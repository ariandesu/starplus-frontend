"use client";

import { useSession, type SessionState } from "@/lib/use-active-crew";
import type { AdoptableCrew, SessionInfo } from "@/lib/session";

export interface SurgeonSession {
  crewReady: boolean;
  crewId: string | null;
  session: SessionInfo | null;
  allowed: boolean;
  candidates: AdoptableCrew[];
  /** The full session view, for `<RequireSession>` and the role gate. */
  state: SessionState;
}

/** Shared gate: a signed-in flight surgeon or mission control member. */
export function useSurgeonSession(): SurgeonSession {
  const state = useSession();
  const allowed =
    state.status === "active" &&
    !!state.session &&
    (state.session.role === "flight_medical_officer" || state.session.role === "mission_control");
  return {
    crewReady: state.ready,
    crewId: state.crewId,
    session: allowed ? state.session : null,
    allowed,
    candidates: state.candidates,
    state,
  };
}

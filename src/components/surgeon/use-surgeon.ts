"use client";

import { useEffect, useState } from "react";
import { getSession, type SessionInfo } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";

export interface SurgeonSession {
  crewReady: boolean;
  crewId: string | null;
  session: SessionInfo | null;
  allowed: boolean;
}

/** Shared gate: logged-in flight surgeon or mission control with a live token. */
export function useSurgeonSession(): SurgeonSession {
  const { crewId, ready: crewReady } = useActiveCrew();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setChecked(true);
        return;
      }
      try {
        const found = await getSession(crewId);
        setSession(
          found && (found.role === "flight_medical_officer" || found.role === "mission_control") ? found : null
        );
      } catch {
        setSession(null);
      } finally {
        setChecked(true);
      }
    })().catch(() => setChecked(true));
  }, [crewId, crewReady]);

  return { crewReady: crewReady && checked, crewId, session, allowed: session !== null };
}

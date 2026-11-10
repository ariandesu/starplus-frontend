"use client";

import { useState } from "react";
import { adoptCrew, checkPin, isSharedDevice, type AdoptableCrew } from "@/lib/session";

/**
 * Profile picker for stranded sessions: "Continue as <name>" buttons above
 * the login links. On a shared device the buttons ask for the profile PIN.
 */
export function roleLabel(role: string): string {
  if (role === "flight_medical_officer") return "Flight surgeon";
  if (role === "mission_control") return "Mission control";
  return "astronaut";
}

export function ContinueAsButtons({ candidates }: { candidates: AdoptableCrew[] }) {
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (candidates.length === 0) return null;

  async function pick(crewId: string) {
    setError(null);
    setBusy(true);
    try {
      if (await isSharedDevice()) {
        setPinFor(crewId);
        setPin("");
        return;
      }
      await adoptCrew(crewId);
    } finally {
      setBusy(false);
    }
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (!pinFor) return;
    setError(null);
    setBusy(true);
    try {
      if (await checkPin(pinFor, pin)) {
        await adoptCrew(pinFor);
        setPinFor(null);
      } else {
        setError("Wrong PIN.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <p className="text-sm font-semibold text-foreground">Continue as</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <button
            key={candidate.crew_id}
            type="button"
            disabled={busy}
            onClick={() => void pick(candidate.crew_id)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Continue as {candidate.display_name} · {roleLabel(candidate.role)}
          </button>
        ))}
      </div>
      {pinFor && (
        <form onSubmit={unlock} className="mt-3">
          <label htmlFor="continue-pin" className="text-sm font-semibold text-foreground">
            4-digit PIN
          </label>
          <input
            id="continue-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Unlock
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

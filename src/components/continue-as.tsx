"use client";

import { useState } from "react";
import { adoptCrew, checkPin, isSharedDevice, type AdoptableCrew } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <Card className="mt-4 p-4">
      <p className="text-sm font-semibold text-foreground">Continue as</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <Button
            key={candidate.crew_id}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void pick(candidate.crew_id)}
          >
            Continue as {candidate.display_name} · {roleLabel(candidate.role)}
          </Button>
        ))}
      </div>
      {pinFor && (
        <form onSubmit={unlock} className="mt-3">
          <Input
            id="continue-pin"
            label="4-digit PIN"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
          <Button type="submit" disabled={busy} className="mt-2">
            Unlock
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkPin, isSharedDevice, listProfiles, login, setSharedDevice } from "@/lib/session";
import type { ProfileRecord } from "@/lib/db";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [pinCrew, setPinCrew] = useState<string | null>(null);
  const [pin, setPinValue] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => undefined);
    isSharedDevice().then(setShared).catch(() => undefined);
  }, []);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(code.trim());
      router.push(`/?crew=${encodeURIComponent(session.crew_id)}`);
    } catch {
      setError("That code did not work. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (pinCrew && (await checkPin(pinCrew, pin))) {
        router.push(`/?crew=${encodeURIComponent(pinCrew)}`);
      } else {
        setError("Wrong PIN.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Log in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the 8-character access code from the flight surgeon. Emergency help needs no login.
      </p>
      <form onSubmit={submitCode} className="mt-4 rounded-xl border border-border p-4">
        <label htmlFor="access-code" className="text-sm font-semibold text-foreground">
          Access code
        </label>
        <input
          id="access-code"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 uppercase text-foreground"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={shared}
            onChange={(event) => {
              setShared(event.target.checked);
              setSharedDevice(event.target.checked).catch(() => undefined);
            }}
          />
          This is a shared device
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          On a shared device, sessions last 24 hours instead of 30 days.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          Log in
        </button>
      </form>

      {profiles.length > 0 && (
        <section aria-label="Unlock a profile" className="mt-6 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Unlock a profile with PIN</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <button
                key={profile.crew_id}
                type="button"
                onClick={() => {
                  setPinCrew(profile.crew_id);
                  setPinValue("");
                  setError(null);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground"
              >
                {profile.display_name}
              </button>
            ))}
          </div>
          {pinCrew && (
            <form onSubmit={submitPin} className="mt-3">
              <label htmlFor="pin" className="text-sm font-semibold text-foreground">
                4-digit PIN
              </label>
              <input
                id="pin"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPinValue(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
              <button
                type="submit"
                disabled={busy}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                Unlock
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

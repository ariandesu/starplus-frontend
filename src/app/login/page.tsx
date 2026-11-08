"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkPin, DemoBusyError, getSession, isSharedDevice, listProfiles, login, loginDemo, pullHistory, setActiveCrew, setSharedDevice } from "@/lib/session";
import { requestOutboxSync } from "@/lib/outbox-sync";
import type { ProfileRecord } from "@/lib/db";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [pinCrew, setPinCrew] = useState<string | null>(null);
  const [pin, setPinValue] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [demoState, setDemoState] = useState<string | null>(null);
  const [demoRole, setDemoRole] = useState<"astronaut" | "flight_medical_officer">("astronaut");
  const [showRetry, setShowRetry] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => undefined);
    isSharedDevice().then(setShared).catch(() => undefined);
  }, []);

  async function enterDemo(role: "astronaut" | "flight_medical_officer", attempt = 0): Promise<void> {
    if (attempt === 0) {
      if (inFlight.current) return;
      inFlight.current = true;
    }
    setBusy(true);
    setError(null);
    setShowRetry(false);
    setDemoRole(role);
    try {
      if (attempt === 0) {
        const knownCrew = role === "astronaut" ? "demo-astronaut" : "demo-surgeon";
        const existing = await getSession(knownCrew);
        if (existing?.demo && existing.token && existing.role === role) {
          setDone(true);
          router.push(`/?crew=${encodeURIComponent(knownCrew)}`);
          return;
        }
        setDemoState(role === "astronaut" ? "Opening the demo…" : "Opening the surgeon demo…");
      }
      const session = await loginDemo(role);
      setDemoState("Loading demo history…");
      try {
        await pullHistory(session.crew_id, session.token);
      } catch {
        /* offline: local data still works */
      }
      setDone(true);
      router.push(`/?crew=${encodeURIComponent(session.crew_id)}`);
    } catch (error) {
      if (error instanceof DemoBusyError && attempt < 3) {
        setDemoState(error.message);
        await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs));
        await enterDemo(role, attempt + 1);
        return;
      }
      setDemoState(null);
      if (error instanceof DemoBusyError) {
        setError("The demo is still busy. Please try again in a minute.");
        setShowRetry(true);
      } else {
        setError(error instanceof Error ? error.message : "Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  useEffect(() => {
    const demo = params.get("demo");
    if (demo !== "astronaut" && demo !== "surgeon") return;
    const role = demo === "astronaut" ? ("astronaut" as const) : ("flight_medical_officer" as const);
    (async () => {
      await enterDemo(role);
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const session = await login(code.trim());
      setCode("");
      setDone(true);
      void requestOutboxSync().catch(() => undefined);
      router.push(`/?crew=${encodeURIComponent(session.crew_id)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function submitPin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (pinCrew && (await checkPin(pinCrew, pin))) {
        await setActiveCrew(pinCrew);
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
      <section aria-label="Trying the demo" className="mt-4 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Try the demo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One tap, no code. A pre-filled month of synthetic data, ready to explore.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="demo-astronaut"
            onClick={() => void enterDemo("astronaut")}
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            Demo astronaut
          </button>
          <button
            type="button"
            data-testid="demo-surgeon"
            onClick={() => void enterDemo("flight_medical_officer")}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Demo flight surgeon
          </button>
        </div>
        {demoState && <p className="mt-2 text-sm text-muted-foreground">{demoState}</p>}
        {showRetry && (
          <button
            type="button"
            data-testid="demo-retry"
            onClick={() => void enterDemo(demoRole)}
            disabled={busy}
            className="mt-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Try again
          </button>
        )}
      </section>
      <p className="mt-4 text-sm text-muted-foreground">
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
          disabled={busy || done}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {done ? "Logged in, opening…" : "Log in"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}

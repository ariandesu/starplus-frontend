"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { checkPin, getSession, isSharedDevice, listProfiles, loginWithPassword, pullHistory, redeemCode, setActiveCrew, setSharedDevice } from "@/lib/session";
import { requestOutboxSync } from "@/lib/outbox-sync";
import { DEMO_CARDS, DEMO_PASSWORD, demoCardForKey, type DemoCard } from "@/lib/demo-accounts";
import type { ProfileRecord } from "@/lib/db";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState(() => params.get("username") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [pinCrew, setPinCrew] = useState<string | null>(null);
  const [pin, setPinValue] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [demoState, setDemoState] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [pendingCard, setPendingCard] = useState<DemoCard | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [code, setCode] = useState("");
  const [redeemUser, setRedeemUser] = useState("");
  const [redeemPassword, setRedeemPassword] = useState("");
  const loginRef = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => undefined);
    isSharedDevice().then(setShared).catch(() => undefined);
  }, []);

  function fillCard(card: DemoCard): void {
    setError(null);
    setUsername(card.username);
    setPassword(DEMO_PASSWORD);
    // Focus (and scroll to) the Login button so the card is one clear step.
    requestAnimationFrame(() => loginRef.current?.focus());
  }

  async function submitCredentials(card?: DemoCard, attempt = 0): Promise<void> {
    if (attempt === 0) {
      if (inFlight.current) return;
      inFlight.current = true;
    }
    setBusy(true);
    setError(null);
    setShowRetry(false);
    try {
      const user = (card?.username ?? username).trim();
      const secret = card ? DEMO_PASSWORD : password;
      if (!user || !secret) {
        setError("Enter your username and password.");
        return;
      }
      if (card) {
        const existing = await getSession(card.crew_id);
        if (existing?.token && existing.role === card.role) {
          await setActiveCrew(card.crew_id);
          setDone(true);
          router.push(`/?crew=${encodeURIComponent(card.crew_id)}`);
          return;
        }
        setDemoState(`Opening the ${card.title} demo…`);
      }
      const session = await loginWithPassword(user, secret);
      if (card) setDemoState("Loading demo history…");
      if (session.role === "astronaut") {
        try {
          await pullHistory(session.crew_id, session.token);
        } catch {
          /* offline: local data still works */
        }
      }
      void requestOutboxSync().catch(() => undefined);
      setDone(true);
      router.push(`/?crew=${encodeURIComponent(session.crew_id)}`);
    } catch (failure) {
      const retryable = failure as { retryAfterMs?: number; message?: string; status?: number };
      if (card && failure instanceof Error && "retryAfterMs" in failure && attempt < 3) {
        setDemoState("Lots of people are trying the demo right now. Retrying…");
        await new Promise((resolve) => setTimeout(resolve, retryable.retryAfterMs ?? 5000));
        await submitCredentials(card, attempt + 1);
        return;
      }
      setDemoState(null);
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
      if (card) {
        setPendingCard(card);
        setShowRetry(true);
      }
    } finally {
      setBusy(false);
      if (attempt === 0) inFlight.current = false;
    }
  }

  useEffect(() => {
    const demo = params.get("demo");
    if (!demo) return;
    const card = demoCardForKey(demo);
    if (!card) return;
    (async () => {
      fillCard(card);
      await submitCredentials(card);
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    await submitCredentials();
  }

  async function submitRedeem(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const session = await redeemCode(code.trim(), redeemUser.trim(), redeemPassword);
      setCode("");
      setDone(true);
      void requestOutboxSync().catch(() => undefined);
      if (session.role === "astronaut") {
        try {
          await pullHistory(session.crew_id, session.token);
        } catch {
          /* offline: local data still works */
        }
      }
      router.push(`/?crew=${encodeURIComponent(session.crew_id)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
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
      <h1 className="text-2xl font-bold text-foreground">Select your mission role</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One tap fills the demo login below. Or sign in with your own username and password.
      </p>

      <section aria-label="Demo roles" className="mt-4 grid gap-2">
        {DEMO_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            data-testid={`demo-card-${card.key}`}
            onClick={() => fillCard(card)}
            disabled={busy}
            className="rounded-xl border border-border p-3 text-left hover:border-foreground disabled:opacity-50"
          >
            <span className="block text-sm font-semibold text-foreground">{card.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{card.description}</span>
          </button>
        ))}
      </section>

      <form onSubmit={submitLogin} className="mt-4 rounded-xl border border-border p-4">
        <label htmlFor="username" className="text-sm font-semibold text-foreground">
          Username
        </label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        />
        <label htmlFor="password" className="mt-3 block text-sm font-semibold text-foreground">
          Password
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
          <button
            type="button"
            data-testid="toggle-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((prev) => !prev)}
            className="rounded-lg border border-border px-3 text-sm text-foreground"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
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
        {demoState && <p className="mt-2 text-sm text-muted-foreground">{demoState}</p>}
        {showRetry && pendingCard && (
          <button
            type="button"
            data-testid="demo-retry"
            onClick={() => void submitCredentials(pendingCard)}
            disabled={busy}
            className="mt-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Try again
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          ref={loginRef}
          type="submit"
          disabled={busy || done}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {done ? "Logged in, opening…" : "Login"}
        </button>
      </form>

      <p className="mt-2 text-xs text-muted-foreground">
        Demo environment · these accounts hold synthetic crew data.
      </p>

      <section aria-label="Access code" className="mt-4">
        {!redeeming ? (
          <button
            type="button"
            data-testid="show-redeem"
            onClick={() => setRedeeming(true)}
            className="text-sm text-accent-strong underline"
          >
            First time? Use your access code
          </button>
        ) : (
          <form onSubmit={submitRedeem} className="rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Redeem your access code</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the 8-character code from the flight surgeon, then choose your username and password.
            </p>
            <label htmlFor="access-code" className="mt-3 block text-sm font-semibold text-foreground">
              Access code
            </label>
            <input
              id="access-code"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 uppercase text-foreground"
            />
            <label htmlFor="redeem-username" className="mt-3 block text-sm font-semibold text-foreground">
              Choose a username
            </label>
            <input
              id="redeem-username"
              autoComplete="username"
              value={redeemUser}
              onChange={(event) => setRedeemUser(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            />
            <label htmlFor="redeem-password" className="mt-3 block text-sm font-semibold text-foreground">
              Choose a password
            </label>
            <input
              id="redeem-password"
              type="password"
              autoComplete="new-password"
              value={redeemPassword}
              onChange={(event) => setRedeemPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Redeem and sign in
            </button>
          </form>
        )}
      </section>

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
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Unlock
              </button>
            </form>
          )}
        </section>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Emergency help needs no login.{" "}
        <Link href="/emergency" className="text-accent-strong underline">
          Open emergency
        </Link>
      </p>
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

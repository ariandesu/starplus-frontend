"use client";

import { Suspense, useEffect, useRef, useState, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, PersonStanding, Stethoscope, Users, User, KeyRound, Check, ArrowRight } from "lucide-react";
import { checkPin, getSession, isSharedDevice, listProfiles, loginWithPassword, pullHistory, redeemCode, setActiveCrew, setSharedDevice } from "@/lib/session";
import { requestOutboxSync } from "@/lib/outbox-sync";
import { DEMO_CARDS, DEMO_PASSWORD, demoCardForKey, type DemoCard } from "@/lib/demo-accounts";
import type { ProfileRecord } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CARD_ICONS: Record<string, ElementType> = {
  astronaut: PersonStanding,
  fmo: Stethoscope,
  mission: Users,
};

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
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
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
    setSelectedCard(card.key);
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
    <div className="relative">
      <div aria-hidden className="absolute inset-0 hidden lg:block">
        <img
          src="/login-cupola.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span aria-hidden className="login-cupola-shade" />
      </div>
      <div className="relative ml-auto flex min-h-[calc(100svh-120px)] w-full max-w-2xl flex-col justify-center rounded-t-card bg-background px-4 py-8 isolate sm:px-8 lg:rounded-tr-none lg:px-10">
      <span aria-hidden className="login-curve" />
      <div className="login-horizon" aria-hidden="true" />
      <h1 className="text-[2rem] font-bold tracking-tight">Sign in to STAR PLUS</h1>
      <p className="mt-1 text-sm text-muted">
        Astronaut health monitoring and spaceflight medical operations platform.
      </p>
      <h2 className="mt-4 text-sm font-semibold text-foreground">Select your mission role</h2>

      <section aria-label="Demo roles" className="mt-3 grid gap-3 sm:grid-cols-3">
        {DEMO_CARDS.map((card) => {
          const Icon = CARD_ICONS[card.key] ?? PersonStanding;
          const selected = selectedCard === card.key;
          return (
            <button
              key={card.key}
              type="button"
              data-testid={`demo-card-${card.key}`}
              onClick={() => fillCard(card)}
              disabled={busy}
              aria-pressed={selected}
              className={cn(
                "rounded-card border-2 bg-card p-4 text-left shadow-card transition-colors disabled:opacity-50 focus-ring",
                selected ? "border-accent-strong bg-accent/15" : "border-border hover:border-foreground/40"
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <Icon className="h-6 w-6 text-accent-strong" aria-hidden />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-accent-strong bg-accent-strong" : "border-input"
                  )}
                >
                  {selected && <Check className="h-3 w-3 text-white" />}
                </span>
              </span>
              <span className="mt-2 block text-base font-semibold text-foreground">{card.title}</span>
              <span className="mt-1 block text-sm text-muted">{card.description}</span>
            </button>
          );
        })}
      </section>

      <form onSubmit={submitLogin} className="mt-4">
        <Card className="p-4">
          <Input
            id="username"
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            icon={<User className="h-4 w-4" aria-hidden />}
          />
          <div className="mt-3">
            <label htmlFor="password" className="block text-sm font-medium text-muted">
              Password
            </label>
            <div className="relative mt-1 flex items-start gap-2">
              <span aria-hidden className="pointer-events-none absolute bottom-[13px] left-3 flex h-4 w-4 items-center justify-center text-muted">
                <KeyRound className="h-4 w-4" aria-hidden />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="flex h-11 w-full rounded-control border border-input bg-surface py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="toggle-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
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
          <p className="mt-1 text-xs text-muted">
            On a shared device, sessions last 24 hours instead of 30 days.
          </p>
          {demoState && <p className="mt-2 text-sm text-muted">{demoState}</p>}
          {showRetry && pendingCard && (
            <Button
              type="button"
              variant="outline"
              data-testid="demo-retry"
              onClick={() => void submitCredentials(pendingCard)}
              disabled={busy}
              className="mt-2"
            >
              Try again
            </Button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button ref={loginRef} type="submit" disabled={busy || done} className="mt-3 w-full rounded-full">
            {(busy || done) && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {done ? "Logged in, opening…" : busy ? "Signing in…" : "Login"}
            {!(busy || done) && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
          </Button>
        </Card>
      </form>

      <p className="mt-2 text-xs text-muted">
        Demo environment · these accounts hold synthetic crew data.
      </p>

      <section aria-label="Access code" className="mt-4">
        {!redeeming ? (
          <button
            type="button"
            data-testid="show-redeem"
            onClick={() => setRedeeming(true)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring"
          >
            First time? Use your access code
          </button>
        ) : (
          <Card className="p-4">
            <form onSubmit={submitRedeem}>
              <h2 className="text-sm font-semibold text-foreground">Redeem your access code</h2>
              <p className="mt-1 text-xs text-muted">
                Enter the 8-character code from the flight surgeon, then choose your username and password.
              </p>
              <div className="mt-3">
                <Input
                  id="access-code"
                  label="Access code"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="uppercase"
                />
              </div>
              <div className="mt-3">
                <Input
                  id="redeem-username"
                  label="Choose a username"
                  autoComplete="username"
                  value={redeemUser}
                  onChange={(event) => setRedeemUser(event.target.value)}
                />
              </div>
              <div className="mt-3">
                <Input
                  id="redeem-password"
                  label="Choose a password"
                  type="password"
                  autoComplete="new-password"
                  value={redeemPassword}
                  onChange={(event) => setRedeemPassword(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy} className="mt-3">
                Redeem and sign in
              </Button>
            </form>
          </Card>
        )}
      </section>

      {profiles.length > 0 && (
        <Card className="mt-6 p-4">
          <section aria-label="Unlock a profile">
            <h2 className="text-sm font-semibold text-foreground">Unlock a profile with PIN</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <Button
                  key={profile.crew_id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPinCrew(profile.crew_id);
                    setPinValue("");
                    setError(null);
                  }}
                >
                  {profile.display_name}
                </Button>
              ))}
            </div>
            {pinCrew && (
              <form onSubmit={submitPin} className="mt-3">
                <Input
                  id="pin"
                  label="4-digit PIN"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => setPinValue(event.target.value)}
                />
                <Button type="submit" disabled={busy} className="mt-3">
                  Unlock
                </Button>
              </form>
            )}
          </section>
        </Card>
      )}

      <p className="mt-4 text-sm text-muted">
        Emergency help needs no login.{" "}
        <Link href="/emergency" className="text-accent-strong underline underline-offset-4">
          Open emergency
        </Link>
      </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}

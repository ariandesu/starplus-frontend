"use client";

import Link from "next/link";
import { ContinueAsButtons } from "@/components/continue-as";
import type { SessionState } from "@/lib/use-active-crew";

export interface RequireSessionProps {
  session: SessionState;
  children?: React.ReactNode;
  /** Optional heading for the logged-out view (the home page keeps its own). */
  heading?: string;
  intro?: string;
  /** The home page offers the emergency shortcut to logged-out visitors. */
  showEmergency?: boolean;
}

/**
 * The single gate for a signed-in view: renders the children only for an
 * active session, otherwise the loading, choose, renewing, expired, none or
 * error view. Replaces the fifteen copies of the per-page logged-out check.
 */
export function RequireSession({ session, children, heading, intro, showEmergency }: RequireSessionProps) {
  if (session.status === "active") return <>{children}</>;

  if (session.status === "loading" || session.status === "renewing") {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground">
        {session.status === "renewing" ? "Renewing your session…" : "Loading…"}
      </p>
    );
  }

  if (session.status === "error") {
    return (
      <p role="alert" className="px-4 py-8 text-sm text-muted-foreground">
        Something went wrong loading your session.{" "}
        <button type="button" onClick={() => window.location.reload()} className="text-accent-strong underline">
          Reload
        </button>
      </p>
    );
  }

  if (session.status === "expired") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8" data-testid="session-expired">
        <p role="alert" className="text-sm text-foreground">
          {session.reason ?? "Your session ended. Sign in again."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Your readings are still on this device.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={session.username ? `/login?username=${encodeURIComponent(session.username)}` : "/login"}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign in again
          </Link>
          <Link href="/login?demo=astronaut" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">
            Try the demo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">{heading ?? "Log in to continue"}</h1>
      {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/login" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Go to login
        </Link>
        {showEmergency && (
          <Link href="/emergency" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">
            Emergency
          </Link>
        )}
        <Link href="/login?demo=astronaut" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">
          Try the demo
        </Link>
      </div>
      <ContinueAsButtons candidates={session.candidates} />
    </div>
  );
}

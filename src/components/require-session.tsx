"use client";

import Link from "next/link";
import { ContinueAsButtons } from "@/components/continue-as";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <p className="px-4 py-8 text-sm text-muted">
        {session.status === "renewing" ? "Renewing your session…" : "Loading…"}
      </p>
    );
  }

  if (session.status === "error") {
    return (
      <p role="alert" className="px-4 py-8 text-sm text-muted">
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
        <Card className="p-5 lg:p-6">
          <p role="alert" className="text-sm text-foreground">
            {session.reason ?? "Your session ended. Sign in again."}
          </p>
          <p className="mt-1 text-sm text-muted">Your readings are still on this device.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={session.username ? `/login?username=${encodeURIComponent(session.username)}` : "/login"}>
                Sign in again
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login?demo=astronaut">Try the demo</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card className="p-5 lg:p-6">
        <h1 className="text-[1.75rem] font-bold tracking-tight">{heading ?? "Log in to continue"}</h1>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Go to login</Link>
          </Button>
          {showEmergency && (
            <Button asChild variant="destructive">
              <Link href="/emergency">Emergency</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/login?demo=astronaut">Try the demo</Link>
          </Button>
        </div>
        <ContinueAsButtons candidates={session.candidates} />
      </Card>
    </div>
  );
}

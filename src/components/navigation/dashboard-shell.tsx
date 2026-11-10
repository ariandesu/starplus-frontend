"use client";

import * as React from "react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar, MobileNav } from "./mobile-nav";
import { EmergencyButton } from "../emergency-button";
import { DemoBanner } from "../dashboard/demo-badge";
import { OutboxSync } from "../outbox-sync";
import { deviceDb } from "@/lib/db";
import { cn } from "@/lib/utils";
import { getSession, touchActivity } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { CrewErrorBoundary } from "@/components/crew-error-boundary";

function useSetting(key: string, fallback: string): string {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    deviceDb()
      .then((db) => db.get("settings", key))
      .then((row) => {
        if (row) setValue(row.value);
      })
      .catch(() => undefined);
  }, [key]);
  return value;
}

function DemoAccountBanner() {
  const { crewId, ready: crewReady } = useActiveCrew();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!crewReady) return;
      const session = crewId ? await getSession(crewId).catch(() => null) : null;
      if (!cancelled) setShow(session?.demo ?? false);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crewId, crewReady]);
  if (!show) return null;
  return (
    <p role="status" className="bg-accent px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-accent-foreground" data-testid="demo-banner">
      Demo: synthetic crew data
    </p>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const pathname = usePathname() ?? "";
  const bare = pathname === "/login";
  const [demo, setDemo] = useState(false);
  const [updated, setUpdated] = useState(false);
  const setting = useSetting("setting", "iss");
  const phase = useSetting("phase", "inflight");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const db = await deviceDb();
      if (params.get("demo") === "1") {
        await db.put("settings", { key: "demo_mode", value: "true" });
        setDemo(true);
      } else {
        const row = await db.get("settings", "demo_mode");
        if (row?.value === "true") setDemo(true);
      }
    })().catch(() => undefined);
  }, []);

  useEffect(() => {
    let last = 0;
    const touch = () => {
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      touchActivity().catch(() => undefined);
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onController = () => setUpdated(true);
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  return (
    <div className="min-h-full">
      <OutboxSync />
      <div className={cn("flex min-h-full flex-col", !bare && "lg:pl-[264px]")}>
        {updated && (
          <p role="status" className="bg-accent px-4 py-1.5 text-center text-xs font-semibold text-accent-foreground">
            Updated.{" "}
            <button type="button" onClick={() => window.location.reload()} className="underline">
              Reload
            </button>
          </p>
        )}
        <TopBar
          isOpen={isOpen}
          onToggle={() => setIsOpen((prev) => !prev)}
          trailing={<EmergencyButton />}
          bare={bare}
        />
        {demo && <DemoBanner />}
        <Suspense>
          <DemoAccountBanner />
        </Suspense>
        {!bare && <MobileNav isOpen={isOpen} onClose={close} context={`${setting} · ${phase}`} />}
        <main className="flex-1 overflow-x-hidden">
          <CrewErrorBoundary>{children}</CrewErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

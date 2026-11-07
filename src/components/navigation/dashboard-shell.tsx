"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { TopBar, MobileNav } from "./mobile-nav";
import { EmergencyButton } from "../emergency-button";
import { deviceDb } from "@/lib/db";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const [demo] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"
  );
  const setting = useSetting("setting", "iss");
  const phase = useSetting("phase", "inflight");

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        trailing={<EmergencyButton />}
        context={`${setting} · ${phase}`}
      />
      {demo && (
        <div role="status" className="bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-foreground">
          Demo mode — all data shown is synthetic and stays on this device.
        </div>
      )}
      <MobileNav isOpen={isOpen} onClose={close} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

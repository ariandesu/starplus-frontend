"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { TopBar, MobileNav } from "./mobile-nav";
import { EmergencyButton } from "../emergency-button";
import { DemoBanner } from "../dashboard/demo-badge";
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
  const [demo, setDemo] = useState(false);
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

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        trailing={<EmergencyButton />}
        context={`${setting} · ${phase}`}
      />
      {demo && <DemoBanner />}
      <MobileNav isOpen={isOpen} onClose={close} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

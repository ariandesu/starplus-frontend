"use client";

import Link from "next/link";
import { useState } from "react";
import demoCrew from "@starplus/core/content/demo-crew.json" with { type: "json" };
import type { Measurement } from "@starplus/core";
import { demoDb, deviceDb } from "@/lib/db";

interface DemoCrewFile {
  crew: { id: string; name: string; role: string; provenance: string };
  measurements: Measurement[];
}

const DEMO = demoCrew as unknown as DemoCrewFile;

export default function DemoPage() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      const device = await deviceDb();
      await device.put("settings", { key: "demo_mode", value: "true" });
      const demo = await demoDb();
      await demo.clear("measurements");
      for (const measurement of DEMO.measurements) {
        await demo.put("measurements", measurement);
      }
      setActive(true);
      window.location.href = "/?demo=1";
    } finally {
      setBusy(false);
    }
  }

  async function exit() {
    const device = await deviceDb();
    await device.put("settings", { key: "demo_mode", value: "false" });
    const demo = await demoDb();
    await demo.clear("measurements");
    setActive(false);
    window.location.href = "/";
  }

  function exportDemo() {
    const payload = {
      watermark: "SYNTHETIC — demo export, not real data. Never send to the server.",
      exported_at: new Date().toISOString(),
      crew: DEMO.crew,
      measurements: DEMO.measurements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "starplus-demo-synthetic.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Demo mode</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Loads a demo crew with 30 days of history into a separate on-device store. The
        outbox is disabled: nothing is ever sent. For judges trying the app.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={enter}
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {active ? "Demo on — re-seed" : "Switch on demo mode"}
        </button>
        <button
          type="button"
          onClick={exit}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground"
        >
          Exit demo mode
        </button>
        <button
          type="button"
          onClick={exportDemo}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground"
        >
          Export (watermarked SYNTHETIC)
        </button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/" className="text-accent-strong underline">Back home</Link>
      </p>
    </div>
  );
}

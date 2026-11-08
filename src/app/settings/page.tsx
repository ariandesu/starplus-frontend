"use client";

import { useEffect, useState } from "react";
import { deviceDb } from "@/lib/db";
import { commsSummary } from "@/lib/comms-link";
import { API_BASE } from "@/lib/api";

const SETTINGS = [
  { value: "iss", label: "ISS" },
  { value: "mars_transit", label: "Mars transit" },
  { value: "moon_base", label: "Moon base" },
  { value: "rover", label: "Surface rover" },
];
const PHASES = [
  { value: "preflight", label: "Pre-flight" },
  { value: "inflight", label: "In flight" },
  { value: "surface", label: "Surface" },
  { value: "postflight", label: "Post-flight" },
];

async function getSetting(key: string, fallback: string): Promise<string> {
  const db = await deviceDb();
  return (await db.get("settings", key))?.value ?? fallback;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await deviceDb();
  await db.put("settings", { key, value });
}

export default function SettingsPage() {
  const [setting, setSettingValue] = useState("iss");
  const [phase, setPhase] = useState("inflight");
  const [missionStart, setMissionStart] = useState("");
  const [blackout, setBlackout] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setSettingValue(await getSetting("setting", "iss"));
      setPhase(await getSetting("phase", "inflight"));
      setMissionStart(await getSetting("mission_start", ""));
      setBlackout((await getSetting("comms_blackout", "false")) === "true");
      setReady(true);
    })().catch(() => setReady(true));
  }, []);

  async function update(key: string, value: string, apply: (v: string) => void) {
    apply(value);
    await setSetting(key, value);
  }

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-border p-4">
          <label htmlFor="setting" className="text-sm font-semibold text-foreground">Setting</label>
          <select
            id="setting"
            value={setting}
            onChange={(e) => update("setting", e.target.value, setSettingValue)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          >
            {SETTINGS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-border p-4">
          <label htmlFor="phase" className="text-sm font-semibold text-foreground">Phase</label>
          <select
            id="phase"
            value={phase}
            onChange={(e) => update("phase", e.target.value, setPhase)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          >
            {PHASES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-border p-4">
          <label htmlFor="mission-start" className="text-sm font-semibold text-foreground">Mission start date</label>
          <input
            id="mission-start"
            type="date"
            value={missionStart}
            onChange={(e) => update("mission_start", e.target.value, setMissionStart)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">Used to count the mission day for each record.</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Comms-link simulation</p>
          <p className="mt-1 text-sm text-muted-foreground">{commsSummary(setting, blackout)}</p>
          <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={blackout}
              onChange={(e) => {
                setBlackout(e.target.checked);
                setSetting("comms_blackout", e.target.checked ? "true" : "false");
              }}
            />
            Simulate a blackout
          </label>
        </div>
        <div className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Data notice</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Measurements are scored on this device first and copied to the server when a link
            returns. The phone PIN is a screen lock only — it does not encrypt stored data.
            Demo data never leaves this device and is never sent.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Server: {API_BASE.replace(/^https?:\/\//, "")}
          </p>
        </div>
      </div>
    </div>
  );
}

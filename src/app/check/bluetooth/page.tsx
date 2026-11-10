"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Measurement, Phase } from "@starplus/core";
import { BLE_PROFILES, requestBleMeasurement } from "@/lib/adapters/ble-profiles";
import {
  downsamplePerMinute,
  parseBloodPressure,
  parseGlucose,
  parseHeartRate,
  parsePulseOximeter,
  parseTemperature,
  parseWeight,
} from "@/lib/adapters/ble-parse";
import {
  simulateBloodPressure,
  simulateGlucose,
  simulateHeartRate,
  simulatePulseOximeter,
  simulateTemperature,
  simulateWeight,
} from "@/lib/adapters/ble-simulator";
import { validateRecord } from "@/lib/adapters/validate";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

interface PreviewReading {
  metric: string;
  value: number;
  unit: string;
  at: string;
}

const UNSUPPORTED_REASON = "This browser has no Web Bluetooth (use Chrome on Android or desktop)";

function parseProfile(profileId: string, view: DataView, at: string): PreviewReading[] {
  switch (profileId) {
    case "heart-rate": {
      const reading = parseHeartRate(view);
      return reading ? [{ metric: reading.metric, value: reading.value, unit: reading.unit, at }] : [];
    }
    case "blood-pressure": {
      const reading = parseBloodPressure(view);
      return reading
        ? [
            { metric: reading.systolic.metric, value: reading.systolic.value, unit: reading.systolic.unit, at },
            { metric: reading.diastolic.metric, value: reading.diastolic.value, unit: reading.diastolic.unit, at },
          ]
        : [];
    }
    case "thermometer": {
      const reading = parseTemperature(view);
      return reading ? [{ metric: reading.metric, value: reading.value, unit: reading.unit, at }] : [];
    }
    case "glucose": {
      const reading = parseGlucose(view);
      return reading ? [{ metric: reading.metric, value: reading.value, unit: reading.unit, at }] : [];
    }
    case "pulse-oximeter": {
      const reading = parsePulseOximeter(view);
      if (!reading) return [];
      const out: PreviewReading[] = [
        { metric: reading.spo2.metric, value: reading.spo2.value, unit: reading.spo2.unit, at },
      ];
      if (reading.pulseRate) {
        out.push({ metric: reading.pulseRate.metric, value: reading.pulseRate.value, unit: reading.pulseRate.unit, at });
      }
      return out;
    }
    case "weight-scale": {
      const reading = parseWeight(view);
      return reading ? [{ metric: reading.metric, value: reading.value, unit: reading.unit, at }] : [];
    }
    default:
      return [];
  }
}

function simulateProfile(profileId: string, at: string): DataView {
  switch (profileId) {
    case "heart-rate":
      return simulateHeartRate(72);
    case "blood-pressure":
      return simulateBloodPressure(120, 80);
    case "thermometer":
      return simulateTemperature(37);
    case "glucose":
      return simulateGlucose(99.09, 1, at);
    case "pulse-oximeter":
      return simulatePulseOximeter(98, 66);
    case "weight-scale":
      return simulateWeight(70);
    default:
      throw new Error(`unknown BLE profile: ${profileId}`);
  }
}

function BluetoothForm() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [supported] = useState(() => typeof navigator !== "undefined" && "bluetooth" in navigator);
  const [profileId, setProfileId] = useState("blood-pressure");
  const [readings, setReadings] = useState<PreviewReading[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  function ingest(view: DataView, at: string) {
    const parsed = parseProfile(profileId, view, at);
    if (parsed.length === 0) {
      setNotice("The device sent a value this app could not read.");
      return;
    }
    setReadings((prev) =>
      profileId === "heart-rate" ? downsamplePerMinute([...prev, ...parsed]) : [...prev, ...parsed]
    );
  }

  async function connect() {
    setNotice(null);
    setBusy(true);
    setSimulated(false);
    try {
      const characteristic = await requestBleMeasurement(profileId);
      const listener = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) ingest(target.value, new Date().toISOString());
      };
      characteristic.addEventListener("characteristicvaluechanged", listener);
      await characteristic.startNotifications();
      setStreaming(true);
      stopRef.current = () => {
        characteristic.removeEventListener("characteristicvaluechanged", listener);
        void characteristic.stopNotifications().catch(() => undefined);
        setStreaming(false);
      };
    } catch {
      setNotice("Could not connect to the device. Try again next to it.");
    } finally {
      setBusy(false);
    }
  }

  function runSimulator() {
    setNotice(null);
    setSimulated(true);
    ingest(simulateProfile(profileId, new Date().toISOString()), new Date().toISOString());
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const id = crewId;
    if (!id) return;
    setNotice(null);
    setBusy(true);
    try {
      const session = await getSession(id);
      if (!session) {
        setNotice("Log in first, then save the reading.");
        return;
      }
      if (readings.length === 0) {
        setNotice("Connect a device or run the simulator first.");
        return;
      }
      const provenance = (
        simulated ? "simulated_device" : (session.provenance ?? "real")
      ) as Measurement["provenance"];
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "ble";
      const captureId = crypto.randomUUID();
      const records: Measurement[] = [];
      for (const reading of readings) {
        const record: Measurement = {
          client_id: crypto.randomUUID(),
          crew_id: id,
          metric: reading.metric,
          value_num: reading.value,
          value_text: null,
          unit: reading.unit,
          measured_at: reading.at,
          received_at: "",
          source: "ble",
          device_id: deviceId,
          capture_id: captureId,
          is_estimate: 0,
          confirmed_by_user: 0,
          provenance,
          setting: "iss",
          phase: "inflight" as Phase,
          phase_day: null,
          supersedes_client_id: null,
          voided: 0,
          catalog_version: "1",
          schema_version: 1,
        };
        const checked = validateRecord(record);
        if (!checked.ok) {
          setNotice(`${reading.metric}: ${checked.reason}`);
          return;
        }
        records.push(record);
      }
      const resultId = await assessAndQueue(id, "inflight", records);
      router.push(`/result?crew=${encodeURIComponent(id)}&result=${encodeURIComponent(resultId)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Bluetooth check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Read a standard Bluetooth health device. Heart-rate streams keep one value per minute.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-semibold text-foreground" htmlFor="ble-profile">
          Device profile
          <select
            id="ble-profile"
            data-testid="profile"
            value={profileId}
            onChange={(event) => {
              setProfileId(event.target.value);
              setReadings([]);
              setSimulated(false);
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          >
            {BLE_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy || streaming || !supported}
            title={supported ? undefined : UNSUPPORTED_REASON}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {streaming ? "Streaming…" : "Connect"}
          </button>
          <button
            type="button"
            data-testid="simulator"
            onClick={runSimulator}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
          >
            Simulator
          </button>
        </div>
        {!supported ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground" data-testid="ble-unsupported">
            {UNSUPPORTED_REASON}
          </p>
        ) : null}
      </div>
      {readings.length > 0 ? (
        <form
          onSubmit={(event) => {
            void save(event);
          }}
          className="mt-4 space-y-3"
        >
          <h2 className="text-base font-semibold text-foreground">Preview</h2>
          <ul className="space-y-1 text-sm text-foreground">
            {readings.map((reading, index) => (
              <li key={`${reading.metric}-${index}`}>
                {reading.metric}: {reading.value} {reading.unit}
              </li>
            ))}
          </ul>
          <button
            type="submit"
            data-testid="save"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save result
          </button>
        </form>
      ) : null}
      {notice ? <p className="mt-3 text-sm text-red-700">{notice}</p> : null}
    </div>
  );
}

export default function BluetoothPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <BluetoothForm />
    </Suspense>
  );
}

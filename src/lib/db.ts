import type { Measurement, Report, Result } from "@starplus/core";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

export interface OutboxItem {
  client_id: string;
  crew_id: string;
  kind: "measurement" | "result" | "report";
  payload: Measurement | Result | Report;
  state: "queued" | "sending" | "failed";
  attempts: number;
  error: string | null;
  created_at: string;
}

export interface ProfileRecord {
  crew_id: string;
  display_name: string;
  token: string | null;
  role: string | null;
  expires_at: string | null;
  device_id: string;
  pin_hash: string | null;
  shared_device: boolean;
}

export interface SettingRecord {
  key: string;
  value: string;
}

interface ProfileSchema extends DBSchema {
  measurements: { key: string; value: Measurement; indexes: { "by-metric-time": [string, string]; "by-received": string } };
  results: { key: string; value: Result; indexes: { "by-assessed": string } };
  reports: { key: string; value: Report; indexes: { "by-status": string } };
  content: { key: string; value: { id: string; json: string } };
}

interface DeviceSchema extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { "by-state": string } };
  settings: { key: string; value: SettingRecord };
  profiles: { key: string; value: ProfileRecord };
}

function upgradeProfile(db: IDBPDatabase<ProfileSchema>): void {
  const measurements = db.createObjectStore("measurements", { keyPath: "client_id" });
  measurements.createIndex("by-metric-time", ["metric", "measured_at"]);
  measurements.createIndex("by-received", "received_at");
  const results = db.createObjectStore("results", { keyPath: "client_id" });
  results.createIndex("by-assessed", "assessed_at");
  const reports = db.createObjectStore("reports", { keyPath: "client_id" });
  reports.createIndex("by-status", "status");
  db.createObjectStore("content", { keyPath: "id" });
}

export function profileDb(crewId: string): Promise<IDBPDatabase<ProfileSchema>> {
  return openDB<ProfileSchema>(`starplus-${crewId}`, 1, {
    upgrade(db) {
      upgradeProfile(db);
    },
  });
}

export function demoDb(): Promise<IDBPDatabase<ProfileSchema>> {
  return openDB<ProfileSchema>("starplus-demo", 1, {
    upgrade(db) {
      upgradeProfile(db);
    },
  });
}

export function deviceDb(): Promise<IDBPDatabase<DeviceSchema>> {
  return openDB<DeviceSchema>("starplus-device", 1, {
    upgrade(db) {
      const outbox = db.createObjectStore("outbox", { keyPath: "client_id" });
      outbox.createIndex("by-state", "state");
      db.createObjectStore("settings", { keyPath: "key" });
      db.createObjectStore("profiles", { keyPath: "crew_id" });
    },
  });
}

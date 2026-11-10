"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CATALOG, type Measurement, type Provenance } from "@starplus/core";
import { importCsv, importJsonRecords, parseCsvRows, suggestColumnMapping } from "@/lib/adapters/import-csv";
import { importFhir } from "@/lib/adapters/import-fhir";
import { enqueueMeasurement } from "@/lib/outbox";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

type ParsedFile =
  | { kind: "csv"; headers: string[]; text: string }
  | { kind: "fhir"; input: unknown }
  | { kind: "json"; items: unknown[] };

function parseFile(name: string, text: string): ParsedFile | { kind: "error"; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "error", reason: "empty file" };
  if (name.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { kind: "error", reason: "not valid JSON" };
    }
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (first && typeof first === "object" && ("resourceType" in first || "code" in first || "valueQuantity" in first)) {
        return { kind: "fhir", input: parsed };
      }
      return { kind: "json", items: parsed };
    }
    const record = parsed as Record<string, unknown> | null;
    if (record && (record.resourceType === "Bundle" || record.resourceType === "Observation" || "code" in record || "valueQuantity" in record)) {
      return { kind: "fhir", input: parsed };
    }
    return { kind: "error", reason: "unrecognized JSON: expected a FHIR Bundle/Observation or an array of records" };
  }
  const rows = parseCsvRows(trimmed);
  if (rows.length === 0) return { kind: "error", reason: "no header row" };
  return { kind: "csv", headers: rows[0], text: trimmed };
}

function ImportForm() {
  const session = useActiveCrew();
  const { crewId: activeCrewId, ready: crewReady } = session;
  const crewId = activeCrewId ?? "";
  const [ready, setReady] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [provenance, setProvenance] = useState<Provenance>("real");

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      const session = await getSession(crewId);
      if (session && (session.provenance === "real" || session.provenance === "synthetic" || session.provenance === "simulated_device")) {
        setProvenance(session.provenance);
      }
      setReady(true);
    })().catch(() => setReady(true));
  }, [crewId, crewReady]);

  const parsed = useMemo(() => (fileText === null ? null : parseFile(fileName, fileText)), [fileName, fileText]);
  const headers = parsed && parsed.kind === "csv" ? parsed.headers : null;
  const suggested = useMemo(() => (headers ? suggestColumnMapping(headers) : []), [headers]);

  const preview = useMemo((): { accepted: number; rejected: Array<{ reason: string; count: number }> } | { error: string } | null => {
    if (!parsed) return null;
    if (parsed.kind === "error") return { error: parsed.reason };
    if (parsed.kind === "fhir") {
      const outcome: { records: unknown[]; rejected: Array<{ reason: string }> } = importFhir(parsed.input, { crewId, provenance });
      return summarize(outcome.records.length, outcome.rejected.map((item: { reason: string }) => item.reason));
    }
    if (parsed.kind === "json") {
      const outcome: { records: unknown[]; rejected: Array<{ reason: string }> } = importJsonRecords(parsed.items, { crewId, provenance });
      return summarize(outcome.records.length, outcome.rejected.map((item: { reason: string }) => item.reason));
    }
    const effective = Object.fromEntries(headers!.map((header, index) => [header, mapping[header] ?? suggested[index] ?? null]));
    const outcome = importCsv(parsed.text, {
      crewId,
      provenance,
      measuredAt: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined,
      mapping: effective,
    });
    return summarize(outcome.records.length, outcome.rejected.map((item) => item.reason));
    function summarize(accepted: number, reasons: string[]) {
      const byReason = new Map<string, number>();
      for (const reason of reasons) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
      return { accepted, rejected: [...byReason].map(([reason, count]) => ({ reason, count })) };
    }
  }, [parsed, mapping, crewId, provenance, date, headers, suggested]);

  async function onFileChosen(file: File | undefined) {
    setNotice(null);
    setImported(null);
    setMapping({});
    if (!file) {
      setFileText(null);
      setFileName("");
      return;
    }
    setFileName(file.name);
    setFileText(await file.text());
  }

  async function onImport() {
    if (!parsed || parsed.kind === "error") return;
    setNotice(null);
    setBusy(true);
    try {
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "csv-import";
      let records: Measurement[] = [];
      if (parsed.kind === "csv") {
        const effective = Object.fromEntries(headers!.map((header, index) => [header, mapping[header] ?? suggested[index] ?? null]));
        const outcome = importCsv(parsed.text, {
          crewId,
          provenance,
          measuredAt: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined,
          deviceId,
          mapping: effective,
        });
        records = outcome.records;
      } else if (parsed.kind === "fhir") {
        const outcome = importFhir(parsed.input, { crewId, provenance, deviceId });
        records = outcome.records;
      } else {
        records = importJsonRecords(parsed.items, { crewId, provenance, deviceId }).records;
      }
      for (const record of records) {
        await enqueueMeasurement(crewId, { ...record, device_id: deviceId });
      }
      setImported(records.length);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Import data</h1>
      <p className="mt-1 text-sm text-muted-foreground">CSV files and FHIR observations import here. Everything stays on this device until a link returns.</p>
      <label htmlFor="import-file" className="mt-4 block text-sm font-semibold text-foreground">
        File (.csv or .json)
      </label>
      <input
        id="import-file"
        type="file"
        accept=".csv,.json,application/json,text/csv"
        onChange={(event) => {
          void onFileChosen(event.target.files?.[0]);
        }}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      {parsed && parsed.kind === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {parsed.reason}
        </p>
      )}
      {headers && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Column mapping</h2>
          {headers.map((header, index) => (
            <div key={header} className="mt-2 flex items-center gap-2">
              <span className="w-1/2 truncate text-sm text-foreground">{header}</span>
              <select
                aria-label={`Map ${header}`}
                value={mapping[header] ?? suggested[index] ?? ""}
                onChange={(event) => setMapping((prev) => ({ ...prev, [header]: event.target.value === "" ? null : event.target.value }))}
                className="w-1/2 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              >
                <option value="">Ignore</option>
                {CATALOG.measures.map((measure) => (
                  <option key={measure.code} value={measure.code}>
                    {measure.label} ({measure.unit})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <label htmlFor="import-date" className="mt-3 block text-sm font-semibold text-foreground">
            Date for rows without a timestamp
          </label>
          <input
            id="import-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      )}
      {preview && "accepted" in preview && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Preview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.accepted} accepted
            {preview.rejected.length > 0 && <> · {preview.rejected.map((item) => `${item.count} ${item.reason}`).join(" · ")}</>}
          </p>
          <ul className="mt-1 text-sm text-muted-foreground">
            {preview.rejected.map((item) => (
              <li key={item.reason}>
                {item.count} × {item.reason}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void onImport()}
            disabled={busy || preview.accepted === 0}
            className="mt-3 w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import ${preview.accepted} readings`}
          </button>
        </div>
      )}
      {imported !== null && (
        <p role="status" className="mt-3 text-sm text-green-700">
          Imported {imported} readings. They will sync when a link is available.{" "}
          <Link href={`/reports?crew=${encodeURIComponent(crewId)}`} className="underline">
            View reports
          </Link>
        </p>
      )}
      {notice && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {notice}
        </p>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <ImportForm />
    </Suspense>
  );
}

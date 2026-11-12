"use client";

import { useEffect, useState } from "react";
import { Citation } from "@/components/citation";
import { ConsultError, explainMedicine, type ConsultAnswer } from "@/lib/consult";

/**
 * Medicine explainer: components, use case and side effects in plain words.
 * Fetched from the assistant once, then kept in the device's content store,
 * so repeat visits (including offline) never call the model again.
 */
export function MedicineExplainer({ crewId, medicineId }: { crewId: string; medicineId: string }) {
  const [answer, setAnswer] = useState<ConsultAnswer | null>(null);
  const [cached, setCached] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotice(null);
      try {
        const result = await explainMedicine(crewId, medicineId);
        if (!cancelled) {
          setAnswer(result.answer);
          setCached(result.cached);
        }
      } catch (err) {
        if (!cancelled) setNotice(err instanceof ConsultError ? err.message : "The explainer failed. Try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crewId, medicineId]);

  return (
    <details className="mt-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-accent-strong underline">
        What is this?
        {cached && (
          <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-muted no-underline">
            Saved on this device
          </span>
        )}
      </summary>
      <div className="mt-2 rounded-lg bg-muted/40 p-3" aria-live="polite">
        {loading && <p className="text-sm text-muted">Loading the explanation…</p>}
        {notice && <p className="text-sm text-foreground">{notice}</p>}
        {answer && (
          <div className="text-sm text-foreground">
            {answer.answer.split("\n").map((line, i) => (
              <p key={i} className="mt-1 first:mt-0">
                {line}
              </p>
            ))}
            {answer.citations[0] && (
              <Citation
                source={`${answer.citations[0].title} — ${answer.citations[0].publisher}, ${answer.citations[0].year}`}
                className="mt-2"
              />
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              AI-written on first view and kept on this device, not reviewed; the formulary above rules.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

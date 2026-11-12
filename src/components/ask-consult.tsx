"use client";

import { useState } from "react";
import { Citation } from "@/components/citation";
import { askQuestion, ConsultError, type ConsultAnswer } from "@/lib/consult";

/**
 * "Ask about your result": one question about the cited source above,
 * answered by the Meta assistant through the server proxy. Each attempt
 * counts toward 10 per hour; past that the server says to contact the
 * flight surgeon. Nothing typed here should be personal: only the public
 * source text and the question leave the device.
 */
export function AskConsult({
  crewId,
  entryId,
  measureLabel,
}: {
  crewId: string;
  entryId: string;
  measureLabel: string;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ConsultAnswer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setNotice(null);
    setAnswer(null);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setNotice("You are offline. Connect to ask the assistant; the explanation above is always available.");
        return;
      }
      setAnswer(await askQuestion(crewId, { question: trimmed, entryIds: [entryId] }));
    } catch (err) {
      setNotice(err instanceof ConsultError ? err.message : "The assistant failed. Try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mt-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-accent-strong underline">
        Ask about your result
      </summary>
      <div className="mt-2 rounded-lg bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">
          Your question is sent to Meta&apos;s AI with the public source text above. Never type
          names, readings or other personal details.
        </p>
        <label className="mt-2 block text-sm" htmlFor={`ask-${entryId}`}>
          Your question about {measureLabel} (10 per hour)
          <input
            id={`ask-${entryId}`}
            value={question}
            maxLength={500}
            autoComplete="off"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: why does this matter?"
            className="mt-1 min-h-11 w-full rounded-control border border-input bg-card px-3 py-2 text-foreground"
          />
        </label>
        <button
          type="button"
          disabled={!question.trim() || busy}
          onClick={() => void ask()}
          className="mt-2 min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Asking…" : "Ask"}
        </button>
        <div aria-live="polite">
          {notice && (
            <p role={notice.toLowerCase().includes("flight surgeon") ? "status" : "alert"} className="mt-2 text-sm text-foreground">
              {notice}
            </p>
          )}
          {answer && (
            <div className="mt-2 text-sm text-foreground">
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
                AI-written at your request, not reviewed; the cited source above rules.
              </p>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

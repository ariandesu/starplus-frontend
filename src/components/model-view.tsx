"use client";

import type { ModelAdvice } from "@starplus/core";

export function ModelView({ advice }: { advice: ModelAdvice | null }) {
  return (
    <section aria-label="Model view" className="rounded-xl border border-border bg-muted/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">Model view (advisory only)</h3>
      {advice === null ? (
        <p className="mt-1 text-sm text-muted-foreground">Model unavailable. Follow the result above.</p>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">
          <p>
            Estimated probability {Math.round(advice.probability * 100)}% (model {advice.model_version}).
          </p>
          {advice.disagrees && (
            <p className="mt-1">
              The model disagrees with the rule-based result. Follow the result above; tell the crew
              medical officer if you are concerned.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

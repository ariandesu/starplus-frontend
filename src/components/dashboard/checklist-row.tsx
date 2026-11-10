"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistRowProps {
  label: string;
  done: boolean;
  note?: string;
  className?: string;
}

export function ChecklistRow({ label, done, note, className }: ChecklistRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-tile px-3 py-2",
        done ? "bg-accent/20" : "bg-surface",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          done ? "bg-foreground text-primary-foreground" : "border border-border"
        )}
        aria-hidden
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      {note && <span className="font-mono text-xs text-muted">{note}</span>}
      <span className="sr-only">{done ? "Done" : "Not done"}</span>
    </div>
  );
}

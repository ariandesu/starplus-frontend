"use client";

import * as React from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/dashboard/demo-badge";

export interface AccordionItem {
  title: string;
  content: string;
  status: "normal" | "watch" | "critical";
  updated?: string;
}

interface HorizontalAccordionProps {
  items: AccordionItem[];
  isDemo?: boolean;
  className?: string;
}

export function HorizontalAccordion({ items, isDemo, className }: HorizontalAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="watch" className={cn("px-4 py-8 sm:px-6 max-w-6xl mx-auto w-full", className)}>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">WATCH Signals</h2>
          {isDemo && <DemoBadge />}
        </div>
        <p className="text-muted">Deviations from each crew member&apos;s 30-day baseline over a 72-hour window.</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-background p-6 text-sm text-muted">
          No WATCH signals recorded.
        </p>
      ) : (
        // Stacked on mobile, horizontal scroll from sm up.
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:overflow-x-auto pb-2 no-scrollbar sm:snap-x sm:snap-mandatory">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `watch-panel-${index}`;
            return (
              <div
                key={index}
                className={cn(
                  "shrink-0 w-full sm:w-72 snap-start self-start rounded-xl border bg-background transition-shadow duration-300",
                  isOpen ? "border-accent shadow-md" : "border-border"
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full text-left p-4 sm:p-5 focus-ring rounded-xl"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    <Badge
                      variant={item.status === "normal" ? "secondary" : item.status === "watch" ? "outline" : "destructive"}
                    >
                      {item.status === "normal" ? "Nominal" : item.status === "watch" ? "WATCH" : "CRITICAL"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>{item.updated ? `Updated ${item.updated}` : isOpen ? "Hide details" : "Show details"}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isOpen && "rotate-180")} />
                  </div>
                </button>

                {isOpen && (
                  <div id={panelId} className="border-t border-border p-4 sm:p-5 bg-accent/5 rounded-b-xl">
                    <p className="text-sm text-foreground leading-relaxed">{item.content}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

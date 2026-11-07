"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AccordionItem {
  title: string;
  content: string;
  status: "normal" | "watch" | "critical";
}

interface HorizontalAccordionProps {
  items: AccordionItem[];
  className?: string;
}

export function HorizontalAccordion({
  items,
  className,
}: HorizontalAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className={cn("px-4 py-8 sm:px-6 max-w-6xl mx-auto", className)}>
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">WATCH Signals</h2>
        <p className="text-muted">Vital deviations requiring medical review.</p>
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className={cn(
                "flex-shrink-0 w-full sm:w-72 rounded-xl border border-border bg-background transition-all duration-300",
                isOpen ? "shadow-lg ring-1 ring-accent" : ""
              )}
            >
              <div className="p-4 sm:p-6 cursor-pointer group" onClick={() => toggle(index)}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <Badge variant={item.status === "normal" ? "default" : item.status === "watch" ? "outline" : "destructive"}>
                    {item.status === "normal" ? "Nominal" : item.status === "watch" ? "WATCH" : "CRITICAL"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted mb-3">
                  <span>Last updated: 2m ago</span>
                  <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", isOpen ? "rotate-90" : "")} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); toggle(index); }} className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20">
                    {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border p-4 sm:p-6 bg-accent/5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-sm text-foreground">{item.content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const DEFAULT_ITEMS: AccordionItem[] = [
  {
    title: "Crew Member A-04",
    content: "Heart rate elevated 12% above 30-day baseline. Trending upward over 72-hour window. Recommend cardiovascular assessment.",
    status: "watch",
  },
  {
    title: "Crew Member B-02",
    content: "SpO2 within nominal parameters. No deviations detected in last 72 hours.",
    status: "normal",
  },
  {
    title: "Crew Member C-09",
    content: "CO2 levels trending above threshold in Module 3. ECLSS team notified.",
    status: "critical",
  },
  {
    title: "Crew Member D-01",
    content: "Sleep cycle disruption detected. Recommend melatonin protocol review.",
    status: "watch",
  },
];

export function WATCHSignals() {
  return <HorizontalAccordion items={DEFAULT_ITEMS} />;
}

import { cn } from "@/lib/utils";

/** Marks a section whose numbers are sample data, not live readings. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted",
        className
      )}
    >
      Sample data
    </span>
  );
}

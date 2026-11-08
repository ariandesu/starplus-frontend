import { cn } from "@/lib/utils";

/** Marks content whose numbers are synthetic demo data, not live readings. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted",
        className
      )}
    >
      Synthetic demo data
    </span>
  );
}

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "w-full bg-accent px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-accent-foreground",
        className
      )}
    >
      Demo mode — everything shown is synthetic and stays on this device
    </div>
  );
}

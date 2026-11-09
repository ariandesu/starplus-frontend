import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  nominal: "bg-accent/10 text-accent",
  watch: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
  insufficient: "bg-muted text-white",
};

export function Citation({ source, className }: { source: string; className?: string }) {
  if (!source) return null;
  return <p className={cn("text-xs text-muted", className)}>Source: {source}</p>;
}

export function StatusTone({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[status] ?? TONES.insufficient,
        className
      )}
    >
      {status}
    </span>
  );
}

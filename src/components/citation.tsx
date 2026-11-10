import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/ui/status-pill";

export function Citation({ source, className }: { source: string; className?: string }) {
  if (!source) return null;
  return <p className={cn("text-xs text-muted", className)}>Source: {source}</p>;
}

export function StatusTone({ status, className }: { status: string; className?: string }) {
  return <StatusPill status={status} className={className} />;
}

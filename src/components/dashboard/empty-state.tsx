import * as React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  tone?: "normal" | "watch" | "critical" | "insufficient";
  action?: React.ReactNode;
  className?: string;
}

const TONES = {
  normal: { icon: CheckCircle2, wrap: "bg-accent/10 text-accent" },
  watch: { icon: AlertCircle, wrap: "bg-amber-100 text-amber-700" },
  critical: { icon: AlertTriangle, wrap: "bg-red-100 text-red-700" },
  insufficient: { icon: HelpCircle, wrap: "bg-muted text-muted-foreground" },
} as const;

export function EmptyState({ title, description, tone = "normal", action, className }: EmptyStateProps) {
  const { icon: Icon, wrap } = TONES[tone];
  return (
    <Card role="status" className={cn("flex items-start gap-4 p-5 sm:p-6", className)}>
      <div className={cn("shrink-0 w-11 h-11 rounded-full flex items-center justify-center", wrap)}>
        <Icon className="w-5 h-5" aria-hidden />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted mt-0.5">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </Card>
  );
}

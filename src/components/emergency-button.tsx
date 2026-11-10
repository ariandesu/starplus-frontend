"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmergencyButton({ className }: { className?: string }) {
  return (
    <Link
      href="/emergency"
      aria-label="Emergency help"
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-danger px-4 py-2 text-sm font-bold text-danger-foreground",
        "hover:bg-danger/90 focus-ring",
        className
      )}
    >
      Emergency
    </Link>
  );
}

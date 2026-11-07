"use client";

import * as React from "react";
import { useState } from "react";
import { ShieldAlert, HeartPulse, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DemoBadge } from "@/components/dashboard/demo-badge";

interface Role {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

// One accent colour for every role (design rule: max 1 accent). Active styling
// uses static class names, so Tailwind can find them at build time.
const ROLES: Role[] = [
  {
    id: "astronaut",
    label: "Astronaut",
    description: "Personal health metrics and crew status.",
    icon: HeartPulse,
  },
  {
    id: "medical",
    label: "Flight Medical Officer",
    description: "Clinical oversight and WATCH signal triage.",
    icon: ShieldAlert,
  },
  {
    id: "mission",
    label: "Mission Control",
    description: "Fleet-wide telemetry and anomaly management.",
    icon: Users,
  },
];

export interface RoleStat {
  label: string;
  value: string;
  status: "normal" | "watch" | "critical";
}

interface RoleSwitcherProps {
  stats: RoleStat[];
  isDemo?: boolean;
  onRoleChange?: (role: string) => void;
  className?: string;
}

export function RoleSwitcher({ stats, isDemo, onRoleChange, className }: RoleSwitcherProps) {
  const [activeRole, setActiveRole] = useState<Role>(ROLES[1]);
  const ActiveIcon = activeRole.icon;

  return (
    <section id="roles" className={cn("px-4 py-8 sm:px-6 max-w-6xl mx-auto w-full", className)}>
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Role View</h2>
        {isDemo && <DemoBadge />}
      </div>

      <div role="tablist" aria-label="Role" className="flex flex-wrap gap-2 mb-6">
        {ROLES.map((role) => {
          const isActive = activeRole.id === role.id;
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveRole(role);
                onRoleChange?.(role.id);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 border focus-ring",
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-muted hover:bg-accent/5 hover:text-accent"
              )}
            >
              <Icon className="w-4 h-4" />
              {role.label}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <ActiveIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{activeRole.label}</h3>
                <p className="text-sm text-muted">{activeRole.description}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                    </div>
                    <Badge
                      variant={
                        stat.status === "normal" ? "secondary" : stat.status === "watch" ? "outline" : "destructive"
                      }
                    >
                      {stat.status === "normal" ? "Nominal" : stat.status === "watch" ? "WATCH" : "CRITICAL"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

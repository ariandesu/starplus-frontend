"use client";

import * as React from "react";
import { useState } from "react";
import { ShieldAlert, HeartPulse, Users, BarChart3, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

interface Role {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const ROLES: Role[] = [
  {
    id: "astronaut",
    label: "Astronaut",
    description: "Personal health metrics and crew status.",
    icon: HeartPulse,
    color: "#0EA5E9",
  },
  {
    id: "medical",
    label: "Flight Medical Officer",
    description: "Clinical oversight and WATCH signal triage.",
    icon: ShieldAlert,
    color: "#F59E0B",
  },
  {
    id: "mission",
    label: "Mission Control",
    description: "Fleet-wide telemetry and anomaly management.",
    icon: Users,
    color: "#10B981",
  },
];

interface RoleSwitcherProps {
  onRoleChange?: (role: string) => void;
  className?: string;
}

export function RoleSwitcher({ onRoleChange, className }: RoleSwitcherProps) {
  const [activeRole, setActiveRole] = useState<Role>(ROLES[1]);

  return (
    <section className={cn("px-4 py-8 sm:px-6 max-w-6xl mx-auto", className)}>
      <div className="flex flex-wrap gap-3 justify-center sm:justify-start mb-8">
        {ROLES.map((role) => {
          const isActive = activeRole.id === role.id;
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              onClick={() => {
                setActiveRole(role);
                onRoleChange?.(role.id);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border",
                isActive
                  ? `border-[#${role.color.slice(1)}] bg-[#${role.color.slice(1)}]/10 text-[#${role.color.slice(1)}]`
                  : "border-border bg-background text-muted hover:bg-accent/5 hover:text-accent"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-accent" : "text-muted")} />
              {role.label}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 border-r border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-lg bg-${activeRole.color.replace('#', '')}/10 text-${activeRole.color.replace('#', '')}`}>
                <activeRole.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{activeRole.label}</h3>
                <p className="text-sm text-muted">{activeRole.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { label: "Real-time telemetry", active: true },
                { label: "WATCH signal alerts", active: true },
                { label: "Crew health trends", active: true },
                { label: "Mission timeline", active: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-accent/5">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted"}`}>
                    {item.active ? "Online" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">{activeRole.label} View</h2>
              <Separator orientation="vertical" className="h-6" />
              <p className="text-muted">{activeRole.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Active Crew", value: "4/4", status: "normal" },
                { label: "WATCH Signals", value: "2", status: "watch" },
                { label: "Critical Alerts", value: "0", status: "normal" },
                { label: "System Health", value: "99.8%", status: "normal" },
              ].map((stat) => (
                <Card key={stat.label} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    </div>
                    <Badge variant={stat.status === "normal" ? "default" : "outline"}>
                      {stat.status === "normal" ? "Nominal" : "WATCH"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

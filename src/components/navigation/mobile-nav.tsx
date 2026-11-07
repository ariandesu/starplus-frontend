"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Home, HeartPulse, ShieldAlert, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Vitals", href: "/vitals", icon: HeartPulse },
  { label: "Alerts", href: "/alerts", icon: ShieldAlert },
  { label: "Crew", href: "/crew", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function MobileNav({ isOpen, onToggle }: MobileNavProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-background border-l border-border shadow-xl flex flex-col transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-lg tracking-tight">STAR PLUS</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onToggle} className="absolute right-6 top-6">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <nav className="flex-1 p-6 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                "text-muted hover:bg-accent/10 hover:text-accent",
                "border-transparent"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
          <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center">
            <Users className="w-5 h-5 text-muted" />
          </div>
          <div>
            <div className="text-sm font-medium">Mission Control</div>
            <div className="text-xs text-muted">Role: Flight Medical Officer</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function TopBar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onToggle} className="hidden sm:block">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex justify-center">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">S</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge className="h-8 px-3">LIVE</Badge>
        </div>
      </div>
    </header>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent", className)}>
      {children}
    </span>
  );
}

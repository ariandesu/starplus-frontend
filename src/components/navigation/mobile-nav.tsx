"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, Home, HeartPulse, Siren, FileText, LogIn, LogOut, ChartLine, Stethoscope, Settings, FlaskConical, PersonStanding, Trophy, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceDb } from "@/lib/db";
import { logout } from "@/lib/session";
import { navItemsForRole } from "@/lib/nav-items";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ICONS: Record<string, React.ElementType> = {
  Home,
  "Self-check": HeartPulse,
  History: ChartLine,
  Body: PersonStanding,
  Progress: Trophy,
  Medicines: Pill,
  Emergency: Siren,
  Reports: FileText,
  Surgeon: Stethoscope,
  Settings: Settings,
  Demo: FlaskConical,
  Login: LogIn,
  Dashboard: Stethoscope,
  Crew: PersonStanding,
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
        <span className="text-accent-foreground font-bold text-sm">S</span>
      </div>
      <span className="font-bold text-base tracking-tight">STAR PLUS</span>
    </div>
  );
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const router = useRouter();
  const [crewId, setCrewId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    deviceDb()
      .then(async (db) => {
        const active = await db.get("settings", "active_crew");
        const id = typeof active?.value === "string" && active.value ? active.value : null;
        setCrewId(id);
        if (id) {
          const profile = await db.get("profiles", id);
          setRole(profile?.role ?? null);
        } else {
          setRole(null);
        }
      })
      .catch(() => undefined);
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  async function signOut() {
    if (crewId) await logout(crewId).catch(() => undefined);
    onClose();
    router.push("/login");
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/30 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        id="site-nav"
        aria-label="Main navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-background border-l border-border shadow-xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex items-center justify-center rounded-lg text-foreground hover:bg-surface focus-ring"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItemsForRole(role).map((item) => {
            const Icon = NAV_ICONS[item.label] ?? Menu;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-accent/10 hover:text-accent focus-ring"
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </a>
            );
          })}
          {crewId && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-accent/10 hover:text-accent focus-ring"
            >
              <LogOut className="w-5 h-5" />
              Log out
            </button>
          )}
        </nav>
      </aside>
    </>
  );
}

export function TopBar({
  isOpen,
  onToggle,
  trailing,
  context,
}: {
  isOpen: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
  context?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-2 max-w-6xl mx-auto">
        <Link href="/" className="focus-ring rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          {context && <span className="hidden sm:inline text-xs text-muted">{context}</span>}
          {trailing}
          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            aria-controls="site-nav"
            className="inline-flex items-center justify-center rounded-lg text-foreground hover:bg-surface focus-ring"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

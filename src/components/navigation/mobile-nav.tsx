"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, Home, HeartPulse, Siren, FileText, LogIn, LogOut, ChartLine, Stethoscope, Settings, FlaskConical, PersonStanding, Trophy, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceDb } from "@/lib/db";
import { logout } from "@/lib/session";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// App routes for the self-check app.
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Self-check", href: "/check", icon: HeartPulse },
  { label: "History", href: "/history", icon: ChartLine },
  { label: "Body", href: "/body", icon: PersonStanding },
  { label: "Progress", href: "/progress", icon: Trophy },
  { label: "Medicines", href: "/medicines", icon: Pill },
  { label: "Emergency", href: "/emergency", icon: Siren },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Surgeon", href: "/surgeon", icon: Stethoscope },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Demo", href: "/demo", icon: FlaskConical },
  { label: "Login", href: "/login", icon: LogIn },
];

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
  useEffect(() => {
    if (!isOpen) return;
    deviceDb()
      .then((db) => db.get("settings", "active_crew"))
      .then((row) => {
        setCrewId(typeof row?.value === "string" && row.value ? row.value : null);
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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
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

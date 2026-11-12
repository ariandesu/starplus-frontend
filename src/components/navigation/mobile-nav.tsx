"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Home, HeartPulse, Siren, FileText, LogIn, LogOut, ChartLine, Stethoscope, Settings, FlaskConical, PersonStanding, Trophy, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceDb } from "@/lib/db";
import { logout } from "@/lib/session";
import { navItemsForRole } from "@/lib/nav-items";
import { activeHref, groupNav } from "./nav-groups";
import { useIsDesktop, useIsMobileChrome } from "./use-is-desktop";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
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

const ROLE_LABELS: Record<string, string> = {
  astronaut: "Astronaut",
  flight_medical_officer: "Flight medical officer",
  mission_control: "Mission Control",
};

function roleText(role: string | null): string {
  return ROLE_LABELS[role ?? ""] ?? ROLE_LABELS.astronaut;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
        <span className="text-sm font-bold text-accent-foreground">S</span>
      </div>
      <span className="text-base font-bold tracking-tight text-foreground">STAR PLUS</span>
    </div>
  );
}

export function MobileNav({ isOpen, onClose, context }: MobileNavProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobileChrome();
  const [crewId, setCrewId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: string | null } | null>(null);

  useEffect(() => {
    if (!isOpen && !isDesktop) return;
    deviceDb()
      .then(async (db) => {
        const active = await db.get("settings", "active_crew");
        const id = typeof active?.value === "string" && active.value ? active.value : null;
        setCrewId(id);
        if (!id) {
          setProfile(null);
          return;
        }
        const row = await db.get("profiles", id);
        setProfile(row ? { name: row.display_name, role: row.role ?? null } : null);
      })
      .catch(() => undefined);
  }, [isOpen, isDesktop, pathname]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, isMobile, onClose]);

  async function signOut() {
    if (crewId) await logout(crewId).catch(() => undefined);
    onClose();
    router.push("/login");
  }

  const role = profile?.role ?? null;
  const items = navItemsForRole(role);
  const groups = groupNav(items, role);
  const current = activeHref(pathname, items);

  return (
    <>
      {isMobile && (
        <div
          aria-hidden
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-40 bg-foreground/30 transition-opacity duration-300 motion-reduce:transition-none",
            isOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
      )}
      <aside
        id="site-nav"
        aria-label="Main navigation"
        aria-hidden={(isMobile && !isOpen) || undefined}
        inert={isMobile && !isOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-border bg-background transition-transform duration-300 ease-in-out motion-reduce:transition-none sm:w-80",
          "lg:z-30 lg:w-[264px] lg:translate-x-0",
          isMobile ? "shadow-xl" : "",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link href="/" className="focus-ring rounded-lg">
            <Logo />
          </Link>
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-lg text-foreground hover:bg-surface-2 focus-ring"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {context && (
          <div className="px-4 pt-3">
            <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted">
              {context}
            </span>
          </div>
        )}

        <nav className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.label] ?? Menu;
                  const active = item.href === current;
                  return (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-tile px-3 py-2 text-sm font-medium transition-colors focus-ring",
                          active
                            ? "bg-card text-foreground shadow-card"
                            : "text-muted hover:bg-surface-2 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div aria-hidden className="hidden shrink-0 px-4 pb-2 lg:block">
          <img
            src="/sidebar-earth.jpg"
            alt=""
            className="h-28 w-full rounded-tile border border-border object-cover object-bottom"
          />
        </div>

        {crewId && (
          <div className="border-t border-border p-4">
            {profile && (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-foreground"
                >
                  {initials(profile.name)}
                </span>
                <span className="text-sm text-foreground">{`${profile.name} · ${roleText(profile.role)}`}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className={cn(
                "flex w-full items-center gap-3 rounded-tile px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-ring",
                profile && "mt-3"
              )}
            >
              <LogOut className="h-5 w-5" aria-hidden />
              Log out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export function TopBar({
  isOpen,
  onToggle,
  trailing,
  bare = false,
}: {
  isOpen: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
  bare?: boolean;
}) {
  const isMobile = useIsMobileChrome();
  const showMenu = isMobile && !bare;
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center gap-3 px-4 py-2",
          showMenu ? "justify-between" : "justify-end"
        )}
      >
        {showMenu && (
          <Link href="/" className="focus-ring rounded-lg">
            <Logo />
          </Link>
        )}
        <div className="flex items-center gap-2">
          {trailing}
          {showMenu && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="site-nav"
              className="inline-flex items-center justify-center rounded-lg text-foreground hover:bg-surface-2 focus-ring"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

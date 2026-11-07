"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { TopBar, MobileNav } from "./mobile-nav";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar isOpen={isOpen} onToggle={() => setIsOpen((prev) => !prev)} />
      <MobileNav isOpen={isOpen} onClose={close} />
      {/* TopBar is sticky (it takes up space), so main needs no top padding. */}
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

"use client";

import * as React from "react";
import { useState } from "react";
import { TopBar, MobileNav } from "./mobile-nav";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <TopBar isOpen={isOpen} onToggle={() => setIsOpen((prev) => !prev)} />
      <MobileNav isOpen={isOpen} onToggle={() => setIsOpen((prev) => !prev)} />
      <main className="flex-1 overflow-x-hidden pt-16 sm:pt-20">
        {children}
      </main>
    </div>
  );
}

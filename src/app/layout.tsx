import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/navigation/dashboard-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  title: "STAR PLUS — Astronaut Self-Check",
  description: "Offline-first astronaut health self-check: status per measure with cited sources.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col antialiased">
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

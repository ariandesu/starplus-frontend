import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/navigation/dashboard-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  title: "STAR PLUS — Astronaut Self-Check",
  description: "Offline-first astronaut health self-check: status per measure with cited sources.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9EAEC" },
    { media: "(prefers-color-scheme: dark)", color: "#060A13" },
  ],
};

// Set the theme before the first paint so the wrong skin never flashes.
const THEME_SCRIPT =
  "(function(){try{var v=localStorage.getItem('starplus-theme');" +
  "var t=v==='light'||v==='dark'?v:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');" +
  "document.documentElement.dataset.theme=t;}catch(e){}})();";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

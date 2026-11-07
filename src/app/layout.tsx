import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STAR PLUS — Astronaut Health Monitoring",
  description: "Mobile-first dashboard for astronaut health monitoring, WATCH signals, and mission control telemetry.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}

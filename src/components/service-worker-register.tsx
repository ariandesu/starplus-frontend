"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const svc = (window as unknown as Record<string, { register?: () => Promise<unknown> }>).serwist;
    if (svc && typeof svc.register === "function") {
      svc.register().catch(() => undefined);
    } else {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);
  return null;
}

"use client";

export function waitingBannerText(waiting: boolean, hasSession: boolean): string | null {
  if (!waiting) return null;
  return hasSession
    ? "1 emergency report waiting — sending when the link is up."
    : "1 emergency report waiting — log in to send it.";
}

export function WaitingBanner({ waiting, hasSession }: { waiting: boolean; hasSession: boolean }) {
  const text = waitingBannerText(waiting, hasSession);
  if (!text) return null;
  return (
    <p role="status" className="mt-2 rounded-lg bg-status-watch-bg px-3 py-2 text-sm text-status-watch-fg">
      {text}
    </p>
  );
}

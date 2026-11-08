import { flush, onQueued, outboxStatus, type FlushOutcome } from "./outbox";
import { getSession, listProfiles } from "./session";

let inFlight: Promise<FlushOutcome> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelScheduledSync(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export async function rescheduleSync(now = Date.now()): Promise<void> {
  cancelScheduledSync();
  const { waiting, nextRetryAt } = await outboxStatus();
  if (waiting > 0 && nextRetryAt !== null) {
    const delay = Math.max(0, nextRetryAt - now);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void requestOutboxSync().catch(() => undefined);
    }, delay);
  }
}

export function requestOutboxSync(): Promise<FlushOutcome> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      return await flush();
    } finally {
      inFlight = null;
      await rescheduleSync();
    }
  })();
  return inFlight;
}

export async function syncIfSession(): Promise<FlushOutcome | null> {
  for (const profile of await listProfiles()) {
    if (await getSession(profile.crew_id)) return requestOutboxSync();
  }
  return null;
}

export function startOutboxSync(): () => void {
  void syncIfSession().catch(() => undefined);
  void rescheduleSync().catch(() => undefined);
  const onOnline = () => {
    void requestOutboxSync().catch(() => undefined);
  };
  window.addEventListener("online", onOnline);
  const offQueued = onQueued(() => {
    void requestOutboxSync().catch(() => undefined);
  });
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("online", onOnline);
    offQueued();
    cancelScheduledSync();
  };
}

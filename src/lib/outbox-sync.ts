import { flush, onQueued, outboxStatus, type FlushOutcome } from "./outbox";
import { getSession, listProfiles } from "./session";

let inFlight: Promise<FlushOutcome> | null = null;
let dirty = false;
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

export function requestOutboxSync(options?: { force?: boolean }): Promise<FlushOutcome> {
  if (!options?.force && typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.resolve({ sent: 0, failed: 0, nextRetryAt: null });
  }
  if (inFlight) {
    dirty = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      return await flush(Date.now(), options);
    } finally {
      inFlight = null;
      await rescheduleSync();
      if (dirty) {
        dirty = false;
        void requestOutboxSync().catch(() => undefined);
      }
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
    void requestOutboxSync({ force: true }).catch(() => undefined);
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

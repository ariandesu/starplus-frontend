import { flush, onQueued, outboxStatus, type FlushOutcome } from "./outbox";
import { deviceDb } from "./db";
import { getSession, listProfiles } from "./session";

let inFlight: Promise<FlushOutcome> | null = null;
let dirty = false;
let dirtyForce = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

type SyncedListener = () => void;

const syncedListeners = new Set<SyncedListener>();

export function onSynced(listener: SyncedListener): () => void {
  syncedListeners.add(listener);
  return () => {
    syncedListeners.delete(listener);
  };
}

function notifySynced(): void {
  for (const listener of syncedListeners) {
    try {
      listener();
    } catch {
      // Listener failures must never break syncing.
    }
  }
}

async function outboxFingerprint(): Promise<string> {
  const db = await deviceDb();
  const items = await db.getAll("outbox");
  return items
    .map((item) => `${item.client_id}:${item.state}:${item.attempts}:${item.error ?? ""}`)
    .sort()
    .join("|");
}

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
    dirtyForce = dirtyForce || options?.force === true;
    return inFlight;
  }
  inFlight = (async () => {
    const before = await outboxFingerprint();
    let changed = false;
    try {
      const outcome = await flush(Date.now(), options);
      if (outcome.sent > 0 || outcome.failed > 0) changed = true;
      return outcome;
    } finally {
      inFlight = null;
      await rescheduleSync();
      if (!changed) {
        changed = (await outboxFingerprint()) !== before;
      }
      if (changed) notifySynced();
      if (dirty) {
        dirty = false;
        const force = dirtyForce;
        dirtyForce = false;
        void requestOutboxSync(force ? { force: true } : undefined).catch(() => undefined);
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
    notifySynced();
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

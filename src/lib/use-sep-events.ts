"use client";

import { useEffect, useState } from "react";
import { fetchSepEvents, parseSepEvents, type SepEvent } from "@/lib/donki";

const CACHE_KEY = "starplus-sep-cache";
const FRESH_MS = 24 * 60 * 60 * 1000;

export interface SepNotice {
  events: SepEvent[];
  asOf: string | null;
  fromCache: boolean;
}

function readCache(): { events: SepEvent[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { events?: unknown; fetchedAt?: unknown };
    if (typeof parsed.fetchedAt !== "number") return null;
    return { events: parseSepEvents(parsed.events), fetchedAt: parsed.fetchedAt };
  } catch {
    return null;
  }
}

function dayOf(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Best-effort solar-particle-event notice. Never throws, never blocks the
 * card: offline or a dead feed simply means no notice.
 */
export function useSepEvents(): SepNotice | null {
  const [notice, setNotice] = useState<SepNotice | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
        if (!cancelled) {
          setNotice({ events: cached.events, asOf: dayOf(cached.fetchedAt), fromCache: true });
        }
        return;
      }
      try {
        const events = await fetchSepEvents();
        const fetchedAt = Date.now();
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ events, fetchedAt }));
        } catch {
          // Private browsing or full storage: caching is best-effort.
        }
        if (!cancelled) setNotice({ events, asOf: dayOf(fetchedAt), fromCache: false });
      } catch {
        if (!cancelled && cached) {
          setNotice({ events: cached.events, asOf: dayOf(cached.fetchedAt), fromCache: true });
        }
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return notice;
}

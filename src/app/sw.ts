/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

async function matchPrecache(pathname: string): Promise<Response | undefined> {
  for (const name of await caches.keys()) {
    if (!name.includes("precache")) continue;
    const hit = await (await caches.open(name)).match(pathname, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
});

async function fetchWithTimeout(request: Request, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Registered before Serwist's own fetch listener, so navigations are matched
// by path first: /check?crew=x and /result?crew=x&result=y serve the same
// cached document as /check and /result.
//
// Page loads are network-first (3 s) so the first visit after a deploy runs
// the new build; on a slow or offline link they fall back to the precache,
// then to the documents cache. Non-navigation requests fall through to
// Serwist untouched.
self.addEventListener("fetch", (event) => {
  const request = (event as FetchEvent).request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  const path = `${url.origin}${url.pathname}`;
  (event as FetchEvent).respondWith(
    (async () => {
      try {
        const response = await fetchWithTimeout(request, 3000);
        if (response && response.ok) {
          const copy = await caches.open("documents");
          await copy.put(path, response.clone());
          return response;
        }
      } catch {
        // Slow or offline: prefer a cached document over a blank screen.
      }
      const precached = await matchPrecache(path);
      if (precached) return precached;
      const fallback = await caches.open("documents").then((cache) => cache.match(path, { ignoreSearch: true }));
      if (fallback) return fallback;
      const home = await matchPrecache(`${url.origin}/`);
      if (home) return home;
      return Response.error();
    })()
  );
});

serwist.addEventListeners();

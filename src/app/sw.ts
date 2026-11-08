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

// Registered before Serwist's own fetch listener, so navigations are matched
// by path first: /check?crew=x and /result?crew=x&result=y serve the same
// cached document as /check and /result. Non-navigation requests fall through
// to Serwist untouched.
self.addEventListener("fetch", (event) => {
  const request = (event as FetchEvent).request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  const path = `${url.origin}${url.pathname}`;
  (event as FetchEvent).respondWith(
    (async () => {
      const precached = await matchPrecache(path);
      if (precached) return precached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = await caches.open("documents");
          await copy.put(path, response.clone());
        }
        return response;
      } catch {
        const fallback = await caches.open("documents").then((cache) => cache.match(path, { ignoreSearch: true }));
        if (fallback) return fallback;
        const home = await matchPrecache(`${url.origin}/`);
        if (home) return home;
        return Response.error();
      }
    })()
  );
});

serwist.addEventListeners();

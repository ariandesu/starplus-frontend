/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Route, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// Documents are matched by path, ignoring the query string: /check?crew=x and
// /result?crew=x&result=y serve the same cached document as /check and /result.
const documentsByPath = new Route(
  ({ request }: { request: Request }) => request.mode === "navigate",
  async ({ request, url }: { request: Request; url: URL }) => {
    const cache = await caches.open("documents");
    const key = url.origin + url.pathname;
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(key, response.clone());
      return response;
    } catch {
      const fallback = await cache.match(key, { ignoreSearch: true });
      if (fallback) return fallback;
      const home = await cache.match(`${url.origin}/`, { ignoreSearch: true });
      if (home) return home;
      return Response.error();
    }
  }
);

serwist.registerRoute(documentsByPath);

serwist.addEventListeners();

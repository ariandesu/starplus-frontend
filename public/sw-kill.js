// Rollback worker: unregisters itself and every service worker, then removes itself.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", async () => {
  const registrations = await self.registration.unregister
    ? [self.registration]
    : [];
  for (const registration of registrations) {
    await registration.unregister();
  }
  const all = await navigator.serviceWorker.getRegistrations();
  for (const registration of all) {
    await registration.unregister();
  }
});

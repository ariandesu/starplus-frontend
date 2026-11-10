"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribeMounted(): () => void {
  return () => undefined;
}

function getMountedSnapshot(): boolean {
  return true;
}

function getServerMountedSnapshot(): boolean {
  return false;
}

/**
 * True only for the phone/tablet chrome, and only after hydration. The server
 * snapshot is never desktop, so anything mobile-only must wait for hydration or
 * the hamburger would be rendered at 1024px until React takes over.
 */
export function useIsMobileChrome(): boolean {
  const isDesktop = useIsDesktop();
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
  return mounted && !isDesktop;
}

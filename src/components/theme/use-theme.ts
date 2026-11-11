"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "starplus-theme";
const MEDIA = "(prefers-color-scheme: dark)";

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(MEDIA);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia(MEDIA).matches ? "dark" : "light";
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "system");
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Private mode: the choice still applies for this page.
  }
  document.documentElement.dataset.theme = resolve(choice);
}

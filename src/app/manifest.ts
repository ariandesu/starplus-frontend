import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "STAR PLUS self-check",
    short_name: "STAR PLUS",
    description: "Offline-first astronaut health self-check with cited guidance.",
    start_url: "/",
    display: "standalone",
    background_color: "#F9FAFB",
    theme_color: "#0EA5E9",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}

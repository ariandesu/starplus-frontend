import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "STAR PLUS self-check",
    short_name: "STAR PLUS",
    description: "Offline-first astronaut health self-check with cited guidance.",
    start_url: "/",
    display: "standalone",
    background_color: "#060A13",
    theme_color: "#060A13",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}

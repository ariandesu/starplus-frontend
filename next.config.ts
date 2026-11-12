import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const asset = (url: string) => ({
  url,
  revision: createHash("sha256").update(readFileSync(`public${url}`)).digest("hex").slice(0, 16),
});

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    "/",
    "/login",
    "/check",
    "/check/questionnaire",
    "/check/reaction",
    "/check/bluetooth",
    "/check/voice",
    "/check/camera",
    "/check/camera-hr",
    "/emergency",
    "/reports",
    "/result",
    "/history",
    "/surgeon",
    "/settings",
    "/demo",
    "/body",
    "/import",
    "/progress",
    "/medicines",
    asset("/fonts/satoshi-400.woff2"),
    asset("/fonts/satoshi-500.woff2"),
    asset("/fonts/satoshi-700.woff2"),
    asset("/hero-iss.jpg"),
    asset("/sidebar-earth.jpg"),
    asset("/models/body-female.glb"),
    asset("/models/body-male.glb"),
    asset("/models/space-shuttle-d.glb"),
    asset("/models/space-shuttle-d-engine.glb"),
    asset("/models/space-shuttle-d-door-prt.glb"),
    asset("/models/space-shuttle-d-door-stb.glb"),
    asset("/draco/draco_decoder.wasm"),
    asset("/draco/draco_wasm_wrapper.js"),
  ],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);

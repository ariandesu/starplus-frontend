import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: false,
  additionalPrecacheEntries: ["/", "/login", "/check", "/check/questionnaire", "/check/reaction", "/check/bluetooth", "/check/voice", "/emergency", "/reports", "/result", "/history", "/surgeon", "/settings", "/demo", "/body", "/import", "/progress", "/medicines"],
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

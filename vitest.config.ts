import { defineConfig } from "vitest/config";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@starplus/core", replacement: join(root, "core/src/index.ts") },
      { find: /^@starplus\/core\/(.*)/, replacement: join(root, "core/$1") },
      { find: "@", replacement: join(root, "src") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["fake-indexeddb/auto"],
    include: ["test/**/*.test.ts", "core/test/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
  },
});

import { defineConfig } from "vitest/config";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@starplus/core": join(root, "core/src/index.ts"),
      "@": join(root, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["fake-indexeddb/auto"],
    include: ["test/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
  },
});

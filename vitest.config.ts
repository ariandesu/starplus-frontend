import { defineConfig } from "vitest/config";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@starplus\/core$/, replacement: join(root, "core/src/index.ts") },
      { find: /^@starplus\/core\/(.*)/, replacement: join(root, "core/$1") },
      { find: "@", replacement: join(root, "src") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["fake-indexeddb/auto"],
    env: { NEXT_PUBLIC_DEMO_PASSWORD: "demo-password-123" },
    include: ["test/**/*.test.{ts,tsx}", "core/test/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    // explain.test.ts reads backend-only tools/eval/cases.json; backend CI runs it.
    exclude: ["core/test/explain.test.ts"],
  },
});

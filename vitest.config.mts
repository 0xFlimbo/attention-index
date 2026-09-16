import { defineConfig } from "vitest/config";
import path from "node:path";

// No `vite-tsconfig-paths` plugin (dependency gate — docs/ENGINEERING.md §1 only
// allows zod/vitest/tsx in B1), so the two path aliases are mirrored here by hand.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@data": path.resolve(import.meta.dirname, "./data"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

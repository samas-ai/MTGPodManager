import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests live with the code under src. Playwright owns e2e/*.spec.ts.
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});

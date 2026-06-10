import { defineConfig, devices } from "@playwright/test";

// Mobile-first: the pod flow is used on phones around the table.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
});

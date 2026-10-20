import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout. Prerequis : MongoDB demarre, `npm run seed`, puis `npm run dev` (ou laisser Playwright lancer le serveur).
 * Installation des navigateurs : npx playwright install chromium
 */
export default defineConfig({
  testDir: "./e2e", timeout: 60_000, retries: 0, workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", cwd: "../..", url: "http://localhost:5173", reuseExistingServer: true, timeout: 120_000 },
});

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const port = new URL(baseURL).port || "3100";

// E2E for the supplier dashboard flow. Uses Playwright's bundled Chromium
// (installed via `npx playwright install chromium`) — the `msedge` channel is
// not usable on WSL without a system Edge, so keep the default browser.
export default defineConfig({
  testDir: "./tests/e2e",
  // Full execution only when explicitly asked via `npm run test:e2e`.
  // Dev server is started by the `webServer` config below.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "Supplier Flow", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

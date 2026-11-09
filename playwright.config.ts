import { defineConfig, devices } from "@playwright/test";

// End-to-end tests in a real browser against the local Supabase stack: run `npm run db:start` and
// `npm run db:reset` first (the tests use the seeded users and documents and change stock).
// The app runs as a production build on port 3100, so it doesn't clash with `npm run dev` on 3000.
export default defineConfig({
  testDir: "e2e",
  // Waits until the local Supabase answers (right after `npm run db:reset` it is still restarting).
  globalSetup: "./e2e/global-setup.ts",
  // One worker: the tests share one database and some change it (POS sale, order assignment).
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      // The installed Google Chrome, so no separate browser download is needed.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});

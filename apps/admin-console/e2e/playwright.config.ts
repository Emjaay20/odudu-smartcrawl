import { defineConfig, devices } from '@playwright/test';

// Run through e2e/run.sh, which starts the image and names its origin here.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3080';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  globalSetup: './global-setup.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  // A test that scans a page with axe in both themes spends 3 to 7 seconds
  // per scan on a CI runner, and several scans per test; the default 30 s
  // fails them on a slow runner while every assertion has already passed.
  // Action and expect timeouts keep their defaults, so a hang still fails fast.
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  snapshotDir: './e2e/baselines',
  timeout: 30_000,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8787',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npx wrangler dev --port 8787 --local || true',
    port: 8787,
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

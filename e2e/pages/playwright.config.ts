// e2e/pages/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'pages.test.ts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

// e2e/playwright.config.ts
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { RUNTIME_DEMO_URL } from './runtime/demoUrl';

const isCI = Boolean(process.env.CI);
const PORT = 9000;
const BASE_URL = `http://localhost:${PORT}`;
const REPO_ROOT = path.resolve(__dirname, '..');

export default defineConfig({
  // Layout: e2e/<area>/*.spec.ts (demo, runtime, editor, export-css, ...).
  testDir: './',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/node_modules/**',
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serve the BUILT demos (run `npm run build:demo` first).
  webServer: [
    {
      command: 'npm run preview:demo --workspace packages/editor',
      cwd: REPO_ROOT,
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: 'npm run preview:demo --workspace demo/runtime',
      cwd: REPO_ROOT,
      url: RUNTIME_DEMO_URL,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});

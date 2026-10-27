// e2e/playwright.config.ts
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { editorPort, portFromEnv } from '../tools/devPorts';
import { RUNTIME_DEMO_URL } from './runtime/demoUrl';

const isCI = Boolean(process.env.CI);
// Ports from E2E_EDITOR_PORT / E2E_RUNTIME_PORT (9000 / 9001 by default), see tools/devPorts.ts.
const BASE_URL = `http://localhost:${editorPort()}`;
const REPO_ROOT = path.resolve(__dirname, '..');
// A server already on a port is reused only on request (E2E_REUSE_SERVER=1, never in CI):
// otherwise another worktree's demo server would be tested silently.
const reuseExistingServer = !isCI && process.env.E2E_REUSE_SERVER === '1';

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
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: 'npm run preview:demo --workspace demo/editor',
      cwd: REPO_ROOT,
      url: `http://localhost:${portFromEnv('E2E_V2_EDITOR_PORT', 9002)}`,
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: 'npm run preview:demo --workspace demo/runtime',
      cwd: REPO_ROOT,
      url: RUNTIME_DEMO_URL,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});

// e2e/blazor-sample/playwright.config.ts
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { portFromEnv } from '../../tools/devPorts';

const port = portFromEnv('E2E_BLAZOR_SAMPLE_PORT', 9138);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `dotnet run --project dotnet/samples/BlazorSample --no-launch-profile --urls ${baseURL}`,
    cwd: path.resolve(__dirname, '../..'),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

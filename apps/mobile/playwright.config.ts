import { defineConfig, devices } from '@playwright/test';

// E2E against the static web export (`pnpm build` → dist/) and a test-only API with a disposable
// database and a fake Google (apps/api/e2e/server.ts). The export calls the API at
// EXPO_PUBLIC_API_URL, which defaults to http://localhost:3000.
const webPort = 8081;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${webPort}`, trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'pnpm --filter @erre/api exec tsx e2e/server.ts',
      url: 'http://localhost:3000/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
    },
    {
      command: `serve dist --single --listen ${webPort} --no-clipboard`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

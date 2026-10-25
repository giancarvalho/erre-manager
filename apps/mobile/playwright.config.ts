import { defineConfig, devices } from '@playwright/test';

// E2E against the static web export (`pnpm build` produces dist/).
const port = 8081;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `serve dist --single --listen ${port} --no-clipboard`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});

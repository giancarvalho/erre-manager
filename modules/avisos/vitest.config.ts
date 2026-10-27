import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A disposable Postgres database with every migration of the workspace (yours included).
    globalSetup: ['./tests/integration/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

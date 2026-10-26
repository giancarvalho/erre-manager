import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/integration/global-setup.ts'],
    // Jobs run over every community of the shared test database: files run one at a time so a job in one
    // file never closes the rounds another file is voting in.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

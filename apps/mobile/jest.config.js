// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS config, loaded by Jest
const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/test/setup.ts'],
  // jest-expo's list plus @noble (ESM only), used by the anonymous vote client (@erre/anon-vote/client).
  transformIgnorePatterns: preset.transformIgnorePatterns.map((p) =>
    p.startsWith('/node_modules/(?!(.pnpm|') ? p.replace('(?!(.pnpm|', '(?!(.pnpm|@noble|') : p,
  ),
};

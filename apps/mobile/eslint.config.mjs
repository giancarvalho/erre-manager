import { react } from '@erre/config/eslint';

export default [
  ...react,
  { ignores: ['expo-env.d.ts', '.expo/**', 'dist/**', 'playwright-report/**', 'test-results/**'] },
];

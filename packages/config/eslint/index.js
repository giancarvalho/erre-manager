// Shared ESLint flat configs for the monorepo.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { noIdentityInAnonRule } from './anon.js';
import { boundariesRule } from './boundaries.js';
import { noRawStyleRule } from './style.js';

export const plugin = {
  meta: { name: 'erre' },
  rules: {
    boundaries: boundariesRule,
    'no-identity-in-anon': noIdentityInAnonRule,
    'no-raw-style': noRawStyleRule,
  },
};

const ignores = { ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/.turbo/**', '**/coverage/**'] };

/** Base config: TypeScript + project boundaries. For Node packages and the API. */
export const base = tseslint.config(ignores, js.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: { globals: { ...globals.node } },
  plugins: { erre: plugin },
  rules: {
    'erre/boundaries': 'error',
    'erre/no-identity-in-anon': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
});

/** React / React Native config (app and UI packages). */
export const react = tseslint.config(...base, {
  languageOptions: { globals: { ...globals.browser } },
  plugins: { 'react-hooks': reactHooks },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'erre/no-raw-style': 'error',
  },
});

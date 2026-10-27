// Bundles the API into a single file for production: workspace packages and third-party dependencies
// are all inlined, so the deploy needs only dist/ and Node (no node_modules).
import { build } from 'esbuild';

// dist/index.js is the API; dist/migrate.js is the migrations CLI (@erre/db) for the separate migrate step.
await build({
  entryPoints: { index: 'src/index.ts', migrate: '../../packages/db/src/cli.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'warning',
  // Optional native driver that pg tries to load; not installed.
  external: ['pg-native'],
  // CommonJS dependencies inside an ESM bundle still call require().
  banner: {
    js: "import { createRequire as __erreCreateRequire } from 'node:module'; const require = __erreCreateRequire(import.meta.url);",
  },
});

// Bundles the API into a single file for production: workspace packages and third-party dependencies
// are all inlined, so the deploy needs only dist/ and Node (no node_modules).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
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

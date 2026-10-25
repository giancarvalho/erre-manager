// Bundles the API for production: workspace packages (@erre/*, TypeScript sources) are inlined,
// third-party dependencies stay external and come from node_modules at runtime.
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
  plugins: [
    {
      name: 'external-third-party',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith('@erre/') ? undefined : { external: true }));
      },
    },
  ],
});

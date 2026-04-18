import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nodeExternals = [
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  'fastify',
];

// ── Backend bundle ───────────────────────────────────────────────────
await build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  outfile: resolve(__dirname, 'dist/index.js'),
  platform: 'node',
  target: 'node20',
  format: 'esm',
  bundle: true,
  minify: false,
  sourcemap: true,
  external: nodeExternals,
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  logLevel: 'info',
});
console.log('Backend built → dist/index.js');

// ── Frontend bundle (single file: index.tsx + all components) ────────
await build({
  entryPoints: [resolve(__dirname, 'frontend/index.tsx')],
  outfile: resolve(__dirname, 'dist/frontend/index.js'),
  platform: 'browser',
  target: ['es2022'],
  format: 'esm',
  bundle: true,
  minify: false,
  sourcemap: true,
  jsx: 'automatic',
  jsxImportSource: 'react',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  logLevel: 'info',
});
console.log('Frontend built → dist/frontend/index.js');

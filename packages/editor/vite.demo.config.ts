// packages/editor/vite.demo.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Vite ne lit pas les `paths` de tsconfig : la démo lit le runtime depuis ses
 * sources, pour fonctionner sur un clone neuf sans build préalable du runtime.
 */
const RUNTIME_SOURCE_ALIAS = {
  find: /^@werddomain\/timeline-runtime$/,
  replacement: fileURLToPath(new URL('../runtime/src/index.ts', import.meta.url)),
};

// Build de la page de démo (index.html) vers dist-demo, chemins relatifs.
export default defineConfig({
  base: './',
  resolve: { alias: [RUNTIME_SOURCE_ALIAS] },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
  preview: { port: 9000 },
});

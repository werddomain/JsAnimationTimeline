// packages/editor/vite.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** Le runtime reste une dépendance externe : il n'est jamais inclus dans le bundle de l'éditeur. */
const RUNTIME_PACKAGE = /^@werddomain\/timeline-runtime(\/.*)?$/;

/**
 * Serveur de dev uniquement (`npm run dev`) : Vite ne lit pas les `paths` de
 * tsconfig, le runtime est donc lu depuis ses sources (pas de build préalable).
 * Jamais appliqué au build bibliothèque, où le runtime reste externe.
 */
const RUNTIME_SOURCE_ALIAS = {
  find: /^@werddomain\/timeline-runtime$/,
  replacement: fileURLToPath(new URL('../runtime/src/index.ts', import.meta.url)),
};

// Build bibliothèque : ESM + UMD sans hash, déclarations générées par tsc (tsconfig.build.json).
export default defineConfig(({ command }) => ({
  resolve: command === 'serve' ? { alias: [RUNTIME_SOURCE_ALIAS] } : {},
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'JsTimeLine',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'timeline-editor.mjs' : 'timeline-editor.umd.js'),
    },
    cssFileName: 'timeline-editor',
    sourcemap: true,
    emptyOutDir: true,
    rolldownOptions: {
      external: [RUNTIME_PACKAGE],
      output: { globals: { '@werddomain/timeline-runtime': 'TimelineRuntime' } },
    },
  },
}));

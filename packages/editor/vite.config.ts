// packages/editor/vite.config.ts
import { defineConfig } from 'vite';

/** Le runtime reste une dépendance externe : il n'est jamais inclus dans le bundle de l'éditeur. */
const RUNTIME_PACKAGE = /^@werddomain\/timeline-runtime(\/.*)?$/;

// Build bibliothèque : ESM + UMD sans hash, déclarations générées par tsc (tsconfig.build.json).
export default defineConfig({
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
});

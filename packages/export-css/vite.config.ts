// packages/export-css/vite.config.ts
import { defineConfig } from 'vite';

/** Le runtime reste une dépendance externe : il n'est jamais inclus dans le bundle de l'export. */
const RUNTIME_PACKAGE = /^@kazo-ca\/timeline-runtime(\/.*)?$/;

// Build bibliothèque : ESM + UMD sans hash, déclarations générées par tsc (tsconfig.build.json).
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'TimelineExportCss',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'timeline-export-css.mjs' : 'timeline-export-css.umd.js'),
    },
    sourcemap: true,
    emptyOutDir: true,
    rolldownOptions: {
      external: [RUNTIME_PACKAGE],
      output: { globals: { '@kazo-ca/timeline-runtime': 'TimelineRuntime' } },
    },
  },
});

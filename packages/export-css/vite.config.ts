// packages/export-css/vite.config.ts
import { defineConfig } from 'vite';

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
  },
});

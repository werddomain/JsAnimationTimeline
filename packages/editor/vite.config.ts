// packages/editor/vite.config.ts
import { defineConfig } from 'vite';

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
  },
});

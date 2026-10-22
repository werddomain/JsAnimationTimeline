// packages/runtime/vite.config.ts
import { defineConfig } from 'vite';

// Build bibliothèque : ESM + UMD sans hash, déclarations générées par tsc (tsconfig.build.json).
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'TimelineRuntime',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'timeline-runtime.mjs' : 'timeline-runtime.umd.js'),
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});

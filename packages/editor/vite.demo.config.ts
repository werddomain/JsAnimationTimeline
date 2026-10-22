// packages/editor/vite.demo.config.ts
import { defineConfig } from 'vite';

// Build de la page de démo (index.html) vers dist-demo, chemins relatifs.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
  preview: { port: 9000 },
});

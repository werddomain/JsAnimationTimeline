// demo/runtime/vite.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Démo du runtime : lit le package depuis ses sources (pas de build préalable),
 * construit vers demo/runtime/dist avec des chemins relatifs, servie sur le
 * port 9001 pour les tests Playwright.
 */
export const RUNTIME_DEMO_PORT = 9001;

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  resolve: {
    alias: [
      {
        find: /^@werddomain\/timeline-runtime$/,
        replacement: fileURLToPath(new URL('../../packages/runtime/src/index.ts', import.meta.url)),
      },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  preview: { port: RUNTIME_DEMO_PORT, strictPort: true },
});

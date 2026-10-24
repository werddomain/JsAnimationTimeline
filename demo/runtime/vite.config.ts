// demo/runtime/vite.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { runtimePort } from '../../tools/devPorts';

/**
 * Démo du runtime : lit le package depuis ses sources (pas de build préalable),
 * construit vers demo/runtime/dist avec des chemins relatifs, servie (dev et
 * preview) sur `E2E_RUNTIME_PORT`, 9001 par défaut : le même port que lit
 * Playwright (voir tools/devPorts.ts).
 */
const RUNTIME_DEMO_PORT = runtimePort();

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
  server: { port: RUNTIME_DEMO_PORT, strictPort: true },
  preview: { port: RUNTIME_DEMO_PORT, strictPort: true },
});

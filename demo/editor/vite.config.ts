// demo/editor/vite.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { portFromEnv } from '../../tools/devPorts';

const port = portFromEnv('E2E_V2_EDITOR_PORT', 9002);
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  resolve: { alias: [
    { find: /^@werddomain\/timeline-runtime$/, replacement: fileURLToPath(new URL('../../packages/runtime/src/index.ts', import.meta.url)) },
    { find: /^@werddomain\/timeline-editor$/, replacement: fileURLToPath(new URL('../../packages/editor/src/index.ts', import.meta.url)) }
  ] },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: {
    main: fileURLToPath(new URL('index.html', import.meta.url)),
    scene: fileURLToPath(new URL('scene.html', import.meta.url))
  } } },
  server: { port, strictPort: true },
  preview: { port, strictPort: true }
});

// e2e/runtime/demoUrl.ts
/**
 * Adresse de la démo du runtime (demo/runtime), servie après `npm run build:demo`.
 * Le port doit rester celui de `preview` dans demo/runtime/vite.config.ts.
 */
export const RUNTIME_DEMO_PORT = 9001;
export const RUNTIME_DEMO_URL = `http://localhost:${RUNTIME_DEMO_PORT}`;

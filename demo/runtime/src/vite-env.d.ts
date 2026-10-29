// demo/runtime/src/vite-env.d.ts
/**
 * Les feuilles LESS importées pour leurs effets (Vite les injecte).
 */
declare module '*.less';

/** Scoped scene styles inserted into a validation page's ShadowRoot. */
declare module '*.less?inline' {
  const css: string;
  export default css;
}

// packages/export-css/src/continuous/htmlErrors.ts
export class HtmlCssSceneError extends Error {
  constructor(readonly code: string, message: string, readonly layerId?: string, readonly property?: string) { super(message); }
}

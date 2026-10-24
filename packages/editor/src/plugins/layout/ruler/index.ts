// packages/editor/src/plugins/layout/ruler/index.ts
/** Plugin `layout.ruler` : la règle des images et ses calculs. */

export { FRAME_WIDTH_VAR, RULER_CLASS, RULER_LABEL_CLASS, RulerPlugin } from './RulerPlugin';
export type { IRulerApi, RulerOptions } from './RulerPlugin';
export { clampFrame, frameAtX, frameCenter, frameLeft, labelStep, labelledFrames, timelineWidth } from './frameGeometry';

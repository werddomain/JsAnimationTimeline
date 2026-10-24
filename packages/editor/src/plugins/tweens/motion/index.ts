// packages/editor/src/plugins/tweens/motion/index.ts
/** Plugin `tweens.motion` : créer et supprimer les interpolations de mouvement. */

export { MOTION_TWEEN_PLUGIN_ID, MotionTweenPlugin } from './MotionTweenPlugin';
export { MotionTweenCodes, MotionTweenError, MotionTweenMessages } from './MotionTweenError';
export type { MotionTweenCode, MotionTweenRefusal } from './MotionTweenError';
export { createMotionTween, createMotionTweenBetween, createMotionTweenFromSpan } from './createMotionTween';
export type { IMotionTarget } from './createMotionTween';
export { removeMotionTween, removeMotionTweens } from './removeMotionTween';
export type { IRemoveTarget } from './removeMotionTween';
export { resolveCreateTarget, resolveRemoveTargets } from './resolveTarget';
export type { IResolutionRefusal, IResolved, Resolution } from './resolveTarget';
export { MotionTweenCommandLabels, createMotionTweenCommands } from './motionTweenCommands';
export type { IMotionTweenCommands, MotionTweenCommandKind } from './motionTweenCommands';
export type {
  IMotionTweenAvailability,
  IMotionTweenService,
  MotionAvailabilityChangedEvent,
  MotionTweenEvent
} from './types';

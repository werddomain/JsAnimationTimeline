// packages/runtime/src/stage/html/conflicts.ts
import type { HtmlBeforeFirstPolicy, IHtmlAnimationContext, IHtmlConflictResolution, IHtmlResolutionDiagnostic } from './animationTypes';
import { cloneHtmlAnimationContext } from './animationContext';

/** Pure saved choice: the integration owns confirmation and project history. */
export function resolveHtmlConflict(
  context: IHtmlAnimationContext, diagnostic: IHtmlResolutionDiagnostic, winnerLayerId: string, beforeFirst?: HtmlBeforeFirstPolicy
): IHtmlAnimationContext {
  if (!diagnostic.blocking || !diagnostic.choices.includes(winnerLayerId) ||
    !['priority-conflict', 'unsupported-specificity', 'composition-conflict', 'before-first-conflict'].includes(diagnostic.code)) {
    throw new Error('Cette décision ne résout pas le conflit HTML proposé.');
  }
  if (diagnostic.code === 'before-first-conflict' ? beforeFirst === undefined || !diagnostic.policies?.includes(beforeFirst) : beforeFirst !== undefined) {
    throw new Error('Choisissez explicitement la règle à appliquer avant la première clé.');
  }
  const resolution: IHtmlConflictResolution = { conflictId: diagnostic.id, signature: diagnostic.signature, winnerLayerId,
    ...(beforeFirst === undefined ? {} : { beforeFirst }) };
  return cloneHtmlAnimationContext({ ...context,
    resolutions: [...(context.resolutions ?? []).filter((item) => item.conflictId !== diagnostic.id), resolution] });
}

/** Removing a saved decision is also a pure, serializable project edit. */
export function removeHtmlConflictResolution(context: IHtmlAnimationContext, conflictId: string): IHtmlAnimationContext {
  return cloneHtmlAnimationContext({ ...context, resolutions: (context.resolutions ?? []).filter((item) => item.conflictId !== conflictId) });
}

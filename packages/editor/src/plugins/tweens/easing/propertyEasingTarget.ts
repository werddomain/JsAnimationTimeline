// packages/editor/src/plugins/tweens/easing/propertyEasingTarget.ts
import type { IPropertyTimeline, IPropertyTransition } from '@kazo-ca/timeline-runtime';
import type { IEditorContext } from '../../../core/context/IEditorContext';
import { createStagePropertyEditContext } from '../../../core/stage/propertyEditContext';
import { applyPropertyTimelineOperation } from '../../../model/propertyTimelines/operations';
import { PropertyOperationError } from '../../../model/properties/propertyValue';
import { requireEditableLayer } from '../../../model/spans/layerAccess';
import type { IPropertyEasingTarget } from './types';

export interface IResolvedPropertyEasing {
  readonly track: IPropertyTimeline;
  readonly transition: IPropertyTransition;
}

/** Checks target identity, ancestor locks and live target capabilities without writing. */
export function requirePropertyEasingTarget(ctx: IEditorContext, target: IPropertyEasingTarget): IResolvedPropertyEasing {
  const document = ctx.document;
  const layer = requireEditableLayer(document, target.layerId);
  const track = Object.prototype.hasOwnProperty.call(layer.propertyTimelines ?? {}, target.property) ? layer.propertyTimelines?.[target.property] : undefined;
  const transition = track?.transitions?.find(({ id }) => id === target.transitionId);
  if (track === undefined || transition === undefined) throw new PropertyOperationError('Cette interpolation de propriété est introuvable.');
  applyPropertyTimelineOperation(document, { kind: 'set-easing', ...target, easing: transition.easing }, createStagePropertyEditContext(ctx.registry, ctx.stage.stages));
  if (ctx.document !== document) throw new PropertyOperationError('Le document a changé : ouvrez de nouveau le dialogue.');
  return { track, transition };
}

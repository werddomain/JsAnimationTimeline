// packages/editor/src/plugins/toolbar/keyframeActions/propertyActionsState.ts
import type { IEditorContext } from '../../../core/context/IEditorContext';
import { findLayer } from '../../../model/spans/layerAccess';
import { checkPropertyOperations, MIXED_PROPERTY_REASON, propertyCells, propertyKeys } from '../../frames/keyframes/propertyKeyframeActions';
import { propertyTransitionAt } from '../../tweens/motion/propertyMotion';
import { DELETE_LABELS, NO_KEYFRAME_REASON } from './keyframeActionsState';
import type { IKeyframeActionsState } from './keyframeActionsState';

/** Shared by the production toolbar and context menu; legacy state stays untouched. */
export function propertyActionsState(ctx: IEditorContext): IKeyframeActionsState | undefined {
  const cells = ctx.services.require('frames.selection').cells();
  const targets = propertyCells(ctx, cells);
  if (targets.length === 0) {
    const ids = cells.length > 0 ? cells.map((cell) => cell.rowId) : ctx.services.get('layers.selection')?.selected() ?? [];
    if (!ids.some((id) => Object.keys(findLayer(ctx.document, id)?.propertyTimelines ?? {}).length > 0)) return undefined;
    const disabled = { enabled: false, reason: 'Sélectionnez une ligne de propriété sous le calque.' };
    return { insert: disabled, createTween: disabled, delete: { ...disabled, action: 'deleteKeyframe', label: DELETE_LABELS.property }, edit: disabled };
  }
  if (targets.length !== cells.length) {
    const disabled = { enabled: false, reason: MIXED_PROPERTY_REASON };
    return { insert: disabled, createTween: disabled, delete: { ...disabled, action: 'deleteKeyframe', label: DELETE_LABELS.property }, edit: disabled };
  }
  const motion = ctx.services.require('tweens.motion');
  const keys = propertyKeys(ctx, cells);
  const insert = checkPropertyOperations(ctx, targets.map((target) => ({ kind: 'capture', ...target })));
  const remove = motion.canRemove();
  const deletion = checkPropertyOperations(ctx, keys.map((target) => ({ kind: 'delete-key', ...target })));
  const first = keys[0];
  const edit = first === undefined ? { enabled: false, reason: NO_KEYFRAME_REASON }
    : checkPropertyOperations(ctx, [{ kind: 'capture', ...first }]);
  return {
    insert, createTween: motion.canCreate(),
    delete: remove.enabled ? { ...remove, action: 'removeTween', label: DELETE_LABELS.tween }
      : { ...deletion, action: 'deleteKeyframe', label: DELETE_LABELS.property },
    edit,
    ...(first === undefined || !edit.enabled ? {} : { editTarget: {
      layerId: first.layerId, property: first.property, frame: first.frame, inTween: propertyTransitionAt(ctx, first) !== undefined
    } })
  };
}

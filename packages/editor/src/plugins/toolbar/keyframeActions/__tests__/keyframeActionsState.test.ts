// packages/editor/src/plugins/toolbar/keyframeActions/__tests__/keyframeActionsState.test.ts
/**
 * Pure state tests for button availability, edit targets and deletion routing.
 */

import type { ISpan, LayerNode } from '@kazo-ca/timeline-runtime';
import { createDoc, layer } from '../../../../model/spans/__tests__/fixtures';
import type { ISelectedKeyframe } from '../../../frames/selection/types';
import type { IMotionTweenAvailability } from '../../../tweens/motion/types';
import {
  DELETE_LABELS,
  LOCKED_REASON,
  NO_KEYFRAME_REASON,
  NO_TARGET_REASON,
  computeKeyframeActionsState,
  resolveDeleteAction
} from '../keyframeActionsState';
import type { IKeyframeActionsInput } from '../keyframeActionsState';

const folder = (id: string, children: readonly LayerNode[], locked?: boolean): LayerNode => ({
  id,
  type: 'folder',
  name: id,
  children,
  ...(locked === undefined ? {} : { locked })
});

const staticSpan = (id: string, start: number, end: number): ISpan => ({ id, start, end, kind: 'static' });
const tweenSpan = (id: string, start: number, end: number): ISpan => ({
  id,
  start,
  end,
  kind: 'tween',
  tracks: { x: [{ frame: start, value: 0 }, { frame: end, value: 10 }] }
});

const doc = createDoc([
  layer('a', [staticSpan('a1', 1, 4), staticSpan('a2', 5, 8)]),
  layer('t', [tweenSpan('t1', 1, 8)]),
  layer('t2', [tweenSpan('u1', 1, 8)]),
  layer('p', [staticSpan('p1', 1, 10), tweenSpan('p2', 11, 20)]),
  layer('lock', [staticSpan('l1', 1, 8)], { locked: true }),
  folder('lf', [layer('inLocked', [staticSpan('i1', 1, 8)])], true),
  folder('f', [layer('inFolder', [staticSpan('n1', 1, 8)])])
]);

const ON: IMotionTweenAvailability = { enabled: true };
const OFF: IMotionTweenAvailability = { enabled: false, reason: 'Aucune image clé sélectionnée' };

function input(extra: Partial<IKeyframeActionsInput> = {}): IKeyframeActionsInput {
  return {
    doc,
    cells: [],
    selectedKeyframes: [],
    playheadFrame: 1,
    layerIds: undefined,
    keyframeAt: () => false,
    tweenAt: (layerId, frame) => {
      const found = doc.layers.find((node) => node.id === layerId);
      return found !== undefined && 'spans' in found
        ? found.spans.find((span) => span.kind === 'tween' && span.start <= frame && frame <= span.end)
        : undefined;
    },
    canCreate: OFF,
    canRemove: OFF,
    ...extra
  };
}

const cell = (rowId: string, frame: number) => ({ rowId, frame });
const keyframe = (rowId: string, frame: number): ISelectedKeyframe => ({
  rowId,
  frame,
  kind: 'keyframe',
  spanId: 'x'
});
const property = (rowId: string, frame: number): ISelectedKeyframe => ({
  rowId,
  frame,
  kind: 'propertyKeyframe',
  spanId: 'x'
});

describe('computeKeyframeActionsState keyframe part', () => {
  it('disables insert and edit with a reason when nothing is selected', () => {
    // Act
    const state = computeKeyframeActionsState(input());

    // Assert
    expect(state.insert).toEqual({ enabled: false, reason: NO_TARGET_REASON });
    expect(state.edit).toEqual({ enabled: false, reason: NO_KEYFRAME_REASON });
    expect(state.editTarget).toBeUndefined();
    expect(state.delete.enabled).toBe(false);
    expect(state.delete.label).toBe(DELETE_LABELS.generic);
  });

  it('enables insert and edit for one selected keyframe cell', () => {
    // Act
    const state = computeKeyframeActionsState(input({ cells: [cell('a', 5)], selectedKeyframes: [keyframe('a', 5)] }));

    // Assert
    expect(state.insert).toEqual({ enabled: true });
    expect(state.edit).toEqual({ enabled: true });
    expect(state.editTarget).toEqual({ layerId: 'a', frame: 5, inTween: false });
  });

  it('targets the lowest frame of the first row for edit when several cells are selected', () => {
    // Act
    const state = computeKeyframeActionsState(
      input({
        cells: [cell('a', 2), cell('a', 5), cell('t', 3)],
        selectedKeyframes: [keyframe('a', 5), keyframe('a', 2), keyframe('t', 3)]
      })
    );

    // Assert
    expect(state.insert.enabled).toBe(true);
    expect(state.editTarget).toEqual({ layerId: 'a', frame: 2, inTween: false });
  });

  it('flags a target inside a tween', () => {
    // Act
    const state = computeKeyframeActionsState(input({ cells: [cell('t', 4)], selectedKeyframes: [property('t', 4)] }));

    // Assert
    expect(state.editTarget).toEqual({ layerId: 't', frame: 4, inTween: true });
  });

  it('disables with the locked reason when the row is locked', () => {
    // Act
    const state = computeKeyframeActionsState(input({ cells: [cell('lock', 2)], selectedKeyframes: [keyframe('lock', 2)] }));

    // Assert
    expect(state.insert).toEqual({ enabled: false, reason: LOCKED_REASON });
    expect(state.edit).toEqual({ enabled: false, reason: LOCKED_REASON });
    expect(state.editTarget).toBeUndefined();
  });

  it('disables when the parent folder is locked', () => {
    // Act
    const state = computeKeyframeActionsState(input({ cells: [cell('inLocked', 2)] }));

    // Assert
    expect(state.insert.reason).toBe(LOCKED_REASON);
  });

  it('stays enabled when only some targets are locked, editing an unlocked one', () => {
    // Act
    const state = computeKeyframeActionsState(
      input({ cells: [cell('lock', 2), cell('a', 3)], selectedKeyframes: [keyframe('lock', 2), keyframe('a', 3)] })
    );

    // Assert
    expect(state.insert.enabled).toBe(true);
    expect(state.editTarget).toEqual({ layerId: 'a', frame: 3, inTween: false });
  });

  it('treats a folder alone as no target', () => {
    // Act
    const state = computeKeyframeActionsState(input({ cells: [cell('f', 2)] }));

    // Assert
    expect(state.insert).toEqual({ enabled: false, reason: NO_TARGET_REASON });
  });

  it('falls back to the playhead on the selected layers', () => {
    // Act
    const state = computeKeyframeActionsState(input({ playheadFrame: 5, layerIds: ['a'], keyframeAt: (_layerId, frame) => frame === 5 }));

    // Assert
    expect(state.insert.enabled).toBe(true);
    expect(state.editTarget).toEqual({ layerId: 'a', frame: 5, inTween: false });
  });

  it('disables edit on a plain selected frame that is no keyframe, but not insert', () => {
    // Act
    const state = computeKeyframeActionsState(input({ cells: [cell('a', 3)] }));

    // Assert
    expect(state.insert.enabled).toBe(true);
    expect(state.edit).toEqual({ enabled: false, reason: NO_KEYFRAME_REASON });
    expect(state.editTarget).toBeUndefined();
  });

  it('disables edit when the playhead of a selected layer is not on a keyframe', () => {
    // Act
    const state = computeKeyframeActionsState(input({ playheadFrame: 6, layerIds: ['a'] }));

    // Assert
    expect(state.insert.enabled).toBe(true);
    expect(state.edit).toEqual({ enabled: false, reason: NO_KEYFRAME_REASON });
  });

  it('follows canCreate for the tween button', () => {
    // Act
    const off = computeKeyframeActionsState(input({ canCreate: OFF }));
    const on = computeKeyframeActionsState(input({ canCreate: ON }));

    // Assert
    expect(off.createTween).toEqual(OFF);
    expect(on.createTween).toEqual({ enabled: true });
  });
});

describe('resolveDeleteAction', () => {
  it('routes a property keyframe to deleteKeyframe even when a tween could be removed', () => {
    // Arrange
    const source = input({ cells: [cell('t', 4)], selectedKeyframes: [property('t', 4)], canRemove: ON });

    // Act
    const action = resolveDeleteAction(source);

    // Assert
    expect(action).toEqual({ action: 'deleteKeyframe', enabled: true, label: DELETE_LABELS.property });
  });

  it('routes to removeTween when a tween is removable and no property keyframe is selected', () => {
    // Act
    const action = resolveDeleteAction(input({ cells: [cell('t', 3)], canRemove: ON }));

    // Assert
    expect(action).toEqual({ action: 'removeTween', enabled: true, label: DELETE_LABELS.tween });
  });

  it('routes to deleteKeyframe otherwise', () => {
    // Act
    const action = resolveDeleteAction(input({ cells: [cell('a', 5)], keyframeAt: () => true }));

    // Assert
    expect(action).toEqual({ action: 'deleteKeyframe', enabled: true, label: DELETE_LABELS.keyframe });
  });

  it('disables with the generic label when nothing can be deleted', () => {
    // Act
    const action = resolveDeleteAction(input());

    // Assert
    expect(action).toEqual({
      action: 'deleteKeyframe',
      enabled: false,
      reason: NO_TARGET_REASON,
      label: DELETE_LABELS.generic
    });
  });

  it('disables with the locked reason on a locked row', () => {
    // Act
    const action = resolveDeleteAction(input({ cells: [cell('lock', 2)] }));

    // Assert
    expect(action.enabled).toBe(false);
    expect(action.reason).toBe(LOCKED_REASON);
  });

  it('mixed selection on one layer: any property keyframe wins over plain tween cells', () => {
    // Arrange
    const source = input({
      cells: [cell('t', 2), cell('t', 4), cell('t', 6)],
      selectedKeyframes: [property('t', 4)],
      canRemove: ON
    });

    // Act
    const action = resolveDeleteAction(source);

    // Assert
    expect(action.action).toBe('deleteKeyframe');
    expect(action.label).toBe(DELETE_LABELS.keyframe);
  });

  it('mixed selection across layers: a property keyframe on another layer still wins', () => {
    // Arrange
    const source = input({
      cells: [cell('t', 2), cell('t2', 5)],
      selectedKeyframes: [property('t2', 5)],
      canRemove: ON
    });

    // Act
    const action = resolveDeleteAction(source);

    // Assert
    expect(action.action).toBe('deleteKeyframe');
    expect(action.enabled).toBe(true);
    expect(action.label).toBe(DELETE_LABELS.keyframe);
  });

  it('names the property keyframe only when every target is a selected property keyframe', () => {
    // Act
    const all = resolveDeleteAction(
      input({ cells: [cell('t', 4), cell('t2', 5)], selectedKeyframes: [property('t', 4), property('t2', 5)], canRemove: ON })
    );

    // Assert
    expect(all.label).toBe(DELETE_LABELS.property);
  });

  it('does not name the property keyframe when a content keyframe at a tween start is also targeted', () => {
    // Arrange: static 1-10 + tween 11-20, cells 11..15 with a property keyframe at 15.
    const source = input({
      cells: [11, 12, 13, 14, 15].map((frame) => cell('p', frame)),
      selectedKeyframes: [keyframe('p', 11), property('p', 15)],
      canRemove: ON
    });

    // Act
    const action = resolveDeleteAction(source);

    // Assert
    expect(action.action).toBe('deleteKeyframe');
    expect(action.label).toBe(DELETE_LABELS.keyframe);
  });

  it('does not name the property keyframe across two layers when one target is a content keyframe', () => {
    // Arrange
    const source = input({
      cells: [cell('p', 11), cell('p', 15), cell('a', 5)],
      selectedKeyframes: [property('p', 15), keyframe('a', 5)],
      canRemove: ON
    });

    // Act
    const action = resolveDeleteAction(source);

    // Assert
    expect(action.label).toBe(DELETE_LABELS.keyframe);
  });

  it('is disabled with the keyframe reason on a plain frame of a span', () => {
    // Act
    const action = resolveDeleteAction(input({ cells: [cell('a', 3)] }));

    // Assert
    expect(action).toEqual({
      action: 'deleteKeyframe',
      enabled: false,
      reason: NO_KEYFRAME_REASON,
      label: DELETE_LABELS.generic
    });
  });

  it('is enabled as soon as one editable target carries a keyframe', () => {
    // Act
    const action = resolveDeleteAction(
      input({ cells: [cell('a', 3), cell('a', 5)], keyframeAt: (_layerId, frame) => frame === 5 })
    );

    // Assert
    expect(action.enabled).toBe(true);
  });

  it('ignores a property keyframe that is not inside a tween', () => {
    // Arrange
    const source = input({ cells: [cell('a', 2)], selectedKeyframes: [property('a', 2)] });

    // Act
    const action = resolveDeleteAction(source);

    // Assert
    expect(action.label).toBe(DELETE_LABELS.keyframe);
  });
});

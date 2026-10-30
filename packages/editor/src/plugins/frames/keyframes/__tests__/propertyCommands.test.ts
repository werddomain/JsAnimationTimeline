// packages/editor/src/plugins/frames/keyframes/__tests__/propertyCommands.test.ts
import { createObjectStage } from '@kazo-ca/timeline-runtime';
import type { ILayer, IPropertyTimeline, IStage, ITimelineDocument, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { cleanBody, createContainer } from '../../../../core/editor/__tests__/fixtures';
import { createSpanCommands } from '../../../../model/spans';
import type { IVisibleRow } from '../../../../model/rows';
import type { IFrameCell } from '../../selection/frameSelection';
import type { IFramesSelectionService } from '../../selection/types';
import { MotionTweenPlugin } from '../../../tweens/motion/MotionTweenPlugin';
import { moveSelectedKeyframes, runSpanAction } from '../keyframeActions';

const number = (value: number) => ({ kind: 'number' as const, value });
const editors: IEditor[] = [];
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); cleanBody(); });

function track(keys = [1, 30]): IPropertyTimeline {
  return { initialValue: number(0), keys: keys.map((frame) => ({ frame, value: number(frame) })) };
}
function setup(timeline: IPropertyTimeline = track(), locked = false, stage?: IStage) {
  const layer: ILayer = { id: 'logo', name: 'Logo', type: 'layer', locked, spans: [], propertyTimelines: { x: timeline, y: track() }, ...(stage === undefined ? {} : { target: { ref: 'object', stage: stage.id } }) };
  const data: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [layer] };
  const rows: readonly IVisibleRow[] = ['x', 'y'].map((property, index) => ({
    kind: 'property', id: `opaque-${index}`, layerId: 'logo', property, depth: 1, parentId: 'logo', index
  }));
  let cells: readonly IFrameCell[] = [];
  let context: IEditorContext | undefined;
  const stub: EditorPlugin = { id: 'frames.selection', dependencies: [], init(ctx) {
    context = ctx;
    const set = (next: readonly IFrameCell[]): void => { const previous = cells; cells = next; ctx.events.emit('frames:selectionChanged', { cells, previous }); };
    const selection: IFramesSelectionService = {
      cells: () => cells, keyframes: () => [],
      propertyKeyframes: () => cells.flatMap((cell) => {
        const row = rows.find((item) => item.id === cell.rowId);
        const current = ctx.document.layers[0] as ILayer;
        return row?.kind === 'property' && current.propertyTimelines?.[row.property].keys.some((key) => key.frame === cell.frame)
          ? [{ ...cell, layerId: row.layerId, property: row.property }] : [];
      }),
      set, select: (cell) => set([cell]), toggle: (cell) => set([...cells, cell]), selectRange: (cell) => set([cell]),
      clear: () => set([]), anchor: () => cells[0], cancelPendingClick: () => undefined,
      isSelected: (rowId, frame) => cells.some((cell) => cell.rowId === rowId && cell.frame === frame)
    };
    ctx.services.provide('frames.selection', selection);
    ctx.services.provide('frames.grid', { rows: () => rows, frameWidth: () => 15, rowHeight: () => 30,
      window: () => ({ frames: { first: 1, last: 100 }, rows: { first: 0, last: 1 } }),
      cellAt: () => undefined, element: () => undefined, refresh: () => undefined });
  }, destroy() {} };
  const editor = createEditor(createContainer(), { data, stage: stage ?? false, defaultPlugins: [stub, new MotionTweenPlugin()] });
  editors.push(editor);
  if (context === undefined) throw new Error('Missing test context');
  const ctx = context;
  const selection = editor.getService('frames.selection')!;
  const motion = editor.getService('tweens.motion')!;
  const spans = createSpanCommands(ctx.registry);
  const select = (...frames: number[]): void => selection.set(frames.map((frame) => ({ rowId: 'opaque-0', frame })));
  const current = (): IPropertyTimeline => (editor.document.layers[0] as ILayer).propertyTimelines!.x;
  return { editor, ctx, motion, selection, spans, select, current };
}

it('creates and removes a tween for exactly two property keys, with exact undo and redo', () => {
  const h = setup();
  h.select(1, 30);
  const before = h.editor.document;
  expect(h.motion.canCreate()).toEqual({ enabled: true });
  expect(h.motion.create()).toBe(true);
  expect(h.current().transitions).toHaveLength(1);
  const created = h.editor.document;
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
  expect(h.editor.redo()).toBe(true);
  expect(h.editor.document).toEqual(created);
  h.select(15);
  expect(h.motion.canRemove()).toEqual({ enabled: true });
  expect(h.motion.remove()).toBe(true);
  expect(h.current().transitions ?? []).toHaveLength(0);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(created);
});

it('commits a multi-property capture atomically before a property listener changes selection', () => {
  const h = setup();
  h.selection.set([{ rowId: 'opaque-0', frame: 15 }, { rowId: 'opaque-1', frame: 15 }]);
  const before = h.editor.document;
  const observed: boolean[] = [];
  let armed = true;
  h.editor.on('property:changed', () => {
    if (!armed) return;
    armed = false;
    const layer = h.editor.document.layers[0] as ILayer;
    observed.push(['x', 'y'].every((name) => layer.propertyTimelines?.[name].keys.some((key) => key.frame === 15)));
    h.selection.select({ rowId: 'opaque-1', frame: 10 });
  });
  expect(runSpanAction(h.ctx, h.spans, 'insertKeyframe')).toBe(true);
  expect(observed).toEqual([true]);
  expect(h.selection.cells()).toEqual([{ rowId: 'opaque-1', frame: 10 }]);
  const after = h.editor.document;
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
  expect(h.editor.canUndo).toBe(false);
  expect(h.editor.redo()).toBe(true);
  expect(h.editor.document).toEqual(after);
});

it.each([[1], [1, 10, 30], [1, 30]].map((frames) => ({ frames })))('refuses invalid property key selection $frames without history', ({ frames }) => {
  const h = setup(track([1, 10, 30]));
  h.select(...frames);
  const before = h.editor.document;
  expect(h.motion.canCreate().enabled).toBe(false);
  expect(h.motion.create()).toBe(false);
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
});

it.each<TimelinePropertyValue>([{ kind: 'text', value: 'blue' }, { kind: 'boolean', value: true }])('refuses non-interpolable $kind keys without changing history or property events', (value) => {
  const h = setup({ initialValue: value, keys: [{ frame: 1, value }, { frame: 30, value }] });
  const changes: unknown[] = [];
  h.editor.on('property:changed', (event) => changes.push(event));
  h.select(1, 30);
  const before = h.editor.document;
  expect(h.motion.canCreate().enabled).toBe(false);
  expect(h.motion.create()).toBe(false);
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
  expect(h.editor.canRedo).toBe(false);
  expect(changes).toEqual([]);
});

it('rechecks capabilities at activation and on redo instead of trusting a cached verdict', () => {
  const object = { x: 0, y: 0 };
  const stage = createObjectStage({ id: 'objects', objects: [{ id: 'object', label: 'Objet', object, properties: ['x', 'y'] }], apply: () => undefined });
  const h = setup(track(), false, stage);
  h.select(1, 30);
  expect(h.motion.canCreate().enabled).toBe(true);
  const before = h.editor.document;
  stage.remove('object');
  stage.add({ id: 'object', label: 'Objet', object, properties: [] });
  expect(h.motion.create()).toBe(false);
  expect(h.editor.document).toBe(before);
  stage.remove('object');
  stage.add({ id: 'object', label: 'Objet', object, properties: ['x', 'y'] });
  expect(h.motion.create()).toBe(true);
  expect(h.editor.undo()).toBe(true);
  stage.remove('object');
  stage.add({ id: 'object', label: 'Objet', object, properties: [] });
  expect(h.editor.redo()).toBe(false);
  expect(h.editor.document).toEqual(before);
  expect(h.editor.canRedo).toBe(true);
});

it('refuses attached-key deletion and colliding moves without consuming the redo branch', () => {
  const h = setup({ ...track([10, 30]), transitions: [{ id: 't', fromFrame: 10, toFrame: 30 }] });
  h.select(15);
  runSpanAction(h.ctx, h.spans, 'insertKeyframe');
  h.editor.undo();
  const before = h.editor.document;
  h.select(10);
  expect(runSpanAction(h.ctx, h.spans, 'deleteKeyframe')).toBe(false);
  expect(moveSelectedKeyframes(h.ctx, h.spans, 20)).toBe(false);
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
  expect(h.editor.canRedo).toBe(true);
});

it('refuses a command whose selection changes inside command:before', () => {
  const h = setup();
  h.select(1, 30);
  const before = h.editor.document;
  const changes: unknown[] = [];
  h.editor.on('property:changed', (event) => changes.push(event));
  const off = h.ctx.events.onCancellable('command:before', () => {
    h.selection.select({ rowId: 'opaque-1', frame: 10 });
  });
  expect(h.motion.create()).toBe(false);
  off();
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
  expect(changes).toEqual([]);
});

it('preflights a multi-property capture before any command or property event', () => {
  const stage = createObjectStage({ id: 'objects', objects: [{ id: 'object', label: 'Objet', object: { x: 0, y: 0 }, properties: ['x'] }], apply: () => undefined });
  const h = setup(track(), false, stage);
  h.selection.set([{ rowId: 'opaque-0', frame: 15 }, { rowId: 'opaque-1', frame: 15 }]);
  const before = h.editor.document;
  const changes: unknown[] = [];
  h.editor.on('property:changed', (event) => changes.push(event));
  expect(runSpanAction(h.ctx, h.spans, 'insertKeyframe')).toBe(false);
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
  expect(changes).toEqual([]);
});

it('refuses keys from two properties and a locked property', () => {
  const h = setup();
  h.selection.set([{ rowId: 'opaque-0', frame: 1 }, { rowId: 'opaque-1', frame: 30 }]);
  expect(h.motion.canCreate().enabled).toBe(false);
  expect(h.motion.create()).toBe(false);
  const locked = setup(track(), true);
  locked.select(1, 30);
  expect(locked.motion.canCreate().enabled).toBe(false);
  expect(locked.motion.create()).toBe(false);
});

it('captures a property in a nonlinear tween without changing the curve and undoes exactly', () => {
  const h = setup({ ...track(), transitions: [{ id: 't', fromFrame: 1, toFrame: 30, easing: { kind: 'effect', family: 'back', mode: 'in-out' } }] });
  const before = h.editor.document;
  const samples = [4.5, 10, 15.5, 20.25, 29].map((frame) => h.editor.sample(frame).layer('logo')?.propertyValues?.x);
  h.select(15);
  expect(runSpanAction(h.ctx, h.spans, 'insertKeyframe')).toBe(true);
  expect(h.current().keys.map((key) => key.frame)).toEqual([1, 15, 30]);
  expect(h.current().transitions).toHaveLength(2);
  expect([4.5, 10, 15.5, 20.25, 29].map((frame) => h.editor.sample(frame).layer('logo')?.propertyValues?.x)).toEqual(samples);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
});

it('moves and deletes independent property keys with undo, and refuses unsupported span shortcuts', () => {
  const h = setup(track([10, 30]));
  const before = h.editor.document;
  h.select(10);
  expect(moveSelectedKeyframes(h.ctx, h.spans, 5)).toBe(true);
  expect(h.current().keys.map((key) => key.frame)).toEqual([15, 30]);
  expect(h.selection.cells()).toEqual([{ rowId: 'opaque-0', frame: 15 }]);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
  h.select(10);
  expect(runSpanAction(h.ctx, h.spans, 'deleteKeyframe')).toBe(true);
  expect(h.current().keys.map((key) => key.frame)).toEqual([30]);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
  for (const action of ['insertBlankKeyframe', 'insertFrame', 'removeFrame'] as const) {
    expect(runSpanAction(h.ctx, h.spans, action)).toBe(false);
    expect(h.editor.document).toEqual(before);
  }
});




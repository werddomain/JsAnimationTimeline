// packages/editor/src/core/editor/__tests__/Editor.propertyTimelines.test.ts
import { createObjectStage } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../createEditor';
import type { EditorOptions, IEditor } from '../types';
import type {
  IEditorPropertyTimelines,
  PropertyChangedEvent as PropertyChanged,
  PropertyTimelineMutationResult as MutationResult
} from '../propertyTimelineTypes';
import { createDoc, layer, layerOf } from '../../../model/spans/__tests__/fixtures';
import { captureContext, cleanBody, createContainer, makeEditorPlugin } from './fixtures';

const editors: IEditor[] = [];
const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const blankDocument = () => createDoc([layer('logo', [])], 100);
function setup(options: Partial<EditorOptions> = {}): IEditor {
  const editor = createEditor(createContainer(), {
    defaultPlugins: false, stage: false, data: blankDocument(), ...options
  });
  editors.push(editor);
  return editor;
}
function api(editor: IEditor): IEditorPropertyTimelines {
  return editor.propertyTimelines;
}
function observe(editor: IEditor): PropertyChanged[] {
  const events: PropertyChanged[] = [];
  editor.on('property:changed', (event) => events.push(event));
  return events;
}
function track(editor: IEditor, property = 'x'): IPropertyTimeline | undefined {
  return layerOf(editor.document, 'logo').propertyTimelines?.[property];
}
function expectRefused(result: MutationResult): void {
  expect(result.status).toBe('refused');
  if (result.status === 'refused') expect(result.reason.trim().length).toBeGreaterThan(0);
}
function documentWithTrack(property = 'x', timeline?: IPropertyTimeline): ReturnType<typeof createDoc> {
  return createDoc([layer('logo', [], { propertyTimelines: { [property]: timeline ?? {
    initialValue: number(0),
    keys: [{ frame: 1, value: number(0) }, { frame: 100, value: number(100) }]
  } } })], 100);
}
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  cleanBody();
});

it('creates one independent property at the current frame and keeps its baseline until then', () => {
  const editor = setup();
  const before = editor.document;
  editor.playback.seek(50);

  expect(api(editor).set('logo', 'x', number(30), { initialValue: number(0) })).toEqual({ status: 'changed' });
  expect(track(editor)).toMatchObject({ initialValue: number(0), keys: [{ frame: 50, value: number(30) }] });
  expect(editor.sample(49).layer('logo')?.propertyValues?.x).toEqual(number(0));
  expect(editor.sample(50).layer('logo')?.propertyValues?.x).toEqual(number(30));
  expect(editor.sample(100).layer('logo')?.propertyValues?.x).toEqual(number(30));
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
  expect(editor.redo()).toBe(true);
  expect(track(editor)?.keys).toEqual([{ frame: 50, value: number(30) }]);
});

it('distinguishes an unchanged existing key from an explicit captured key without extra undo entries', () => {
  const editor = setup();
  expect(api(editor).set('logo', 'x', number(30), { frame: 10, initialValue: number(0) })).toEqual({ status: 'changed' });
  const first = editor.document;
  expect(api(editor).set('logo', 'x', number(30), { frame: 10 })).toEqual({ status: 'noop' });
  expect(editor.document).toBe(first);
  expect(api(editor).capture('logo', 'x', { frame: 20 })).toEqual({ status: 'changed' });
  expect(track(editor)?.keys).toEqual([{ frame: 10, value: number(30) }, { frame: 20, value: number(30) }]);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(first);
  expect(editor.undo()).toBe(true);
  expect(editor.undo()).toBe(false);
});

it('emits a property change only for committed edits and history, never for seek or no-op', () => {
  const editor = setup();
  const changes = observe(editor);
  editor.playback.seek(10);
  editor.sample(20);
  expect(changes).toEqual([]);
  expect(api(editor).set('logo', 'x', number(30), { initialValue: number(0) })).toEqual({ status: 'changed' });
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ layerId: 'logo', property: 'x', cause: 'execute',
    frame: 10, oldValue: number(0), newValue: number(30) });
  expect(changes[0].label).toEqual(expect.any(String));
  expect(changes[0].before).toBeUndefined();
  expect(changes[0].after).toEqual(track(editor));
  expect(api(editor).set('logo', 'x', number(30))).toEqual({ status: 'noop' });
  editor.playback.seek(40);
  expect(changes).toHaveLength(1);
  expect(editor.undo()).toBe(true);
  expect(changes[1]).toMatchObject({ layerId: 'logo', property: 'x', cause: 'undo' });
  expect(changes[1].after).toBeUndefined();
  expect(editor.redo()).toBe(true);
  expect(changes[2]).toMatchObject({ layerId: 'logo', property: 'x', cause: 'redo' });
  expect(changes).toHaveLength(3);
});

it('groups an X/Y gesture into one undoable transaction', () => {
  const editor = setup();
  const before = editor.document;
  const transaction = api(editor).beginTransaction('Déplacer');
  expect(transaction.active).toBe(true);
  expect(api(editor).set('logo', 'x', number(10), { initialValue: number(0) })).toEqual({ status: 'changed' });
  expect(api(editor).set('logo', 'y', number(20), { initialValue: number(0) })).toEqual({ status: 'changed' });
  expect(api(editor).set('logo', 'x', number(30))).toEqual({ status: 'changed' });
  expect(transaction.commit()).toBe(true);
  expect(transaction.active).toBe(false);
  const changed = editor.document;
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
  expect(editor.undo()).toBe(false);
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(changed);
});

it('cancels a gesture with inverse property events and preserves the existing redo branch', () => {
  const editor = setup();
  api(editor).set('logo', 'x', number(7), { initialValue: number(0) });
  const committed = editor.document;
  editor.undo();
  const before = editor.document;
  const changes = observe(editor);
  const transaction = api(editor).beginTransaction('Déplacer');
  api(editor).set('logo', 'x', number(20), { initialValue: number(0) });
  api(editor).set('logo', 'y', number(30), { initialValue: number(0) });
  transaction.cancel();
  expect(transaction.active).toBe(false);
  expect(editor.document).toEqual(before);
  expect(editor.canUndo).toBe(false);
  expect(editor.canRedo).toBe(true);
  expect(changes.filter((event) => event.cause === 'group-cancel').map((event) => event.property).sort()).toEqual(['x', 'y']);
  expect(changes.filter((event) => event.cause === 'group-cancel').every((event) => event.after === undefined)).toBe(true);
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(committed);
});

it('does not create history for an empty transaction and refuses nesting without ending the active gesture', () => {
  const editor = setup();
  const empty = api(editor).beginTransaction('Vide');
  expect(empty.commit()).toBe(false);
  expect(editor.canUndo).toBe(false);
  const outer = api(editor).beginTransaction('Déplacer');
  expect(() => api(editor).beginTransaction('Imbriqué')).toThrow();
  expect(outer.active).toBe(true);
  api(editor).set('logo', 'x', number(20), { initialValue: number(0) });
  expect(outer.commit()).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(track(editor)).toBeUndefined();
});

it('invalidates a transaction on load and prevents the stale handle from closing a later transaction', () => {
  const editor = setup();
  const stale = api(editor).beginTransaction('Ancien geste');
  api(editor).set('logo', 'x', number(20), { initialValue: number(0) });
  editor.load(blankDocument());
  const current = api(editor).beginTransaction('Nouveau geste');
  api(editor).set('logo', 'y', number(30), { initialValue: number(0) });
  const changed = editor.document;
  expect(stale.active).toBe(false);
  expect(() => stale.commit()).toThrow();
  expect(() => stale.cancel()).toThrow();
  expect(current.active).toBe(true);
  expect(editor.document).toBe(changed);
  expect(current.commit()).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(track(editor, 'y')).toBeUndefined();
});

it('rejects a completed transaction handle and retained facade mutations after destruction', () => {
  const editor = setup();
  const facade = api(editor);
  const done = facade.beginTransaction('Terminé');
  done.commit();
  expect(() => done.commit()).toThrow();
  expect(() => done.cancel()).toThrow();
  const interrupted = facade.beginTransaction('Interrompu');
  editor.destroy();
  expect(interrupted.active).toBe(false);
  expect(() => interrupted.commit()).toThrow();
  expect(() => interrupted.cancel()).toThrow();
  expect(() => facade.set('logo', 'x', number(1), { initialValue: number(0) })).toThrow(/détruit/);
});

it.each([
  ['missing layer', 'missing', number(1), { frame: 1, initialValue: number(0) }],
  ['missing baseline', 'logo', number(1), { frame: 1 }],
  ['frame before start', 'logo', number(1), { frame: 0, initialValue: number(0) }],
  ['frame after end', 'logo', number(1), { frame: 101, initialValue: number(0) }],
  ['fractional frame', 'logo', number(1), { frame: 1.5, initialValue: number(0) }],
  ['non-finite value', 'logo', number(NaN), { frame: 1, initialValue: number(0) }],
  ['mixed value kind', 'logo', { kind: 'text', value: 'bad' }, { frame: 1, initialValue: number(0) }]
] as const)('refuses %s without changing document, emitting property changes, or adding history', (_name, id, value, options) => {
  const editor = setup();
  const before = editor.document;
  const changes = observe(editor);
  expectRefused(api(editor).set(id, 'x', value, options));
  expect(editor.document).toBe(before);
  expect(changes).toEqual([]);
  expect(editor.canUndo).toBe(false);
  expect(editor.canRedo).toBe(false);
});

it('preserves a valid gesture when another edit is refused', () => {
  const editor = setup();
  const transaction = api(editor).beginTransaction('Déplacer');
  api(editor).set('logo', 'x', number(20), { initialValue: number(0) });
  const valid = editor.document;
  expectRefused(api(editor).set('logo', 'y', number(30), { frame: 101, initialValue: number(0) }));
  expect(editor.document).toBe(valid);
  expect(transaction.active).toBe(true);
  transaction.cancel();
  expect(track(editor)).toBeUndefined();
  expect(editor.canUndo).toBe(false);
});

it('takes ownership of value inputs so later caller mutation cannot rewrite the document or redo', () => {
  const editor = setup();
  const value: { kind: 'number'; value: number } = { kind: 'number', value: 30 };
  const initialValue: { kind: 'number'; value: number } = { kind: 'number', value: 0 };
  api(editor).set('logo', 'x', value, { frame: 10, initialValue });
  value.value = 99;
  initialValue.value = -99;
  expect(track(editor)).toMatchObject({ initialValue: number(0), keys: [{ frame: 10, value: number(30) }] });
  expect(Object.isFrozen(track(editor)?.keys[0].value)).toBe(true);
  editor.undo();
  editor.redo();
  expect(track(editor)).toMatchObject({ initialValue: number(0), keys: [{ frame: 10, value: number(30) }] });
});

it('captures the current frame before a command callback moves the playhead', () => {
  let movePlayhead = false;
  const plugin = makeEditorPlugin([], 'test.movePlayhead', [], { onInit: (ctx) => {
    ctx.events.onCancellable('command:before', () => {
      if (movePlayhead) ctx.playback.seek(80);
    });
  } });
  const editor = setup({ plugins: [plugin] });
  editor.playback.seek(20);
  movePlayhead = true;
  expect(api(editor).set('logo', 'x', number(30), { initialValue: number(0) })).toEqual({ status: 'changed' });
  expect(editor.playback.frame).toBe(80);
  expect(track(editor)?.keys).toEqual([{ frame: 20, value: number(30) }]);
});

it('rechecks a lock introduced by command:before without committing a property event', () => {
  const initial = blankDocument();
  let locked = false;
  const plugin = makeEditorPlugin([], 'test.lockLayer', [], { onInit: (ctx) => {
    ctx.events.onCancellable('command:before', () => {
      if (locked) return;
      locked = true;
      ctx.commands.execute({ label: 'Verrouiller',
        do: (doc) => ({ ...doc, layers: [{ ...layerOf(doc, 'logo'), locked: true }] }),
        undo: () => initial });
    });
  } });
  const editor = setup({ plugins: [plugin], data: initial });
  const changes = observe(editor);
  expectRefused(api(editor).set('logo', 'x', number(20), { initialValue: number(0) }));
  expect(layerOf(editor.document, 'logo').locked).toBe(true);
  expect(track(editor)).toBeUndefined();
  expect(changes).toEqual([]);
  expect(editor.undo()).toBe(true);
  expect(editor.canUndo).toBe(false);
});

it('moves and deletes a property key with exact undo and a structural event for the move', () => {
  const editor = setup({ data: documentWithTrack() });
  const changes = observe(editor);
  const initial = editor.document;
  expect(api(editor).moveKey('logo', 'x', 100, 80)).toEqual({ status: 'changed' });
  expect(track(editor)?.keys.map((key) => key.frame)).toEqual([1, 80]);
  expect(changes[0].before?.keys.map((key) => key.frame)).toEqual([1, 100]);
  expect(changes[0].after?.keys.map((key) => key.frame)).toEqual([1, 80]);
  expect(changes[0].frame).toBeUndefined();
  expect(changes[0].oldValue).toBeUndefined();
  expect(changes[0].newValue).toBeUndefined();
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(initial);
  editor.playback.seek(100);
  expect(api(editor).deleteKey('logo', 'x')).toEqual({ status: 'changed' });
  expect(track(editor)?.keys).toEqual([{ frame: 1, value: number(0) }]);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(initial);
});

it('removes the property row when its last explicit key is deleted and restores it on undo', () => {
  const editor = setup();
  api(editor).set('logo', 'x', number(30), { frame: 10, initialValue: number(0) });
  const keyed = editor.document;
  expect(api(editor).deleteKey('logo', 'x', 10)).toEqual({ status: 'changed' });
  expect(track(editor)).toBeUndefined();
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(keyed);
});

it('routes transition creation, easing changes and removal through undoable property commands', () => {
  const editor = setup({ data: documentWithTrack() });
  const initial = editor.document;
  const changes = observe(editor);
  expect(api(editor).createTransition('logo', 'x', [1, 100])).toEqual({ status: 'changed' });
  const transition = track(editor)?.transitions?.[0];
  expect(transition).toMatchObject({ fromFrame: 1, toFrame: 100 });
  expect(transition?.id).toEqual(expect.any(String));
  expect(changes[0]).toMatchObject({ kind: 'transition', property: 'x', cause: 'execute' });
  expect(changes[0].frame).toBeUndefined();
  expect(changes[0].oldValue).toBeUndefined();
  expect(changes[0].newValue).toBeUndefined();
  const created = editor.document;
  const id = transition?.id ?? '';
  const easing: PropertyEasing = { kind: 'effect', family: 'quadratic', mode: 'in' };
  expect(api(editor).setEasing('logo', 'x', id, easing)).toEqual({ status: 'changed' });
  expect(track(editor)?.transitions?.[0].easing).toEqual(easing);
  const eased = editor.document;
  expect(api(editor).removeTransition('logo', 'x', id)).toEqual({ status: 'changed' });
  expect(track(editor)?.transitions ?? []).toHaveLength(0);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(eased);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(created);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(initial);
});

it('captures within a tween without changing its evaluation or another property', () => {
  const opacity: IPropertyTimeline = {
    initialValue: number(0), keys: [{ frame: 1, value: number(0) }, { frame: 100, value: number(1) }],
    transitions: [{ id: 'opacity-fade', fromFrame: 1, toFrame: 100,
      easing: { kind: 'effect', family: 'quadratic', mode: 'in' } }]
  };
  const editor = setup({ data: documentWithTrack('opacity', opacity) });
  const samples = [1, 10.5, 49.9, 50, 66.2, 100].map((frame) => editor.sample(frame).layer('logo')?.propertyValues);
  expect(api(editor).capture('logo', 'opacity', { frame: 50 })).toEqual({ status: 'changed' });
  expect(track(editor, 'opacity')?.keys).toHaveLength(3);
  expect(track(editor, 'opacity')?.transitions).toHaveLength(2);
  expect([1, 10.5, 49.9, 50, 66.2, 100].map((frame) => editor.sample(frame).layer('logo')?.propertyValues)).toEqual(samples);
  const captured = track(editor, 'opacity');
  api(editor).set('logo', 'x', number(30), { frame: 50, initialValue: number(0) });
  expect(track(editor, 'opacity')).toEqual(captured);
  expect(editor.undo()).toBe(true);
  expect(track(editor, 'opacity')).toEqual(captured);
  expect(editor.undo()).toBe(true);
  expect(track(editor, 'opacity')).toEqual(opacity);
});

it('refuses incompatible transitions and attached-key deletion without consuming history', () => {
  const text: IPropertyTimeline = { initialValue: { kind: 'text', value: 'Blue' }, keys: [
    { frame: 1, value: { kind: 'text', value: 'Red' } },
    { frame: 100, value: { kind: 'text', value: 'Yellow' } }
  ] };
  const editor = setup({ data: documentWithTrack('caption', text) });
  const changes = observe(editor);
  const initial = editor.document;
  expectRefused(api(editor).createTransition('logo', 'caption', [1, 100]));
  expect(editor.document).toBe(initial);
  expect(editor.canUndo).toBe(false);
  expect(changes).toEqual([]);
  editor.load(documentWithTrack());
  api(editor).createTransition('logo', 'x', [1, 100]);
  const transitioned = editor.document;
  expectRefused(api(editor).deleteKey('logo', 'x', 100));
  expect(editor.document).toBe(transitioned);
  expect(editor.undo()).toBe(true);
  expect(track(editor)?.transitions ?? []).toHaveLength(0);
  expect(editor.undo()).toBe(false);
});

it('requires explicit migration before editing a legacy property and preserves its value on migration', () => {
  const initial = createDoc([layer('logo', [{ id: 'still', start: 1, end: 100, kind: 'static',
    tracks: { x: [{ frame: 1, value: 12 }] } }])], 100);
  const editor = setup({ data: initial });
  const changes = observe(editor);
  expectRefused(api(editor).set('logo', 'x', number(30), { frame: 50, initialValue: number(0) }));
  expect(editor.document).toBe(initial);
  expect(api(editor).migrate('logo', 'x')).toEqual({ status: 'changed' });
  expect(editor.sample(50).layer('logo')?.propertyValues?.x).toEqual(number(12));
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ kind: 'track', property: 'x', cause: 'execute' });
  expect(changes[0].frame).toBeUndefined();
  expect(changes[0].oldValue).toBeUndefined();
  expect(changes[0].newValue).toBeUndefined();
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(initial);
});

it('keeps numeric setProperty on its legacy path while the additive API edits a separate property', () => {
  const editor = setup({ data: createDoc([layer('logo', [
    { id: 'motion', start: 1, end: 100, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 100, value: 99 }] } }
  ])], 100) });
  expect(editor.setProperty('logo', 'x', 40, { frame: 50 })).toBe(true);
  const legacyEdited = editor.document;
  expect(track(editor)).toBeUndefined();
  expect(api(editor).set('logo', 'caption', { kind: 'text', value: 'Hello' },
    { frame: 50, initialValue: { kind: 'text', value: '' } })).toEqual({ status: 'changed' });
  expect(layerOf(editor.document, 'logo').spans).toEqual(layerOf(legacyEdited, 'logo').spans);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(legacyEdited);
});

it('respects explicit object-stage permissions for rich properties and rechecks them on redo', () => {
  const object = { caption: '' };
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'object', label: 'Objet', object, properties: ['caption'] }], apply: () => {} });
  const data = createDoc([layer('logo', [], { target: { ref: 'object' } })], 100);
  const editor = setup({ data, stage });
  expectRefused(api(editor).set('logo', 'x', number(20), { initialValue: number(0) }));
  expect(editor.canUndo).toBe(false);
  expect(api(editor).set('logo', 'caption', { kind: 'text', value: 'Hello' },
    { initialValue: { kind: 'text', value: '' } })).toEqual({ status: 'changed' });
  const committed = editor.document;
  expect(editor.undo()).toBe(true);
  const undone = editor.document;
  const changes = observe(editor);
  stage.remove('object');
  stage.add({ id: 'object', label: 'Objet', object, properties: [] });
  expect(editor.redo()).toBe(false);
  expect(editor.document).toBe(undone);
  expect(editor.canRedo).toBe(true);
  expect(changes).toEqual([]);
  stage.remove('object');
  stage.add({ id: 'object', label: 'Objet', object, properties: ['caption'] });
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(committed);
});

it('permits a self-describing rich property when the routed object has no property restrictions', () => {
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'object', label: 'Objet', object: { caption: '' } }], apply: () => {} });
  const editor = setup({ stage, data: createDoc([layer('logo', [], { target: { ref: 'object' } })], 100) });
  expect(api(editor).set('logo', 'caption', { kind: 'text', value: 'Hello' },
    { initialValue: { kind: 'text', value: '' } })).toEqual({ status: 'changed' });
  expect(editor.sample(1).layer('logo')?.propertyValues?.caption).toEqual({ kind: 'text', value: 'Hello' });
});

it('refuses failed target metadata without losing the redo entry or publishing a property event', () => {
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'object', label: 'Objet', object: { x: 0 }, properties: ['x'] }], apply: () => {} });
  const failures: unknown[] = [];
  let fails = false;
  const editor = setup({
    data: createDoc([layer('logo', [], { target: { ref: 'object' } })], 100),
    onStageError: (error) => failures.push(error),
    stage: { ...stage, targets: { list: () => stage.targets?.list() ?? [], describe: (target) => {
      if (fails) throw new Error('Metadata unavailable');
      return stage.targets?.describe?.(target);
    } } }
  });
  api(editor).set('logo', 'x', number(20), { initialValue: number(0) });
  editor.undo();
  const before = editor.document;
  const changes = observe(editor);
  fails = true;
  expect(editor.redo()).toBe(false);
  expect(editor.document).toBe(before);
  expect(editor.canRedo).toBe(true);
  expect(changes).toEqual([]);
  expect(failures).toHaveLength(1);
  fails = false;
  expect(editor.redo()).toBe(true);
  expect(editor.sample(1).layer('logo')?.propertyValues?.x).toEqual(number(20));
});

it('preserves a document loaded by target metadata during an edit and emits no stale property event', () => {
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'object', label: 'Objet', object: { x: 0 }, properties: ['x'] }], apply: () => {} });
  const initial = createDoc([layer('logo', [], { target: { ref: 'object' } })], 100);
  const loaded = { ...initial, settings: { ...initial.settings, fps: 12 } };
  let trigger = false;
  const editor = setup({ data: initial,
    stage: { ...stage, targets: { list: () => stage.targets?.list() ?? [], describe: (target) => {
      if (trigger) { trigger = false; editor.load(loaded); }
      return stage.targets?.describe?.(target);
    } } }
  });
  const changes = observe(editor);
  trigger = true;
  expectRefused(api(editor).set('logo', 'x', number(20), { initialValue: number(0) }));
  expect(editor.document).toBe(loaded);
  expect(editor.canUndo).toBe(false);
  expect(changes).toEqual([]);
});

it('preserves a reentrant command from target metadata instead of overwriting it with the outer edit', () => {
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'object', label: 'Objet', object: { x: 0 }, properties: ['x'] }], apply: () => {} });
  const initial = createDoc([layer('logo', [], { target: { ref: 'object' } })], 100);
  let trigger = false;
  const editor = setup({ data: initial,
    stage: { ...stage, targets: { list: () => stage.targets?.list() ?? [], describe: (target) => {
      if (trigger) {
        trigger = false;
        editor.execute({ label: 'Verrouiller',
          do: (doc) => ({ ...doc, layers: [{ ...layerOf(doc, 'logo'), locked: true }] }),
          undo: () => initial });
      }
      return stage.targets?.describe?.(target);
    } } }
  });
  const changes = observe(editor);
  trigger = true;
  expectRefused(api(editor).set('logo', 'x', number(20), { initialValue: number(0) }));
  expect(layerOf(editor.document, 'logo').locked).toBe(true);
  expect(track(editor)).toBeUndefined();
  expect(changes).toEqual([]);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(initial);
  expect(editor.canUndo).toBe(false);
});

it('stops a pending edit when target metadata destroys the editor', () => {
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'object', label: 'Objet', object: { x: 0 }, properties: ['x'] }], apply: () => {} });
  let trigger = false;
  const editor = setup({ data: createDoc([layer('logo', [], { target: { ref: 'object' } })], 100),
    stage: { ...stage, targets: { list: () => stage.targets?.list() ?? [], describe: (target) => {
      if (trigger) { trigger = false; editor.destroy(); }
      return stage.targets?.describe?.(target);
    } } }
  });
  const changes = observe(editor);
  const facade = api(editor);
  trigger = true;
  expectRefused(facade.set('logo', 'x', number(20), { initialValue: number(0) }));
  expect(editor.isDestroyed).toBe(true);
  expect(changes).toEqual([]);
});

it('does not emit property changes when load replaces property tracks', () => {
  const editor = setup({ data: documentWithTrack() });
  const changes = observe(editor);
  editor.load(documentWithTrack('caption', { initialValue: { kind: 'text', value: '' },
    keys: [{ frame: 1, value: { kind: 'text', value: 'Hello' } }] }));
  expect(changes).toEqual([]);
});

it('reports a cancelled property command as refused rather than a no-op', () => {
  const plugin = makeEditorPlugin([], 'veto', [], { onInit: (ctx) => {
    ctx.events.onCancellable('command:before', (event) => event.cancel());
  } });
  const editor = setup({ plugins: [plugin] });
  const before = editor.document;
  const changes = observe(editor);
  expectRefused(api(editor).set('logo', 'x', number(20), { initialValue: number(0) }));
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
  expect(changes).toEqual([]);
});

it('keeps the outer result accurate when a command callback triggers an unrelated refused edit', () => {
  let nested = false;
  let nestedResult: MutationResult | undefined;
  const plugin = makeEditorPlugin([], 'test.nestedRefusal', [], { onInit: (ctx) => {
    ctx.events.onCancellable('command:before', () => {
      if (nested) return;
      nested = true;
      nestedResult = api(editor).set('logo', 'y', number(30), { frame: 101, initialValue: number(0) });
    });
  } });
  const editor = setup({ plugins: [plugin] });
  const changes = observe(editor);
  expect(api(editor).set('logo', 'x', number(20), { initialValue: number(0) })).toEqual({ status: 'changed' });
  expect(nestedResult?.status).toBe('refused');
  expect(changes.map((event) => event.property)).toEqual(['x']);
  expect(track(editor, 'y')).toBeUndefined();
  expect(editor.undo()).toBe(true);
  expect(editor.undo()).toBe(false);
});

it('lets plugins observe property changes but rejects fabricated core events', () => {
  const capture = captureContext();
  const editor = setup({ plugins: [capture.plugin] });
  const ctx = capture.context();
  const seen: PropertyChanged[] = [];
  ctx.events.on('property:changed', (event) => seen.push(event));
  const emitUntyped = ctx.events.emit as (name: string, payload: unknown) => void;
  const emitCancellableUntyped = ctx.events.emitCancellable as (name: string, payload: unknown) => boolean;
  expect(() => emitUntyped('property:changed', {})).toThrow(/événement du noyau/);
  expect(() => emitCancellableUntyped('property:changed', {})).toThrow(/événement du noyau/);
  expect(seen).toEqual([]);
  const forge = (): void => {
    // @ts-expect-error Plugins may subscribe to, but cannot fabricate, core property events.
    ctx.events.emit('property:changed', {});
  };
  expect(typeof forge).toBe('function');
  api(editor).set('logo', 'x', number(20), { initialValue: number(0) });
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatchObject({ property: 'x', newValue: number(20) });
});

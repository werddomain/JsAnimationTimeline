// packages/editor/src/core/editor/__tests__/PropertyTimeline.boundaries.test.ts
import { createEditor } from '../createEditor';
import type { IEditor } from '../types';
import type { PropertyChangedEvent } from '../propertyTimelineTypes';
import type { PropertyEasing } from '@kazo-ca/timeline-runtime';
import { createDoc, layer } from '../../../model/spans/__tests__/fixtures';
import { captureContext, cleanBody, createContainer, makeEditorPlugin } from './fixtures';

const editors: IEditor[] = [];
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); cleanBody(); });

it('reports evaluated baseline values when the first key is added or the last is removed', () => {
  const editor = createEditor(createContainer(), { data: createDoc([layer('logo', [])]), defaultPlugins: false, stage: false });
  editors.push(editor);
  const events: PropertyChangedEvent[] = [];
  editor.on('property:changed', (event) => events.push(event));
  editor.propertyTimelines.set('logo', 'opacity', { kind: 'number', value: 0.5 }, { initialValue: { kind: 'number', value: 2 } });
  expect(events[0].oldValue).toEqual({ kind: 'number', value: 1 });
  editor.propertyTimelines.deleteKey('logo', 'opacity', 1);
  expect(events[1].newValue).toEqual({ kind: 'number', value: 1 });
});

it('never closes a plugin group that replaced the transaction during begin notification', () => {
  const capture = captureContext();
  const editor = createEditor(createContainer(), { data: createDoc([layer('logo', [])]), defaultPlugins: false, stage: false,
    plugins: [capture.plugin] });
  editors.push(editor);
  const commands = capture.context().commands;
  let replaced = false;
  editor.on('history:changed', () => {
    if (replaced || !commands.isGrouping) return;
    replaced = true;
    commands.cancelGroup();
    commands.beginGroup('Autre geste');
  });
  const stale = editor.propertyTimelines.beginTransaction('Ancien geste');
  expect(stale.active).toBe(false);
  expect(() => stale.commit()).toThrow(/plus active/);
  expect(() => stale.cancel()).toThrow(/plus active/);
  expect(commands.isGrouping).toBe(true);
  commands.cancelGroup();
});

it('publishes property changes in commit order when an earlier plugin edits during document notification', () => {
  let nested = false;
  const plugin = makeEditorPlugin([], 'test.reenterDocument', [], { onInit: (ctx) => {
    ctx.events.on('document:changed', () => {
      if (nested) return;
      nested = true;
      editor.propertyTimelines.set('logo', 'x', { kind: 'number', value: 2 });
    });
  } });
  const editor = createEditor(createContainer(), { data: createDoc([layer('logo', [])]), defaultPlugins: false, stage: false, plugins: [plugin] });
  editors.push(editor);
  const seen: number[] = [];
  editor.on('property:changed', (event) => { if (event.newValue?.kind === 'number') seen.push(event.newValue.value); });
  editor.propertyTimelines.set('logo', 'x', { kind: 'number', value: 1 }, { initialValue: { kind: 'number', value: 0 } });
  expect(seen).toEqual([1, 2]);
  expect(editor.sample(1).layer('logo')?.values.x).toBe(2);
});

it('finishes all property diffs of a commit before delivering a reentrant property edit', () => {
  const editor = createEditor(createContainer(), { data: createDoc([layer('logo', [])]), defaultPlugins: false, stage: false });
  editors.push(editor);
  const seen: string[] = [];
  editor.on('property:changed', (event) => {
    if (event.property === 'x') editor.propertyTimelines.set('logo', 'y', { kind: 'number', value: 2 });
  });
  editor.on('property:changed', (event) => {
    if (event.newValue?.kind === 'number') seen.push(`${event.property}:${event.newValue.value}`);
  });
  const before = editor.document;
  editor.execute({ label: 'Deux propriétés', do: (doc) => ({ ...doc, layers: [layer('logo', [], {
    propertyTimelines: Object.fromEntries(['x', 'y'].map((name) => [name, {
      initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 1 } }]
    }]))
  })] }), undo: () => before });
  expect(seen).toEqual(['x:1', 'y:1', 'y:2']);
});

it('does not announce queued edits discarded by a reentrant load', () => {
  let replaced = false;
  const plugin = makeEditorPlugin([], 'test.loadDuringChange', [], { onInit: (ctx) => {
    ctx.events.on('document:changed', () => {
      if (replaced) return;
      replaced = true;
      editor.load(createDoc([layer('logo', [])]));
    });
  } });
  const editor = createEditor(createContainer(), { data: createDoc([layer('logo', [])]), defaultPlugins: false, stage: false, plugins: [plugin] });
  editors.push(editor);
  const seen: PropertyChangedEvent[] = [];
  editor.on('property:changed', (event) => seen.push(event));
  editor.propertyTimelines.set('logo', 'x', { kind: 'number', value: 1 }, { initialValue: { kind: 'number', value: 0 } });
  expect(seen).toEqual([]);
  expect(editor.canUndo).toBe(false);
});

it.each([null, false, []])('refuses invalid easing parameters %j from JavaScript without normalizing them', (parameters) => {
  const editor = createEditor(createContainer(), { data: createDoc([layer('logo', [])]), defaultPlugins: false, stage: false });
  editors.push(editor);
  editor.propertyTimelines.set('logo', 'x', { kind: 'number', value: 0 }, { initialValue: { kind: 'number', value: 0 } });
  editor.propertyTimelines.set('logo', 'x', { kind: 'number', value: 10 }, { frame: 10 });
  editor.propertyTimelines.createTransition('logo', 'x', [1, 10]);
  const before = editor.document;
  const transition = before.layers[0].type === 'layer' ? before.layers[0].propertyTimelines!.x.transitions![0] : undefined;
  const easing = { kind: 'effect', family: 'power', mode: 'in', parameters } as unknown as PropertyEasing;
  expect(editor.propertyTimelines.setEasing('logo', 'x', transition!.id, easing).status).toBe('refused');
  expect(editor.document).toBe(before);
  expect(editor.undo()).toBe(true);
  expect(editor.document.layers[0].type === 'layer' && editor.document.layers[0].propertyTimelines!.x.transitions).toBeUndefined();
});

// packages/editor/src/core/editor/__tests__/Editor.setProperty.test.ts
import { createObjectStage, createPropertyRegistry } from '@werddomain/timeline-runtime';
import type { IStage } from '@werddomain/timeline-runtime';
import { createEditor } from '../createEditor';
import { createDoc, layer, layerOf, spansOf } from '../../../model/spans/__tests__/fixtures';
import { cleanBody, createContainer, makeEditorPlugin } from './fixtures';

afterEach(cleanBody);

it('exposes an undoable property edit without default plugins or a stage', () => {
  const editor = createEditor(createContainer(), {
    defaultPlugins: false,
    stage: false,
    data: createDoc([layer('logo', [{
      id: 'motion', start: 1, end: 10, kind: 'tween',
      tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] }
    }])])
  });
  expect(editor.setProperty('logo', 'x', 42, { frame: 5 })).toBe(true);
  expect(spansOf(editor.document, 'logo')[0].tracks?.x).toEqual([
    { frame: 1, value: 0 }, { frame: 5, value: 42 }, { frame: 10, value: 90 }
  ]);
  expect(editor.undo()).toBe(true);
  expect(editor.sample(5).layer('logo')?.values.x).toBe(40);
});

function stillDocument(): ReturnType<typeof createDoc> {
  return createDoc([layer('logo', [{ id: 'still', start: 1, end: 10, kind: 'static' }])]);
}

it('defaults to the current integer frame and records no extra history for identical keys', () => {
  const doc = createDoc([layer('logo', [{ id: 'motion', start: 1, end: 10, kind: 'tween' }])]);
  const editor = createEditor(createContainer(), { defaultPlugins: false, stage: false, data: doc });
  editor.playback.seek(5.8);
  const frame = editor.playback.frame;
  expect(Number.isInteger(frame)).toBe(true);
  const refused: string[] = [];
  editor.on('command:refused', ({ reason }) => refused.push(reason));
  expect(editor.setProperty('logo', 'x', 25)).toBe(true);
  const changed = editor.document;
  expect(spansOf(changed, 'logo')[0].tracks?.x).toEqual([{ frame, value: 25 }]);
  expect(Object.isFrozen(changed)).toBe(true);
  expect(Object.isFrozen(spansOf(changed, 'logo')[0].tracks?.x)).toBe(true);
  expect(editor.setProperty('logo', 'x', 25)).toBe(false);
  expect(editor.document).toBe(changed);
  expect(refused).toEqual([]);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(doc);
  expect(editor.undo()).toBe(false);
});

it.each([
  ['unknown', 'x', 1, 1], ['logo', 'unknown', 1, 1], ['logo', 'x', NaN, 1],
  ['logo', 'x', 1, 0], ['logo', 'x', 1, 25], ['logo', 'x', 1, 1.2],
  ['logo', 'x', 1, null], ['logo', 'x', '1', 1]
])('emits a business refusal for invalid input (%s, %s, %s, %s)', (id, name, value, frame) => {
  const editor = createEditor(createContainer(), { defaultPlugins: false, stage: false, data: stillDocument() });
  const reasons: string[] = [];
  editor.on('command:refused', ({ reason }) => reasons.push(reason));
  const before = editor.document;
  expect(editor.setProperty(String(id), String(name), value as number, { frame: frame as number })).toBe(false);
  expect(reasons).toHaveLength(1);
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
});

it('rechecks current document locks after command:before, before editing', () => {
  const data = stillDocument();
  let locked = false;
  const guard = makeEditorPlugin([], 'guard', [], { onInit: (ctx) => {
    ctx.events.onCancellable('command:before', () => {
      if (locked) return;
      locked = true;
      ctx.commands.execute({
        label: 'Verrouiller',
        do: (doc) => ({ ...doc, layers: [{ ...layerOf(doc, 'logo'), locked: true }] }),
        undo: () => data
      });
    });
  } });
  const editor = createEditor(createContainer(), { defaultPlugins: false, plugins: [guard], stage: false, data });
  const reasons: string[] = [];
  editor.on('command:refused', ({ reason }) => reasons.push(reason));
  expect(editor.setProperty('logo', 'x', 30)).toBe(false);
  expect(reasons[0]).toContain('verrouillé');
  expect(editor.canUndo).toBe(true);
  expect(spansOf(editor.document, 'logo')[0].tracks).toBeUndefined();
});

it('uses real object-stage permissions and rereads changed metadata on refused redo', () => {
  const object = { volume: 0 };
  const objectStage = createObjectStage({
    id: 'audio',
    properties: [{ name: 'volume', kind: 'value', unit: '', defaultValue: 0 }],
    objects: [{ id: 'logo', label: 'Logo', object, properties: [{ name: 'volume', unit: 'dB' }] }],
    apply: (target, values) => { target.volume = values.volume ?? 0; }
  });
  const data = stillDocument();
  const editor = createEditor(createContainer(), {
    defaultPlugins: false, stage: objectStage,
    data: { ...data, layers: [{ ...layerOf(data, 'logo'), target: { ref: 'logo', stage: 'audio' } }] }
  });
  expect(editor.setProperty('logo', 'x', 30)).toBe(false);
  expect(editor.setProperty('logo', 'volume', 0.7)).toBe(true);
  expect(editor.undo()).toBe(true);
  const before = editor.document;
  objectStage.remove('logo');
  objectStage.add({ id: 'logo', label: 'Logo', object, properties: [] });
  expect(editor.redo()).toBe(false);
  expect(editor.document).toBe(before);
  expect(editor.canRedo).toBe(true);
  objectStage.remove('logo');
  objectStage.add({ id: 'logo', label: 'Logo', object, properties: ['volume'] });
  expect(editor.redo()).toBe(true);
});

it('supports custom inherited property names and rejects access after destroy', () => {
  const registry = createPropertyRegistry([{ name: 'toString', kind: 'value', unit: '', defaultValue: 0 }]);
  const editor = createEditor(createContainer(), { defaultPlugins: false, stage: false, registry, data: stillDocument() });
  expect(editor.setProperty('logo', 'toString', 7)).toBe(true);
  expect(editor.sample(1).layer('logo')?.values['toString']).toBe(7);
  editor.destroy();
  expect(() => editor.setProperty('logo', 'x', 1)).toThrow(/détruit.*setProperty/);
});

it('uses only the routed stage list metadata for an unscoped alias without describe', () => {
  const canvas = createObjectStage({
    id: 'canvas', unscoped: true,
    objects: [{ id: 'a', label: 'Objet canvas', object: { x: 0 }, properties: ['x'] }],
    apply: (object, values) => { object.x = values.x ?? 0; }
  });
  const other = createObjectStage({
    id: 'other', unscoped: true,
    objects: [{ id: 'a', label: 'Autre objet', object: { y: 0 }, properties: ['y'] }],
    apply: (object, values) => { object.y = values.y ?? 0; }
  });
  const listedOnly = (stage: IStage): IStage => ({
    ...stage, targets: { list: () => stage.targets?.list() ?? [] }
  });
  const data = stillDocument();
  const editor = createEditor(createContainer(), {
    defaultPlugins: false, stage: [listedOnly(canvas), listedOnly(other)],
    data: { ...data, layers: [{ ...layerOf(data, 'logo'), target: { ref: 'a' } }] }
  });
  expect(editor.setProperty('logo', 'y', 20)).toBe(false);
  expect(editor.canUndo).toBe(false);
  expect(editor.setProperty('logo', 'x', 10)).toBe(true);
  expect(spansOf(editor.document, 'logo')[0].tracks).toEqual({ x: [{ frame: 1, value: 10 }] });
});


it('fills missing permissions from the routed list when describe only supplies a label', () => {
  const stage = createObjectStage({
    id: 'canvas', unscoped: true,
    objects: [{ id: 'a', label: 'Canvas object', object: { x: 0 }, properties: ['x'] }],
    apply: (object, values) => { object.x = values.x ?? 0; }
  });
  const data = stillDocument();
  const editor = createEditor(createContainer(), {
    defaultPlugins: false,
    stage: {
      ...stage,
      targets: { ...stage.targets, list: () => stage.targets?.list() ?? [],
        describe: (target) => ({ target, label: 'Described without capabilities' }) }
    },
    data: { ...data, layers: [{ ...layerOf(data, 'logo'), target: { ref: 'a' } }] }
  });
  expect(editor.setProperty('logo', 'y', 20)).toBe(false);
  expect(editor.canUndo).toBe(false);
  expect(editor.setProperty('logo', 'x', 10)).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual({ ...data, layers: [{ ...layerOf(data, 'logo'), target: { ref: 'a' } }] });
});

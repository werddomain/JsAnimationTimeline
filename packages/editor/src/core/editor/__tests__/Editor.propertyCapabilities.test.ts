// packages/editor/src/core/editor/__tests__/Editor.propertyCapabilities.test.ts
import { createObjectStage } from '@kazo-ca/timeline-runtime';
import type { ITargetPropertyInfo, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../createEditor';
import type { IEditor } from '../types';
import { createDoc, layer, layerOf } from '../../../model/spans/__tests__/fixtures';
import { cleanBody, createContainer } from './fixtures';

const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const editors: IEditor[] = [];
function setup(property: () => ITargetPropertyInfo): IEditor {
  const objectStage = createObjectStage({ id: 'objects', unscoped: true, objects: [{ id: 'target', label: 'Cible', object: {} }], apply: () => {} });
  const stage = { ...objectStage, targets: { ...objectStage.targets,
    list: () => objectStage.targets?.list() ?? [],
    describe: () => ({ target: { ref: 'target' }, label: 'Cible', properties: [property()] }) } };
  const editor = createEditor(createContainer(), { stage, defaultPlugins: false, data: createDoc([
    layer('logo', [], { target: { ref: 'target' }, propertyTimelines: {
      opacity: { initialValue: number(1), keys: [{ frame: 50, value: number(0.8) }, { frame: 100, value: number(0.6) }] }
    } })
  ], 100) });
  editors.push(editor);
  return editor;
}
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); cleanBody(); });

it('captures resolved state through the public facade with one event and one undo entry', () => {
  const editor = setup(() => ({ name: 'opacity', sample: () => number(0.8) }));
  const before = editor.document;
  const events: string[] = [];
  editor.on('property:changed', ({ cause }) => events.push(cause));
  editor.playback.seek(20);
  expect(editor.propertyTimelines.capture('logo', 'opacity')).toEqual({ status: 'changed' });
  expect(layerOf(editor.document, 'logo').propertyTimelines?.opacity.keys[0]).toEqual({ frame: 20, value: number(0.8) });
  expect(events).toEqual(['execute']);
  const changed = editor.document;
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
  expect(editor.canUndo).toBe(false);
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(changed);
  expect(events).toEqual(['execute', 'undo', 'redo']);
});

it('returns a capability refusal and keeps both document and history when transition creation is unavailable', () => {
  const editor = setup(() => ({ name: 'opacity', interpolable: false, reason: 'Les valeurs ne peuvent pas être interpolées.' }));
  const before = editor.document;
  expect(editor.propertyTimelines.createTransition('logo', 'opacity', [50, 100])).toEqual({
    status: 'refused', reason: 'Les valeurs ne peuvent pas être interpolées.'
  });
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
  expect(editor.propertyTimelines.set('logo', 'opacity', number(0.7), { frame: 50 })).toEqual({ status: 'changed' });
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
});

it('reevaluates editability on redo and preserves the redo entry after refusal', () => {
  let editable = true;
  const editor = setup(() => ({ name: 'opacity', editable, reason: 'Les éléments ne partagent plus la même base.' }));
  expect(editor.propertyTimelines.set('logo', 'opacity', number(0.7), { frame: 50 })).toEqual({ status: 'changed' });
  const after = editor.document;
  expect(editor.undo()).toBe(true);
  const before = editor.document;
  editable = false;
  expect(editor.redo()).toBe(false);
  expect(editor.document).toBe(before);
  expect(editor.canRedo).toBe(true);
  editable = true;
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(after);
});

it('rejects a non-common sample and keeps cancellation free of edits', () => {
  const editor = setup(() => ({ name: 'opacity', sample: () => { throw new Error('Les valeurs affichées du groupe diffèrent.'); } }));
  const before = editor.document;
  const event = jest.fn();
  editor.on('property:changed', event);
  expect(editor.propertyTimelines.capture('logo', 'opacity', { frame: 20 })).toMatchObject({ status: 'refused' });
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
  expect(event).not.toHaveBeenCalled();
  expect(editor.propertyTimelines.set('logo', 'opacity', number(0.7), { frame: 20 })).toEqual({ status: 'changed' });
  expect(event).toHaveBeenCalledTimes(1);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
});

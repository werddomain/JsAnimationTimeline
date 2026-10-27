// packages/editor/src/plugins/tweens/propertyKeyframes/__tests__/PropertyKeyframesPlugin.test.ts
import { createEditor } from '../../../../core/editor/createEditor';
import { createObjectStage, createPropertyRegistry } from '@werddomain/timeline-runtime';
import type { IStage, ITargetInfo, ITimelineDocument } from '@werddomain/timeline-runtime';
import type { EditorOptions, IEditor } from '../../../../core/editor/types';
import { SetPropertyCommand } from '../../../../model/properties/SetPropertyCommand';
import { PropertyOperationError } from '../../../../model/properties/propertyValue';
import { layerOf, spansOf } from '../../../../model/spans/__tests__/fixtures';
import { captureContext, cleanBody, createContainer } from '../../../../core/editor/__tests__/fixtures';
import { PropertyKeyframesPlugin, PROPERTY_KEYFRAMES_PLUGIN_ID } from '..';
import type { IPropertyKeyframesService } from '../types';

afterEach(cleanBody);

it('provides the property keyframe service with the default editor plugins', () => {
  const editor = createEditor(createContainer(), { stage: false });
  const service = editor.getService('tweens.propertyKeyframes');
  expect(service).toBeDefined();
  expect(typeof service?.setProperty).toBe('function');
});

function data(): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 24, totalFrames: 20 },
    layers: [
      { id: 'main', name: 'Main', type: 'layer', target: { ref: 'main' }, spans: [
        { id: 'motion', kind: 'tween', start: 1, end: 11, easing: 'linear', tracks: {
          x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }],
          y: [{ frame: 1, value: 10 }, { frame: 11, value: 30 }]
        } },
        { id: 'static', kind: 'static', start: 12, end: 15, tracks: { x: [{ frame: 12, value: 100 }] } },
        { id: 'blank', kind: 'blank', start: 16, end: 18 }
      ] },
      { id: 'folder', name: 'Folder', type: 'folder', locked: true, children: [
        { id: 'locked', name: 'Locked', type: 'layer', spans: [{ id: 'locked-span', kind: 'static', start: 1, end: 20 }] }
      ] }
    ]
  };
}

function setup(options: EditorOptions = {}): { readonly editor: IEditor; readonly service: IPropertyKeyframesService } {
  const editor = createEditor(createContainer(), { stage: false, data: data(), ...options });
  const service = editor.getService('tweens.propertyKeyframes');
  if (service === undefined) throw new Error('Service de propriétés absent.');
  return { editor, service };
}

it('declares a literal id, depends on motion, and owns no rendering or slot', () => {
  const plugin = new PropertyKeyframesPlugin();
  const id: 'tweens.propertyKeyframes' = plugin.id;
  expect(id).toBe(PROPERTY_KEYFRAMES_PLUGIN_ID);
  expect(plugin.dependencies).toEqual(['tweens.motion']);
  expect('render' in plugin).toBe(false);
  expect('slot' in plugin).toBe(false);
  plugin.destroy();
});

it('uses exactly SetPropertyCommand and changes one requested track without splitting spans', () => {
  const commands: unknown[] = [];
  const { editor, service } = setup({ plugins: [{
    id: 'commandObserver', dependencies: [],
    init: (ctx) => { ctx.events.onCancellable('command:before', ({ payload }) => { commands.push(payload.command); }); },
    destroy: () => {}
  }] });
  const before = editor.document;
  expect(service.setProperty('main', 'x', 75, { frame: 6 })).toBe(true);
  const changed = editor.document;
  expect(spansOf(changed, 'main')[0]).toEqual({ ...spansOf(before, 'main')[0], tracks: {
    ...spansOf(before, 'main')[0].tracks,
    x: [{ frame: 1, value: 0 }, { frame: 6, value: 75 }, { frame: 11, value: 100 }]
  } });
  expect(spansOf(changed, 'main')[0].tracks?.y).toBe(spansOf(before, 'main')[0].tracks?.y);
  expect(changed.settings).toBe(before.settings);
  expect(changed.layers[1]).toBe(before.layers[1]);
  expect(spansOf(changed, 'main')).toHaveLength(3);
  expect(Object.isFrozen(spansOf(changed, 'main')[0].tracks?.x)).toBe(true);
  expect(service.setProperty('main', 'x', 75, { frame: 6 })).toBe(false);
  expect(editor.document).toBe(changed);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
  expect(editor.canUndo).toBe(false);
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(changed);
  expect(commands).toHaveLength(2);
  expect(commands.every((command) => command instanceof SetPropertyCommand)).toBe(true);
});

it('shares the core API history, defaults to the current integer frame and stores static values at start', () => {
  const { editor, service } = setup();
  editor.playback.seek(6);
  expect(service.setProperty('main', 'x', 50)).toBe(true);
  expect(spansOf(editor.document, 'main')[0].tracks?.x[1]).toEqual({ frame: 6, value: 50 });
  expect(editor.setProperty('main', 'y', 66, { frame: 6 })).toBe(true);
  expect(service.setProperty('main', 'x', 125, { frame: 14 })).toBe(true);
  expect(spansOf(editor.document, 'main')[1]).toEqual({
    id: 'static', kind: 'static', start: 12, end: 15, tracks: { x: [{ frame: 12, value: 125 }] }
  });
  expect(editor.undo()).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(editor.sample(6).layer('main')?.values).toEqual({ x: 50, y: 20 });
});

it('inspects locked content, returns no properties for absent layers and folders, and preserves descriptors', () => {
  const registry = createPropertyRegistry([{ name: 'toString', kind: 'value', unit: 'u', defaultValue: 0 }]);
  const { editor, service } = setup({ registry });
  const names = editor.registry.list().map(({ name }) => name);
  expect(service.propertiesFor('main').map(({ name }) => name)).toEqual(names);
  expect(service.propertiesFor('locked').map(({ name }) => name)).toEqual(names);
  expect(service.propertiesFor('missing')).toEqual([]);
  expect(service.propertiesFor('folder')).toEqual([]);
  expect(service.propertiesFor('main').find(({ name }) => name === 'toString')).toBe(editor.registry.get('toString'));
  expect(Object.isFrozen(service.propertiesFor('main'))).toBe(true);
  expect(service.setProperty('main', 'toString', 7, { frame: 6 })).toBe(true);
  expect(editor.sample(6).layer('main')?.values['toString']).toBe(7);
});

it.each([
  ['locked', 'x', 1, 1], ['folder', 'x', 1, 1], ['missing', 'x', 1, 1],
  ['main', 'unknown', 1, 1], ['main', 'x', Infinity, 1], ['main', 'x', 1, 16],
  ['main', 'x', 1, 19], ['main', 'x', 1, 0], ['main', 'x', 1, 2.5], ['main', 'x', 1, 21]
])('refuses invalid service edit (%s, %s, %s, %s) atomically', (id, name, value, frame) => {
  const { editor, service } = setup();
  const reasons: string[] = [];
  editor.on('command:refused', ({ reason }) => reasons.push(reason));
  const before = editor.document;
  expect(service.setProperty(String(id), String(name), value as number, { frame: frame as number })).toBe(false);
  expect(reasons).toHaveLength(1);
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
});

it('reads fresh explicit target capabilities and preserves a refused redo for healthy retry', () => {
  const objectStage = createObjectStage({ id: 'canvas', unscoped: true,
    objects: [{ id: 'main', label: 'Main', object: {}, properties: [{ name: 'x', label: 'Custom X', unit: 'px' }, 'unknown'] }],
    apply: () => {} });
  const { editor, service } = setup({ stage: objectStage });
  expect(service.propertiesFor('main')).toEqual([editor.registry.require('x')]);
  expect(service.setProperty('main', 'y', 90, { frame: 6 })).toBe(false);
  expect(service.setProperty('main', 'x', 75, { frame: 6 })).toBe(true);
  const changed = editor.document;
  expect(editor.undo()).toBe(true);
  const before = editor.document;
  objectStage.remove('main');
  objectStage.add({ id: 'main', label: 'Main', object: {}, properties: [] });
  expect(service.propertiesFor('main')).toEqual([]);
  expect(editor.redo()).toBe(false);
  expect(editor.document).toBe(before);
  expect([editor.canUndo, editor.canRedo]).toEqual([false, true]);
  objectStage.remove('main');
  objectStage.add({ id: 'main', label: 'Main', object: {}, properties: ['x'] });
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(changed);
});

it('uses only the routed scene for aliases and never borrows other scene capabilities', () => {
  const first = createObjectStage({ id: 'first', unscoped: true,
    objects: [{ id: 'main', label: 'Main', object: {}, properties: ['x'] }], apply: () => {} });
  const second = createObjectStage({ id: 'second', unscoped: true,
    objects: [{ id: 'main', label: 'Other', object: {}, properties: ['y'] }], apply: () => {} });
  const listed = (stage: IStage): IStage => ({ ...stage, targets: { list: () => stage.targets?.list() ?? [] } });
  const { editor, service } = setup({ stage: [listed(first), listed(second)] });
  expect(service.propertiesFor('main').map(({ name }) => name)).toEqual(['x']);
  expect(service.setProperty('main', 'y', 5, { frame: 6 })).toBe(false);
  const before = editor.document;
  editor.execute({ label: 'Changer la cible',
    do: (doc) => ({ ...doc, layers: doc.layers.map((node) => node.id === 'main' ? { ...node, target: { ref: 'main', stage: 'second' } } : node) }),
    undo: () => before });
  expect(service.propertiesFor('main').map(({ name }) => name)).toEqual(['y']);
  expect(service.setProperty('main', 'x', 5, { frame: 6 })).toBe(false);
  expect(service.setProperty('main', 'y', 5, { frame: 6 })).toBe(true);
});

it('uses the registry when routed metadata is absent even if another scene lists an exact denied target', () => {
  const first = createObjectStage({ id: 'first', unscoped: true,
    objects: [{ id: 'main', label: 'Main', object: {} }], apply: () => {} });
  const second = createObjectStage({ id: 'second', unscoped: true, apply: () => {} });
  const { editor, service } = setup({ stage: [first, { ...second,
    targets: { list: () => [{ target: { ref: 'main' }, label: 'Wrong scene', properties: [] }] } }] });
  expect(service.propertiesFor('main')).toEqual(editor.registry.list());
  expect(service.setProperty('main', 'y', 5, { frame: 6 })).toBe(true);
});

it.each(['accepts', 'describe', 'list'] as const)('fails closed when %s throws, then permits retry after repair', (query) => {
  let fails = false;
  const stage = createObjectStage({ id: 'canvas', unscoped: true,
    objects: [{ id: 'main', label: 'Main', object: {}, properties: ['x'] }], apply: () => {} });
  const checked = (name: string): void => { if (fails && query === name) throw new Error('Capabilities unavailable'); };
  const errors: unknown[] = [];
  const { editor, service } = setup({ onStageError: (error) => errors.push(error), stage: {
    ...stage,
    accepts: (target) => { checked('accepts'); return stage.accepts(target); },
    targets: {
      list: () => { checked('list'); return stage.targets?.list() ?? []; },
      describe: (target): ITargetInfo | undefined => {
        checked('describe'); return query === 'list' ? undefined : stage.targets?.describe?.(target);
      }
    }
  } });
  const reasons: string[] = [];
  editor.on('command:refused', ({ reason }) => reasons.push(reason));
  const before = editor.document;
  fails = true;
  expect(() => service.propertiesFor('main')).toThrow(PropertyOperationError);
  expect(service.setProperty('main', 'x', 75, { frame: 6 })).toBe(false);
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
  expect(reasons).toHaveLength(1);
  expect(errors).toEqual([]);
  // The public core query reports the error once, while its edit still refuses.
  expect(editor.stage.describe({ ref: 'main' })).toBeUndefined();
  expect(errors).toHaveLength(1);
  expect(editor.setProperty('main', 'x', 75, { frame: 6 })).toBe(false);
  expect(errors).toHaveLength(2);
  fails = false;
  expect(service.setProperty('main', 'x', 75, { frame: 6 })).toBe(true);
  const changed = editor.document;
  editor.undo();
  const undone = editor.document;
  fails = true;
  expect(editor.redo()).toBe(false);
  expect(editor.document).toBe(undone);
  expect(editor.canRedo).toBe(true);
  fails = false;
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(changed);
});

it('unregisters its service and rejects retained handles after destruction', () => {
  const capture = captureContext();
  const { editor, service } = setup({ plugins: [capture.plugin] });
  editor.destroy();
  expect(capture.context().services.get('tweens.propertyKeyframes')).toBeUndefined();
  expect(() => service.propertiesFor('main')).toThrow(/après destroy/);
  expect(() => service.setProperty('main', 'x', 5)).toThrow(/après destroy/);
});

it('does not require plugins for the existing core stage-free property API', () => {
  const editor = createEditor(createContainer(), { defaultPlugins: false, stage: false, data: data() });
  expect(editor.getService('tweens.propertyKeyframes')).toBeUndefined();
  expect(editor.setProperty('main', 'x', 75, { frame: 6 })).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(layerOf(editor.document, 'main').spans).toEqual(layerOf(data(), 'main').spans);
});

it.each(['editor', 'service'] as const)('does not commit an in-flight %s edit after destruction in metadata', (mode) => {
  const capture = captureContext();
  const stage = createObjectStage({ id: 'canvas', unscoped: true,
    objects: [{ id: 'main', label: 'Main', object: {}, properties: ['x'] }], apply: () => {} });
  let trigger = false;
  const { editor, service } = setup({ plugins: [capture.plugin], stage: { ...stage,
    targets: { list: () => stage.targets?.list() ?? [], describe: (target) => {
      if (trigger) { trigger = false; editor.destroy(); }
      return stage.targets?.describe?.(target);
    } } } });
  const before = capture.context().document;
  const changes: string[] = [];
  editor.on('document:changed', () => changes.push('document'));
  editor.on('history:changed', () => changes.push('history'));
  trigger = true;
  const result = mode === 'editor' ? editor.setProperty('main', 'x', 75, { frame: 6 }) :
    service.setProperty('main', 'x', 75, { frame: 6 });
  expect(result).toBe(false);
  expect(capture.context().document).toBe(before);
  expect(changes).toEqual([]);
});

it('does not emit a history change during ordinary destruction', () => {
  const { editor } = setup();
  const changes: string[] = [];
  editor.on('history:changed', () => changes.push('history'));
  editor.destroy();
  expect(changes).toEqual([]);
});

it.each(['execute', 'editor', 'service'] as const)('does not start an outer %s transform after destruction in command:before', (mode) => {
  const capture = captureContext();
  let trigger = false;
  let transformations = 0;
  const beforeDestroy = {
    id: 'beforeDestroy', dependencies: [],
    init: (ctx: ReturnType<typeof capture.context>) => {
      ctx.events.onCancellable('command:before', () => {
        if (trigger) { trigger = false; editor.destroy(); }
      });
    },
    destroy: () => {}
  };
  const { editor, service } = setup({ plugins: [capture.plugin, beforeDestroy] });
  const before = capture.context().document;
  const changes: string[] = [];
  editor.on('document:changed', () => changes.push('document'));
  editor.on('history:changed', () => changes.push('history'));
  trigger = true;
  const result = mode === 'execute' ? editor.execute({ label: 'Outer',
    do: (doc) => { transformations++; return { ...doc }; }, undo: (doc) => doc }) :
    mode === 'editor' ? editor.setProperty('main', 'x', 75, { frame: 6 }) :
      service.setProperty('main', 'x', 75, { frame: 6 });
  expect(result).toBe(false);
  expect(transformations).toBe(0);
  expect(capture.context().document).toBe(before);
  expect(changes).toEqual([]);
});

it('allows commands started in stage teardown after pending work is invalidated', () => {
  const capture = captureContext();
  const stage = createObjectStage({ id: 'canvas', unscoped: true,
    objects: [{ id: 'main', label: 'Main', object: {}, properties: ['x'] }], apply: () => {} });
  let result: boolean | undefined;
  const { editor } = setup({ plugins: [capture.plugin], stage: { ...stage,
    detach: () => { result = editor.execute({ label: 'Teardown',
      do: (doc) => ({ ...doc, settings: { ...doc.settings, fps: 30 } }), undo: (doc) => doc }); }
  } });
  editor.destroy();
  expect(result).toBe(true);
  expect(capture.context().document.settings.fps).toBe(30);
});

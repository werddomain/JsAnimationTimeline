// packages/editor/src/core/editor/__tests__/Editor.propertyContext.test.ts
import { createDoc, layer } from '../../../model/spans/__tests__/fixtures';
import { createEditor } from '../createEditor';
import type { IEditorPropertyTimelines, PropertyChangedEvent } from '../propertyTimelineTypes';
import { cleanBody, createContainer, makeEditorPlugin } from './fixtures';

afterEach(cleanBody);

it('shares the property facade during plugin init and emits each committed change once', () => {
  let facade: IEditorPropertyTimelines | undefined;
  const changes: PropertyChangedEvent[] = [];
  const plugin = makeEditorPlugin([], 'property.init', [], { onInit(ctx) {
    facade = ctx.propertyTimelines;
    ctx.events.on('property:changed', (event) => changes.push(event));
    expect(facade.set('logo', 'x', { kind: 'number', value: 30 }, {
      frame: 10, initialValue: { kind: 'number', value: 0 }
    })).toEqual({ status: 'changed' });
  } });
  const editor = createEditor(createContainer(), {
    data: createDoc([layer('logo', [])], 100), defaultPlugins: false, stage: false, plugins: [plugin]
  });
  try {
    expect(facade).toBe(editor.propertyTimelines);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ cause: 'execute', property: 'x', frame: 10 });
    expect(editor.undo()).toBe(true);
    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({ cause: 'undo', property: 'x' });
    expect(editor.redo()).toBe(true);
    expect(changes).toHaveLength(3);
  } finally { editor.destroy(); }
  expect(() => facade?.capture('logo', 'x')).toThrow(/détruit/i);
});

it('invalidates the retained property facade when a later plugin fails to initialize', () => {
  let facade: IEditorPropertyTimelines | undefined;
  const plugin = makeEditorPlugin([], 'property.init', [], { onInit(ctx) {
    facade = ctx.propertyTimelines;
    expect(facade).toBeDefined();
  } });
  const failing = makeEditorPlugin([], 'failing', ['property.init'], { onInit() { throw new Error('init failed'); } });
  const container = createContainer();
  expect(() => createEditor(container, {
    defaultPlugins: false, stage: false, plugins: [plugin, failing]
  })).toThrow(/init failed/);
  expect(container.childNodes).toHaveLength(0);
  expect(() => facade?.capture('logo', 'x')).toThrow(/détruit/i);
});

it('shares event observation with guarded facades and composes UI guards without binding redo to them', () => {
  const editor = createEditor(createContainer(), {
    data: createDoc([layer('logo', [])], 100), defaultPlugins: false, stage: false
  });
  try {
    const changes: PropertyChangedEvent[] = [];
    editor.on('property:changed', (event) => changes.push(event));
    let current = true;
    const guarded = editor.propertyTimelines.guarded(() => current);
    expect(guarded.guarded(() => false).set('logo', 'x', { kind: 'number', value: 20 }, {
      initialValue: { kind: 'number', value: 0 }
    }).status).toBe('refused');
    expect(changes).toEqual([]);
    expect(editor.canUndo).toBe(false);
    expect(guarded.set('logo', 'x', { kind: 'number', value: 30 }, {
      initialValue: { kind: 'number', value: 0 }
    }).status).toBe('changed');
    current = false;
    expect(changes).toHaveLength(1);
    expect(editor.undo()).toBe(true);
    expect(editor.redo()).toBe(true);
    expect(changes.map(({ cause }) => cause)).toEqual(['execute', 'undo', 'redo']);
    expect(guarded.capture('logo', 'x', { frame: 10 }).status).toBe('refused');
    expect(changes).toHaveLength(3);
  } finally { editor.destroy(); }
});

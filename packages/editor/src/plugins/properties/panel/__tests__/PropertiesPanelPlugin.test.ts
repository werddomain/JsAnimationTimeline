// packages/editor/src/plugins/properties/panel/__tests__/PropertiesPanelPlugin.test.ts
import { createEditor } from '../../../../core/editor/createEditor';
import { captureContext, cleanBody, createContainer } from '../../../../core/editor/__tests__/fixtures';
import { createManualClock, createObjectStage, createPropertyRegistry } from '@werddomain/timeline-runtime';
import type { IStage, ITimelineDocument } from '@werddomain/timeline-runtime';
import type { EditorOptions, IEditor } from '../../../../core/editor/types';
import type { IEditorContext } from '../../../../core/context/IEditorContext';
import { createPropertiesPanelPlugin, PROPERTIES_PANEL_PLUGIN_ID } from '..';

afterEach(cleanBody);

function data(): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 20 }, layers: [
    { id: 'main', type: 'layer', name: 'Main', spans: [
      { id: 'motion', kind: 'tween', start: 1, end: 11, tracks: {
        x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }],
        y: [{ frame: 1, value: 10 }, { frame: 11, value: 30 }]
      } }, { id: 'still', kind: 'static', start: 12, end: 15 },
      { id: 'blank', kind: 'blank', start: 16, end: 18 }
    ] }
  ] };
}

it('is optional, renders persistently in the root and writes only an explicit draft through W2', () => {
  const plain = createEditor(createContainer(), { stage: false });
  expect(plain.getService(PROPERTIES_PANEL_PLUGIN_ID)).toBeUndefined();
  expect(plain.container.querySelector('.jt-properties-panel')).toBeNull();
  plain.destroy();
  const capture = captureContext();
  const plugin = createPropertiesPanelPlugin();
  const editor = createEditor(createContainer(), { data: data(), stage: false, plugins: [plugin, capture.plugin] });
  expect(plugin.dependencies).toEqual(['layout.shell', 'layers.selection', 'tweens.propertyKeyframes']);
  expect(editor.container.children[1]?.classList.contains('jt-properties-panel')).toBe(true);
  const service = editor.getService(PROPERTIES_PANEL_PLUGIN_ID);
  expect(service?.focusAt('main', 6)).toBe(true);
  const field = editor.container.querySelector<HTMLInputElement>('[data-property="x"] input');
  if (field === null) throw new Error('Missing X field');
  expect(field.value).toBe('50');
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(editor.canUndo).toBe(false);
  field.value = '75';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.blur();
  expect(editor.canUndo).toBe(false);
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const node = editor.document.layers[0];
  expect(node.type === 'layer' && node.spans[0].tracks?.x).toEqual([
    { frame: 1, value: 0 }, { frame: 6, value: 75 }, { frame: 11, value: 100 }
  ]);
  expect(editor.sample(6).layer('main')?.values.y).toBe(20);
  expect(capture.context().services.require('layers.selection').selected()).toEqual(['main']);
  editor.destroy();
  expect(() => service?.focusAt('main', 6)).toThrow();
});

function setup(options: EditorOptions = {}) {
  const capture = captureContext();
  const plugin = createPropertiesPanelPlugin();
  const clock = createManualClock();
  const editor = createEditor(createContainer(), { data: data(), stage: false, clock, ...options,
    plugins: [plugin, capture.plugin, ...(options.plugins ?? [])] });
  const service = editor.getService('properties.panel');
  if (service === undefined) throw new Error('Missing panel service');
  const selection = editor.getService('layers.selection');
  if (selection === undefined) throw new Error('Missing selection service');
  const seek = (frame: number): void => { editor.playback.seek(frame); clock.advance(1); };
  return { editor, plugin, service, ctx: capture.context(), selection, seek, clock };
}
function input(editor: IEditor, name = 'x'): HTMLInputElement {
  const found = editor.container.querySelector<HTMLInputElement>('[data-property="' + name + '"] input');
  if (found === null) throw new Error('Missing field ' + name);
  return found;
}
function draft(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
function enter(field: HTMLInputElement): void {
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
function content(editor: IEditor): string { return editor.container.querySelector('.jt-properties-panel')?.textContent ?? ''; }

it('has a literal identity and removes only its own service, root class, DOM and handlers', () => {
  const { editor, plugin, service, ctx } = setup();
  const id: 'properties.panel' = plugin.id;
  expect(id).toBe(PROPERTIES_PANEL_PLUGIN_ID);
  service.focusAt('main', 6);
  const field = input(editor);
  draft(field, '72');
  const shell = ctx.services.require('layout.shell').element();
  plugin.destroy();
  plugin.destroy();
  enter(field);
  expect(editor.canUndo).toBe(false);
  expect(editor.container.contains(shell ?? null)).toBe(true);
  expect(editor.container.classList.contains('jt-properties-panel-owner')).toBe(false);
  expect(ctx.services.get('properties.panel')).toBeUndefined();
  expect(() => service.focusAt('main', 6)).toThrow(/after destroy/);
  editor.destroy();
});

it('uses registry labels/units and defaults including own-property names', () => {
  const registry = createPropertyRegistry([{ name: 'toString', kind: 'value', label: 'Valeur personnalisée', unit: 'u', defaultValue: 7 }]);
  const { editor, service } = setup({ registry });
  service.focusAt('main', 6);
  expect(input(editor, 'toString').value).toBe('7');
  expect(content(editor)).toContain('Valeur personnalisée (u)');
  expect(content(editor)).toContain('Valeur par défaut du registre');
  expect(content(editor)).toContain('Position X (px)');
  expect(input(editor, 'scaleX').value).toBe('1');
  draft(input(editor, 'toString'), '12');
  enter(input(editor, 'toString'));
  expect(editor.sample(6).layer('main')?.values['toString']).toBe(12);
  editor.destroy();
});

it('uses actual W2 capabilities without resolving live target objects', () => {
  const stage = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'target', label: 'Target', object: {}, properties: ['x', 'unknown'] }], apply: () => {} });
  const doc = data();
  const main = doc.layers[0];
  if (main.type !== 'layer') throw new Error('Missing layer');
  const { editor, service } = setup({ data: { ...doc, layers: [{ ...main, target: { ref: 'target' } }] }, stage });
  const resolve = jest.spyOn(stage, 'resolve');
  resolve.mockClear();
  service.focusAt('main', 6);
  expect(editor.container.querySelectorAll('.jt-properties-panel input')).toHaveLength(1);
  expect(input(editor).value).toBe('50');
  draft(input(editor), '75');
  enter(input(editor));
  expect(editor.sample(6).layer('main')?.values.x).toBe(75);
  expect(resolve).not.toHaveBeenCalled();
  editor.destroy();
});

it.each(['', 'NaN', 'Infinity', '1e309'])('rejects invalid numeric input %s without a command', (value) => {
  const { editor, service } = setup();
  service.focusAt('main', 6);
  draft(input(editor), value);
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  expect(input(editor).getAttribute('aria-invalid')).toBe('true');
  expect(content(editor)).toContain('nombre fini');
  editor.destroy();
});

it('accepts an explicit draft equal to the sample, ignores untouched Enter and preserves exact history', () => {
  const { editor, service } = setup();
  const before = editor.document;
  service.focusAt('main', 6);
  const x = input(editor);
  x.focus();
  enter(x);
  x.blur();
  expect(editor.canUndo).toBe(false);
  draft(x, '50');
  enter(x);
  const changed = editor.document;
  expect(changed).not.toBe(before);
  expect(editor.sample(6).layer('main')?.values).toEqual({ x: 50, y: 20 });
  expect(document.activeElement).not.toBe(x); // blur was explicit above
  draft(x, '50');
  enter(x);
  expect(editor.document).toBe(changed);
  expect(editor.undo()).toBe(true);
  expect(editor.document).toEqual(before);
  expect(editor.canUndo).toBe(false);
  expect(editor.redo()).toBe(true);
  expect(editor.document).toEqual(changed);
  editor.destroy();
});

it('keeps static spans, writes one track and stores values without UI clamping', () => {
  const { editor, service } = setup();
  service.focusAt('main', 14);
  const opacity = input(editor, 'opacity');
  expect(opacity.hasAttribute('min')).toBe(false);
  expect(opacity.hasAttribute('max')).toBe(false);
  draft(opacity, '2');
  const button = opacity.closest('form')?.querySelector('button');
  button?.click();
  const layer = editor.document.layers[0];
  expect(layer.type === 'layer' && layer.spans[1]).toEqual({
    id: 'still', kind: 'static', start: 12, end: 15, tracks: { opacity: [{ frame: 12, value: 2 }] }
  });
  expect(opacity.value).toBe(String(editor.sample(14).layer('main')?.values.opacity));
  expect(content(editor)).toContain('Clé enregistrée : 2.');
  expect(editor.document.settings.totalFrames).toBe(20);
  editor.destroy();
});

it('displays actual nonlinear samples instead of converting between easing and stored keys', () => {
  const original = data();
  const layer = original.layers[0];
  if (layer.type !== 'layer') throw new Error('Missing layer');
  const doc = { ...original, layers: [{ ...layer, spans: layer.spans.map((span, i) => i === 0 ? { ...span, easing: 'ease-in' as const } : span) }] };
  const { editor, service } = setup({ data: doc });
  service.focusAt('main', 6);
  expect(Number(input(editor).value)).toBe(editor.sample(6).layer('main')?.values.x);
  draft(input(editor), '80');
  enter(input(editor));
  const edited = editor.document.layers[0];
  expect(edited.type === 'layer' && edited.spans[0].tracks?.x[1].value).toBe(80);
  expect(Number(input(editor).value)).toBe(editor.sample(6).layer('main')?.values.x);
  expect(content(editor)).toContain('Clé enregistrée : 80.');
  editor.destroy();
});

it('restores Escape without writing and preserves focused inputs during refresh and commit', () => {
  const { editor, service, ctx } = setup();
  service.focusAt('main', 6);
  const x = input(editor);
  draft(x, '90');
  x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(x.value).toBe('50');
  enter(x);
  expect(editor.canUndo).toBe(false);
  draft(x, '75');
  ctx.events.emit('layers:selectionChanged', { ids: ['main'], previous: ['main'], focused: 'main' });
  expect(x.value).toBe('75');
  enter(x);
  expect(editor.canUndo).toBe(true);
  expect(document.activeElement).toBe(x);
  expect(input(editor)).toBe(x);
  editor.destroy();
});

it('never treats the independent frame-grid selection as the normal inspector target', () => {
  const { editor, service, selection, ctx } = setup();
  ctx.services.require('frames.selection').set([{ rowId: 'main', frame: 9 }]);
  expect(content(editor)).toContain('Sélectionnez un calque');
  service.focusAt('main', 6);
  expect(input(editor).value).toBe('50');
  selection.clear();
  expect(content(editor)).toContain('Sélectionnez un calque');
  editor.destroy();
});

it.each([16, 19])('allows inspection but refuses edits in blank/outside content at frame %s', (frame) => {
  const { editor, service } = setup();
  expect(service.focusAt('main', frame)).toBe(true);
  expect(input(editor).disabled).toBe(true);
  expect(content(editor)).toContain('Aucun contenu');
  draft(input(editor), '75');
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  editor.destroy();
});

it('inspects inherited and direct locks, folders, multiple selection and playback', () => {
  const original = data();
  const { editor, service, selection, clock } = setup({ data: { ...original, layers: [
    ...original.layers,
    { id: 'folder', type: 'folder', name: 'Folder', locked: true, children: [
      { id: 'child', type: 'layer', name: 'Child', spans: [{ id: 'child-span', kind: 'static', start: 1, end: 20 }] }
    ] }, { id: 'direct', type: 'layer', name: 'Direct', locked: true,
      spans: [{ id: 'direct-span', kind: 'static', start: 1, end: 20 }] }
  ] } });
  selection.select(['folder']);
  expect(content(editor)).toContain('Un dossier');
  selection.select(['main', 'folder']);
  expect(content(editor)).toContain('un seul calque');
  service.focusAt('child', 6);
  expect(input(editor).disabled).toBe(true);
  expect(content(editor)).toContain('verrouillé');
  service.focusAt('direct', 6);
  expect(input(editor).disabled).toBe(true);
  service.focusAt('main', 6);
  draft(input(editor), '75');
  editor.playback.play();
  expect(input(editor).disabled).toBe(true);
  expect(content(editor)).toContain('Lecture en cours');
  clock.advance(50);
  editor.playback.pause();
  expect(input(editor).disabled).toBe(false);
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  editor.destroy();
});

it.each([0, 21, 2.5, NaN, Infinity])('refuses invalid focus frame %s without changing selection or time', (frame) => {
  const { editor, service, selection } = setup();
  expect(service.focusAt('main', frame)).toBe(false);
  expect(selection.selected()).toEqual([]);
  expect(editor.playback.frame).toBe(1);
  editor.destroy();
});

it('refuses absent/folder/hidden focus targets and honors toolbar layer/frame independently of inTween', () => {
  const doc = data();
  const { editor, service, selection, ctx } = setup({ data: { ...doc, layers: [...doc.layers,
    { id: 'folder', name: 'Folder', type: 'folder', collapsed: true, children: [
      { id: 'hidden', name: 'Hidden', type: 'layer', spans: [{ id: 'h', kind: 'static', start: 1, end: 20 }] }
    ] }
  ] } });
  expect(service.focusAt('missing', 6)).toBe(false);
  expect(service.focusAt('folder', 6)).toBe(false);
  expect(service.focusAt('hidden', 6)).toBe(false);
  expect(editor.playback.frame).toBe(1);
  ctx.events.emit('toolbar:editKeyframe', { layerId: 'main', frame: 14, inTween: true });
  expect(selection.selected()).toEqual(['main']);
  expect(editor.playback.frame).toBe(14);
  expect(content(editor)).toContain('image 14');
  expect(document.activeElement).toBe(input(editor));
  ctx.events.emit('toolbar:editKeyframe', { layerId: 'missing', frame: 6, inTween: true });
  expect(editor.playback.frame).toBe(14);
  editor.destroy();
});

it('invalidates a draft on document/frame/selection changes even before batched playhead events', () => {
  const { editor, service, seek } = setup();
  service.focusAt('main', 6);
  const x = input(editor);
  draft(x, '75');
  editor.playback.seek(7); // no emitted playhead yet
  enter(x);
  expect(editor.canUndo).toBe(false);
  expect(input(editor).value).toBe('60');
  draft(input(editor), '80');
  seek(8);
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  draft(input(editor), '85');
  editor.setProperty('main', 'y', 90, { frame: 8 });
  enter(input(editor));
  const main = editor.document.layers[0];
  expect(main.type === 'layer' && main.spans[0].tracks?.x).toHaveLength(2);
  draft(input(editor), '95');
  editor.getService('layers.selection')?.clear();
  enter(x);
  expect(editor.undo()).toBe(true);
  expect(editor.canUndo).toBe(false);
  editor.destroy();
});

function metadataSetup() {
  let allowed = ['x'];
  let fails = false;
  let nextQuery: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const object = {};
  const actual = createObjectStage({ id: 'objects', unscoped: true,
    objects: [{ id: 'target', label: 'Target', object }], apply: () => {} });
  const stage: IStage = { ...actual, targets: {
    list: () => actual.targets?.list() ?? [],
    describe: (target) => {
      const callback = nextQuery; nextQuery = undefined; callback?.();
      if (fails) throw new Error('Metadata failure');
      const found = actual.targets?.describe?.(target);
      return found === undefined ? undefined : { ...found, properties: allowed };
    },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }
  } };
  const original = data();
  const main = original.layers[0];
  if (main.type !== 'layer') throw new Error('Missing layer');
  const result = setup({ stage, onStageError: () => {},
    data: { ...original, layers: [{ ...main, target: { ref: 'target' } }] } });
  return { ...result, listeners,
    onQuery: (callback: () => void): void => { nextQuery = callback; },
    capabilities: (names: string[], error = false, notify = true): void => {
      allowed = names; fails = error;
      if (notify) [...listeners].forEach((listener) => listener());
    } };
}

it('subscribes directly to capability-only metadata changes and detaches stale nodes', () => {
  const { editor, service, capabilities, listeners } = metadataSetup();
  service.focusAt('main', 6);
  const old = input(editor);
  draft(old, '75');
  expect(listeners.size).toBe(2); // core and the optional inspector
  capabilities(['y']);
  expect(old.isConnected).toBe(false);
  expect(input(editor, 'y').value).toBe('20');
  enter(old);
  old.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(editor.canUndo).toBe(false);
  capabilities([]);
  expect(content(editor)).toContain('Aucune propriété autorisée');
  expect(editor.container.querySelectorAll('.jt-properties-panel input')).toHaveLength(0);
  editor.destroy();
  expect(listeners.size).toBe(0);
});

it('fails closed on metadata errors and silently changed capabilities at confirmation', () => {
  const { editor, service, capabilities } = metadataSetup();
  service.focusAt('main', 6);
  const x = input(editor);
  draft(x, '75');
  capabilities(['x'], true, false);
  enter(x);
  expect(editor.canUndo).toBe(false);
  expect(content(editor)).toContain('indisponibles');
  capabilities(['x']);
  draft(input(editor), '75');
  capabilities(['y'], false, false);
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  expect(input(editor, 'y').value).toBe('20');
  editor.destroy();
});

it('invalidates drafts even when a capability notification retains the same descriptor names', () => {
  const { editor, service, capabilities } = metadataSetup();
  service.focusAt('main', 6);
  draft(input(editor), '75');
  capabilities(['x']);
  expect(input(editor).value).toBe('50');
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  editor.destroy();
});

it('keeps independent editors isolated and handles a loaded document reusing layer ids', () => {
  const first = setup();
  const second = setup();
  first.service.focusAt('main', 6);
  second.service.focusAt('main', 8);
  draft(input(first.editor), '75');
  enter(input(first.editor));
  expect(input(second.editor).value).toBe('70');
  expect(second.editor.canUndo).toBe(false);
  const old = input(first.editor);
  draft(old, '90');
  first.editor.load(data());
  enter(old);
  expect(content(first.editor)).toContain('Sélectionnez un calque');
  expect(first.editor.canUndo).toBe(false);
  first.editor.destroy();
  draft(input(second.editor), '95');
  enter(input(second.editor));
  expect(second.editor.sample(8).layer('main')?.values.x).toBe(95);
  second.editor.destroy();
});

it.each(['destroy', 'document', 'selection', 'frame'] as const)('cancels focusAt after selection callbacks reorient via %s', (change) => {
  const { editor, service, ctx, selection } = setup();
  ctx.events.once('layers:selectionChanged', () => {
    if (change === 'destroy') editor.destroy();
    else if (change === 'document') editor.load(data());
    else if (change === 'selection') selection.clear();
    else editor.playback.seek(9);
  });
  expect(service.focusAt('main', 6)).toBe(false);
  if (!editor.isDestroyed) { expect(editor.playback.frame).not.toBe(6); editor.destroy(); }
});

it.each(['destroy', 'document', 'selection', 'frame'] as const)('cancels focusAt when focus callbacks reorient via %s', (change) => {
  const { editor, service, selection } = setup();
  const onFocus = (event: FocusEvent): void => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.closest('.jt-properties-panel')) return;
    document.removeEventListener('focusin', onFocus);
    if (change === 'destroy') editor.destroy();
    else if (change === 'document') editor.load(data());
    else if (change === 'selection') selection.clear();
    else editor.playback.seek(9);
  };
  document.addEventListener('focusin', onFocus);
  expect(service.focusAt('main', 6)).toBe(false);
  document.removeEventListener('focusin', onFocus);
  if (!editor.isDestroyed) editor.destroy();
});

it.each(['destroy', 'selection', 'frame'] as const)('cancels focusAt when seek callbacks reorient via %s', (change) => {
  const capture = captureContext();
  const editor = createEditor(createContainer(), { data: data(), stage: false, plugins: [capture.plugin] });
  const ctx = capture.context();
  const plugin = createPropertiesPanelPlugin();
  const playback: IEditorContext['playback'] = { ...ctx.playback,
    get frame() { return ctx.playback.frame; },
    seek: (frame) => {
      ctx.playback.seek(frame);
      if (change === 'destroy') plugin.destroy();
      else if (change === 'selection') ctx.services.require('layers.selection').clear();
      else ctx.playback.seek(9);
    }
  };
  plugin.init({ ...ctx, playback });
  plugin.render(editor.container);
  expect(editor.getService('properties.panel')?.focusAt('main', 6)).toBe(false);
  plugin.destroy();
  editor.destroy();
});

it('invalidates the captured service before cleanup causes synchronous focus callbacks', () => {
  const { editor, service, plugin } = setup();
  service.focusAt('main', 6);
  const view = editor.container.querySelector('.jt-properties-panel');
  if (view === null) throw new Error('Missing panel');
  const remove = view.remove.bind(view);
  view.remove = () => {
    expect(() => service.focusAt('main', 6)).toThrow(/after destroy/);
    remove();
  };
  plugin.destroy();
  editor.destroy();
});

it.each(['selection', 'document', 'frame', 'playback'] as const)('rejects a ticket invalidated reentrantly by metadata query changing %s', (change) => {
  const { editor, service, selection, onQuery } = metadataSetup();
  service.focusAt('main', 6);
  draft(input(editor), '75');
  onQuery(() => {
    if (change === 'selection') selection.clear();
    else if (change === 'document') editor.load(data());
    else if (change === 'frame') editor.playback.seek(9);
    else editor.playback.play();
  });
  enter(input(editor));
  expect(editor.canUndo).toBe(false);
  if (change === 'selection' || change === 'document') expect(content(editor)).toContain('Sélectionnez un calque');
  if (change === 'frame') expect(content(editor)).toContain('image 9');
  editor.destroy();
});

it('returns to editable after natural completion without owning a timer', () => {
  const { editor, service, clock } = setup();
  service.focusAt('main', 14);
  editor.playback.play();
  expect(input(editor).disabled).toBe(true);
  clock.advance(1000);
  expect(editor.playback.playing).toBe(false);
  expect(content(editor)).not.toContain('Lecture en cours');
  // main has no content at 20: inspect another layer's complete content.
  expect(input(editor).disabled).toBe(true);
  service.focusAt('main', 14);
  expect(input(editor).disabled).toBe(false);
  editor.destroy();
});

it('never repaints a stale target over a nested refresh caused by metadata callbacks', () => {
  const { editor, service, selection, onQuery, capabilities } = metadataSetup();
  service.focusAt('main', 6);
  onQuery(() => selection.clear());
  capabilities(['x']);
  expect(content(editor)).toContain('Sélectionnez un calque');
  expect(editor.container.querySelectorAll('.jt-properties-panel input')).toHaveLength(0);
  editor.destroy();
});

it.each(['', '   '])('falls back to a usable accessible name for a blank custom label %j', (label) => {
  const registry = createPropertyRegistry([{ name: 'customValue', kind: 'value', label, unit: '', defaultValue: 0 }]);
  const { editor, service } = setup({ registry });
  service.focusAt('main', 6);
  expect(input(editor, 'customValue').labels?.[0].textContent?.trim()).toBe('customValue');
  editor.destroy();
});


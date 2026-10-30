// packages/editor/src/plugins/tweens/easing/__tests__/PropertyEasingPlugin.test.ts
import type { ILayer, IStage, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import { captureContext } from '../../../../core/editor/__tests__/fixtures';
import { EasingPlugin } from '../EasingPlugin';
import { createSetLockedCommand } from '../../../layers/lock/lockCommands';
import type { IPropertyEasingTarget } from '../types';

const target: IPropertyEasingTarget = { layerId: 'a', property: 'x', transitionId: 'transition' };
function fixture(): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [{ id: 'a', type: 'layer', name: 'Objet', spans: [], propertyTimelines: {
    x: { initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 0 } }, { frame: 100, value: { kind: 'number', value: 100 } }],
      transitions: [{ id: 'transition', fromFrame: 1, toFrame: 100 }] }
  } }] };
}
function setup(data = fixture(), stage: IStage | false = false, owner = document) {
  const container = owner.createElement('div'); owner.body.append(container);
  const capture = captureContext();
  const editor = createEditor(container, { data, stage, defaultPlugins: [
    { id: 'tweens.motion', dependencies: [], init: (ctx) => { ctx.services.provide('tweens.motion', {
      canCreate: () => ({ enabled: false }), canRemove: () => ({ enabled: false }), create: () => false, remove: () => false,
      createAt: () => false, removeAt: () => false, tweenAt: () => undefined
    }); }, destroy: () => undefined }, new EasingPlugin(), capture.plugin
  ] });
  // The legacy dependency only needs to exist until a legacy method is called.
  const service = editor.getService('tweens.easing');
  if (service === undefined) throw new Error('Missing easing service');
  return { editor, service, context: capture.context() };
}
function dialog(): HTMLElement | null { return document.querySelector('[role="dialog"]'); }
function select(label: string, value: string): void {
  const input = dialog()?.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  if (input === null || input === undefined) throw new Error(`Missing ${label}`);
  input.value = value; input.dispatchEvent(new Event('change', { bubbles: true }));
}
function button(label: string): HTMLButtonElement {
  const found = [...dialog()?.querySelectorAll('button') ?? []].find((entry) => entry.textContent === label);
  if (found === undefined) throw new Error(`Missing ${label}`);
  return found;
}
function parameter(name: string, value: string): void {
  const input = dialog()?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (input === null || input === undefined) throw new Error(`Missing ${name}`);
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
}
function keyboard(key: string, shiftKey = false): void {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}
afterEach(() => { document.body.replaceChildren(); });

it('edits a modern easing only on confirmation and restores exact undo/redo', () => {
  const { editor, service } = setup();
  const before = editor.document;
  const changes = jest.fn(); editor.on('property:changed', changes);
  expect(service.canSetProperty(target)).toEqual({ enabled: true });
  expect(service.openProperty(target)).toBe(true);
  select('Famille', 'sine'); select('Mode', 'in-out');
  expect(editor.document).toBe(before); expect(editor.canUndo).toBe(false);
  button('Appliquer').click();
  const after = editor.document;
  expect((after.layers[0] as ILayer).propertyTimelines?.x.transitions?.[0].easing).toEqual({ kind: 'effect', family: 'sine', mode: 'in-out' });
  expect(changes).toHaveBeenCalledTimes(1);
  expect(dialog()).toBeNull(); expect(editor.undo()).toBe(true); expect(editor.document).toEqual(before);
  expect(editor.redo()).toBe(true); expect(editor.document).toEqual(after);
  editor.destroy();
});

it('offers all effect families, local previews and modes without issuing commands', () => {
  const { editor, service } = setup(); const before = editor.document;
  service.openProperty(target);
  const expected = ['linear', 'sine', 'circle', 'quadratic', 'cubic', 'quartic', 'quintic', 'power', 'exponential', 'back', 'bounce', 'elastic', 'bezier'];
  expect([...dialog()?.querySelectorAll<HTMLOptionElement>('select[aria-label="Famille"] option') ?? []].map(({ value }) => value)).toEqual(expected);
  for (const family of expected) {
    select('Famille', family);
    expect(button('Appliquer').disabled).toBe(false);
    expect(dialog()?.querySelector('.jt-property-easing__curve')?.getAttribute('d')).toMatch(/^M/);
  }
  select('Famille', 'quadratic');
  const enter = dialog()?.querySelector('.jt-property-easing__curve')?.getAttribute('d');
  select('Mode', 'out');
  expect(dialog()?.querySelector('.jt-property-easing__curve')?.getAttribute('d')).not.toBe(enter);
  expect(editor.document).toBe(before); expect(editor.canUndo).toBe(false);
  editor.destroy();
});

it('retains overshoot and refuses invalid numeric drafts before confirmation', () => {
  const { editor, service } = setup(); const before = editor.document;
  service.openProperty(target); select('Famille', 'back'); select('Mode', 'out');
  expect(Number(dialog()?.querySelector<SVGSVGElement>('svg')?.dataset.max)).toBeGreaterThan(1);
  select('Famille', 'elastic'); select('Mode', 'in');
  expect(Number(dialog()?.querySelector<SVGSVGElement>('svg')?.dataset.min)).toBeLessThan(0);
  parameter('oscillations', '1.5'); expect(button('Appliquer').disabled).toBe(true);
  expect(dialog()?.textContent).toContain('Vérifiez les paramètres');
  parameter('oscillations', '3'); parameter('springiness', ''); expect(button('Appliquer').disabled).toBe(true);
  parameter('springiness', '31'); expect(button('Appliquer').disabled).toBe(true);
  parameter('springiness', '4'); expect(button('Appliquer').disabled).toBe(false);
  select('Famille', 'bezier'); parameter('x1', '-1'); expect(button('Appliquer').disabled).toBe(true);
  parameter('x1', '0.2'); parameter('y1', '-0.5'); parameter('x2', '0.8'); parameter('y2', '1.5');
  button('Appliquer').click();
  expect((editor.document.layers[0] as ILayer).propertyTimelines?.x.transitions?.[0].easing).toEqual({ kind: 'bezier', x1: 0.2, y1: -0.5, x2: 0.8, y2: 1.5 });
  editor.undo(); expect(editor.document).toEqual(before); editor.destroy();
});

it('keeps a retained source on open, cancel, Escape and untouched submit, then detaches only after an explicit effect', () => {
  const { editor, service } = setup();
  editor.propertyTimelines.setEasing('a', 'x', 'transition', { kind: 'effect', family: 'quadratic', mode: 'in' });
  editor.propertyTimelines.capture('a', 'x', { frame: 50 });
  const before = editor.document;
  const changes = jest.fn(); editor.on('property:changed', changes);
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  service.openProperty(target);
  expect(dialog()?.textContent).toContain('Courbe conservée'); expect(button('Appliquer').disabled).toBe(true);
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Famille');
  keyboard('Tab', true); expect(document.activeElement).toBe(button('Annuler'));
  keyboard('Tab'); expect(document.activeElement?.getAttribute('aria-label')).toBe('Famille');
  button('Annuler').click(); expect(document.activeElement).toBe(trigger);
  service.openProperty(target); keyboard('Escape');
  service.openProperty(target); dialog()?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(editor.document).toBe(before); expect(changes).not.toHaveBeenCalled(); expect(dialog()).toBeNull();
  service.openProperty(target); select('Famille', 'bounce'); button('Appliquer').click();
  const transitions = (editor.document.layers[0] as ILayer).propertyTimelines?.x.transitions;
  expect(transitions?.[0].source).toBeUndefined(); expect(transitions?.[1].source).toBeDefined();
  expect(changes).toHaveBeenCalledTimes(1);
  editor.undo(); expect(editor.document).toEqual(before); editor.redo(); expect(transitions).toEqual((editor.document.layers[0] as ILayer).propertyTimelines?.x.transitions);
  editor.destroy();
});

it('draws actual retained values even when both endpoints are equal', () => {
  const base = fixture(); const layer = base.layers[0] as ILayer; const track = layer.propertyTimelines!.x;
  const zero = { kind: 'number' as const, value: 0 };
  const data = { ...base, layers: [{ ...layer, propertyTimelines: { x: { ...track,
    keys: [{ frame: 1, value: zero }, { frame: 100, value: zero }], transitions: [{ id: 'transition', fromFrame: 1, toFrame: 100,
      source: { start: 1, end: 100, keys: [{ frame: 1, value: zero }, { frame: 50, value: { kind: 'number' as const, value: 100 } }, { frame: 100, value: zero }] } }] } } }] };
  const { editor, service } = setup(data); service.openProperty(target);
  expect(Number(dialog()?.querySelector<SVGSVGElement>('svg')?.dataset.max)).toBeGreaterThan(99);
  expect(dialog()?.querySelector('svg')?.getAttribute('aria-label')).toContain('valeurs');
  expect(editor.canUndo).toBe(false); editor.destroy();
});

it('closes stale dialogs on selection, document load and lock, and rejects missing identities', () => {
  const { editor, service, context } = setup(); const before = editor.document;
  expect(service.canSetProperty({ ...target, property: 'missing' }).enabled).toBe(false);
  expect(service.openProperty({ ...target, layerId: 'missing' })).toBe(false);
  expect(service.setProperty({ ...target, transitionId: 'missing' })).toBe(false);
  service.openProperty(target); select('Famille', 'sine'); const stale = button('Appliquer');
  context.events.emit('layers:selectionChanged', { ids: ['a'], previous: [], focused: 'a' });
  stale.click(); expect(editor.document).toBe(before); expect(dialog()).toBeNull();
  service.openProperty(target); editor.load(fixture()); expect(dialog()).toBeNull();
  service.openProperty(target); editor.execute(createSetLockedCommand(editor.document, 'a', true));
  expect(dialog()).toBeNull(); expect(service.canSetProperty(target).enabled).toBe(false);
  editor.destroy(); expect(() => service.openProperty(target)).toThrow('tweens.easing');
});

it('keeps a cancelled confirmation open and prevents a selection change inside command:before from committing', () => {
  const { editor, service, context } = setup(); const before = editor.document;
  service.openProperty(target); select('Famille', 'sine');
  const off = context.events.onCancellable('command:before', (event) => event.cancel());
  button('Appliquer').click(); expect(dialog()?.textContent).toContain('refusée'); expect(editor.document).toBe(before); off();
  const selectElsewhere = context.events.onCancellable('command:before', () => context.events.emit('layers:selectionChanged', { ids: [], previous: ['a'] }));
  button('Appliquer').click(); expect(dialog()).toBeNull(); expect(editor.document).toBe(before); expect(editor.canUndo).toBe(false);
  selectElsewhere(); editor.destroy();
});

it('rechecks silently changed capabilities and disposes capability subscriptions', () => {
  let allowed = ['x']; const listeners = new Set<() => void>();
  const stage: IStage = { id: 'custom', accepts: () => true, resolve: () => ({}), render: () => undefined, targets: {
    list: () => [], describe: (target) => ({ target, label: 'Objet', properties: allowed }),
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }
  } };
  const base = fixture(); const layer = base.layers[0] as ILayer;
  const { editor, service } = setup({ ...base, layers: [{ ...layer, target: { ref: 'object', stage: 'custom' } }] }, stage);
  const initialListeners = listeners.size; const before = editor.document;
  service.openProperty(target); expect(listeners.size).toBe(initialListeners + 1); select('Famille', 'sine');
  allowed = []; button('Appliquer').click(); expect(editor.document).toBe(before); expect(dialog()?.textContent).toContain('refusée');
  [...listeners].forEach((listener) => listener()); expect(dialog()).toBeNull(); expect(listeners.size).toBe(initialListeners);
  editor.destroy(); expect(listeners.size).toBe(0);
});

it('cleans modern subscriptions when mounting fails during initial focus', () => {
  const listeners = new Set<() => void>();
  const stage: IStage = { id: 'custom', accepts: () => true, resolve: () => ({}), render: () => undefined, targets: {
    list: () => [], subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }
  } };
  const { editor, service } = setup(fixture(), stage); const initial = listeners.size;
  const focus = jest.spyOn(HTMLSelectElement.prototype, 'focus').mockImplementation(() => { throw new Error('focus failed'); });
  try {
    expect(() => service.openProperty(target)).toThrow('focus failed');
    expect(dialog()).toBeNull(); expect(listeners.size).toBe(initial);
  } finally { focus.mockRestore(); editor.destroy(); }
});

it('discards a dialog invalidated during focus and refuses retained services during destroy', () => {
  const { editor, service } = setup(); const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const originalFocus = HTMLSelectElement.prototype.focus;
  const focus = jest.spyOn(HTMLSelectElement.prototype, 'focus').mockImplementation(function (this: HTMLSelectElement, options) {
    originalFocus.call(this, options); editor.load(fixture());
  });
  try { expect(service.openProperty(target)).toBe(false); expect(dialog()).toBeNull(); }
  finally { focus.mockRestore(); }
  service.openProperty(target);
  const reopen = jest.fn(() => { expect(() => service.openProperty(target)).toThrow('tweens.easing'); });
  trigger.addEventListener('focus', reopen); editor.destroy();
  expect(reopen).toHaveBeenCalledTimes(1); expect(dialog()).toBeNull();
});

it('keeps a newer dialog opened by a property event when the old confirmation completes', () => {
  const { editor, service } = setup();
  editor.on('property:changed', () => { service.openProperty(target); });
  service.openProperty(target); select('Famille', 'sine'); button('Appliquer').click();
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(button('Appliquer').disabled).toBe(true);
  editor.destroy();
});

it('renders in the owner document and restores its own focus after Escape', () => {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const owner = iframe.contentDocument;
  if (owner === null) throw new Error('Missing iframe document');
  const trigger = owner.createElement('button'); owner.body.append(trigger); trigger.focus();
  const { editor, service } = setup(fixture(), false, owner);
  service.openProperty(target);
  expect(dialog()).toBeNull(); expect(owner.querySelector('[role="dialog"]')).not.toBeNull();
  expect(owner.activeElement?.getAttribute('aria-label')).toBe('Famille');
  owner.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(owner.querySelector('[role="dialog"]')).toBeNull(); expect(owner.activeElement).toBe(trigger);
  expect(editor.canUndo).toBe(false); editor.destroy();
});

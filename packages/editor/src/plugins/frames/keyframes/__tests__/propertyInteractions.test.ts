// packages/editor/src/plugins/frames/keyframes/__tests__/propertyInteractions.test.ts
import type { ILayer, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { captureContext, cleanBody, createContainer } from '../../../../core/editor/__tests__/fixtures';
import { moveTo, pressCell, pressKey, GRID_LEFT, GRID_TOP } from './keyframeFixtures';
import { contextMenuActions } from '../../../interaction/contextMenu/menuActions';

const number = (value: number) => ({ kind: 'number' as const, value });
const editors: IEditor[] = [];
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); cleanBody(); });

function setup(singleKeys = false) {
  const data: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [{
    id: 'logo', type: 'layer', name: 'Logo', spans: [], propertyTimelines: {
      x: { initialValue: number(0), keys: singleKeys ? [{ frame: 10, value: number(0) }]
        : [{ frame: 10, value: number(0) }, { frame: 30, value: number(100) }] },
      y: { initialValue: number(0), keys: singleKeys ? [{ frame: 10, value: number(0) }]
        : [{ frame: 10, value: number(0) }, { frame: 30, value: number(100) }],
        ...(singleKeys ? {} : { transitions: [{ id: 'y-tween', fromFrame: 10, toFrame: 30 }] }) }
    }
  }] };
  const capture = captureContext();
  const editor = createEditor(createContainer(), { data, stage: false, plugins: [capture.plugin] });
  editors.push(editor);
  editor.getService('layers.selection')!.select(['logo']);
  const grid = editor.getService('frames.grid')!;
  const element = grid.element()!;
  element.getBoundingClientRect = () => new DOMRect(GRID_LEFT, GRID_TOP, 1200, 600);
  const x = grid.rows().find((row) => row.kind === 'property' && row.property === 'x');
  const y = grid.rows().find((row) => row.kind === 'property' && row.property === 'y');
  if (x === undefined || y === undefined) throw new Error('Missing property rows');
  const selection = editor.getService('frames.selection')!;
  const current = (): ILayer => editor.document.layers[0] as ILayer;
  const button = (action: string): HTMLButtonElement => editor.container.querySelector(`[data-keyframe-action="${action}"]`)!;
  return { editor, ctx: capture.context(), grid, element, x, y, selection, current, button };
}

it('deletes the last keys of two properties atomically while their rows and selection disappear', () => {
  const h = setup(true);
  const before = h.editor.document;
  h.selection.set([{ rowId: h.x.id, frame: 10 }, { rowId: h.y.id, frame: 10 }]);
  expect(h.editor.getService('frames.keyframes')?.deleteKeyframe()).toBe(true);
  expect(h.current().propertyTimelines?.x).toBeUndefined();
  expect(h.current().propertyTimelines?.y).toBeUndefined();
  expect(h.grid.rows().filter((row) => row.kind === 'property')).toEqual([]);
  expect(h.selection.cells()).toEqual([]);
  const after = h.editor.document;
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
  expect(h.grid.rows().filter((row) => row.kind === 'property')).toHaveLength(2);
  expect(h.editor.redo()).toBe(true);
  expect(h.editor.document).toEqual(after);
});

it('routes the production toolbar to exactly two keys of one property and preserves the other transition', () => {
  const h = setup();
  const before = h.editor.document;
  expect(h.button('insert').getAttribute('aria-disabled')).toBe('true');
  expect(h.button('insert').getAttribute('aria-description')).toContain('ligne de propriété');
  h.selection.set([{ rowId: h.x.id, frame: 10 }, { rowId: h.y.id, frame: 30 }]);
  expect(h.button('createTween').getAttribute('aria-disabled')).toBe('true');
  h.button('createTween').click();
  expect(h.editor.document).toBe(before);
  h.selection.set([{ rowId: h.x.id, frame: 10 }, { rowId: h.x.id, frame: 30 }]);
  expect(h.button('createTween').hasAttribute('aria-disabled')).toBe(false);
  h.button('createTween').click();
  expect(h.current().propertyTimelines?.x.transitions).toHaveLength(1);
  expect(h.current().propertyTimelines?.y).toEqual((before.layers[0] as ILayer).propertyTimelines?.y);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
});

it('opens easing for the context property, disables span-only actions, and preserves history on cancel', () => {
  const h = setup();
  h.selection.select({ rowId: h.y.id, frame: 15 });
  const before = h.editor.document;
  const cells = { kind: 'frames' as const, cell: { rowId: h.y.id, frame: 15 } };
  const actions = contextMenuActions(h.ctx, cells);
  for (const id of ['insertFrame', 'removeFrame', 'insertBlankKeyframe', 'copy', 'paste']) {
    expect(actions.find((action) => action.id === id)?.enabled).toBe(false);
  }
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
    clientX: GRID_LEFT + h.grid.frameWidth() * 14 + 2, clientY: GRID_TOP + h.y.index * h.grid.rowHeight() + 2 });
  h.element.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  const easing = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent === 'Modifier l’accélération');
  expect(easing).toBeDefined();
  easing!.click();
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog?.textContent).toContain('y · images 10 à 30');
  const cancel = [...dialog!.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === 'Annuler');
  cancel!.click();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
});

it('previews a property-key drag without mutation, cancels with Escape, then commits with one undo', () => {
  const h = setup();
  const before = h.editor.document;
  h.selection.select({ rowId: h.x.id, frame: 10 });
  pressCell(h.element, h.x.index, 10);
  moveTo('pointermove', h.x.index, 15);
  expect(h.element.querySelector('.jt-keyframe-ghost__marker')).not.toBeNull();
  expect(h.editor.document).toBe(before);
  pressKey(h.element, 'Escape');
  moveTo('pointerup', h.x.index, 15);
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
  pressCell(h.element, h.x.index, 10);
  moveTo('pointermove', h.x.index, 15);
  moveTo('pointerup', h.x.index, 15);
  expect(h.current().propertyTimelines?.x.keys.map((key) => key.frame)).toEqual([15, 30]);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
});

it('uses F6 to split only the targeted property transition and Shift+F6 refuses its attached key', () => {
  const h = setup();
  const before = h.editor.document;
  h.selection.select({ rowId: h.y.id, frame: 20 });
  pressKey(h.editor.container, 'F6');
  expect(h.current().propertyTimelines?.y.keys.map((key) => key.frame)).toEqual([10, 20, 30]);
  expect(h.current().propertyTimelines?.y.transitions).toHaveLength(2);
  expect(h.current().propertyTimelines?.x).toEqual((before.layers[0] as ILayer).propertyTimelines?.x);
  const split = h.editor.document;
  pressKey(h.editor.container, 'F6', { shiftKey: true });
  expect(h.editor.document).toBe(split);
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
});

it.each(['selection', 'blur'] as const)('abandons a property drag when %s changes the interaction context', (cause) => {
  const h = setup();
  const before = h.editor.document;
  h.selection.select({ rowId: h.x.id, frame: 10 });
  pressCell(h.element, h.x.index, 10);
  moveTo('pointermove', h.x.index, 15);
  if (cause === 'selection') h.selection.select({ rowId: h.y.id, frame: 10 });
  else window.dispatchEvent(new Event('blur'));
  moveTo('pointerup', h.x.index, 15);
  expect(h.editor.document).toBe(before);
  expect(h.editor.canUndo).toBe(false);
  expect(h.element.querySelector('.jt-keyframe-ghost__marker')).toBeNull();
});

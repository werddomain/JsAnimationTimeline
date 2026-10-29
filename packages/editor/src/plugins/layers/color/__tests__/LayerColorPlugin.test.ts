// packages/editor/src/plugins/layers/color/__tests__/LayerColorPlugin.test.ts
import { findNodeById } from '@kazo-ca/timeline-runtime';
import { LAYER_COLOR_CLASSES, createLayerColorControl } from '..';
import type { ILayerRow } from '../../list/types';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';

afterEach(unmountAll);

function swatch(h: IListHarness, id: string): HTMLButtonElement {
  const el = h.host.querySelector<HTMLButtonElement>(`[data-row-id="${id}"] .${LAYER_COLOR_CLASSES.swatch}`);
  if (el === null) throw new Error(`carré ${id} absent`);
  return el;
}

function colorInput(h: IListHarness, id: string): HTMLInputElement {
  const el = h.host.querySelector<HTMLInputElement>(`[data-row-id="${id}"] .${LAYER_COLOR_CLASSES.input}`);
  if (el === null) throw new Error(`entrée ${id} absente`);
  return el;
}

function colorOf(h: IListHarness, id: string): string | undefined {
  return findNodeById(h.editor.document.layers, id)?.color;
}

const source = doc([layer('a', { color: '#ff0000' }), folder('f', [layer('b')])]);

describe('layers.color', () => {
  it('paints a swatch per row, neutral without color', () => {
    const h = mount(source);
    expect(swatch(h, 'a').style.backgroundColor).not.toBe('');
    expect(swatch(h, 'a').classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(false);
    expect(swatch(h, 'b').classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(true);
    expect(swatch(h, 'f').classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(true);
    expect(colorInput(h, 'a').value).toBe('#ff0000');
  });

  it('opens the native chooser when the swatch is clicked', () => {
    const h = mount(source);
    const input = colorInput(h, 'a');
    const click = jest.spyOn(input, 'click').mockImplementation(() => undefined);
    swatch(h, 'a').click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('runs an undoable command on change, lower-casing the color', () => {
    const h = mount(source);
    const input = colorInput(h, 'b');
    const before = h.editor.document;
    input.value = '#00ff7f';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(colorOf(h, 'b')).toBe('#00ff7f');
    expect(swatch(h, 'b').classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(false);
    expect(h.editor.undo()).toBe(true);
    expect(h.editor.document).toEqual(before);
    expect(swatch(h, 'b').classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(true);
    expect(h.editor.redo()).toBe(true);
    expect(colorOf(h, 'b')).toBe('#00ff7f');
  });

  it('exposes setColor for layers and folders ', () => {
    const h = mount(source);
    const service = h.editor.getService('layers.color');
    expect(service?.setColor('f', '#ABCDEF')).toBe(true);
    expect(colorOf(h, 'f')).toBe('#abcdef');
    expect(service?.setColor('f', undefined)).toBe(true);
    expect('color' in (findNodeById(h.editor.document.layers, 'f') ?? {})).toBe(false);
    expect(h.editor.undo()).toBe(true);
    expect(colorOf(h, 'f')).toBe('#abcdef');
  });

  it('refuses invalid colors, unknown ids and no-ops', () => {
    const h = mount(source);
    const service = h.editor.getService('layers.color');
    const before = h.editor.document;
    expect(service?.setColor('a', 'red')).toBe(false);
    expect(service?.setColor('zzz', '#000000')).toBe(false);
    expect(service?.setColor('a', '#FF0000')).toBe(false);
    expect(service?.setColor('b', undefined)).toBe(false);
    expect(h.editor.document).toEqual(before);
  });

  it('follows the row when its id keeps the same cell and cleans up on destroy', () => {
    const h = mount(source);
    const input = colorInput(h, 'a');
    h.editor.destroy();
    input.value = '#123456';
    expect(() => input.dispatchEvent(new Event('change'))).not.toThrow();
    expect(h.host.querySelector(`.${LAYER_COLOR_CLASSES.wrapper}`)).toBeNull();
  });

  it('paints only a valid #rrggbb color (anything else shows empty)', () => {
    const control = createLayerColorControl('layers.color', () => undefined);
    const element = document.createElement('span');
    const row = (color: string): ILayerRow => ({ node: layer('x', { color }) }) as unknown as ILayerRow;
    control.render(row('url(javascript:x)'), element);
    const swatchEl = element.querySelector<HTMLElement>(`.${LAYER_COLOR_CLASSES.swatch}`);
    expect(swatchEl?.classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(true);
    expect(swatchEl?.style.backgroundColor).toBe('');
    control.update?.(row('#ABCDEF'), element);
    expect(swatchEl?.classList.contains(LAYER_COLOR_CLASSES.swatchEmpty)).toBe(false);
    expect(element.querySelector<HTMLInputElement>(`.${LAYER_COLOR_CLASSES.input}`)?.value).toBe('#abcdef');
    control.dispose?.(row('#ABCDEF'), element);
  });
});

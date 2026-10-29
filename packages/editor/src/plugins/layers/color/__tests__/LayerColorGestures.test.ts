// packages/editor/src/plugins/layers/color/__tests__/LayerColorGestures.test.ts
/**
 * Carré de couleur : propagation des clics, valeur de départ du sélecteur
 * et commande insensible à la casse.
 */

import { findNodeById } from '@kazo-ca/timeline-runtime';
import { LAYER_COLOR_CLASSES } from '..';
import { createSetColorCommand } from '../layerColor';
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

describe('swatch click propagation', () => {
  it('lets a mouse click reach the row and the container', () => {
    const h = mount(doc([layer('a')]));
    const seen = jest.fn();
    h.host.addEventListener('click', seen);
    jest.spyOn(colorInput(h, 'a'), 'click').mockImplementation(() => undefined);
    swatch(h, 'a').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('stops a keyboard-synthesized click (detail 0) so the focus stays on the swatch', () => {
    const h = mount(doc([layer('a')]));
    const seen = jest.fn();
    h.host.addEventListener('click', seen);
    const input = colorInput(h, 'a');
    const open = jest.spyOn(input, 'click').mockImplementation(() => undefined);
    const button = swatch(h, 'a');
    button.focus();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(seen).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
  });

  it('never lets the hidden input click bubble', () => {
    const h = mount(doc([layer('a')]));
    const seen = jest.fn();
    h.host.addEventListener('click', seen);
    colorInput(h, 'a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('picker start value', () => {
  it('starts a colorless node away from #808080 so picking that gray fires a change and applies', () => {
    const h = mount(doc([layer('a'), layer('b', { color: '#112233' })]));
    const input = colorInput(h, 'a');
    expect(input.value).not.toBe('#808080');
    input.value = '#808080';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(findNodeById(h.editor.document.layers, 'a')?.color).toBe('#808080');
    expect(colorInput(h, 'b').value).toBe('#112233');
  });
});

describe('createSetColorCommand case-insensitivity', () => {
  const source = doc([layer('a', { color: '#FF0000' }), folder('f', [layer('b')])]);

  it('is a no-op between #FF0000 and #ff0000 (no history entry)', () => {
    const command = createSetColorCommand(source, 'a', '#ff0000');
    expect(command.do(source)).toBe(source);
    const h = mount(source);
    expect(h.editor.getService('layers.color')?.setColor('a', '#ff0000')).toBe(false);
    expect(h.editor.canUndo).toBe(false);
  });

  it('still undoes to the exact original (upper-case) value', () => {
    const command = createSetColorCommand(source, 'a', '#00ff00');
    const done = command.do(source);
    expect(findNodeById(done.layers, 'a')?.color).toBe('#00ff00');
    expect(findNodeById(command.undo(done).layers, 'a')?.color).toBe('#FF0000');
    expect(findNodeById(command.do(command.undo(done)).layers, 'a')?.color).toBe('#00ff00');
  });
});

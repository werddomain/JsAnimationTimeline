// packages/runtime/src/model/__tests__/guards.test.ts
/**
 * Type guards of the model unions (jsdom environment for a real Element).
 */

import { isElementTarget, isFolder, isLayer, isSelectorTarget } from '../guards';
import type { IFolder, ILayer } from '../layer';
import type { LayerTarget } from '../target';

const layer: ILayer = { id: 'l', type: 'layer', name: 'L', spans: [] };
const folder: IFolder = { id: 'f', type: 'folder', name: 'F', children: [layer] };

describe('node guards', () => {
  it('distinguishes layers and folders', () => {
    expect(isLayer(layer)).toBe(true);
    expect(isFolder(layer)).toBe(false);
    expect(isLayer(folder)).toBe(false);
    expect(isFolder(folder)).toBe(true);
  });
});

describe('target guards', () => {
  const selectorTarget: LayerTarget = { selector: '#logo' };
  const elementTarget: LayerTarget = { element: document.createElement('div') };

  it('recognises selector targets', () => {
    expect(isSelectorTarget(selectorTarget)).toBe(true);
    expect(isSelectorTarget(elementTarget)).toBe(false);
    expect(isSelectorTarget(undefined)).toBe(false);
  });

  it('recognises element targets', () => {
    expect(isElementTarget(elementTarget)).toBe(true);
    expect(isElementTarget(selectorTarget)).toBe(false);
    expect(isElementTarget(undefined)).toBe(false);
  });
});

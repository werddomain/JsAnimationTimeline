// packages/runtime/src/model/__tests__/defaults.test.ts
/**
 * Default values of optional model fields.
 */

import {
  DEFAULT_COLLAPSED,
  DEFAULT_LOCKED,
  DEFAULT_VISIBLE,
  resolveCollapsed,
  resolveEasing,
  resolveLocked,
  resolveTracks,
  resolveVisible
} from '../defaults';
import type { IFolder, ILayer } from '../layer';
import type { ISpan } from '../span';

describe('defaults', () => {
  it('matches the schema defaults', () => {
    expect(DEFAULT_VISIBLE).toBe(true);
    expect(DEFAULT_LOCKED).toBe(false);
    expect(DEFAULT_COLLAPSED).toBe(false);
  });

  it('resolves node flags', () => {
    const bare: ILayer = { id: 'l', type: 'layer', name: 'L', spans: [] };
    const set: ILayer = { ...bare, visible: false, locked: true };
    expect(resolveVisible(bare)).toBe(true);
    expect(resolveLocked(bare)).toBe(false);
    expect(resolveVisible(set)).toBe(false);
    expect(resolveLocked(set)).toBe(true);
  });

  it('resolves folder collapse', () => {
    const folder: IFolder = { id: 'f', type: 'folder', name: 'F', children: [] };
    expect(resolveCollapsed(folder)).toBe(false);
    expect(resolveCollapsed({ ...folder, collapsed: true })).toBe(true);
  });

  it('resolves easing and tracks of a span', () => {
    const span: ISpan = { id: 's', start: 1, end: 2, kind: 'tween' };
    expect(resolveEasing(span)).toBe('linear');
    expect(resolveEasing({ ...span, easing: 'ease' })).toBe('ease');
    expect(resolveTracks(span)).toEqual({});
    expect(Object.isFrozen(resolveTracks(span))).toBe(true);
    const tracks = { x: [{ frame: 1, value: 3 }] };
    expect(resolveTracks({ ...span, tracks })).toBe(tracks);
  });
});

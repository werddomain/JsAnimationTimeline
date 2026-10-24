// packages/editor/src/plugins/layers/icon/__tests__/menuPosition.test.ts
import { clampMenuPosition } from '../menuPosition';

const view = { width: 800, height: 600 };
const size = { width: 200, height: 300 };

describe('clampMenuPosition', () => {
  it('places the menu under the anchor', () => {
    expect(clampMenuPosition({ left: 50, top: 100, bottom: 120 }, size, view)).toEqual({ left: 50, top: 120 });
  });

  it('shifts left when it overflows on the right', () => {
    expect(clampMenuPosition({ left: 700, top: 100, bottom: 120 }, size, view).left).toBe(600);
  });

  it('flips above the anchor when it overflows at the bottom', () => {
    expect(clampMenuPosition({ left: 50, top: 500, bottom: 520 }, size, view)).toEqual({ left: 50, top: 200 });
  });

  it('never leaves the viewport on the top or left', () => {
    expect(clampMenuPosition({ left: -40, top: 100, bottom: 580 }, { width: 200, height: 700 }, view)).toEqual({
      left: 0,
      top: 0
    });
  });

  it('uses the origin without an anchor', () => {
    expect(clampMenuPosition(undefined, size, view)).toEqual({ left: 0, top: 0 });
  });
});

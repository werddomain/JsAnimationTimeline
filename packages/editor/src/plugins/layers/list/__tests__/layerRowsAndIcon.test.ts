// packages/editor/src/plugins/layers/list/__tests__/layerRowsAndIcon.test.ts
import {
  BUILTIN_LAYER_ICONS,
  LAYER_ICON_CLASS,
  classifyLayerIcon,
  defaultLayerIcon,
  effectiveLayerIcon,
  renderLayerIcon
} from '../layerIcon';
import { layerRows, sameRowLayout } from '../layerRows';
import { doc, folder, layer } from './fixtures';

describe('layerRows', () => {
  it('adds the node to each visible row', () => {
    const source = doc([folder('f', [layer('a')]), layer('b')]);
    const rows = layerRows(source);
    expect(rows.map((row) => [row.id, row.depth, row.parentId, row.index])).toEqual([
      ['f', 0, undefined, 0],
      ['a', 1, 'f', 1],
      ['b', 0, undefined, 2]
    ]);
    expect(rows[1]?.node).toBe((source.layers[0] as { children: readonly unknown[] }).children[0]);
  });

  it('leaves out the children of a collapsed folder', () => {
    expect(layerRows(doc([folder('f', [layer('a')], { collapsed: true })])).map((row) => row.id)).toEqual(['f']);
  });

  it('marks rows locked by themselves or by an ancestor folder', () => {
    const rows = layerRows(doc([folder('f', [layer('a'), folder('g', [layer('b')])], { locked: true }), layer('c', { locked: true }), layer('d')]));
    expect(rows.map((row) => [row.id, row.lockedByAncestor])).toEqual([
      ['f', true],
      ['a', true],
      ['g', true],
      ['b', true],
      ['c', true],
      ['d', false]
    ]);
  });
});

describe('layerRows reuse', () => {
  it('reuses unchanged rows from the previous list and rebuilds changed ones', () => {
    const before = layerRows(doc([layer('a'), layer('b')]));
    const source = doc([before[0]?.node ?? layer('a'), layer('b', { name: 'B' })]);
    const after = layerRows(source, before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  });

  it('rebuilds a row whose index or inherited lock changed', () => {
    const a = layer('a');
    const before = layerRows(doc([a, layer('b')]));
    expect(layerRows(doc([layer('z'), a]), before)[1]).not.toBe(before[0]);
    const inFolder = layerRows(doc([folder('f', [a])]));
    expect(layerRows(doc([folder('f', [a], { locked: true })]), inFolder)[1]?.lockedByAncestor).toBe(true);
  });
});

describe('layerRows hidden state', () => {
  it('marks rows hidden by themselves or by an ancestor folder', () => {
    const rows = layerRows(doc([folder('f', [layer('a')], { visible: false }), layer('b', { visible: false }), layer('c')]));
    expect(rows.map((row) => [row.id, row.hiddenByAncestor])).toEqual([
      ['f', true],
      ['a', true],
      ['b', true],
      ['c', false]
    ]);
  });

  it('rebuilds a child row when its folder is hidden', () => {
    const a = layer('a');
    const before = layerRows(doc([folder('f', [a])]));
    const after = layerRows(doc([folder('f', [a], { visible: false })]), before);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]?.hiddenByAncestor).toBe(true);
  });
});

describe('sameRowLayout', () => {
  it('ignores node content but not order, depth or parent', () => {
    const base = layerRows(doc([layer('a'), layer('b')]));
    expect(sameRowLayout(base, layerRows(doc([layer('a', { name: 'A' }), layer('b')])))).toBe(true);
    expect(sameRowLayout(base, layerRows(doc([layer('b'), layer('a')])))).toBe(false);
    expect(sameRowLayout(base, layerRows(doc([layer('a')])))).toBe(false);
    expect(sameRowLayout(layerRows(doc([folder('f', []), layer('a')])), layerRows(doc([folder('f', [layer('a')])])))).toBe(false);
  });
});

describe('layer icons', () => {
  it('classifies built-in names, URLs, CSS classes and invalid values', () => {
    expect(classifyLayerIcon('sprite')).toBe('builtin');
    expect(classifyLayerIcon('https://cdn.example/icon.svg')).toBe('url');
    expect(classifyLayerIcon('data:image/png;base64,AAA')).toBe('url');
    expect(classifyLayerIcon('./icons/hero.png')).toBe('url');
    expect(classifyLayerIcon('fa fa-star')).toBe('class');
    expect(classifyLayerIcon('javascript:alert(1)')).toBe('invalid');
    expect(classifyLayerIcon('<b>')).toBe('invalid');
    expect(classifyLayerIcon('toString')).toBe('class');
    expect(classifyLayerIcon('//evil.example/x.png')).toBe('invalid');
    expect(classifyLayerIcon('/icons/a.png')).toBe('url');
    expect(classifyLayerIcon('jt-layer-row--hidden')).toBe('invalid');
    expect(classifyLayerIcon('fa jt-shell')).toBe('invalid');
  });

  it('keeps the classes it did not add when the icon changes', () => {
    const element = document.createElement('span');
    element.classList.add('host-class');
    renderLayerIcon(layer('a', { icon: 'fa fa-star' }), element);
    renderLayerIcon(layer('a', { icon: 'audio' }), element);
    expect(Array.from(element.classList).sort()).toEqual(['host-class', LAYER_ICON_CLASS, `${LAYER_ICON_CLASS}--audio`].sort());
  });

  it('defaults by node type and folder state', () => {
    expect(defaultLayerIcon(layer('a'))).toBe('layer');
    expect(defaultLayerIcon(folder('f', []))).toBe('folderOpen');
    expect(defaultLayerIcon(folder('f', [], { collapsed: true }))).toBe('folder');
    expect(effectiveLayerIcon(layer('a', { icon: 'javascript:void(0)' }))).toBe('layer');
    expect(effectiveLayerIcon(layer('a', { icon: ' audio ' }))).toBe('audio');
  });

  it('renders a built-in glyph, an image or CSS classes', () => {
    const element = document.createElement('span');
    renderLayerIcon(layer('a', { icon: 'audio' }), element);
    expect(element.textContent).toBe(BUILTIN_LAYER_ICONS.audio);
    expect(element.classList.contains(`${LAYER_ICON_CLASS}--audio`)).toBe(true);

    renderLayerIcon(layer('a', { icon: 'https://cdn.example/a.png' }), element);
    const image = element.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://cdn.example/a.png');
    expect(image?.alt).toBe('');

    renderLayerIcon(layer('a', { icon: 'fa fa-star' }), element);
    expect(element.querySelector('img')).toBeNull();
    expect(Array.from(element.classList)).toEqual([LAYER_ICON_CLASS, 'fa', 'fa-star']);
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });
});

// packages/editor/src/plugins/frames/grid/__tests__/FramesGridPlugin.test.ts
/**
 * Tests de `frames.grid` : rendu des lignes visibles (plages, marques,
 * dossiers repliés), mise à jour sur les événements du document et des
 * lignes, dessin de la seule partie visible, alignement sur la règle,
 * `zoom:changed`, service et nettoyage.
 */

import type { ILayer, ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../../core/commands/createCommand';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { LayersPlugin } from '../../../layers/LayersPlugin';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { cleanBody, createContainer, createManualScheduler, makeScrollable } from '../../../layout/__tests__/layoutFixtures';
import type { IManualScheduler } from '../../../layout/__tests__/layoutFixtures';
import { FramesPlugin } from '../../FramesPlugin';
import type { FramesGridRenderedEvent, IFramesGridService } from '../types';

afterEach(cleanBody);

function layer(id: string, extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id, spans: [], ...extra };
}

function doc(layers: readonly LayerNode[], totalFrames = 24): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames }, layers };
}

const animated = layer('a', {
  spans: [
    { id: 's1', start: 1, end: 4, kind: 'static' },
    {
      id: 's2',
      start: 5,
      end: 10,
      kind: 'tween',
      tracks: {
        x: [
          { frame: 5, value: 0 },
          { frame: 8, value: 4 },
          { frame: 10, value: 9 }
        ]
      }
    },
    { id: 's3', start: 11, end: 12, kind: 'blank' }
  ]
});

interface IHarness {
  readonly editor: IEditor;
  readonly scheduler: IManualScheduler;
  readonly grid: IFramesGridService;
  readonly frames: HTMLElement;
  readonly rendered: FramesGridRenderedEvent[];
  readonly ctx: () => IEditorContext;
}

interface ISetupOptions {
  readonly withLayers?: boolean;
  readonly frameWidth?: number;
}

/** Monte la mise en page (ordonnanceur manuel), l'epic frames et un plugin espion du contexte. */
function setup(data: ITimelineDocument, options: ISetupOptions = {}): IHarness {
  const scheduler = createManualScheduler();
  let captured: IEditorContext | undefined;
  const spy: EditorPlugin = {
    id: 'test.spy',
    dependencies: [],
    init: (ctx) => void (captured = ctx),
    destroy: () => undefined
  };
  const editor = createEditor(createContainer(), {
    data,
    defaultPlugins: [
      new LayoutPlugin({ scrollSync: { scheduler }, ruler: { frameWidth: options.frameWidth } }),
      ...(options.withLayers === true ? [new LayersPlugin()] : []),
      new FramesPlugin()
    ],
    plugins: [spy]
  });
  const grid = editor.getService('frames.grid');
  if (grid === undefined) throw new Error('service frames.grid absent');
  const frames = editor.container.querySelector<HTMLElement>('[data-zone="frames"]');
  if (frames === null) throw new Error('zone frames absente');
  const rendered: FramesGridRenderedEvent[] = [];
  editor.on('frames:gridRendered', (event) => rendered.push(event));
  const ctx = (): IEditorContext => {
    if (captured === undefined) throw new Error('contexte absent');
    return captured;
  };
  return { editor, scheduler, grid, frames, rendered, ctx };
}

function rowIds(frames: HTMLElement): string[] {
  return Array.from(frames.querySelectorAll<HTMLElement>('.jt-grid__row')).map((row) => row.dataset.rowId ?? '');
}

function rowElement(frames: HTMLElement, id: string): HTMLElement {
  const row = frames.querySelector<HTMLElement>(`.jt-grid__row[data-row-id="${id}"]`);
  if (row === null) throw new Error(`ligne ${id} absente`);
  return row;
}

function classesOf(row: HTMLElement, selector: string): string[] {
  return Array.from(row.querySelectorAll<HTMLElement>(selector)).map((element) => element.className);
}

describe('frames.grid rendering', () => {
  it('renders one row per visible row, skipping the children of collapsed folders', () => {
    // Arrange
    const data = doc([
      layer('top'),
      { id: 'open', type: 'folder', name: 'open', children: [layer('inside')] },
      { id: 'closed', type: 'folder', name: 'closed', collapsed: true, children: [layer('hidden')] }
    ]);

    // Act
    const { frames } = setup(data);

    // Assert
    expect(rowIds(frames)).toEqual(['top', 'open', 'inside', 'closed']);
    expect(rowElement(frames, 'inside').style.top).toBe('60px');
    expect(rowElement(frames, 'open').className).toContain('jt-grid__row--folder');
  });

  it('draws each span, the empty end and the keyframe marks at the ruler positions', () => {
    // Act
    const { frames } = setup(doc([animated], 20));
    const row = rowElement(frames, 'a');
    const spans = Array.from(row.querySelectorAll<HTMLElement>('.jt-grid__span'));

    // Assert
    expect(spans.map((span) => [span.className, span.style.left, span.style.width])).toEqual([
      ['jt-grid__span jt-grid__span--static', '0px', '60px'],
      ['jt-grid__span jt-grid__span--tween', '60px', '90px'],
      ['jt-grid__span jt-grid__span--blank', '150px', '30px'],
      ['jt-grid__span jt-grid__span--empty', '180px', '120px']
    ]);
    expect(spans[1]?.dataset).toMatchObject({ spanId: 's2', start: '5', end: '10' });
    expect(classesOf(row, '.jt-grid__mark')).toEqual([
      'jt-grid__mark jt-grid__mark--keyframe',
      'jt-grid__mark jt-grid__mark--spanEnd',
      'jt-grid__mark jt-grid__mark--keyframe',
      'jt-grid__mark jt-grid__mark--propertyKeyframe',
      'jt-grid__mark jt-grid__mark--propertyKeyframe',
      'jt-grid__mark jt-grid__mark--blankKeyframe',
      'jt-grid__mark jt-grid__mark--spanEnd'
    ]);
  });

  it('anchors the span backgrounds on frame 1, whatever the segment start', () => {
    // Act : statique 1..12 -> la fin vide commence à l'image 13 (13 n'est pas 1 modulo 5).
    const data = doc([layer('a', { spans: [{ id: 's', start: 1, end: 12, kind: 'static' }] })], 30);
    const { frames } = setup(data);
    const empty = rowElement(frames, 'a').querySelector<HTMLElement>('.jt-grid__span--empty');

    // Assert : décalage de -(13 - 1) * 15 px, la teinte tombe sur les images 15, 20...
    expect(empty?.style.left).toBe('180px');
    expect(empty?.style.backgroundPositionX).toBe('-180px');
  });

  it('sizes the grid to the whole timeline and publishes the frame width', () => {
    // Act
    const { grid, frames } = setup(doc([layer('a'), layer('b')], 100));
    const element = grid.element();

    // Assert
    expect(element?.parentElement).toBe(frames);
    expect(element?.style.width).toBe('1500px');
    expect(element?.style.height).toBe('60px');
    expect(element?.style.getPropertyValue('--jt-grid-frame-width')).toBe('15px');
  });

  it('uses the frame width of layout.ruler', () => {
    // Act
    const { grid, frames } = setup(doc([animated], 20), { frameWidth: 10 });
    const tween = rowElement(frames, 'a').querySelector<HTMLElement>('.jt-grid__span--tween');

    // Assert
    expect(grid.frameWidth()).toBe(10);
    expect([tween?.style.left, tween?.style.width]).toEqual(['40px', '60px']);
    expect(grid.element()?.style.width).toBe('200px');
  });
});

describe('frames.grid updates', () => {
  it('redraws on document:changed', () => {
    // Arrange
    const { editor, frames, rendered } = setup(doc([layer('a')]));
    const before = rendered.length;

    // Act
    editor.execute(
      createCommand(
        'Ajouter',
        (current) => ({ ...current, layers: [...current.layers, layer('b')] }),
        (current) => ({ ...current, layers: current.layers.slice(0, 1) })
      )
    );

    // Assert
    expect(rowIds(frames)).toEqual(['a', 'b']);
    expect(rendered.length).toBe(before + 1);
  });

  it('redraws on document:loaded', () => {
    // Arrange
    const { editor, frames } = setup(doc([layer('a')]));

    // Act
    editor.load(doc([layer('x'), layer('y')]));

    // Assert
    expect(rowIds(frames)).toEqual(['x', 'y']);
  });

  it('follows layers:rowsChanged from layers.list without drawing twice for one change', () => {
    // Arrange
    const { editor, frames, rendered } = setup(
      doc([{ id: 'f', type: 'folder', name: 'f', children: [layer('c')] }]),
      { withLayers: true }
    );
    const list = editor.getService('layers.list');
    const before = rendered.length;

    // Act
    list?.setCollapsed('f', true);

    // Assert
    expect(rowIds(frames)).toEqual(['f']);
    expect(rendered.length).toBe(before + 1);
  });

  it('does not redraw when nothing it shows has changed', () => {
    // Arrange
    const { scheduler, rendered } = setup(doc([layer('a')]));
    const before = rendered.length;

    // Act : premier layout:scrolled, avec la même fenêtre (zone non mesurée).
    scheduler.flush();

    // Assert
    expect(rendered.length).toBe(before);
  });

  it('redraws immediately on refresh()', () => {
    // Arrange
    const { grid, rendered } = setup(doc([layer('a')]));
    const before = rendered.length;

    // Act
    grid.refresh();

    // Assert
    expect(rendered.length).toBe(before + 1);
  });
});

describe('frames.grid visible window', () => {
  it('draws only the visible frames of a long timeline, and follows the scroll', () => {
    // Arrange
    const { frames, scheduler, editor, grid } = setup(doc([animated], 10000));
    makeScrollable(frames, { scrollWidth: 150000, scrollHeight: 300, clientWidth: 300, clientHeight: 300 });
    scheduler.flush();

    // Act
    editor.getService('layout.scrollSync')?.scrollTo({ left: 15000 });
    const empty = rowElement(frames, 'a').querySelector<HTMLElement>('.jt-grid__span--empty');

    // Assert : images 1001 à 1020 visibles, 20 images de marge de chaque côté.
    expect(grid.window().frames).toEqual({ first: 981, last: 1041 });
    expect(empty?.style.left).toBe(`${980 * 15}px`);
    expect(empty?.style.width).toBe(`${61 * 15}px`);
    expect(rowElement(frames, 'a').querySelectorAll('.jt-grid__mark')).toHaveLength(0);
  });

  it('keeps the whole span bounds on a span cut by the drawn window', () => {
    // Arrange
    const long = layer('a', { spans: [{ id: 'big', start: 1, end: 5000, kind: 'static' }] });
    const { frames, scheduler, editor } = setup(doc([long], 10000));
    makeScrollable(frames, { scrollWidth: 150000, scrollHeight: 300, clientWidth: 300, clientHeight: 300 });
    scheduler.flush();

    // Act
    editor.getService('layout.scrollSync')?.scrollTo({ left: 15000 });
    const span = rowElement(frames, 'a').querySelector<HTMLElement>('.jt-grid__span--static');

    // Assert
    expect(span?.dataset).toMatchObject({ spanId: 'big', start: '1', end: '5000' });
    expect(span?.style.left).toBe(`${980 * 15}px`);
  });

  it('does not redraw while the visible part stays inside the drawn margin', () => {
    // Arrange
    const { frames, scheduler, editor, rendered } = setup(doc([animated], 10000));
    makeScrollable(frames, { scrollWidth: 150000, scrollHeight: 300, clientWidth: 300, clientHeight: 300 });
    scheduler.flush();
    const scroll = editor.getService('layout.scrollSync');
    scroll?.scrollTo({ left: 15000 });
    const before = rendered.length;

    // Act : 5 images à droite, puis 30 images (hors de la marge de 20).
    scroll?.scrollTo({ left: 15000 + 5 * 15 });
    const afterSmall = rendered.length;
    scroll?.scrollTo({ left: 15000 + 30 * 15 });

    // Assert
    expect(afterSmall).toBe(before);
    expect(rendered.length).toBe(before + 1);
  });

  it('keeps the folder background anchored on frame 1 after a scroll', () => {
    // Arrange
    const data = doc([{ id: 'f', type: 'folder', name: 'f', children: [] }], 10000);
    const { frames, scheduler, editor } = setup(data);
    makeScrollable(frames, { scrollWidth: 150000, scrollHeight: 300, clientWidth: 300, clientHeight: 300 });
    scheduler.flush();

    // Act : première image visible 1003, la fenêtre commence 20 images plus tôt (983).
    editor.getService('layout.scrollSync')?.scrollTo({ left: 1002 * 15 + 7 });
    const folderSpan = rowElement(frames, 'f').querySelector<HTMLElement>('.jt-grid__span--folder');

    // Assert
    expect(folderSpan?.style.left).toBe(`${982 * 15}px`);
    expect(folderSpan?.style.backgroundPositionX).toBe(`${-982 * 15}px`);
  });

  it('draws only the visible rows of a long layer list', () => {
    // Arrange
    const layers = Array.from({ length: 200 }, (_, index) => layer(`l${index}`));
    const { frames, scheduler, editor } = setup(doc(layers));
    makeScrollable(frames, { scrollWidth: 360, scrollHeight: 6000, clientWidth: 360, clientHeight: 150 });
    scheduler.flush();

    // Act
    editor.getService('layout.scrollSync')?.scrollTo({ top: 3000 });

    // Assert : lignes 100 à 105 visibles, 5 lignes de marge de chaque côté.
    expect(rowIds(frames)).toEqual(Array.from({ length: 16 }, (_, index) => `l${95 + index}`));
    expect(rowElement(frames, 'l95').style.top).toBe(`${95 * 30}px`);
  });

  it('keeps the decorations other plugins add to the grid element', () => {
    // Arrange
    const { grid, editor } = setup(doc([layer('a')]));
    const overlay = document.createElement('div');
    grid.element()?.appendChild(overlay);

    // Act
    editor.load(doc([layer('b')]));

    // Assert
    expect(overlay.isConnected).toBe(true);
  });
});

describe('frames.grid zoom', () => {
  it('redraws on zoom:changed and asks layout.scrollSync to measure again', () => {
    // Arrange
    const { ctx, scheduler, frames } = setup(doc([layer('a')]));
    makeScrollable(frames, { scrollWidth: 360, scrollHeight: 300, clientWidth: 360, clientHeight: 300 });
    scheduler.flush();

    // Act
    ctx().events.emit('zoom:changed', { zoom: 2, frameWidth: 30, previousZoom: 1, previousFrameWidth: 15 });

    // Assert
    expect(scheduler.pendingCount()).toBe(1);
  });
});

describe('frames.grid service', () => {
  function mockRect(element: HTMLElement, left: number, top: number): void {
    element.getBoundingClientRect = () => ({
      left,
      top,
      right: left,
      bottom: top,
      width: 0,
      height: 0,
      x: left,
      y: top,
      toJSON: () => ({})
    });
  }

  it('finds the cell under a point', () => {
    // Arrange
    const { grid } = setup(doc([layer('a'), layer('b')], 20));
    const element = grid.element();
    if (element === undefined) throw new Error('grille absente');
    mockRect(element, 100, 50);

    // Act / Assert
    expect(grid.cellAt(100, 50)).toEqual({ rowId: 'a', rowIndex: 0, frame: 1 });
    expect(grid.cellAt(100 + 15 * 7 + 3, 50 + 30 + 1)).toEqual({ rowId: 'b', rowIndex: 1, frame: 8 });
    expect(grid.cellAt(100 + 15 * 20 - 1, 50)).toEqual({ rowId: 'a', rowIndex: 0, frame: 20 });
  });

  it('returns undefined outside the grid', () => {
    // Arrange
    const { grid } = setup(doc([layer('a')], 20));
    const element = grid.element();
    if (element === undefined) throw new Error('grille absente');
    mockRect(element, 100, 50);

    // Act / Assert
    expect(grid.cellAt(99, 55)).toBeUndefined();
    expect(grid.cellAt(110, 49)).toBeUndefined();
    expect(grid.cellAt(100 + 15 * 20, 55)).toBeUndefined();
    expect(grid.cellAt(110, 50 + 30)).toBeUndefined();
  });

  it('exposes the rows, the row height and the drawn window', () => {
    // Act
    const { grid, rendered } = setup(doc([layer('a'), layer('b')], 20));
    grid.refresh();

    // Assert
    expect(grid.rows().map((row) => row.id)).toEqual(['a', 'b']);
    expect(grid.rowHeight()).toBe(30);
    expect(grid.window()).toEqual({ frames: { first: 1, last: 20 }, rows: { first: 0, last: 1 } });
    expect(rendered[rendered.length - 1]).toEqual({ window: grid.window(), frameWidth: 15, rowHeight: 30 });
  });

  it('removes the grid and its service on destroy', () => {
    // Arrange
    const { editor, frames, grid } = setup(doc([layer('a')]));

    // Act
    editor.destroy();

    // Assert
    expect(frames.querySelector('.jt-grid')).toBeNull();
    expect(grid.element()).toBeUndefined();
  });
});

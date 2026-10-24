// packages/editor/src/plugins/frames/clipboard/__tests__/FramesClipboardPlugin.test.ts
/**
 * Tests de `frames.clipboard` : Ctrl+C / Ctrl+V par le clavier, cibles de
 * collage de secours, lignes abandonnées, dossiers sautés, touche laissée au
 * navigateur quand elle est inutile, événement, sélection après collage,
 * annulation, refus et place dans le jeu de plugins par défaut.
 */

import type { ILayer, ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import { defaultPlugins } from '../../../../core/editor/defaultPlugins';
import type { IEditor } from '../../../../core/editor/types';
import { LayersPlugin } from '../../../layers/LayersPlugin';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { cleanBody, createContainer, createManualScheduler } from '../../../layout/__tests__/layoutFixtures';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { FramesPlugin } from '../../FramesPlugin';
import { FramesClipboardPlugin } from '../FramesClipboardPlugin';
import type { FramesClipboardChangedEvent, IFramesClipboardService } from '../types';

afterEach(() => {
  jest.restoreAllMocks();
  cleanBody();
});

function layer(id: string, extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id, spans: [], ...extra };
}

function doc(layers: readonly LayerNode[], totalFrames = 20): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames }, layers };
}

/** Calque de trois plages : fixe 1-3 (x=1), vide 4-6, fixe 7-20 (x=7). */
const source = (id: string, extra: Partial<ILayer> = {}): ILayer =>
  layer(id, {
    spans: [
      { id: `${id}1`, start: 1, end: 3, kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } },
      { id: `${id}2`, start: 4, end: 6, kind: 'blank' },
      { id: `${id}3`, start: 7, end: 20, kind: 'static', tracks: { x: [{ frame: 7, value: 7 }] } }
    ],
    ...extra
  });

const sample = doc([source('a'), { id: 'f', type: 'folder', name: 'f', children: [] }, source('b'), layer('c')]);

interface IHarness {
  readonly editor: IEditor;
  readonly clipboard: IFramesClipboardService;
  readonly events: FramesClipboardChangedEvent[];
  readonly select: (cells: ReadonlyArray<readonly [string, number]>) => void;
  readonly spans: (id: string) => string[];
}

function setup(data: ITimelineDocument = sample, extra: readonly EditorPlugin[] = []): IHarness {
  const scheduler = createManualScheduler();
  const editor = createEditor(createContainer(), {
    data,
    defaultPlugins: [
      new LayoutPlugin({ scrollSync: { scheduler } }),
      new LayersPlugin(),
      new FramesPlugin(),
      createShortcutsPlugin()
    ],
    plugins: extra
  });
  const clipboard = editor.getService('frames.clipboard');
  const selection = editor.getService('frames.selection');
  if (clipboard === undefined || selection === undefined) throw new Error('montage incomplet');
  const events: FramesClipboardChangedEvent[] = [];
  editor.on('frames:clipboardChanged', (event) => events.push(event));
  return {
    editor,
    clipboard,
    events,
    select: (cells) => selection.set(cells.map(([rowId, frame]) => ({ rowId, frame }))),
    spans: (id) => {
      const node = editor.document.layers.flatMap((n) => (n.type === 'folder' ? n.children : [n])).find((n) => n.id === id);
      return node?.type === 'layer' ? node.spans.map((span) => `${span.kind} ${span.start}-${span.end}`) : [];
    }
  };
}

function press(editor: IEditor, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init });
  editor.container.dispatchEvent(event);
  return event;
}

const range = (rowId: string, first: number, last: number): Array<readonly [string, number]> =>
  Array.from({ length: last - first + 1 }, (_, index) => [rowId, first + index] as const);

describe('frames.clipboard keyboard', () => {
  it('copies with Ctrl+C and pastes with Ctrl+V at the anchor', () => {
    // Arrange
    const { editor, select, spans } = setup();
    select(range('a', 1, 3));
    const copy = press(editor, 'c');
    select([['c', 10]]);

    // Act
    const paste = press(editor, 'v');

    // Assert
    expect(copy.defaultPrevented).toBe(true);
    expect(paste.defaultPrevented).toBe(true);
    expect(spans('c')).toEqual(['blank 1-9', 'static 10-12']);
  });

  it('works with Cmd on the Mac', () => {
    // Arrange
    const { editor, select, clipboard } = setup();
    select([['a', 2]]);

    // Act
    press(editor, 'c', { ctrlKey: false, metaKey: true });

    // Assert
    expect(clipboard.hasContent()).toBe(true);
  });

  it('leaves Ctrl+C to the browser when nothing is selected', () => {
    // Arrange
    const { editor, clipboard } = setup();

    // Act
    const event = press(editor, 'c');

    // Assert
    expect(event.defaultPrevented).toBe(false);
    expect(clipboard.hasContent()).toBe(false);
  });

  it('leaves Ctrl+V to the browser when the clipboard is empty', () => {
    // Arrange
    const { editor, select } = setup();
    select([['a', 2]]);

    // Act
    const event = press(editor, 'v');

    // Assert
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves the keys to a text field in the editor', () => {
    // Arrange
    const { editor, select, clipboard } = setup();
    select([['a', 2]]);
    const input = document.createElement('input');
    editor.container.appendChild(input);

    // Act
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);

    // Assert
    expect(event.defaultPrevented).toBe(false);
    expect(clipboard.hasContent()).toBe(false);
  });

  it('registers Mod+C and Mod+V next to the other default plugins without a conflict', () => {
    // Act
    const editor = createEditor(createContainer(), { data: sample, defaultPlugins: defaultPlugins() });

    // Assert
    const shortcuts = editor.getService('interaction.shortcuts');
    expect(shortcuts?.lookup('Mod+C')?.id).toBe('frames.clipboard.copy');
    expect(shortcuts?.lookup('Mod+V')?.id).toBe('frames.clipboard.paste');
    expect(shortcuts?.lookup('Mod+V')?.label).toBe('Coller les images');
  });
});

describe('frames.clipboard keys on refusal and highlighted text', () => {
  it('takes Ctrl+V even when the paste is refused, and announces the refusal', () => {
    // Arrange
    const locked = doc([source('a'), source('b', { locked: true })]);
    const { editor, select } = setup(locked);
    const refused: string[] = [];
    editor.on('command:refused', (event) => refused.push(event.reason));
    select([['a', 1]]);
    press(editor, 'c');
    select([['b', 5]]);

    // Act
    const event = press(editor, 'v');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain('verrouillé');
    expect(editor.toJSON()).toEqual(locked);
  });

  /** Surligne le texte de `element` le temps de `act`, puis nettoie (même en cas d'échec). */
  function withHighlighted<T>(element: HTMLElement, act: () => T): T {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.addRange(range);
    try {
      return act();
    } finally {
      window.getSelection()?.removeAllRanges();
      element.remove();
    }
  }

  it('takes the keys but does nothing during a history group', () => {
    // Arrange
    const captured: { ctx?: IEditorContext } = {};
    const spy: EditorPlugin = { id: 'test.spy', dependencies: [], init: (ctx) => void (captured.ctx = ctx), destroy: () => undefined };
    const { editor, select, clipboard } = setup(sample, [spy]);
    select([['a', 1]]);
    captured.ctx?.commands.beginGroup('Groupe');

    // Act
    const copyEvent = press(editor, 'c');
    captured.ctx?.commands.cancelGroup();

    // Assert
    expect(copyEvent.defaultPrevented).toBe(true);
    expect(clipboard.hasContent()).toBe(false);
  });

  it('leaves Ctrl+V to the browser when there is nowhere to paste', () => {
    // Arrange
    const { editor, select, clipboard } = setup();
    select([['a', 1]]);
    clipboard.copy();
    editor.getService('frames.selection')?.clear();

    // Act
    const event = press(editor, 'v');

    // Assert
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves Ctrl+C to the browser while text is highlighted in the page', () => {
    // Arrange
    const { editor, select, clipboard } = setup();
    select([['a', 1]]);
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Texte de la page';
    document.body.appendChild(paragraph);

    // Act
    const event = withHighlighted(paragraph, () => press(editor, 'c'));

    // Assert
    expect(event.defaultPrevented).toBe(false);
    expect(clipboard.hasContent()).toBe(false);
  });

  it('still copies the frames when the highlighted text is inside the editor', () => {
    // Arrange
    const { editor, select, clipboard } = setup();
    select([['a', 1]]);
    const label = document.createElement('span');
    label.textContent = 'Nom du calque';
    editor.container.appendChild(label);

    // Act
    const event = withHighlighted(label, () => press(editor, 'c'));

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(clipboard.hasContent()).toBe(true);
  });

  it('announces a copy that cannot evaluate a cut edge, and keeps the key', () => {
    // Arrange : interpolation sur une propriété inconnue du registre, coupée par la sélection.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = doc([
      layer('u', {
        spans: [
          { id: 'u1', start: 1, end: 10, kind: 'tween', tracks: { unknownThing: [{ frame: 1, value: 0 }, { frame: 10, value: 9 }] } }
        ]
      })
    ]);
    const { editor, select, clipboard } = setup(broken);
    const refused: string[] = [];
    editor.on('command:refused', (event) => refused.push(event.reason));
    select(range('u', 3, 5));

    // Act
    const event = press(editor, 'c');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain('Impossible de calculer');
    expect(clipboard.hasContent()).toBe(false);
  });

});

describe('frames.clipboard paste', () => {
  it('pastes a rectangle over several layers, skipping the folder between them', () => {
    // Arrange
    const { clipboard, select, spans } = setup();
    select([...range('a', 2, 4), ...range('b', 2, 4)]);
    clipboard.copy();

    // Act
    const pasted = clipboard.paste({ rowId: 'b', frame: 10 });

    // Assert
    expect(pasted).toBe(true);
    expect(spans('b')).toEqual(['static 1-3', 'blank 4-6', 'static 7-9', 'static 10-11', 'blank 12-12', 'static 13-20']);
    expect(spans('c')).toEqual(['blank 1-9', 'static 10-11', 'blank 12-12']);
  });

  it('drops the rows that fall past the last layer', () => {
    // Arrange
    const { clipboard, select, spans } = setup();
    select([...range('a', 1, 2), ...range('b', 1, 2)]);
    clipboard.copy();

    // Act
    const pasted = clipboard.paste({ rowId: 'c', frame: 15 });

    // Assert
    expect(pasted).toBe(true);
    expect(spans('b')).toEqual(['static 1-3', 'blank 4-6', 'static 7-20']);
    expect(spans('c')).toEqual(['blank 1-14', 'static 15-16']);
  });

  it('refuses a target that is not a layer row', () => {
    // Arrange
    const { clipboard, select } = setup();
    select([['a', 1]]);
    clipboard.copy();

    // Act
    const pasted = clipboard.paste({ rowId: 'f', frame: 2 });

    // Assert
    expect(pasted).toBe(false);
  });

  it('selects the pasted cells afterwards', () => {
    // Arrange
    const { clipboard, select, editor } = setup();
    select(range('a', 1, 2));
    clipboard.copy();
    select([['c', 5]]);

    // Act
    clipboard.paste();

    // Assert
    expect(editor.getService('frames.selection')?.cells()).toEqual([
      { rowId: 'c', frame: 5 },
      { rowId: 'c', frame: 6 }
    ]);
  });

  it('pastes at the top-left of the selection, not at its anchor', () => {
    // Arrange : l'ancre de `set` est la dernière cellule (c:9).
    const { clipboard, select, editor, spans } = setup();
    select([['a', 1]]);
    clipboard.copy();
    select([['c', 8], ['c', 9]]);
    expect(editor.getService('frames.selection')?.anchor()).toEqual({ rowId: 'c', frame: 9 });

    // Act
    clipboard.paste();

    // Assert
    expect(spans('c')).toEqual(['blank 1-7', 'static 8-8']);
  });

  it('pastes a ragged selection from its top-left corner', () => {
    // Arrange : a5-a6 puis b3-b4 ; le coin haut gauche est (a, 3).
    const data = doc([source('a'), { id: 'f', type: 'folder', name: 'f', children: [] }, source('b'), layer('c'), layer('d')]);
    const { clipboard, select, spans } = setup(data);
    select([...range('a', 1, 2), ...range('b', 1, 1)]);
    clipboard.copy();
    select([...range('c', 5, 6), ...range('d', 3, 4)]);

    // Act
    clipboard.paste();

    // Assert : ligne 1 du contenu en c à partir de 3, ligne 2 en d à partir de 3.
    expect(spans('c')).toEqual(['blank 1-2', 'static 3-4']);
    expect(spans('d')).toEqual(['blank 1-2', 'static 3-3']);
  });

  it('pastes twice at the same place', () => {
    // Arrange : copie a1-a3, collage en c10.
    const { clipboard, select, spans } = setup();
    select(range('a', 1, 3));
    clipboard.copy();
    select([['c', 10]]);
    clipboard.paste();
    const once = spans('c');

    // Act : la sélection est maintenant c10-c12 (ancre en c12).
    clipboard.paste();

    // Assert
    expect(once).toEqual(['blank 1-9', 'static 10-12']);
    expect(spans('c')).toEqual(once);
  });

  it('pastes a clip of several rows twice at the same rows', () => {
    // Arrange : copie a1-a2 et b1-b2 (le dossier entre les deux est sauté), collage en b5.
    const data = doc([source('a'), { id: 'f', type: 'folder', name: 'f', children: [] }, source('b'), layer('c'), layer('d')]);
    const { clipboard, select, spans } = setup(data);
    select([...range('a', 1, 2), ...range('b', 1, 2)]);
    clipboard.copy();
    select([['c', 5]]);
    clipboard.paste();
    const once = { c: spans('c'), d: spans('d') };

    // Act
    clipboard.paste();

    // Assert : toujours sur c et d, toujours à l'image 5.
    expect(once).toEqual({ c: ['blank 1-4', 'static 5-6'], d: ['blank 1-4', 'static 5-6'] });
    expect({ c: spans('c'), d: spans('d') }).toEqual(once);
  });

  it('pastes at the top-left of a range selected right to left', () => {
    // Arrange : sélection de c9 vers c6 (l'ancre reste en c9).
    const { clipboard, select, editor, spans } = setup();
    select([['a', 1]]);
    clipboard.copy();
    const selection = editor.getService('frames.selection');
    selection?.select({ rowId: 'c', frame: 9 });
    selection?.selectRange({ rowId: 'c', frame: 6 });
    const anchorBefore = selection?.anchor();

    // Act
    clipboard.paste();

    // Assert
    expect(anchorBefore).toEqual({ rowId: 'c', frame: 9 });
    expect(spans('c')).toEqual(['blank 1-5', 'static 6-6']);
  });

  it('falls back to the playhead on the first selected layer', () => {
    // Arrange
    const { clipboard, select, editor, spans } = setup();
    select([['a', 1]]);
    clipboard.copy();
    editor.getService('frames.selection')?.clear();
    editor.getService('layers.selection')?.select(['c']);
    editor.playback.seek(4);

    // Act
    const pasted = clipboard.paste();

    // Assert
    expect(pasted).toBe(true);
    expect(spans('c')).toEqual(['blank 1-3', 'static 4-4']);
  });

  it('returns false without any target', () => {
    // Arrange
    const { clipboard, select, editor } = setup();
    select([['a', 1]]);
    clipboard.copy();
    editor.getService('frames.selection')?.clear();

    // Act
    const pasted = clipboard.paste();

    // Assert
    expect(pasted).toBe(false);
    expect(editor.canUndo).toBe(false);
  });

  it('is one undo step and one redo step', () => {
    // Arrange
    const { clipboard, select, editor, spans } = setup();
    select([...range('a', 1, 2), ...range('b', 1, 2)]);
    clipboard.copy();
    const original = editor.document;

    // Act
    clipboard.paste({ rowId: 'b', frame: 19 });
    const afterPaste = editor.document;
    editor.undo();
    const afterUndo = editor.document;
    editor.redo();

    // Assert
    expect(afterPaste).not.toBe(original);
    expect(afterUndo).toEqual(original);
    expect(editor.document).toEqual(afterPaste);
    expect(spans('b')).toEqual(['static 1-3', 'blank 4-6', 'static 7-18', 'static 19-20']);
  });

  it('refuses the whole paste when one target row is locked', () => {
    // Arrange
    const locked = doc([source('a'), source('b', { locked: true })]);
    const { clipboard, select, editor } = setup(locked);
    select([...range('a', 1, 2), ...range('b', 1, 2)]);
    clipboard.copy();
    const refused: string[] = [];
    editor.on('command:refused', (event) => refused.push(event.reason));
    const before = editor.document;

    // Act
    const pasted = clipboard.paste({ rowId: 'a', frame: 10 });

    // Assert
    expect(pasted).toBe(false);
    expect(editor.document).toBe(before);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain('verrouillé');
  });
});

describe('frames.clipboard service and event', () => {
  it('emits frames:clipboardChanged on copy and on clear', () => {
    // Arrange
    const { clipboard, select, events } = setup();
    select([...range('a', 1, 3), ...range('b', 1, 3)]);

    // Act
    clipboard.copy();
    clipboard.clear();

    // Assert
    expect(events).toEqual([
      { hasContent: true, rows: 2, width: 3 },
      { hasContent: false, rows: 0, width: 0 }
    ]);
  });

  it('does not emit when clearing an empty clipboard', () => {
    // Arrange
    const { clipboard, events } = setup();

    // Act
    clipboard.clear();

    // Assert
    expect(events).toEqual([]);
  });

  it('keeps the previous content when there is nothing selected to copy', () => {
    // Arrange
    const { clipboard, select, editor } = setup();
    select([['a', 1]]);
    clipboard.copy();
    const content = clipboard.content();
    editor.getService('frames.selection')?.clear();

    // Act
    const copied = clipboard.copy();

    // Assert
    expect(copied).toBe(false);
    expect(clipboard.content()).toBe(content);
  });

  it('exposes a frozen JSON clip', () => {
    // Arrange
    const { clipboard, select } = setup();
    select(range('a', 2, 4));

    // Act
    clipboard.copy();

    // Assert
    const clip = clipboard.content();
    expect(Object.isFrozen(clip)).toBe(true);
    expect(JSON.parse(JSON.stringify(clip))).toEqual(clip);
    expect(clip).toMatchObject({ format: 'jstimeline/frames', version: 1, width: 3 });
  });

  it('declares its dependencies and no optional one', () => {
    // Act
    const plugin = new FramesClipboardPlugin();

    // Assert
    expect(plugin.id).toBe('frames.clipboard');
    expect(plugin.dependencies).toEqual(['frames.grid', 'frames.selection', 'interaction.shortcuts']);
  });
});

describe('frames.clipboard lifecycle', () => {
  it('forgets the content and removes its shortcuts and service on destroy', () => {
    // Arrange
    const { editor, select, clipboard } = setup();
    select([['a', 1]]);
    clipboard.copy();
    const shortcuts = editor.getService('interaction.shortcuts');

    // Act
    editor.destroy();

    // Assert
    expect(shortcuts?.lookup('Mod+C')).toBeUndefined();
    expect(shortcuts?.lookup('Mod+V')).toBeUndefined();
    expect(clipboard.hasContent()).toBe(false);
  });

  it('undoes what it registered when a shortcut registration throws', () => {
    // Arrange
    const unregisterCopy = jest.fn();
    const unregisterService = jest.fn();
    const register = jest
      .fn()
      .mockReturnValueOnce(unregisterCopy)
      .mockImplementation(() => {
        throw new Error('conflit');
      });
    const services = {
      require: (id: string): unknown => (id === 'interaction.shortcuts' ? { register } : {}),
      provide: () => unregisterService,
      get: () => undefined
    };
    const plugin = new FramesClipboardPlugin();

    // Act
    const init = (): void => plugin.init({ services } as unknown as IEditorContext);

    // Assert
    expect(init).toThrow('conflit');
    expect(unregisterCopy).toHaveBeenCalledTimes(1);
    expect(unregisterService).toHaveBeenCalledTimes(1);
  });
});

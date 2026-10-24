// packages/editor/src/plugins/toolbar/keyframeActions/__tests__/KeyframeActionsPlugin.test.ts
/**
 * Tests de `toolbar.keyframeActions` : les quatre boutons dans la barre
 * d'outils, appel d'un seul service par bouton, boutons indisponibles
 * (`aria-disabled`, infobulle, clavier), aiguillage de « Supprimer »,
 * événement `toolbar:editKeyframe`, suivi des événements et destruction.
 */

import { createManualClock } from '@werddomain/timeline-runtime';
import type { ILayer, ISpan, ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { FramesPlugin } from '../../../frames/FramesPlugin';
import type { IFramesSelectionService } from '../../../frames/selection/types';
import { LayersPlugin } from '../../../layers/LayersPlugin';
import type { ILayerSelectionService } from '../../../layers/selection/types';
import { cleanBody, createContainer } from '../../../layout/__tests__/layoutFixtures';
import { TweensPlugin } from '../../../tweens/TweensPlugin';
import type { MotionTweenEvent } from '../../../tweens/motion/types';
import { toolbarBasePlugins } from '../../__tests__/toolbarFixtures';
import { KeyframeActionsPlugin, KEYFRAME_ACTIONS_PLUGIN_ID } from '../KeyframeActionsPlugin';
import { DELETE_LABELS, LOCKED_REASON, NO_TARGET_REASON } from '../keyframeActionsState';
import type { ToolbarEditKeyframeEvent } from '../types';

afterEach(cleanBody);

function layer(id: string, extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id, spans: [], ...extra };
}

function sample(): ITimelineDocument {
  const layers: LayerNode[] = [
    layer('a', {
      spans: [
        { id: 'a1', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
        { id: 'a2', start: 5, end: 8, kind: 'static', tracks: { x: [{ frame: 5, value: 100 }] } }
      ]
    }),
    layer('b', {
      spans: [
        {
          id: 'b1',
          start: 1,
          end: 6,
          kind: 'tween',
          tracks: { x: [{ frame: 1, value: 1 }, { frame: 3, value: 5 }, { frame: 6, value: 9 }] }
        }
      ]
    }),
    layer('lock', { locked: true, spans: [{ id: 'l1', start: 1, end: 8, kind: 'static' }] })
  ];
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 40 }, layers };
}

/** Observation des effets : les services sont figés, on lit donc leurs effets. */
interface IProbe {
  /** Nombre de `document:changed`. */
  changes: number;
  readonly created: MotionTweenEvent[];
  readonly removed: MotionTweenEvent[];
  readonly refused: string[];
  readonly shape: (layerId: string) => string[];
  readonly propertyFrames: (layerId: string) => number[];
}

interface IHarness {
  readonly editor: IEditor;
  /** Horloge manuelle : `advance` fait le rendu groupé qui émet `playhead:changed`. */
  readonly clock: ReturnType<typeof createManualClock>;
  readonly selection: IFramesSelectionService;
  readonly layers: ILayerSelectionService;
  readonly probe: IProbe;
  readonly edits: ToolbarEditKeyframeEvent[];
  readonly button: (action: string) => HTMLButtonElement;
  readonly control: () => HTMLElement | null;
}

function setup(): IHarness {
  const clock = createManualClock();
  const editor = createEditor(createContainer(), {
    data: sample(),
    clock,
    defaultPlugins: [
      ...toolbarBasePlugins({}, [new KeyframeActionsPlugin()]),
      new LayersPlugin(),
      new FramesPlugin(),
      new TweensPlugin()
    ]
  });
  const selection = editor.getService('frames.selection');
  const layers = editor.getService('layers.selection');
  if (selection === undefined || layers === undefined) {
    throw new Error('montage incomplet');
  }
  const edits: ToolbarEditKeyframeEvent[] = [];
  editor.on('toolbar:editKeyframe', (event) => edits.push(event));
  const spans = (layerId: string): readonly ISpan[] => {
    const node = editor.document.layers.find((candidate) => candidate.id === layerId);
    return node !== undefined && 'spans' in node ? node.spans : [];
  };
  const probe: IProbe = {
    changes: 0,
    created: [],
    removed: [],
    refused: [],
    shape: (layerId) => spans(layerId).map((span) => `${span.kind} ${span.start}-${span.end}`),
    propertyFrames: (layerId) => (spans(layerId)[0]?.tracks?.x ?? []).map((keyframe) => keyframe.frame)
  };
  editor.on('document:changed', () => (probe.changes += 1));
  editor.on('tweens:motionCreated', (event) => probe.created.push(event));
  editor.on('tweens:motionRemoved', (event) => probe.removed.push(event));
  editor.on('command:refused', (event) => probe.refused.push(event.reason));
  const button = (action: string): HTMLButtonElement => {
    const found = editor.container.querySelector<HTMLButtonElement>(`[data-keyframe-action="${action}"]`);
    if (found === null) throw new Error(`bouton ${action} absent`);
    return found;
  };
  const control = (): HTMLElement | null =>
    editor.container.querySelector<HTMLElement>(`[data-toolbar-item="${KEYFRAME_ACTIONS_PLUGIN_ID}"]`);
  return { editor, clock, selection, layers, probe, edits, button, control };
}

const cells = (rowId: string, ...frames: number[]) => frames.map((frame) => ({ rowId, frame }));
/** Durée d'une image d'affichage de l'horloge manuelle. */
const DISPLAY_FRAME_MS = 16;
const disabled = (button: HTMLElement): boolean => button.getAttribute('aria-disabled') === 'true';

describe('rendering', () => {
  it('adds one labelled group control with four buttons in the keyframes group', () => {
    // Act
    const { control, button } = setup();

    // Assert
    const element = control();
    expect(element).not.toBeNull();
    expect(element?.getAttribute('role')).toBe('group');
    expect(element?.getAttribute('aria-label')).toBe('Actions des images clés');
    expect(element?.closest('[data-group]')?.getAttribute('data-group')).toBe('keyframes');
    expect(Array.from(element?.querySelectorAll('button') ?? []).map((item) => item.dataset.keyframeAction)).toEqual([
      'insert',
      'createTween',
      'delete',
      'edit'
    ]);
    expect(button('insert').getAttribute('aria-label')).toBe('Ajouter une image clé');
    expect(button('createTween').getAttribute('aria-label')).toBe('Créer une interpolation de mouvement');
    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.generic);
    expect(button('edit').getAttribute('aria-label')).toBe("Modifier l'image clé");
  });

  it('gives each button its type, shared classes, a stable class and a hidden icon', () => {
    // Act
    const { button } = setup();

    // Assert
    (['insert', 'createTween', 'delete', 'edit'] as const).forEach((action) => {
      const item = button(action);
      expect(item.type).toBe('button');
      expect(item.classList.contains('jt-toolbar__button')).toBe(true);
      expect(item.classList.contains(`jt-keyframeActions__${action}`)).toBe(true);
      expect(item.querySelector('.jt-toolbar__icon')?.getAttribute('aria-hidden')).toBe('true');
      expect(item.hasAttribute('disabled')).toBe(false);
    });
  });

  it('starts with every button unavailable, with the reason as title', () => {
    // Act
    const { button } = setup();

    // Assert
    expect(disabled(button('insert'))).toBe(true);
    expect(button('insert').title).toBe(NO_TARGET_REASON);
    expect(disabled(button('edit'))).toBe(true);
    expect(disabled(button('delete'))).toBe(true);
    expect(disabled(button('createTween'))).toBe(true);
    expect(button('createTween').title).toBe('Aucune image clé sélectionnée');
  });

  it('registers no shortcut of its own', () => {
    // Act
    const { editor } = setup();
    const shortcuts = editor.getService('interaction.shortcuts');

    // Assert
    expect(shortcuts?.list().filter((item) => item.id.startsWith('toolbar.keyframeActions'))).toEqual([]);
    expect(shortcuts?.list().filter((item) => item.id.startsWith('toolbar'))).toEqual([]);
  });
});

describe('buttons run exactly their service', () => {
  it('insert inserts a keyframe once and nothing else', () => {
    // Arrange
    const { selection, probe, button } = setup();
    selection.set(cells('a', 3));

    // Act
    button('insert').click();

    // Assert
    expect(probe.shape('a')).toEqual(['static 1-2', 'static 3-4', 'static 5-8']);
    expect(probe.changes).toBe(1);
    expect(probe.created).toEqual([]);
    expect(probe.removed).toEqual([]);
  });

  it('shows the shortcut hint in the title of insert and delete when available', () => {
    // Arrange
    const { selection, button } = setup();

    // Act
    selection.set(cells('a', 5));

    // Assert
    expect(button('insert').title).toMatch(/^Ajouter une image clé \(.*F6\)$/);
    expect(button('delete').title).toMatch(/^Supprimer l'image clé \(.*F6\)$/);
    expect(button('edit').title).toBe("Modifier l'image clé");
  });

  it('create tween creates one tween and nothing else', () => {
    // Arrange
    const { selection, probe, button } = setup();
    selection.set(cells('a', 5));

    expect(disabled(button('createTween'))).toBe(false);

    // Act
    button('createTween').click();

    // Assert
    expect(probe.created).toHaveLength(1);
    expect(probe.shape('a')).toEqual(['static 1-4', 'tween 5-8']);
    expect(probe.changes).toBe(1);
  });

  it('delete runs deleteKeyframe on a plain keyframe', () => {
    // Arrange
    const { selection, probe, button } = setup();
    selection.set(cells('a', 5));

    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.keyframe);

    // Act
    button('delete').click();

    // Assert
    expect(probe.shape('a')).toEqual(['static 1-8']);
    expect(probe.removed).toEqual([]);
    expect(probe.changes).toBe(1);
  });

  it('delete removes the tween when plain tween cells are selected', () => {
    // Arrange
    const { selection, probe, button } = setup();
    selection.set(cells('b', 2, 4));

    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.tween);
    expect(button('delete').title).toBe(DELETE_LABELS.tween);

    // Act
    button('delete').click();

    // Assert
    expect(probe.removed).toHaveLength(1);
    expect(probe.shape('b')).toEqual(['static 1-6']);
    expect(probe.changes).toBe(1);
  });

  it('delete routes a property keyframe to deleteKeyframe, even mixed with tween cells', () => {
    // Arrange
    const { selection, probe, button } = setup();
    selection.set([...cells('b', 2, 3), ...cells('a', 5)]);

    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.property);

    // Act
    button('delete').click();

    // Assert
    expect(probe.removed).toEqual([]);
    expect(probe.shape('b')).toEqual(['tween 1-6']);
    expect(probe.shape('a')).toEqual(['static 1-8']);
    expect(probe.propertyFrames('b')).toEqual([1, 6]);
    expect(probe.changes).toBe(1);
  });

  it('edit emits toolbar:editKeyframe with inTween false then true and changes nothing', () => {
    // Arrange
    const { selection, edits, probe, button } = setup();

    // Act
    selection.set(cells('a', 5));
    button('edit').click();
    selection.set(cells('b', 3));
    button('edit').click();

    // Assert
    expect(edits).toEqual([
      { layerId: 'a', frame: 5, inTween: false },
      { layerId: 'b', frame: 3, inTween: true }
    ]);
    expect(probe.changes).toBe(0);
  });
});

describe('edit targets a keyframe', () => {
  it('is unavailable on a plain frame and explains why', () => {
    // Arrange
    const { selection, edits, button } = setup();

    // Act
    selection.set(cells('a', 3));
    button('edit').click();

    // Assert
    expect(disabled(button('edit'))).toBe(true);
    expect(button('edit').title).toBe('Sélectionnez une image clé.');
    expect(edits).toEqual([]);
  });

  it('uses the playhead on a selected layer only when it is on a keyframe', () => {
    // Arrange
    const { editor, clock, layers, edits, button } = setup();
    layers.select(['a']);

    // Act
    editor.playback.seek(5);
    clock.advance(DISPLAY_FRAME_MS);
    const onKeyframe = !disabled(button('edit'));
    button('edit').click();
    editor.playback.seek(3);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(onKeyframe).toBe(true);
    expect(edits).toEqual([{ layerId: 'a', frame: 5, inTween: false }]);
    expect(disabled(button('edit'))).toBe(true);
  });
});

describe('unavailable buttons', () => {
  it('do nothing on click, Enter or Space, and stay focusable', () => {
    // Arrange
    const { edits, probe, button, editor } = setup();

    // Act
    (['insert', 'createTween', 'delete', 'edit'] as const).forEach((action) => {
      const item = button(action);
      item.focus();
      item.click();
      [' ', 'Enter'].forEach((key) =>
        item.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      );
      expect(item.hasAttribute('disabled')).toBe(false);
      expect(item.getAttribute('tabindex')).toBeNull();
      expect(editor.container.ownerDocument.activeElement).toBe(item);
    });

    // Assert
    expect(probe.changes).toBe(0);
    expect(probe.refused).toEqual([]);
    expect(probe.created).toEqual([]);
    expect(probe.removed).toEqual([]);
    expect(edits).toEqual([]);
  });

  it('expose the reason with aria-description, cleared when available', () => {
    // Arrange
    const { selection, button } = setup();
    const initial = button('insert').getAttribute('aria-description');

    // Act
    selection.set(cells('a', 5));
    const enabled = button('insert').getAttribute('aria-description');
    selection.set(cells('lock', 2));

    // Assert
    expect(initial).toBe(NO_TARGET_REASON);
    expect(enabled).toBeNull();
    expect(button('insert').getAttribute('aria-description')).toBe(LOCKED_REASON);
  });

  it('prevent the keyboard activation of an aria-disabled button', () => {
    // Arrange
    const { button } = setup();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    // Act
    button('insert').dispatchEvent(event);

    // Assert
    expect(event.defaultPrevented).toBe(true);
  });

  it('explain a locked row in the title', () => {
    // Arrange
    const { selection, button } = setup();

    // Act
    selection.set(cells('lock', 2));

    // Assert
    expect(disabled(button('insert'))).toBe(true);
    expect(button('insert').title).toBe(LOCKED_REASON);
    expect(disabled(button('edit'))).toBe(true);
    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.generic);
  });
});

describe('following the editor', () => {
  it('updates on frames:selectionChanged', () => {
    // Arrange
    const { selection, button } = setup();

    // Act
    selection.set(cells('a', 5));
    const enabled = !disabled(button('insert'));
    selection.clear();

    // Assert
    expect(enabled).toBe(true);
    expect(disabled(button('insert'))).toBe(true);
  });

  it('updates on layers:selectionChanged (playhead fallback)', () => {
    // Arrange
    const { layers, button } = setup();

    // Act
    layers.select(['a']);

    // Assert
    expect(disabled(button('insert'))).toBe(false);
    expect(button('insert').title).not.toBe(NO_TARGET_REASON);
  });

  it('updates on document:changed', () => {
    // Arrange
    const { editor, selection, button } = setup();
    selection.set(cells('b', 2));
    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.tween);

    // Act
    editor.getService('tweens.motion')?.remove();

    // Assert
    expect(button('delete').getAttribute('aria-label')).toBe(DELETE_LABELS.keyframe);
  });

  it('updates on document:loaded', () => {
    // Arrange
    const { editor, selection, button } = setup();
    selection.set(cells('a', 5));
    expect(disabled(button('insert'))).toBe(false);

    // Act
    editor.load({ version: '2.0.0', settings: { fps: 24, totalFrames: 40 }, layers: [] });

    // Assert
    expect(disabled(button('insert'))).toBe(true);
  });

  it('updates on tweens:motionAvailabilityChanged', () => {
    // Arrange
    const { editor, button } = setup();
    const refresh = jest.fn();
    editor.on('tweens:motionAvailabilityChanged', refresh);

    // Act
    editor.getService('frames.selection')?.set(cells('a', 5));

    // Assert
    expect(refresh).toHaveBeenCalled();
    expect(disabled(button('createTween'))).toBe(false);
  });

  it.todo('keeps createTween enabled right after a create on {k1,k2} (pending W1 issue)');
});

describe('destroy', () => {
  it('removes the control and ignores a click on the detached button', () => {
    // Arrange
    const { editor, selection, probe, button } = setup();
    selection.set(cells('a', 5));
    const container = editor.container;
    const detached = button('insert');

    // Act
    editor.destroy();
    detached.click();

    // Assert
    expect(container.querySelector('[data-toolbar-item="toolbar.keyframeActions"]')).toBeNull();
    expect(probe.changes).toBe(0);
  });

  it('rolls back what init did when it throws', () => {
    // Arrange
    const container = createContainer();

    // Act
    const create = (): IEditor =>
      createEditor(container, {
        data: sample(),
        defaultPlugins: [...toolbarBasePlugins({}, [new KeyframeActionsPlugin()]), new LayersPlugin(), new FramesPlugin()]
      });

    // Assert
    expect(create).toThrow();
    expect(container.querySelector('[data-toolbar-item="toolbar.keyframeActions"]')).toBeNull();
  });
});

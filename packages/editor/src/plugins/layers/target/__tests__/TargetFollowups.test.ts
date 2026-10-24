// packages/editor/src/plugins/layers/target/__tests__/TargetFollowups.test.ts
/**
 * Suivis de Y4 : scène d'une ref saisie (première scène préréglée avec
 * plusieurs scènes, scène inconnue corrigeable avec une seule scène, ref
 * préremplie sans scène gardée telle quelle), reconstruction de la fenêtre
 * qui garde la saisie et ne vole pas le focus, Tab qui rend le focus au
 * bouton de la ligne, et nettoyage complet du plugin à sa destruction.
 */

import { createManualClock } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerTarget } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import { defaultPlugins } from '../../../../core/editor/defaultPlugins';
import { LayersPlugin } from '../../LayersPlugin';
import { TargetPlugin } from '../TargetPlugin';
import { createFakeStage, createTargetDocument, flushPromises, mountTarget, popup, press, targetButton, unmountTargets } from './fixtures';

afterEach(unmountTargets);

function withHeroTarget(target: LayerTarget): ITimelineDocument {
  const data = createTargetDocument();
  return { ...data, layers: data.layers.map((node) => (node.id === 'hero' && node.type === 'layer' ? { ...node, target } : node)) };
}

function open(host: HTMLElement, id: string): HTMLElement {
  targetButton(host, id).click();
  const dialog = popup(host);
  if (dialog === null) throw new Error('fenêtre absente');
  return dialog;
}

function field<T extends HTMLElement>(dialog: HTMLElement, part: string): T {
  const element = dialog.querySelector<T>(`.jt-target-popup__${part}`);
  if (element === null) throw new Error(`partie ${part} absente`);
  return element;
}

function submit(dialog: HTMLElement): void {
  field<HTMLFormElement>(dialog, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('stage of a typed ref', () => {
  it('preselects the first stage with several stages, so a typed ref is scoped', () => {
    // Arrange
    const { editor, host } = mountTarget({ stage: [createFakeStage('canvas'), createFakeStage('audio', false)] });
    const dialog = open(host, 'bare');

    // Act
    field<HTMLSelectElement>(dialog, 'kind').value = 'ref';
    field<HTMLInputElement>(dialog, 'text').value = 'hero';
    submit(dialog);

    // Assert
    expect(editor.document.layers[1]).toMatchObject({ target: { ref: 'hero', stage: 'canvas' } });
  });

  it('shows the stage list for an unknown stage with a single stage, so the alert can be fixed', () => {
    // Arrange
    const element = document.createElement('div');
    element.setAttribute('data-timeline-target', 'hero');
    document.body.appendChild(element);
    const { editor, host, service } = mountTarget({ stage: undefined }, withHeroTarget({ ref: 'hero', stage: 'canvas' }));
    const missingBefore = service.alert('hero').missing;
    const dialog = open(host, 'hero');
    const stageSelect = field<HTMLSelectElement>(dialog, 'stage');

    // Act
    const optionsShown = Array.from(stageSelect.options).map((option) => option.value);
    stageSelect.value = 'html';
    submit(dialog);

    // Assert
    expect(missingBefore).toBe(true);
    expect(optionsShown).toEqual(['html', 'canvas', '']);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'html' } });
    expect(service.alert('hero').missing).toBe(false);
  });

  it('scopes a stageless prefilled ref the only stage does not accept, so the alert clears', () => {
    // Arrange
    const element = document.createElement('div');
    element.setAttribute('data-timeline-target', 'a');
    document.body.appendChild(element);
    const { editor, host, service } = mountTarget({ stage: undefined }, withHeroTarget({ ref: 'a' }));
    const missingBefore = service.alert('hero').missing;

    // Act
    submit(open(host, 'hero'));

    // Assert
    expect(missingBefore).toBe(true);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'a', stage: 'html' } });
    expect(service.alert('hero').missing).toBe(false);
  });

  it('keeps a stageless prefilled ref unchanged when the only stage accepts it', () => {
    // Arrange
    const { editor, host } = mountTarget({}, withHeroTarget({ ref: 'hero' }));

    // Act
    submit(open(host, 'hero'));

    // Assert
    expect(editor.canUndo).toBe(false);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero' } });
  });
});

describe('popup rebuild and Tab', () => {
  it('keeps the typed text and the focused field when rebuilt, and does not steal the focus otherwise', () => {
    // Arrange
    const { host, service } = mountTarget();
    const dialog = open(host, 'hero');
    const text = field<HTMLInputElement>(dialog, 'text');
    text.value = 'brouillon';
    text.dispatchEvent(new Event('input'));
    text.focus();

    // Act
    service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    const rebuilt = popup(host);
    const keptText = rebuilt === null ? '' : field<HTMLInputElement>(rebuilt, 'text').value;
    const focused = document.activeElement;
    const outside = document.body.appendChild(document.createElement('button'));
    outside.focus();
    service.setTarget('hero', { ref: 'tree', stage: 'canvas' });

    // Assert
    expect(keptText).toBe('brouillon');
    expect(focused).toBe(rebuilt === null ? null : field(rebuilt, 'text'));
    expect(document.activeElement).toBe(outside);
  });

  it('closes on Tab from the last field and gives the focus back to the row button', () => {
    // Arrange
    const { host } = mountTarget();
    const dialog = open(host, 'hero');
    const apply = field<HTMLButtonElement>(dialog, 'apply');
    apply.focus();

    // Act
    const event = press(apply, 'Tab');

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(popup(host)).toBeNull();
    expect(document.activeElement).toBe(targetButton(host, 'hero'));
  });
});

describe('TargetPlugin destroy', () => {
  it('removes its service, its row controls and every document listener of an open popup', () => {
    // Arrange
    const plugins = defaultPlugins();
    const layers = plugins.find((plugin): plugin is LayersPlugin => plugin instanceof LayersPlugin);
    const target = layers?.children.find((plugin): plugin is TargetPlugin => plugin instanceof TargetPlugin);
    if (target === undefined) throw new Error('layers.target absent');
    let context: IEditorContext | undefined;
    const capture: EditorPlugin = { id: 'test.capture', dependencies: [], init: (ctx) => void (context = ctx), destroy: () => undefined };
    const signals: AbortSignal[] = [];
    const original = document.addEventListener.bind(document);
    const addListener = jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (typeof options === 'object' && options?.signal !== undefined) signals.push(options.signal);
      original(type, listener, options);
    });
    const host = document.body.appendChild(document.createElement('section'));
    const editor = createEditor(host, {
      data: createTargetDocument(), clock: createManualClock(), stage: createFakeStage(),
      defaultPlugins: plugins, plugins: [capture]
    });
    const service = editor.getService('layers.target');
    if (service === undefined || !service.open('hero')) throw new Error('fenêtre non ouverte');

    try {
      // Act
      target.destroy();

      // Assert
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(context?.services.get('layers.target')).toBeUndefined();
      expect(host.querySelector('.jt-layer-target')).toBeNull();
      expect(popup(host)).toBeNull();
    } finally {
      addListener.mockRestore();
      editor.destroy();
    }
  });
});

describe('#87 regressions', () => {
  it('fills the rebuilt form with the new target when the user typed nothing', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    const dialog = open(host, 'hero');
    field<HTMLButtonElement>(dialog, 'apply').focus();

    // Act
    editor.undo();
    const rebuilt = popup(host);

    // Assert
    expect(rebuilt === null ? '' : field<HTMLInputElement>(rebuilt, 'text').value).toBe('hero');
    expect(editor.canRedo).toBe(true);
  });

  it('rebuilds when a pick ends without applying, after a change during the pick', async () => {
    // Arrange
    const stage = createFakeStage();
    const { host, service } = mountTarget({ stage });
    const dialog = open(host, 'hero');
    field<HTMLButtonElement>(dialog, 'pick').click();

    // Act
    service.setTarget('hero', { ref: 'tree', stage: 'canvas' });
    const staleDuringPick = popup(host) === dialog;
    press(document.body, 'Escape');
    const rebuilt = popup(host);

    // Assert
    expect(stage.picks).toHaveLength(1);
    expect(staleDuringPick).toBe(true);
    expect(rebuilt).not.toBe(dialog);
    expect(rebuilt === null ? '' : field<HTMLInputElement>(rebuilt, 'text').value).toBe('tree');
  });

  it('rebuilds after a rejected pick following undo without discarding redo', async () => {
    // Arrange
    const stage = createFakeStage();
    const { editor, host, service } = mountTarget({ stage });
    expect(service.setTarget('hero', { ref: 'sun', stage: 'canvas' })).toBe(true);
    const dialog = open(host, 'hero');
    expect(field<HTMLInputElement>(dialog, 'text').value).toBe('sun');
    field<HTMLButtonElement>(dialog, 'pick').click();
    expect(stage.picks).toHaveLength(1);

    // Act
    expect(editor.undo()).toBe(true);
    expect(editor.canRedo).toBe(true);
    stage.picks[0]?.reject(new Error('Stage pick failed'));
    await flushPromises();
    const rebuilt = popup(host);
    if (rebuilt === null) throw new Error('fenêtre absente après le choix');

    // Assert
    expect(field<HTMLInputElement>(rebuilt, 'text').value).toBe('hero');
    expect(rebuilt === dialog).toBe(false);
    expect(document.activeElement).toBe(field<HTMLButtonElement>(rebuilt, 'pick'));
    submit(rebuilt);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'canvas' } });
    expect(editor.canRedo).toBe(true);
    expect(editor.redo()).toBe(true);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'sun', stage: 'canvas' } });
  });

  it('preselects the first stage for a stageless ref that no stage accepts', () => {
    // Arrange
    const scoped = (id: string): ReturnType<typeof createFakeStage> => ({ ...createFakeStage(id), accepts: (target) => 'ref' in target && target.stage === id });
    const { host } = mountTarget({ stage: [scoped('canvas'), scoped('audio')] }, withHeroTarget({ ref: 'hero' }));

    // Act
    const dialog = open(host, 'hero');

    // Assert
    expect(field<HTMLSelectElement>(dialog, 'stage').value).toBe('canvas');
  });
});

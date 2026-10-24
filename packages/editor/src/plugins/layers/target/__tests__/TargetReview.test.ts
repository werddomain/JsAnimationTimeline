// packages/editor/src/plugins/layers/target/__tests__/TargetReview.test.ts
/**
 * Retour de l'intégrateur sur `layers.target` : ref saisie rattachée à la
 * scène HTML réelle (et scène courante gardée, sans entrée d'historique),
 * clic sur une zone non focalisable de la fenêtre, refus d'une commande
 * affiché, `setTarget` qui ne lève jamais, focus après une fermeture forcée
 * ou un choix annulé, touches du bouton de ligne, fenêtre reconstruite après
 * annuler, et raison « erreur de la scène ».
 */

import { isRefTarget, refStage } from '@werddomain/timeline-runtime';
import type { IStage, ITimelineDocument, LayerTarget } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../../core/commands/createCommand';
import type { EditorPlugin } from '../../../../core/context/IEditorContext';
import { TargetAlertLabels } from '../targetAlert';
import { TARGET_CANCELLED_MESSAGE } from '../TargetPlugin';
import {
  createFakeStage,
  createTargetDocument,
  flushPromises,
  mountTarget,
  popup,
  targetButton,
  unmountTargets
} from './fixtures';

afterEach(unmountTargets);

function open(host: HTMLElement, id: string): HTMLElement {
  targetButton(host, id).click();
  const dialog = popup(host);
  if (dialog === null) throw new Error('fenêtre absente');
  return dialog;
}

/** Document des fixtures, la cible du calque `hero` remplacée par `target`. */
function withHeroTarget(target: LayerTarget): ITimelineDocument {
  const data = createTargetDocument();
  return {
    ...data,
    layers: data.layers.map((node) => (node.id === 'hero' && node.type === 'layer' ? { ...node, target } : node))
  };
}

function submitRef(dialog: HTMLElement, text?: string): void {
  const kind = dialog.querySelector<HTMLSelectElement>('.jt-target-popup__kind');
  const input = dialog.querySelector<HTMLInputElement>('.jt-target-popup__text');
  const form = dialog.querySelector<HTMLFormElement>('.jt-target-popup__form');
  if (kind === null || input === null || form === null) throw new Error('formulaire incomplet');
  kind.value = 'ref';
  kind.dispatchEvent(new Event('change'));
  if (text !== undefined) input.value = text;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('typed refs and their stage', () => {
  it('scopes a typed ref to the only stage, so the default HTML stage resolves it', () => {
    // Arrange
    const element = document.createElement('div');
    element.setAttribute('data-timeline-target', 'hero');
    document.body.appendChild(element);
    const { editor, host, service } = mountTarget({ stage: undefined });

    // Act
    submitRef(open(host, 'bare'), 'hero');

    // Assert
    expect(editor.document.layers[1]).toMatchObject({ target: { ref: 'hero', stage: 'html' } });
    expect(editor.stage.missingTargets).not.toContain('bare');
    expect(service.alert('bare').missing).toBe(false);
  });

  it('keeps the stage of the current target when the prefilled ref is applied (no history entry)', () => {
    // Arrange
    const { editor, host } = mountTarget({ stage: undefined }, withHeroTarget({ ref: 'hero', stage: 'html' }));

    // Act
    const dialog = open(host, 'hero');
    dialog.querySelector<HTMLFormElement>('.jt-target-popup__form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    // Assert
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'html' } });
    expect(editor.canUndo).toBe(false);
    expect(popup(host)).toBeNull();
  });

  it('keeps a current stage missing from the stage list', () => {
    // Arrange
    const stages = [createFakeStage('canvas'), createFakeStage('audio', false)];
    const { editor, host } = mountTarget({ stage: stages }, withHeroTarget({ ref: 'hero', stage: 'old' }));

    // Act
    const dialog = open(host, 'hero');
    const stageSelect = dialog.querySelector<HTMLSelectElement>('.jt-target-popup__stage');
    dialog.querySelector<HTMLFormElement>('.jt-target-popup__form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    // Assert
    expect(stageSelect?.value).toBe('old');
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'old' } });
    expect(editor.canUndo).toBe(false);
  });
});

describe('clicks inside the popup', () => {
  it('keeps the focus on mousedown outside the fields, and stays open when the editor root takes the focus', () => {
    // Arrange
    const { editor, host } = mountTarget();
    const dialog = open(host, 'hero');
    const input = dialog.querySelector<HTMLInputElement>('.jt-target-popup__text');

    // Act
    const onPadding = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    dialog.dispatchEvent(onPadding);
    const onInput = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    input?.dispatchEvent(onInput);
    dialog.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: editor.container }));
    expect(popup(host)).not.toBeNull();
    const sun = Array.from(dialog.querySelectorAll<HTMLButtonElement>('.jt-target-popup__option'))[2];
    sun?.click();

    // Assert
    expect(onPadding.defaultPrevented).toBe(true);
    expect(onInput.defaultPrevented).toBe(false);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'sun', stage: 'canvas' } });
  });
});

describe('refused commands and the service', () => {
  it('shows the refusal and keeps the popup open when a plugin vetoes the command', () => {
    // Arrange
    const veto: EditorPlugin = {
      id: 'test.veto',
      dependencies: [],
      init: (ctx) => void ctx.events.onCancellable('command:before', (event) => event.cancel()),
      destroy: () => undefined
    };
    const { editor, host } = mountTarget({ plugins: [veto] });
    const dialog = open(host, 'hero');

    // Act
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('.jt-target-popup__option'))[2]?.click();

    // Assert
    expect(popup(host)).not.toBeNull();
    expect(dialog.querySelector('[role="status"]')?.textContent).toBe(TARGET_CANCELLED_MESSAGE);
    expect(editor.canUndo).toBe(false);
  });

  it('never throws from setTarget, even with a throwing getter', () => {
    // Arrange
    const { service } = mountTarget();
    const hostile = Object.defineProperty({}, 'ref', {
      enumerable: true,
      get: () => {
        throw new Error('accesseur');
      }
    });

    // Act
    const act = (): boolean => service.setTarget('hero', hostile);

    // Assert
    expect(act).not.toThrow();
    expect(act()).toBe(false);
  });
});

describe('focus after the popup closes', () => {
  it('goes back to the row button on a forced close, or to the editor when the row is gone', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    const button = targetButton(host, 'hero');
    open(host, 'hero');

    // Act
    service.close();
    const afterClose = document.activeElement;
    open(host, 'hero');
    editor.execute(createCommand('Supprimer', (doc) => ({ ...doc, layers: doc.layers.slice(1) }), (doc) => doc));

    // Assert
    expect(afterClose).toBe(button);
    expect(popup(host)).toBeNull();
    expect(document.activeElement).toBe(editor.container);
  });

  it('goes back to the pick button when the pick is cancelled', async () => {
    // Arrange
    const stage = createFakeStage();
    const { host } = mountTarget({ stage });
    const dialog = open(host, 'hero');
    const pick = dialog.querySelector<HTMLButtonElement>('.jt-target-popup__pick');
    pick?.click();
    const canvas = document.body.appendChild(document.createElement('canvas'));
    canvas.tabIndex = 0;
    canvas.focus();

    // Act
    stage.picks[0]?.resolve(null);
    await flushPromises();

    // Assert
    expect(stage.picks).toHaveLength(1);
    expect(document.activeElement).toBe(pick);
  });
});

describe('row button keys', () => {
  it('stops only Enter and Space, so the arrows reach the row', () => {
    // Arrange
    const { host } = mountTarget();
    const reached: string[] = [];
    const listener = (event: KeyboardEvent): void => void reached.push(event.key);
    document.addEventListener('keydown', listener);
    const button = targetButton(host, 'hero');

    try {
      // Act
      ['ArrowDown', 'Enter', ' '].forEach((key) =>
        button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));

      // Assert
      expect(reached).toEqual(['ArrowDown']);
    } finally {
      document.removeEventListener('keydown', listener);
    }
  });
});

describe('open popup follows the document', () => {
  it('is rebuilt with the current target after an undo', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    open(host, 'hero');

    // Act
    editor.undo();
    const dialog = popup(host);
    const pressed = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('.jt-target-popup__option[aria-pressed="true"]') ?? []);

    // Assert
    expect(dialog).not.toBeNull();
    expect(pressed.map((button) => button.textContent)).toEqual(['Objet hero']);
  });
});

describe('external changes while the popup is open', () => {
  it('rebuilds the popup after a setTarget from the service', () => {
    // Arrange
    const { host, service } = mountTarget();
    open(host, 'hero');

    // Act
    service.setTarget('hero', { ref: 'tree', stage: 'canvas' });
    const pressed = Array.from(popup(host)?.querySelectorAll<HTMLButtonElement>('.jt-target-popup__option[aria-pressed="true"]') ?? []);

    // Assert
    expect(pressed.map((button) => button.textContent)).toEqual(['Objet tree']);
  });
});

describe('alert reason for a stage error', () => {
  it('labels a target whose resolve threw as a stage error', () => {
    // Arrange
    const throwing: IStage<string> = {
      ...createFakeStage(),
      accepts: refStage('canvas', { unscoped: true }),
      resolve: (target) => {
        if (isRefTarget(target) && target.ref === 'boom') throw new Error('resolve');
        return null;
      }
    };
    const { service } = mountTarget({ stage: throwing, onStageError: () => undefined });

    // Act
    service.setTarget('hero', { ref: 'boom', stage: 'canvas' });

    // Assert
    expect(service.alert('hero')).toEqual({ missing: true, reason: 'stage-error', label: TargetAlertLabels.stageError });
  });
});

// packages/editor/src/plugins/layers/target/__tests__/TargetPopup.test.ts
/**
 * Fenêtre de choix de `layers.target` : `role=dialog`, liste des cibles de la
 * scène avec les libellés de `describe`, choix d'une cible (une entrée
 * d'historique, fermeture, focus rendu au bouton), saisie libre (sélecteur,
 * ref, scène quand il y en a plusieurs), fermeture par Échap, Tab et clic
 * extérieur, touches gardées hors des raccourcis sauf Ctrl+Z, et choix sur la
 * scène (`pick` : résultat appliqué, annulé, abandonné par Échap ou par la
 * destruction, absent, ou cible vivante refusée).
 */

import { createFakeStage, flushPromises, mountTarget, popup, press, targetButton, unmountTargets } from './fixtures';

afterEach(unmountTargets);

function open(host: HTMLElement, id = 'hero'): HTMLElement {
  targetButton(host, id).click();
  const dialog = popup(host);
  if (dialog === null) throw new Error('fenêtre absente');
  return dialog;
}

function pickButton(dialog: HTMLElement): HTMLButtonElement {
  const button = dialog.querySelector('.jt-target-popup__pick');
  if (!(button instanceof HTMLButtonElement)) throw new Error('bouton « Choisir sur la scène » absent');
  return button;
}

describe('target popup: list and free entry', () => {
  it('opens a dialog listing the stage targets with their describe labels', () => {
    // Arrange
    const { host } = mountTarget();

    // Act
    const dialog = open(host);
    const options = Array.from(dialog.querySelectorAll<HTMLButtonElement>('.jt-target-popup__option'));

    // Assert
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Cible de « Héros »');
    expect(options.map((option) => option.textContent)).toEqual(['Objet hero', 'Objet tree', 'Objet sun']);
    expect(options[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(options[0]);
  });

  it('applies a listed target in one undo step, closes and gives focus back', () => {
    // Arrange
    const { editor, host } = mountTarget();
    const dialog = open(host);
    const sun = Array.from(dialog.querySelectorAll<HTMLButtonElement>('.jt-target-popup__option'))[2];

    // Act
    sun?.click();

    // Assert
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'sun', stage: 'canvas' } });
    expect(popup(host)).toBeNull();
    expect(document.activeElement).toBe(targetButton(host, 'hero'));
    editor.undo();
    expect(editor.canUndo).toBe(false);
  });

  it('applies a typed selector or ref, with a stage choice only when there are several stages', () => {
    // Arrange
    const { editor, host } = mountTarget({ stage: [createFakeStage('canvas'), createFakeStage('audio', false)] });
    const dialog = open(host, 'bare');
    const kind = dialog.querySelector<HTMLSelectElement>('.jt-target-popup__kind');
    const text = dialog.querySelector<HTMLInputElement>('.jt-target-popup__text');
    const stage = dialog.querySelector<HTMLSelectElement>('.jt-target-popup__stage');
    const form = dialog.querySelector<HTMLFormElement>('.jt-target-popup__form');
    if (kind === null || text === null || stage === null || form === null) throw new Error('formulaire incomplet');

    // Act
    kind.value = 'ref';
    kind.dispatchEvent(new Event('change'));
    text.value = '  music ';
    stage.value = 'audio';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Assert
    expect(editor.document.layers[1]).toMatchObject({ target: { ref: 'music', stage: 'audio' } });
    expect(popup(host)).toBeNull();
  });

  it('hides the stage choice with a single stage and keeps the popup open on empty text', () => {
    // Arrange
    const { editor, host } = mountTarget();
    const dialog = open(host, 'bare');
    const form = dialog.querySelector<HTMLFormElement>('.jt-target-popup__form');

    // Act
    form?.dispatchEvent(new Event('submit', { cancelable: true }));

    // Assert
    expect(dialog.querySelector('.jt-target-popup__stage')).toBeNull();
    expect(popup(host)).not.toBeNull();
    expect(dialog.querySelector('[role="status"]')?.textContent).not.toBe('');
    expect(editor.canUndo).toBe(false);
  });
});

describe('target popup: closing and keys', () => {
  it('closes on Escape and gives focus back to the row button', () => {
    // Arrange
    const { host } = mountTarget();
    const dialog = open(host);

    // Act
    press(dialog.querySelector('button') ?? dialog, 'Escape');

    // Assert
    expect(popup(host)).toBeNull();
    expect(document.activeElement).toBe(targetButton(host, 'hero'));
  });

  it('closes on an outside pointerdown and when focus leaves with Tab', () => {
    // Arrange
    const { host } = mountTarget();
    open(host);

    // Act
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const closedByClick = popup(host) === null;
    const dialog = open(host);
    dialog.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));

    // Assert
    expect(closedByClick).toBe(true);
    expect(popup(host)).toBeNull();
  });

  it('keeps its keys from the editor shortcuts but lets Ctrl+Z through', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    const dialog = open(host);
    const reached: string[] = [];
    const listener = (event: KeyboardEvent): void => void reached.push(event.key);
    document.addEventListener('keydown', listener);

    try {
      // Act
      press(pickButton(dialog), 'Delete');
      press(pickButton(dialog), 'z', { ctrlKey: true });

      // Assert
      expect(reached).toEqual(['z']);
      expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'canvas' } });
      expect(popup(host)).not.toBeNull();
    } finally {
      document.removeEventListener('keydown', listener);
    }
  });
});

describe('target popup: pick on the stage', () => {
  it('applies the picked target', async () => {
    // Arrange
    const stage = createFakeStage();
    const { editor, host } = mountTarget({ stage });
    const dialog = open(host);

    // Act
    pickButton(dialog).click();
    stage.picks[0]?.resolve({ ref: 'tree', stage: 'canvas' });
    await flushPromises();

    // Assert
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'tree', stage: 'canvas' } });
    expect(popup(host)).toBeNull();
  });

  it('changes nothing when the pick is cancelled', async () => {
    // Arrange
    const stage = createFakeStage();
    const { editor, host } = mountTarget({ stage });
    const dialog = open(host);

    // Act
    pickButton(dialog).click();
    stage.picks[0]?.resolve(null);
    await flushPromises();

    // Assert
    expect(editor.canUndo).toBe(false);
    expect(popup(host)).not.toBeNull();
  });

  it('keeps the popup open on an outside click while picking, and aborts the pick on Escape', async () => {
    // Arrange
    const stage = createFakeStage();
    const { editor, host } = mountTarget({ stage });
    const dialog = open(host);
    pickButton(dialog).click();

    // Act
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const openWhilePicking = popup(host) !== null;
    press(document.body, 'Escape');
    stage.picks[0]?.resolve({ ref: 'tree', stage: 'canvas' });
    await flushPromises();

    // Assert
    expect(openWhilePicking).toBe(true);
    expect(stage.picks[0]?.signal?.aborted).toBe(true);
    expect(editor.canUndo).toBe(false);
  });

  it('aborts the pick when the editor is destroyed', () => {
    // Arrange
    const stage = createFakeStage();
    const { editor, host } = mountTarget({ stage });
    pickButton(open(host)).click();

    // Act
    editor.destroy();

    // Assert
    expect(stage.picks[0]?.signal?.aborted).toBe(true);
    expect(popup(host)).toBeNull();
  });

  it('refuses a live element returned by pick', async () => {
    // Arrange
    const stage = createFakeStage();
    const { editor, host } = mountTarget({ stage });
    const dialog = open(host);

    // Act
    pickButton(dialog).click();
    stage.picks[0]?.resolve({ element: document.createElement('div') });
    await flushPromises();

    // Assert
    expect(editor.canUndo).toBe(false);
    expect(dialog.querySelector('[role="status"]')?.textContent).toMatch(/enregistr/);
  });

  it('disables the pick button when no stage can pick', () => {
    // Arrange
    const stage = createFakeStage('canvas', false);
    const { host } = mountTarget({ stage });
    const button = pickButton(open(host));

    // Act
    button.click();

    // Assert
    expect(button.disabled).toBe(true);
    expect(stage.picks).toHaveLength(0);
  });
});

// packages/editor/src/plugins/toolbar/timeSettings/__tests__/TimeSettingsPlugin.test.ts
/**
 * Tests de `toolbar.timeSettings` : champs de cadence et de durée dans la
 * barre d'outils, application par commande annulable, champs qui suivent le
 * document (annuler, chargement), motif affiché en cas de refus, Échap et
 * nettoyage.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../../core/commands/CommandRefusedError';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { createDoc, layer } from '../../../../model/spans/__tests__/fixtures';
import { toolbarBasePlugins } from '../../__tests__/toolbarFixtures';
import type { EditorPlugin } from '../../../../core/context/IEditorContext';
import {
  CANCELLED_MESSAGE,
  TIME_SETTINGS_CLASS,
  TIME_SETTINGS_PLUGIN_ID,
  TimeSettingsPlugin
} from '../TimeSettingsPlugin';

afterEach(() => {
  document.body.innerHTML = '';
});

interface IMounted {
  readonly editor: IEditor;
  readonly fps: HTMLInputElement;
  readonly totalFrames: HTMLInputElement;
  readonly message: () => HTMLElement;
}

function mount(data?: ITimelineDocument): IMounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, {
    defaultPlugins: toolbarBasePlugins({}, [new TimeSettingsPlugin()]),
    ...(data === undefined ? {} : { data })
  });
  const input = (name: string): HTMLInputElement => {
    const element = editor.container.querySelector<HTMLInputElement>(`input[data-setting="${name}"]`);
    if (element === null) throw new Error(`Champ ${name} absent.`);
    return element;
  };
  const message = (): HTMLElement => {
    const element = editor.container.querySelector<HTMLElement>(`.${TIME_SETTINGS_CLASS}__message`);
    if (element === null) throw new Error('Message absent.');
    return element;
  };
  return { editor, fps: input('fps'), totalFrames: input('totalFrames'), message };
}

function enter(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('toolbar.timeSettings fields', () => {
  it('renders both fields in the time group of the toolbar, with French labels and limits', () => {
    // Act
    const { editor, fps, totalFrames } = mount();

    // Assert
    const control = editor.container.querySelector(`[data-toolbar-item="${TIME_SETTINGS_PLUGIN_ID}"]`);
    expect(control?.closest('[data-zone="toolbar"]')).not.toBeNull();
    expect(control?.getAttribute('aria-label')).toBe('Réglages du temps');
    expect(fps.closest('label')?.textContent).toBe('Cadenceimg/s');
    expect(totalFrames.closest('label')?.textContent).toBe('Duréeimages');
    expect([fps.value, fps.min, fps.max, fps.step]).toEqual(['24', '1', '240', '1']);
    expect([totalFrames.value, totalFrames.min]).toEqual(['60', '1']);
  });

  it('applies a new fps through an undoable command and follows undo and redo', () => {
    // Arrange
    const { editor, fps } = mount();

    // Act
    enter(fps, '30');

    // Assert
    expect(editor.document.settings.fps).toBe(30);
    editor.undo();
    expect(fps.value).toBe('24');
    editor.redo();
    expect(fps.value).toBe('30');
  });

  it('applies a new duration and follows a loaded document', () => {
    // Arrange
    const { editor, totalFrames } = mount();

    // Act
    enter(totalFrames, '90');
    editor.load(createDoc([], 12));

    // Assert
    expect(totalFrames.value).toBe('12');
    expect(editor.canUndo).toBe(false);
  });

  it('does nothing when the value is unchanged', () => {
    // Arrange
    const { editor, fps } = mount();

    // Act
    enter(fps, '24');

    // Assert
    expect(editor.canUndo).toBe(false);
  });
});

describe('toolbar.timeSettings refusals', () => {
  it('shows why an fps is refused and keeps the value, marked invalid, for correction', () => {
    // Arrange
    const { editor, fps, message } = mount();

    // Act
    enter(fps, '500');

    // Assert
    expect(editor.document.settings.fps).toBe(24);
    expect(fps.value).toBe('500');
    expect(fps.getAttribute('aria-invalid')).toBe('true');
    expect(message().textContent).not.toBe('');
    expect(message().getAttribute('role')).toBe('status');
    expect(message().textContent).toBe('La cadence doit être un nombre entier de 1 à 240 images par seconde.');
  });

  it('refuses an empty field', () => {
    // Arrange
    const { totalFrames, message } = mount();

    // Act
    enter(totalFrames, '');

    // Assert
    expect(totalFrames.value).toBe('');
    expect(message().textContent).toBe('La durée doit être un nombre entier de 1 à 100 000 images.');
  });

  it('refuses a duration shorter than a span, then clears the message on success', () => {
    // Arrange
    const data = createDoc([layer('l1', [{ id: 's1', start: 1, end: 40, kind: 'blank' }], { name: 'Héros' })], 60);
    const { editor, totalFrames, message } = mount(data);

    // Act
    enter(totalFrames, '30');

    // Assert
    expect(editor.document.settings.totalFrames).toBe(60);
    expect(totalFrames.value).toBe('30');
    expect(message().textContent).toBe(
      "La durée ne peut pas être inférieure à 40 images : une plage du calque « Héros » se termine à l'image 40."
    );
    enter(totalFrames, '40');
    expect(editor.document.settings.totalFrames).toBe(40);
    expect(message().textContent).toBe('');
  });

  it('restores the document value and hides the message on Escape', () => {
    // Arrange
    const { fps, message } = mount();
    enter(fps, '0');
    fps.value = '48';

    // Act
    fps.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // Assert
    expect(fps.value).toBe('24');
    expect(message().textContent).toBe('');
  });

  it('ignores refusals of commands it did not run', () => {
    // Arrange
    const { editor, message } = mount();

    // Act
    editor.execute({
      label: 'Autre',
      do: () => {
        throw new CommandRefusedError('Autre', 'non');
      },
      undo: (doc) => doc
    });

    // Assert
    expect(message().textContent).toBe('');
  });
});

describe('toolbar.timeSettings destroy', () => {
  it('stops following the document once the editor is destroyed', () => {
    // Arrange
    const { editor, fps } = mount();
    const host = fps.closest('[data-zone="toolbar"]');

    // Act
    editor.destroy();

    // Assert
    expect(host?.querySelector(`.${TIME_SETTINGS_CLASS}`)).toBeNull();
  });
});

describe('toolbar.timeSettings message', () => {
  it('clears an old refusal when the document changes by undo', () => {
    // Arrange
    const { editor, fps, message } = mount();
    enter(fps, '30');
    enter(fps, '999');
    expect(message().textContent).not.toBe('');

    // Act
    editor.undo();

    // Assert
    expect(message().textContent).toBe('');
    expect(fps.value).toBe('24');
    expect(fps.hasAttribute('aria-invalid')).toBe(false);
  });

  it('lets a loaded document longer than the maximum be shortened, and sets the field maximum', () => {
    // Arrange
    const data = createDoc([layer('l1', [{ id: 's1', start: 1, end: 150_000, kind: 'blank' }], { name: 'Long' })], 200_000);
    const { editor, totalFrames, message } = mount(data);

    // Act + Assert
    expect(totalFrames.max).toBe('200000');
    enter(totalFrames, '180000');
    expect(editor.document.settings.totalFrames).toBe(180_000);
    expect(totalFrames.max).toBe('180000');
    enter(totalFrames, '190000');
    expect(message().textContent).toBe('La durée doit être un nombre entier de 1 à 180 000 images.');
  });
});

describe('toolbar.timeSettings accessibility and vetoes', () => {
  it('links both fields to the message and marks only the refused one invalid', () => {
    // Arrange
    const { fps, totalFrames, message } = mount();

    // Act
    enter(totalFrames, '0');

    // Assert
    expect(message().id).not.toBe('');
    expect(fps.getAttribute('aria-describedby')).toBe(message().id);
    expect(totalFrames.getAttribute('aria-describedby')).toBe(message().id);
    expect(totalFrames.getAttribute('aria-invalid')).toBe('true');
    expect(fps.hasAttribute('aria-invalid')).toBe(false);
    enter(totalFrames, '30');
    expect(totalFrames.hasAttribute('aria-invalid')).toBe(false);
  });

  it('keeps the live region in the page while it is empty', () => {
    // Act
    const { message } = mount();

    // Assert
    expect(message().hidden).toBe(false);
    expect(message().textContent).toBe('');
  });

  it('shows a French reason, not the raw token, when another plugin vetoes the change', () => {
    // Arrange
    const veto: EditorPlugin = {
      id: 'test.veto',
      dependencies: [],
      init: (ctx) => void ctx.events.onCancellable('command:before', (event) => event.cancel()),
      destroy: () => {}
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = createEditor(container, {
      defaultPlugins: toolbarBasePlugins({}, [new TimeSettingsPlugin()]),
      plugins: [veto]
    });
    const fps = editor.container.querySelector<HTMLInputElement>('input[data-setting="fps"]') as HTMLInputElement;

    // Act
    enter(fps, '30');

    // Assert
    expect(editor.document.settings.fps).toBe(24);
    expect(editor.container.querySelector(`.${TIME_SETTINGS_CLASS}__message`)?.textContent).toBe(CANCELLED_MESSAGE);
  });
});

describe('toolbar.timeSettings marks per field', () => {
  it('keeps the other field marked when one field is set back to the document value', () => {
    // Arrange
    const { fps, totalFrames, message } = mount();
    enter(fps, '500');

    // Act
    enter(totalFrames, '60.0');

    // Assert
    expect(fps.value).toBe('500');
    expect(fps.getAttribute('aria-invalid')).toBe('true');
    expect(message().textContent).not.toBe('');
  });

  it('clears the message once the refused field is set back to the document value', () => {
    // Arrange
    const { fps, message } = mount();
    enter(fps, '500');

    // Act
    enter(fps, '24');

    // Assert
    expect(fps.hasAttribute('aria-invalid')).toBe(false);
    expect(message().textContent).toBe('');
  });
});


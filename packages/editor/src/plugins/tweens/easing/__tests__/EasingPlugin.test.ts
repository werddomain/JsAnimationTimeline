// packages/editor/src/plugins/tweens/easing/__tests__/EasingPlugin.test.ts
import type { Easing, ILayer } from '@kazo-ca/timeline-runtime';
import { captureContext } from '../../../../core/editor/__tests__/fixtures';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditorContext } from '../../../../core/context/IEditorContext';
import type { CommandRefusedEvent } from '../../../../core/commands/commandEvents';
import { createSetLockedCommand } from '../../../layers/lock/lockCommands';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { createContainer, createManualScheduler, cleanBody } from '../../../layout/__tests__/layoutFixtures';
import { FramesPlugin } from '../../../frames/FramesPlugin';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { MotionTweenPlugin } from '../../motion/MotionTweenPlugin';
import { EasingPlugin } from '../EasingPlugin';
import { fixture } from './fixtures';

afterEach(cleanBody);

function setup(easing?: Easing) {
  const capture = captureContext();
  const editor = createEditor(createContainer(), { data: fixture(easing), stage: false, defaultPlugins: [
    new LayoutPlugin({ scrollSync: { scheduler: createManualScheduler() } }), new FramesPlugin(),
    createShortcutsPlugin(), new MotionTweenPlugin(), new EasingPlugin(), capture.plugin
  ] });
  const service = editor.getService('tweens.easing');
  if (service === undefined) throw new Error('Missing easing service');
  return { editor, service, context: capture.context() };
}

function dialog(): HTMLElement | null { return document.querySelector('[role="dialog"]'); }
function preset(): HTMLSelectElement { return document.querySelector('select[aria-label="Préréglage"]') as HTMLSelectElement; }
function button(text: string): HTMLButtonElement {
  const found = Array.from(dialog()?.querySelectorAll('button') ?? []).find((el) => el.textContent === text);
  if (found === undefined) throw new Error(`Missing ${text}`);
  return found;
}
function choose(value: string): void { preset().value = value; preset().dispatchEvent(new Event('change', { bubbles: true })); }
function key(key: string, shiftKey = false): void { document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })); }

describe('easing service and history', () => {
  it('changes once, preserves tracks, and restores the exact document through history', () => {
    const { editor, service } = setup();
    const before = editor.document;
    expect(service.canSetAt('a', 6)).toEqual({ enabled: true });
    expect(service.setAt('a', 6, 'ease-in')).toBe(true);
    const after = editor.document;
    expect((after.layers[0] as ILayer).spans[0].tracks).toBe((before.layers[0] as ILayer).spans[0].tracks);
    expect(service.setAt('a', 6, 'ease-in')).toBe(false);
    expect(editor.undo()).toBe(true);
    expect(editor.document).toEqual(before);
    expect(editor.canUndo).toBe(false);
    expect(editor.redo()).toBe(true);
    expect(editor.document).toEqual(after);
    editor.destroy();
    expect(() => service.canSetAt('a', 1)).toThrow('tweens.easing');
  });

  it('reports atomic refusals and matching availability', () => {
    const { editor, service } = setup();
    const refusals: CommandRefusedEvent[] = [];
    editor.on('command:refused', (event) => refusals.push(event));
    const before = editor.document;
    for (const frame of [0, 12, 16, 21]) {
      expect(service.canSetAt('a', frame).enabled).toBe(false);
      expect(service.openAt('a', frame)).toBe(false);
      expect(service.setAt('a', frame, 'ease')).toBe(false);
    }
    expect(refusals).toHaveLength(4);
    expect(editor.document).toBe(before);
    expect(editor.canUndo).toBe(false);
    editor.destroy();
  });
});

describe('accessible easing dialog', () => {
  it('focuses the preset, traps Tab both ways, and cancels without any mutation', () => {
    const { editor, service } = setup();
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const before = editor.document;
    expect(service.openAt('a', 6)).toBe(true);
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(preset());
    key('Tab', true); expect(document.activeElement).toBe(button('Annuler'));
    key('Tab'); expect(document.activeElement).toBe(preset());
    choose('ease-in'); button('Annuler').click();
    expect(dialog()).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(editor.document).toBe(before); expect(editor.canUndo).toBe(false);
    service.openAt('a', 1); key('Escape'); expect(dialog()).toBeNull();
    editor.destroy();
  });

  it('leaves custom curves unselected and untouched until the user chooses and confirms', () => {
    const { editor, service } = setup('cubic-bezier(0.2, -0.5, 0.8, 1.5)');
    const before = editor.document;
    service.openAt('a', 1);
    expect(preset().value).toBe(''); expect(button('Appliquer').disabled).toBe(true);
    expect(dialog()?.textContent).toContain('Courbe personnalisée');
    service.close(); expect(editor.document).toBe(before);
    service.openAt('a', 1); choose('ease-out'); button('Appliquer').click();
    expect(dialog()).toBeNull();
    expect((editor.document.layers[0] as ILayer).spans[0].easing).toBe('ease-out');
    expect(editor.undo()).toBe(true); expect(editor.document).toEqual(before);
    editor.destroy();
  });

  it('closes when selection, document, locks or load change and cannot apply a stale target', () => {
    const { editor, service } = setup();
    service.openAt('a', 1); choose('ease');
    const staleApply = button('Appliquer');
    editor.execute(createSetLockedCommand(editor.document, 'a', true));
    expect(dialog()).toBeNull(); staleApply.click();
    expect((editor.document.layers[0] as ILayer).spans[0].easing).toBeUndefined();
    editor.undo(); service.openAt('a', 1);
    editor.getService('frames.selection')?.set([{ rowId: 'a', frame: 2 }]);
    expect(dialog()).toBeNull();
    service.openAt('a', 1); editor.load(fixture('ease-out')); expect(dialog()).toBeNull();
    service.openAt('a', 1); editor.destroy(); expect(dialog()).toBeNull();
    key('Escape');
  });

  it('isolates editor dialogs and cleans a partial initialization failure', () => {
    const first = setup(); const second = setup();
    first.service.openAt('a', 1); second.service.openAt('a', 1);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    first.editor.destroy(); expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    second.service.close(); second.editor.destroy();
    const cleanup = jest.fn(); const plugin = new EasingPlugin();
    const ctx = { services: { require: jest.fn(), provide: jest.fn(() => cleanup) },
      events: { on: jest.fn().mockReturnValueOnce(cleanup).mockImplementationOnce(() => { throw new Error('failed'); }) }
    } as unknown as IEditorContext;
    expect(() => plugin.init(ctx)).toThrow('failed');
    expect(cleanup).toHaveBeenCalled(); plugin.destroy();
  });
});



describe('easing confirmation reentrance and lifecycle', () => {
  it('keeps a refused dialog open and closes an identical choice without history', () => {
    const { editor, service, context } = setup();
    service.openAt('a', 1); button('Appliquer').click();
    expect(dialog()).toBeNull(); expect(editor.canUndo).toBe(false);
    service.openAt('a', 1); choose('ease-in');
    const off = context.events.onCancellable('command:before', (event) => event.cancel());
    button('Appliquer').click();
    expect(dialog()?.textContent).toContain('La modification a été refusée'); expect(editor.canUndo).toBe(false);
    off(); button('Appliquer').click(); expect(dialog()).toBeNull(); expect(editor.canUndo).toBe(true);
    editor.destroy();
  });

  it('refuses if the target is replaced inside command:before', () => {
    const { editor, service, context } = setup();
    const replaced = fixture(); const layer = replaced.layers[0] as ILayer;
    const off = context.events.onCancellable('command:before', () => {
      editor.load({ ...replaced, layers: [{ ...layer, spans: layer.spans.map((span) => ({ ...span, id: `${span.id}-new` })) }] });
    });
    service.openAt('a', 1); choose('ease-in'); button('Appliquer').click();
    expect(dialog()).toBeNull();
    expect((editor.document.layers[0] as ILayer).spans[0].easing).toBeUndefined(); expect(editor.canUndo).toBe(false);
    off(); editor.destroy();
  });

  it('uses ownerDocument and its window for dialog and focus restoration', () => {
    const frame = document.createElement('iframe'); document.body.append(frame);
    const other = frame.contentDocument;
    if (other === null) throw new Error('Missing iframe document');
    const host = other.createElement('div'); const trigger = other.createElement('button'); other.body.append(trigger, host);
    const editor = createEditor(host, { data: fixture(), stage: false });
    trigger.focus(); editor.getService('tweens.easing')?.openAt('a', 1);
    expect(other.querySelector('[role="dialog"]')).not.toBeNull(); expect(dialog()).toBeNull();
    editor.getService('tweens.easing')?.close(); expect(other.activeElement).toBe(trigger);
    editor.destroy();
  });
});

it('does not steal focus from a second editor when the first editor is destroyed', () => {
  const first = setup(); const second = setup();
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  first.service.openAt('a', 1); second.service.openAt('a', 1);
  const secondSelect = document.querySelectorAll('select[aria-label="Préréglage"]')[1];
  expect(document.activeElement).toBe(secondSelect);
  first.editor.destroy(); expect(document.activeElement).toBe(secondSelect);
  second.editor.destroy();
});


it('closes on layer selection changes and accepts valid custom curves through the public setter', () => {
  const { editor, service, context } = setup();
  service.openAt('a', 1);
  context.events.emit('layers:selectionChanged', { ids: ['a'], previous: [] });
  expect(dialog()).toBeNull();
  expect(service.setAt('a', 1, 'cubic-bezier(.2, -.5, .8, 1.5)')).toBe(true);
  expect((editor.document.layers[0] as ILayer).spans[0].easing).toBe('cubic-bezier(.2, -.5, .8, 1.5)');
  editor.destroy();
});

describe('easing initial-focus reentrance', () => {
  it('discards a dialog when initial focus destroys the editor', () => {
    const { editor, service } = setup();
    document.addEventListener('focusin', () => editor.destroy(), { once: true });

    const opened = service.openAt('a', 1);

    expect(editor.isDestroyed).toBe(true);
    expect(opened).toBe(false);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(document.querySelector('.jt-easing-portal')).toBeNull();
  });

  it('discards a dialog when initial focus changes the document', () => {
    const { editor, service } = setup();
    document.addEventListener('focusin', () => {
      editor.execute(createSetLockedCommand(editor.document, 'a', true));
    }, { once: true });

    const opened = service.openAt('a', 1);

    expect(opened).toBe(false);
    expect(dialog()).toBeNull();
    expect((editor.document.layers[0] as ILayer).locked).toBe(true);
    expect((editor.document.layers[0] as ILayer).spans[0].easing).toBeUndefined();
    editor.destroy();
  });

  it('retains only the newest opening when initial focus opens another dialog', () => {
    const { editor, service } = setup();
    let nestedOpened = false;
    let nestedSelect: HTMLSelectElement | undefined;
    document.addEventListener('focusin', () => {
      nestedOpened = service.openAt('a', 6);
      nestedSelect = document.activeElement as HTMLSelectElement;
    }, { once: true });

    const opened = service.openAt('a', 1);

    expect(opened).toBe(false);
    expect(nestedOpened).toBe(true);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(preset()).toBe(nestedSelect);
    expect(document.activeElement).toBe(nestedSelect);
    service.close();
    expect(dialog()).toBeNull();
    editor.destroy();
  });
});

describe('easing destruction focus reentrance', () => {
  it('refuses a captured service reopening while destruction restores trigger focus', () => {
    const { editor, service } = setup();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    expect(service.openAt('a', 1)).toBe(true);
    let reopened: boolean | undefined;
    let refusal: unknown;
    trigger.addEventListener('focus', () => {
      try { reopened = service.openAt('a', 1); }
      catch (error) { refusal = error; }
    }, { once: true });

    editor.destroy();

    expect(editor.isDestroyed).toBe(true);
    expect(reopened).toBeUndefined();
    expect(refusal).toBeInstanceOf(Error);
    expect((refusal as Error).message).toContain('tweens.easing');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(document.querySelectorAll('.jt-easing-portal')).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });

  it('refuses captured service reads and setters before focus restoration can execute a command', () => {
    const { editor, service, context } = setup();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    expect(service.openAt('a', 1)).toBe(true);
    const before = context.document;
    const commands: string[] = [];
    const historyChanges: boolean[] = [];
    const refusals: unknown[] = [];
    context.events.onCancellable('command:before', (event) => { commands.push(event.payload.command.label); });
    editor.on('history:changed', () => { historyChanges.push(context.commands.canUndo); });
    trigger.addEventListener('focus', () => {
      for (const attempt of [() => service.canSetAt('a', 1), () => service.setAt('a', 1, 'ease-in')]) {
        try { attempt(); }
        catch (error) { refusals.push(error); }
      }
    }, { once: true });

    editor.destroy();

    expect(refusals).toHaveLength(2);
    refusals.forEach((error) => {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('tweens.easing');
    });
    expect(context.document).toBe(before);
    expect(commands).toEqual([]);
    expect(historyChanges).toEqual([]);
    expect(context.commands.canUndo).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('.jt-easing-portal')).toBeNull();
    expect(() => service.openAt('a', 1)).toThrow('tweens.easing');
    expect(() => service.setAt('a', 1, 'ease')).toThrow('tweens.easing');
  });
});

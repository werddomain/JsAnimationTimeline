// packages/editor/src/plugins/interaction/shortcuts/__tests__/keyChord.test.ts
/**
 * Combinaisons de touches : lecture d'un texte, d'un événement clavier,
 * forme canonique et affichage en français.
 */

import { chordToString, chordsFromEvent, formatChord, parseChord } from '../keyChord';
import { ShortcutError } from '../ShortcutError';

function canonical(text: string): string {
  return chordToString(parseChord(text));
}

function fromEvent(init: KeyboardEventInit): string[] {
  return chordsFromEvent(new KeyboardEvent('keydown', init)).map(chordToString);
}

describe('parseChord', () => {
  it.each([
    ['F6', 'F6'],
    ['f6', 'F6'],
    ['Shift+F5', 'Shift+F5'],
    ['Mod+Z', 'Mod+z'],
    ['Ctrl+z', 'Mod+z'],
    ['Cmd+Shift+Z', 'Mod+Shift+z'],
    ['Maj+Ctrl+Z', 'Mod+Shift+z'],
    ['Option+X', 'Alt+x'],
    ['Delete', 'Delete'],
    ['del', 'Delete'],
    ['Space', 'Space'],
    ['Esc', 'Escape'],
    ['Mod+Plus', 'Mod++'],
    [',', ','],
    ['Shift+,', ','],
    ['Shift+1', '1']
  ])('reads « %s » as %s', (text, expected) => {
    // Act / Assert
    expect(canonical(text)).toBe(expected);
  });

  it.each([
    ['', 'texte vide'],
    ['Mod+', 'touche manquante'],
    ['Hyper+Z', 'modificateur « Hyper » inconnu'],
    ['Ctrl+Cmd+Z', 'répété'],
    ['Shift', 'modificateur seul'],
    ['Mod+Banana', 'touche « Banana » inconnue'],
    ['F25', 'touche « F25 » inconnue'],
    ['toString', 'touche « toString » inconnue']
  ])('rejects « %s » (%s)', (text, reason) => {
    // Act
    const act = (): unknown => parseChord(text);

    // Assert
    expect(act).toThrow(ShortcutError);
    expect(act).toThrow(reason);
  });

  it('rejects a non-string value with the invalid-keys code', () => {
    // Act
    let caught: unknown;
    try {
      parseChord(42 as unknown as string);
    } catch (error) {
      caught = error;
    }

    // Assert
    expect(caught).toBeInstanceOf(ShortcutError);
    expect((caught as ShortcutError).code).toBe('invalid-keys');
  });

  it('returns a frozen chord', () => {
    expect(Object.isFrozen(parseChord('Mod+Z'))).toBe(true);
  });
});

describe('chordsFromEvent', () => {
  it('treats Ctrl and Cmd alike', () => {
    expect(fromEvent({ key: 'z', ctrlKey: true })).toEqual(['Mod+z']);
    expect(fromEvent({ key: 'z', metaKey: true })).toEqual(['Mod+z']);
  });

  it('lower-cases a shifted letter and keeps Shift', () => {
    expect(fromEvent({ key: 'Z', ctrlKey: true, shiftKey: true })).toEqual(['Mod+Shift+z']);
  });

  it('drops Shift for a character without case', () => {
    expect(fromEvent({ key: '?', shiftKey: true })).toEqual(['?']);
  });

  it('reads named and function keys', () => {
    expect(fromEvent({ key: 'F5', shiftKey: true })).toEqual(['Shift+F5']);
    expect(fromEvent({ key: ' ' })).toEqual(['Space']);
    expect(fromEvent({ key: 'Delete', altKey: true })).toEqual(['Alt+Delete']);
  });

  it('falls back on the physical key for a non-latin layout', () => {
    expect(fromEvent({ key: 'я', code: 'KeyZ', ctrlKey: true })).toEqual(['Mod+я', 'Mod+z']);
    expect(fromEvent({ key: 'ё', code: 'Digit1' })).toEqual(['ё', '1']);
  });

  it('has no physical fallback for an ASCII character (Shift+1 is not « 1 »)', () => {
    expect(fromEvent({ key: '!', code: 'Digit1', shiftKey: true })).toEqual(['!']);
    expect(fromEvent({ key: '&', code: 'Digit1', ctrlKey: true })).toEqual(['Mod+&']);
  });

  it('does not add the physical key when the produced key is latin', () => {
    expect(fromEvent({ key: 'y', code: 'KeyZ', ctrlKey: true })).toEqual(['Mod+y']);
  });

  it('ignores a lone modifier or an unknown key', () => {
    expect(fromEvent({ key: 'Control', ctrlKey: true })).toEqual([]);
    expect(fromEvent({ key: 'Unidentified' })).toEqual([]);
  });
});

describe('formatChord', () => {
  it.each([
    ['Mod+Shift+Z', 'Ctrl+Maj+Z'],
    ['F6', 'F6'],
    ['Delete', 'Suppr'],
    ['Alt+ArrowLeft', 'Alt+←'],
    ['Enter', 'Entrée'],
    ['Tab', 'Tab'],
    [',', ',']
  ])('shows « %s » as « %s »', (text, expected) => {
    expect(formatChord(parseChord(text))).toBe(expected);
  });
});

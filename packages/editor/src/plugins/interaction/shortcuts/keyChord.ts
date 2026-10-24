// packages/editor/src/plugins/interaction/shortcuts/keyChord.ts
/**
 * Combinaisons de touches : lecture d'un texte (« Mod+Shift+Z », « F6 »),
 * lecture d'un `KeyboardEvent`, forme canonique (clé de recherche) et
 * affichage en français (« Ctrl+Maj+Z »).
 *
 * Règles :
 * - `Mod` (alias `Ctrl`, `Control`, `Cmd`, `Meta`, `Command`) vaut Ctrl ou
 *   Cmd : un événement avec `ctrlKey` ou `metaKey` le satisfait, comme dans
 *   le contrôle v1 ;
 * - `Shift` (alias `Maj`) et `Alt` (alias `Option`) ;
 * - la touche est le dernier segment ; `Plus` désigne la touche « + » ;
 * - pour un caractère qui n'a pas de casse (« , », « ? », « 1 »...), Maj est
 *   ignorée : le caractère produit en tient déjà compte ;
 * - si la touche produite n'est ni une lettre ni un chiffre latin (clavier
 *   cyrillique...), la touche physique (`event.code` : `KeyZ`, `Digit1`) sert
 *   de repli, pour que Ctrl+Z fonctionne quelle que soit la disposition.
 */

import { ShortcutError } from './ShortcutError';

/** Combinaison de touches normalisée. */
export interface IKeyChord {
  readonly mod: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  /** Touche : un caractère en minuscule, ou un nom canonique (`F6`, `Delete`, `Space`...). */
  readonly key: string;
}

type ModifierName = 'mod' | 'alt' | 'shift';

const MODIFIERS: Readonly<Record<string, ModifierName>> = {
  mod: 'mod',
  ctrl: 'mod',
  control: 'mod',
  cmd: 'mod',
  meta: 'mod',
  command: 'mod',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  maj: 'shift'
};

/** Noms de touches acceptés (en minuscules) -> nom canonique. */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  enter: 'Enter',
  escape: 'Escape',
  esc: 'Escape',
  delete: 'Delete',
  del: 'Delete',
  backspace: 'Backspace',
  tab: 'Tab',
  space: 'Space',
  ' ': 'Space',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  plus: '+'
};

/** Libellés français des touches nommées (les autres s'affichent telles quelles). */
const KEY_LABELS: Readonly<Record<string, string>> = {
  Enter: 'Entrée',
  Escape: 'Échap',
  Delete: 'Suppr',
  Backspace: 'Retour arrière',
  Space: 'Espace',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Home: 'Début',
  End: 'Fin',
  PageUp: 'Pg préc.',
  PageDown: 'Pg suiv.',
  Insert: 'Inser'
};

const FUNCTION_KEY = /^f([1-9]|1\d|2[0-4])$/;
const LATIN_LETTER_OR_DIGIT = /^[a-z0-9]$/;
const PHYSICAL_KEY = /^(?:Key([A-Z])|Digit([0-9]))$/;

function isSingleCharacter(key: string): boolean {
  return Array.from(key).length === 1;
}

function modifierOf(name: string): ModifierName | undefined {
  return Object.prototype.hasOwnProperty.call(MODIFIERS, name) ? MODIFIERS[name] : undefined;
}

/** Nom canonique d'une touche, ou `null` si elle n'est pas reconnue. */
function normalizeKey(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NAMED_KEYS, lower)) return NAMED_KEYS[lower] ?? null;
  const fn = FUNCTION_KEY.exec(lower);
  if (fn) return `F${fn[1] ?? ''}`;
  return isSingleCharacter(raw) ? lower : null;
}

/** Maj compte pour une touche nommée ou un caractère qui a une casse (voir l'en-tête). */
function keepsShift(key: string): boolean {
  return !isSingleCharacter(key) || key.toUpperCase() !== key.toLowerCase();
}

function makeChord(mod: boolean, alt: boolean, shift: boolean, key: string): IKeyChord {
  return Object.freeze({ mod, alt, shift: shift && keepsShift(key), key });
}

/**
 * Lit une combinaison écrite (« Mod+Z », « Shift+F5 », « Delete »).
 * Lève une `ShortcutError` (`invalid-keys`) si elle est vide, sans touche,
 * avec un modificateur inconnu ou répété, ou une touche inconnue.
 */
export function parseChord(text: string): IKeyChord {
  const fail = (reason: string): never => {
    throw new ShortcutError('invalid-keys', `Combinaison de touches « ${String(text)} » invalide : ${reason}.`);
  };
  if (typeof text !== 'string' || text.trim() === '') return fail('texte vide');
  const parts = text.split('+').map((part) => part.trim());
  const keyPart = parts.pop() ?? '';
  if (keyPart === '') return fail('touche manquante (écrire « Plus » pour la touche +)');
  const flags: Record<ModifierName, boolean> = { mod: false, alt: false, shift: false };
  for (const part of parts) {
    const modifier = modifierOf(part.toLowerCase());
    if (modifier === undefined) return fail(`modificateur « ${part} » inconnu`);
    if (flags[modifier]) return fail(`modificateur « ${part} » répété`);
    flags[modifier] = true;
  }
  if (modifierOf(keyPart.toLowerCase()) !== undefined) return fail('un modificateur seul ne suffit pas');
  const key = normalizeKey(keyPart);
  if (key === null) return fail(`touche « ${keyPart} » inconnue`);
  return makeChord(flags.mod, flags.alt, flags.shift, key);
}

/**
 * Combinaisons qu'un événement clavier peut désigner : la touche produite,
 * puis éventuellement la touche physique en repli (voir l'en-tête). Vide
 * pour un modificateur seul ou une touche inconnue.
 */
export function chordsFromEvent(event: KeyboardEvent): IKeyChord[] {
  const mod = event.ctrlKey || event.metaKey;
  const key = typeof event.key === 'string' ? normalizeKey(event.key) : null;
  const chords: IKeyChord[] = [];
  if (key !== null) chords.push(makeChord(mod, event.altKey, event.shiftKey, key));
  const physical = typeof event.code === 'string' ? PHYSICAL_KEY.exec(event.code) : null;
  if (physical && (key === null || !LATIN_LETTER_OR_DIGIT.test(key))) {
    const fallback = (physical[1] ?? physical[2] ?? '').toLowerCase();
    chords.push(makeChord(mod, event.altKey, event.shiftKey, fallback));
  }
  return chords;
}

/** Forme canonique, utilisée comme clé de recherche (« Mod+Shift+z »). */
export function chordToString(chord: IKeyChord): string {
  const parts: string[] = [];
  if (chord.mod) parts.push('Mod');
  if (chord.alt) parts.push('Alt');
  if (chord.shift) parts.push('Shift');
  parts.push(chord.key);
  return parts.join('+');
}

/** Affichage en français (« Ctrl+Maj+Z », « F6 », « Suppr »). */
export function formatChord(chord: IKeyChord): string {
  const parts: string[] = [];
  if (chord.mod) parts.push('Ctrl');
  if (chord.alt) parts.push('Alt');
  if (chord.shift) parts.push('Maj');
  const label = KEY_LABELS[chord.key];
  parts.push(label ?? (isSingleCharacter(chord.key) ? chord.key.toUpperCase() : chord.key));
  return parts.join('+');
}

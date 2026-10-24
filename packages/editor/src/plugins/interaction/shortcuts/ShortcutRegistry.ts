// packages/editor/src/plugins/interaction/shortcuts/ShortcutRegistry.ts
/**
 * Registre des raccourcis, sans DOM : validation des définitions, détection
 * des conflits (une combinaison n'appartient qu'à un seul raccourci) et
 * recherche du raccourci d'une combinaison.
 *
 * Chaque enregistrement a sa propre identité : la fonction de retrait ne
 * retire que cet enregistrement, même si le même identifiant a été
 * enregistré de nouveau entre-temps.
 */

import { chordToString, formatChord, parseChord } from './keyChord';
import type { IKeyChord } from './keyChord';
import { ShortcutError } from './ShortcutError';
import type { IShortcutDefinition, IShortcutInfo } from './types';

/** Un raccourci enregistré : sa définition et sa description figée. */
export interface IShortcutEntry {
  readonly definition: IShortcutDefinition;
  readonly info: IShortcutInfo;
}

function invalid(message: string, id?: string): ShortcutError {
  return new ShortcutError('invalid-definition', message, id);
}

/** Vérifie les champs d'une définition ; retourne ses combinaisons écrites. */
function validate(definition: IShortcutDefinition): readonly string[] {
  if (typeof definition !== 'object' || definition === null) {
    throw invalid('Raccourci invalide : une définition { id, keys, label, run } est attendue.');
  }
  const { id, label, run, enabled, keys } = definition;
  if (typeof id !== 'string' || id.trim() === '') {
    throw invalid('Raccourci invalide : « id » doit être une chaîne non vide.');
  }
  if (typeof label !== 'string' || label.trim() === '') {
    throw invalid(`Raccourci « ${id} » invalide : « label » doit être une chaîne non vide.`, id);
  }
  if (typeof run !== 'function') {
    throw invalid(`Raccourci « ${id} » invalide : « run » doit être une fonction.`, id);
  }
  if (enabled !== undefined && typeof enabled !== 'function') {
    throw invalid(`Raccourci « ${id} » invalide : « enabled » doit être une fonction.`, id);
  }
  const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? (keys as readonly unknown[]) : [];
  if (list.length === 0 || list.some((item) => typeof item !== 'string')) {
    throw invalid(`Raccourci « ${id} » invalide : « keys » doit être une combinaison ou une liste non vide.`, id);
  }
  return list as readonly string[];
}

/** `parseChord` dont l'erreur nomme le raccourci concerné. */
function parseFor(id: string, text: string): IKeyChord {
  try {
    return parseChord(text);
  } catch (error) {
    if (!(error instanceof ShortcutError)) throw error;
    throw new ShortcutError(error.code, `Raccourci « ${id} » : ${error.message}`, id);
  }
}

/** Description figée d'une définition (combinaisons sans doublon, dans l'ordre). */
function describe(definition: IShortcutDefinition, written: readonly string[]): IShortcutInfo {
  const keys: string[] = [];
  const display: string[] = [];
  for (const text of written) {
    const chord = parseFor(definition.id, text);
    const canonical = chordToString(chord);
    if (keys.includes(canonical)) continue;
    keys.push(canonical);
    display.push(formatChord(chord));
  }
  return Object.freeze({
    id: definition.id,
    label: definition.label,
    keys: Object.freeze(keys),
    display: Object.freeze(display)
  });
}

/** Raccourcis enregistrés, par identifiant et par combinaison. */
export class ShortcutRegistry {
  private readonly byId = new Map<string, IShortcutEntry>();
  private readonly byKeys = new Map<string, IShortcutEntry>();

  /** Enregistre `definition` ; voir `IShortcutsService.register`. */
  register(definition: IShortcutDefinition): () => void {
    const info = describe(definition, validate(definition));
    if (this.byId.has(info.id)) {
      throw new ShortcutError('duplicate-id', `Le raccourci « ${info.id} » est déjà enregistré.`, info.id);
    }
    info.keys.forEach((keys, index) => {
      const owner = this.byKeys.get(keys);
      if (owner === undefined) return;
      throw new ShortcutError(
        'conflict',
        `Conflit de raccourcis : « ${info.display[index] ?? keys} » est déjà attribué à ` +
          `« ${owner.info.id} » (${owner.info.label}) ; « ${info.id} » ne peut pas la reprendre.`,
        info.id,
        owner.info.id
      );
    });
    const entry: IShortcutEntry = Object.freeze({ definition, info });
    this.byId.set(info.id, entry);
    info.keys.forEach((keys) => this.byKeys.set(keys, entry));
    return () => this.remove(entry);
  }

  /** Raccourci qui possède la combinaison canonique `keys`, s'il y en a un. */
  match(keys: string): IShortcutEntry | undefined {
    return this.byKeys.get(keys);
  }

  /** Raccourci qui possède la combinaison écrite `keys` (lève si elle est invalide). */
  lookup(keys: string): IShortcutInfo | undefined {
    return this.byKeys.get(chordToString(parseChord(keys)))?.info;
  }

  /** Raccourcis enregistrés, dans l'ordre d'enregistrement. */
  list(): readonly IShortcutInfo[] {
    return Array.from(this.byId.values(), (entry) => entry.info);
  }

  /** Retire tous les raccourcis (destruction du plugin). */
  clear(): void {
    this.byId.clear();
    this.byKeys.clear();
  }

  private remove(entry: IShortcutEntry): void {
    if (this.byId.get(entry.info.id) !== entry) return;
    this.byId.delete(entry.info.id);
    entry.info.keys.forEach((keys) => {
      if (this.byKeys.get(keys) === entry) this.byKeys.delete(keys);
    });
  }
}

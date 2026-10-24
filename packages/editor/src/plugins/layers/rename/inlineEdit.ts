// packages/editor/src/plugins/layers/rename/inlineEdit.ts
/**
 * Saisie sur place du nom d'une ligne : un `<input>` remplace le texte dans
 * l'élément du nom, qui porte `data-editing` tant que la saisie dure (la
 * liste ne réécrit alors pas le nom). Entrée ou perte du focus valide,
 * Échap annule. À la fin, le texte du nom courant est remis : si le nom
 * change, c'est la liste qui le réécrit après la commande.
 */

import { NAME_EDITING_ATTRIBUTE } from '../list/LayerRowView';

/** Classe de l'input de saisie. */
export const RENAME_INPUT_CLASS = 'jt-layer-row__name-input';

/** Libellé accessible de l'input. */
export const RENAME_INPUT_LABEL = 'Nom du calque';

/** Événements de la saisie qui ne doivent jamais atteindre la ligne (sélection, glisser, menu). */
const ISOLATED_EVENTS = [
  'click',
  'dblclick',
  'mousedown',
  'pointerdown',
  'dragstart',
  'keyup',
  'contextmenu'
] as const;

/** Saisie en cours. */
export interface IInlineEdit {
  /** L'input de saisie. */
  readonly input: HTMLInputElement;
  /** Termine en validant la valeur saisie (sans effet si déjà terminée). */
  commit(): void;
  /** Termine sans rien valider (sans effet si déjà terminée). */
  cancel(): void;
}

/** Réglages et rappels d'une saisie. */
export interface IInlineEditOptions {
  /** Nom courant du nœud : valeur initiale, et texte remis à la fin (relu à ce moment-là). */
  readonly currentName: () => string;
  /** Reçoit la valeur brute saisie, après la fin de la saisie. */
  readonly onCommit: (value: string) => void;
  /**
   * Appelée à la fin, validée ou non, avant `onCommit`. `refocus` est vrai
   * pour Entrée et Échap (le focus revient à la ligne), faux sinon (blur, API).
   */
  readonly onDone: (refocus: boolean) => void;
}

/** Démarre la saisie dans `nameElement`. */
export function startInlineEdit(nameElement: HTMLElement, options: IInlineEditOptions): IInlineEdit {
  const input = nameElement.ownerDocument.createElement('input');
  input.type = 'text';
  input.classList.add(RENAME_INPUT_CLASS);
  input.value = options.currentName();
  input.setAttribute('aria-label', RENAME_INPUT_LABEL);
  let finished = false;
  let composing = false;

  const finish = (commit: boolean, refocus: boolean): void => {
    if (finished) return;
    finished = true;
    const value = input.value;
    nameElement.removeAttribute(NAME_EDITING_ATTRIBUTE);
    nameElement.textContent = options.currentName();
    options.onDone(refocus);
    if (commit) options.onCommit(value);
  };

  input.addEventListener('keydown', (event) => {
    // Les touches de saisie ne doivent pas déclencher les raccourcis de l'éditeur.
    event.stopPropagation();
    // Pendant une composition (IME), Entrée et Échap appartiennent au clavier de saisie.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false, true);
    }
  });
  // Une saisie IME en cours (blur pendant la composition) est abandonnée plutôt que validée à moitié.
  // Un input retiré du DOM (ligne disparue) perd le focus : pas de commande pendant `document:changed`.
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
  });
  input.addEventListener('blur', () => {
    if (input.isConnected) finish(!composing, false);
  });
  ISOLATED_EVENTS.forEach((type) => input.addEventListener(type, (event) => event.stopPropagation()));

  nameElement.setAttribute(NAME_EDITING_ATTRIBUTE, '');
  nameElement.replaceChildren(input);
  input.focus();
  input.select();
  return { input, commit: () => finish(true, false), cancel: () => finish(false, false) };
}

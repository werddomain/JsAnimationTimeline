// packages/editor/src/plugins/layers/rename/inlineEdit.ts
/**
 * Saisie sur place du nom d'une ligne : un `<input>` remplace le texte dans
 * l'élément du nom, qui porte `data-editing` tant que la saisie dure (la
 * liste ne réécrit alors pas le nom). Entrée ou perte du focus valide,
 * Échap annule. À la fin, le texte d'origine est remis : si le nom change,
 * c'est la liste qui le réécrit après la commande.
 */

import { NAME_EDITING_ATTRIBUTE } from '../list/LayerRowView';

/** Classe de l'input de saisie. */
export const RENAME_INPUT_CLASS = 'jt-layer-row__name-input';

/** Libellé accessible de l'input. */
export const RENAME_INPUT_LABEL = 'Nom du calque';

/** Saisie en cours. */
export interface IInlineEdit {
  /** L'input de saisie. */
  readonly input: HTMLInputElement;
  /** Termine en validant la valeur saisie (sans effet si déjà terminée). */
  commit(): void;
  /** Termine sans rien valider (sans effet si déjà terminée). */
  cancel(): void;
}

/**
 * Démarre la saisie dans `nameElement`.
 *
 * @param currentName Nom actuel (valeur initiale, texte remis à la fin).
 * @param onCommit Reçoit la valeur brute saisie, après la fin de la saisie.
 * @param onDone Appelée à la fin, validée ou non, avant `onCommit`.
 */
export function startInlineEdit(
  nameElement: HTMLElement,
  currentName: string,
  onCommit: (value: string) => void,
  onDone: () => void
): IInlineEdit {
  const input = nameElement.ownerDocument.createElement('input');
  input.type = 'text';
  input.classList.add(RENAME_INPUT_CLASS);
  input.value = currentName;
  input.setAttribute('aria-label', RENAME_INPUT_LABEL);
  let finished = false;

  const finish = (commit: boolean): void => {
    if (finished) return;
    finished = true;
    const value = input.value;
    nameElement.removeAttribute(NAME_EDITING_ATTRIBUTE);
    nameElement.textContent = currentName;
    onDone();
    if (commit) onCommit(value);
  };

  input.addEventListener('keydown', (event) => {
    // Les touches de saisie ne doivent pas déclencher les raccourcis de l'éditeur.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  // Clics dans l'input : ni sélection de ligne ni nouveau double-clic.
  (['click', 'dblclick', 'mousedown'] as const).forEach((type) =>
    input.addEventListener(type, (event) => event.stopPropagation())
  );

  nameElement.setAttribute(NAME_EDITING_ATTRIBUTE, '');
  nameElement.replaceChildren(input);
  input.focus();
  input.select();
  return { input, commit: () => finish(true), cancel: () => finish(false) };
}

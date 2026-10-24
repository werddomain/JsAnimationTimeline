// packages/editor/src/plugins/layers/target/TargetPopup.ts
/**
 * Fenêtre de choix de la cible d'un calque (`layers.target`) :
 * - liste des cibles proposées par les scènes (`ctx.stage.listTargets()`,
 *   libellés de `describe`), la cible courante marquée ;
 * - bouton « Choisir sur la scène » : `targets.pick(signal)` de la première
 *   scène qui en a un (désactivé sinon), abandonné par la fermeture, Échap ou
 *   la destruction ; un résultat tardif ou annulé (`null`) ne change rien ;
 * - saisie libre : sélecteur CSS ou référence, avec la scène quand il y en a
 *   plusieurs.
 *
 * Fenêtre `role="dialog"` ajoutée dans l'élément de l'éditeur. Elle se ferme
 * sur Échap (focus rendu au bouton de la ligne), quand le focus la quitte
 * (Tab), sur un clic extérieur, ou à la demande du plugin (calque supprimé,
 * destruction). Pendant un choix sur la scène, le clic extérieur et la perte
 * du focus ne la ferment pas (l'utilisateur clique justement sur la scène) ;
 * Échap abandonne alors le choix.
 *
 * Les touches pressées dans la fenêtre ne remontent pas aux raccourcis de
 * l'éditeur, sauf annuler / rétablir (Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z).
 */

import { sameTarget } from '@werddomain/timeline-runtime';
import type { IStageTargets, LayerTarget } from '@werddomain/timeline-runtime';
import type { IEditorStage } from '../../../core/stage/types';
import { UndoRedoKeys } from '../../history/undoRedo/UndoRedoPlugin';
import { chordToString, chordsFromEvent, parseChord } from '../../interaction/shortcuts/keyChord';
import { targetFromInput } from './targetValidation';
import type { ITargetInput } from './targetValidation';

/** Libellés de la fenêtre. */
export const TargetPopupLabels = Object.freeze({
  dialog: (name: string): string => `Cible de « ${name} »`,
  list: 'Cibles proposées par la scène',
  empty: 'La scène ne propose aucune cible.',
  pick: 'Choisir sur la scène',
  pickUnavailable: 'Aucune scène ne permet de choisir un objet',
  picking: 'Cliquez sur un objet de la scène (Échap pour annuler).',
  pickFailed: 'Le choix sur la scène a échoué.',
  kind: 'Type de cible',
  selector: 'Sélecteur CSS',
  ref: 'Référence',
  text: 'Sélecteur CSS ou référence',
  stage: 'Scène',
  anyStage: 'Automatique',
  apply: 'Appliquer',
  emptyText: 'Saisissez un sélecteur CSS ou une référence.',
  refused: 'Cette cible ne peut pas être enregistrée (un sélecteur CSS ou une référence seulement).'
});

/** Classes de la fenêtre. */
export const TARGET_POPUP_CLASS = 'jt-target-popup';

/** Chaînes canoniques des raccourcis annuler / rétablir, laissées remonter. */
const HISTORY_CHORDS = new Set(
  [UndoRedoKeys.UNDO, ...UndoRedoKeys.REDO].map((keys) => chordToString(parseChord(keys)))
);

/** Événements gardés dans la fenêtre (la ligne et la sélection n'y réagissent pas). */
const ISOLATED_EVENTS = ['click', 'dblclick', 'mousedown', 'pointerdown', 'keyup'] as const;

function isHistoryChord(event: KeyboardEvent): boolean {
  return chordsFromEvent(event).some((chord) => HISTORY_CHORDS.has(chordToString(chord)));
}

/** Ce que la fenêtre reçoit du plugin. */
export interface ITargetPopupOptions {
  readonly stage: IEditorStage;
  /** Élément où la fenêtre est ajoutée (l'élément de l'éditeur). */
  readonly parent: HTMLElement;
  /** Bouton de la ligne : position, focus rendu, clics qui ne ferment pas. */
  readonly anchor: HTMLElement;
  readonly layerName: string;
  readonly current: LayerTarget | undefined;
  /** Enregistre la cible ; `false` si elle est refusée (forme) ou inchangée. */
  readonly apply: (target: unknown) => 'applied' | 'unchanged' | 'refused';
  /** Appelé une fois, à la fermeture. */
  readonly onClose: () => void;
}

/** Fenêtre ouverte. */
export interface ITargetPopup {
  readonly element: HTMLElement;
  /** Ferme la fenêtre (abandonne un choix en cours) ; rend le focus au bouton si `restoreFocus`. */
  close(restoreFocus: boolean): void;
}

interface IPopupParts {
  readonly element: HTMLElement;
  readonly status: HTMLElement;
  readonly pick: HTMLButtonElement;
  readonly firstFocus: HTMLElement;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Ouvre la fenêtre de choix pour `options.anchor`. */
export function openTargetPopup(options: ITargetPopupOptions): ITargetPopup {
  const doc = options.parent.ownerDocument;
  const listeners = new AbortController();
  let pickController: AbortController | null = null;
  let closed = false;

  const close = (restoreFocus: boolean): void => {
    if (closed) return;
    closed = true;
    pickController?.abort();
    listeners.abort();
    parts.element.remove();
    if (restoreFocus && options.anchor.isConnected) options.anchor.focus();
    options.onClose();
  };

  const finish = (target: unknown): void => {
    const result = options.apply(target);
    if (result === 'refused') {
      parts.status.textContent = TargetPopupLabels.refused;
      return;
    }
    close(true);
  };

  const parts = buildPopup(doc, options, finish, () => void startPick());

  const startPick = async (): Promise<void> => {
    const targets = options.stage.stages.map((stage) => stage.targets).find(
      (candidate): candidate is IStageTargets & Required<Pick<IStageTargets, 'pick'>> => typeof candidate?.pick === 'function'
    );
    if (targets === undefined || pickController !== null || closed) return;
    const controller = new AbortController();
    pickController = controller;
    parts.status.textContent = TargetPopupLabels.picking;
    try {
      const picked = await targets.pick(controller.signal);
      if (controller.signal.aborted || closed) return;
      parts.status.textContent = '';
      if (picked !== null) finish(picked);
    } catch {
      if (!controller.signal.aborted && !closed) parts.status.textContent = TargetPopupLabels.pickFailed;
    } finally {
      if (pickController === controller) pickController = null;
    }
  };

  const abortPick = (): void => {
    if (pickController === null) return;
    pickController.abort();
    pickController = null;
    parts.status.textContent = '';
  };

  wireClosing(parts.element, options.anchor, doc, listeners.signal, {
    isPicking: () => pickController !== null,
    abortPick,
    close
  });

  options.parent.appendChild(parts.element);
  position(parts.element, options.anchor, options.parent);
  parts.firstFocus.focus();
  return { element: parts.element, close };
}

interface IClosingHooks {
  readonly isPicking: () => boolean;
  readonly abortPick: () => void;
  readonly close: (restoreFocus: boolean) => void;
}

/** Échap, Tab hors de la fenêtre, clic extérieur ; touches gardées hors des raccourcis. */
function wireClosing(element: HTMLElement, anchor: HTMLElement, doc: Document, signal: AbortSignal, hooks: IClosingHooks): void {
  const inside = (target: EventTarget | null): boolean =>
    target instanceof Node && (element.contains(target) || anchor.contains(target));
  ISOLATED_EVENTS.forEach((type) => element.addEventListener(type, (event) => event.stopPropagation(), { signal }));
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      hooks.close(true);
      return;
    }
    if (!isHistoryChord(event)) event.stopPropagation();
  }, { signal });
  element.addEventListener('focusout', (event) => {
    if (!hooks.isPicking() && event.relatedTarget !== null && !inside(event.relatedTarget)) hooks.close(false);
  }, { signal });
  doc.addEventListener('pointerdown', (event) => {
    if (!hooks.isPicking() && !inside(event.target)) hooks.close(false);
  }, { capture: true, signal });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && hooks.isPicking() && !inside(event.target)) hooks.abortPick();
  }, { capture: true, signal });
}

/** Construit le contenu de la fenêtre. */
function buildPopup(
  doc: Document,
  options: ITargetPopupOptions,
  finish: (target: unknown) => void,
  pick: () => void
): IPopupParts {
  const element = el(doc, 'div', TARGET_POPUP_CLASS);
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', TargetPopupLabels.dialog(options.layerName));
  const status = el(doc, 'p', `${TARGET_POPUP_CLASS}__status`);
  status.setAttribute('role', 'status');
  const list = buildList(doc, options, finish);
  const pickButton = el(doc, 'button', `${TARGET_POPUP_CLASS}__pick`, TargetPopupLabels.pick);
  pickButton.type = 'button';
  const canPick = options.stage.stages.some((stage) => typeof stage.targets?.pick === 'function');
  pickButton.disabled = !canPick;
  if (!canPick) pickButton.title = TargetPopupLabels.pickUnavailable;
  pickButton.addEventListener('click', () => {
    if (!pickButton.disabled) pick();
  });
  const form = buildForm(doc, options, finish, status);
  element.append(list.element, pickButton, form.element, status);
  return { element, status, pick: pickButton, firstFocus: list.first ?? form.text };
}

function describeLabel(stage: IEditorStage, target: LayerTarget, fallback: string): string {
  return stage.describe(target)?.label ?? fallback;
}

/** Liste des cibles proposées : un bouton par cible. */
function buildList(
  doc: Document,
  options: ITargetPopupOptions,
  finish: (target: unknown) => void
): { element: HTMLElement; first: HTMLButtonElement | undefined } {
  const infos = options.stage.listTargets();
  if (infos.length === 0) return { element: el(doc, 'p', `${TARGET_POPUP_CLASS}__empty`, TargetPopupLabels.empty), first: undefined };
  const element = el(doc, 'ul', `${TARGET_POPUP_CLASS}__list`);
  element.setAttribute('aria-label', TargetPopupLabels.list);
  const buttons = infos.map((info) => {
    const item = el(doc, 'li', `${TARGET_POPUP_CLASS}__item`);
    const button = el(doc, 'button', `${TARGET_POPUP_CLASS}__option`, describeLabel(options.stage, info.target, info.label));
    button.type = 'button';
    button.setAttribute('aria-pressed', String(sameTarget(info.target, options.current)));
    if (info.group !== undefined) button.title = info.group;
    button.addEventListener('click', () => finish(info.target));
    item.appendChild(button);
    element.appendChild(item);
    return button;
  });
  return { element, first: buttons[0] };
}

/** Saisie libre : type, texte, scène (plusieurs scènes seulement), bouton Appliquer. */
function buildForm(
  doc: Document,
  options: ITargetPopupOptions,
  finish: (target: unknown) => void,
  status: HTMLElement
): { element: HTMLFormElement; text: HTMLInputElement } {
  const form = el(doc, 'form', `${TARGET_POPUP_CLASS}__form`);
  const kind = el(doc, 'select', `${TARGET_POPUP_CLASS}__kind`);
  kind.setAttribute('aria-label', TargetPopupLabels.kind);
  kind.append(new Option(TargetPopupLabels.selector, 'selector'), new Option(TargetPopupLabels.ref, 'ref'));
  const text = el(doc, 'input', `${TARGET_POPUP_CLASS}__text`);
  text.type = 'text';
  text.setAttribute('aria-label', TargetPopupLabels.text);
  const current = options.current;
  if (current !== undefined && 'ref' in current) {
    kind.value = 'ref';
    text.value = current.ref;
  } else if (current !== undefined && 'selector' in current) {
    text.value = current.selector;
  }
  form.append(kind, text);
  const stageSelect = buildStageSelect(doc, options.stage, current);
  if (stageSelect !== null) {
    form.appendChild(stageSelect);
    const sync = (): void => void (stageSelect.hidden = kind.value !== 'ref');
    kind.addEventListener('change', sync);
    sync();
  }
  const apply = el(doc, 'button', `${TARGET_POPUP_CLASS}__apply`, TargetPopupLabels.apply);
  apply.type = 'submit';
  form.appendChild(apply);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input: ITargetInput = {
      kind: kind.value === 'ref' ? 'ref' : 'selector',
      text: text.value,
      stage: stageSelect?.value
    };
    const target = targetFromInput(input);
    if (target === undefined) {
      status.textContent = TargetPopupLabels.emptyText;
      return;
    }
    finish(target);
  });
  return { element: form, text };
}

function buildStageSelect(doc: Document, stage: IEditorStage, current: LayerTarget | undefined): HTMLSelectElement | null {
  if (stage.stages.length < 2) return null;
  const select = el(doc, 'select', `${TARGET_POPUP_CLASS}__stage`);
  select.setAttribute('aria-label', TargetPopupLabels.stage);
  select.appendChild(new Option(TargetPopupLabels.anyStage, ''));
  stage.stages.forEach((candidate) => select.appendChild(new Option(candidate.id, candidate.id)));
  if (current !== undefined && 'ref' in current && current.stage !== undefined) select.value = current.stage;
  return select;
}

/** Place la fenêtre sous le bouton, dans le repère de l'élément de l'éditeur. */
function position(element: HTMLElement, anchor: HTMLElement, parent: HTMLElement): void {
  const anchorBox = anchor.getBoundingClientRect();
  const parentBox = parent.getBoundingClientRect();
  element.style.left = `${Math.max(0, anchorBox.left - parentBox.left)}px`;
  element.style.top = `${anchorBox.bottom - parentBox.top}px`;
}

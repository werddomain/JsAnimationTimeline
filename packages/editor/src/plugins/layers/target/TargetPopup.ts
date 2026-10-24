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
 * Échap, où que soit le focus, abandonne alors seulement le choix et rend le
 * focus au bouton « Choisir sur la scène » (sans atteindre les raccourcis).
 *
 * Les touches pressées dans la fenêtre ne remontent pas aux raccourcis de
 * l'éditeur, sauf annuler / rétablir (Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z). Une scène
 * qui lève dans `listTargets` ou `describe` donne une liste vide ou le libellé
 * brut ; une erreur de `pick` affiche un message.
 */

import { sameTarget } from '@werddomain/timeline-runtime';
import type { IStageTargets, ITargetInfo, LayerTarget } from '@werddomain/timeline-runtime';
import type { IEditorStage } from '../../../core/stage/types';
import { isHistoryChord } from './historyKeys';
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

/** Classe de la fenêtre (préfixe des classes de ses parties). */
export const TARGET_POPUP_CLASS = 'jt-target-popup';

/** Événements gardés dans la fenêtre (la ligne et la sélection n'y réagissent pas). */
const ISOLATED_EVENTS = ['click', 'dblclick', 'mousedown', 'pointerdown', 'keyup'] as const;

/** Cibles d'une scène qui sait faire choisir un objet. */
type PickingTargets = IStageTargets & Required<Pick<IStageTargets, 'pick'>>;

/** Ce que la fenêtre reçoit du plugin. */
export interface ITargetPopupOptions {
  readonly stage: IEditorStage;
  /** Élément où la fenêtre est ajoutée (l'élément de l'éditeur). */
  readonly parent: HTMLElement;
  /** Bouton de la ligne : position, focus rendu, clics qui ne ferment pas. */
  readonly anchor: HTMLElement;
  readonly layerName: string;
  readonly current: LayerTarget | undefined;
  /** Enregistre la cible : appliquée, inchangée, ou refusée (forme). */
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
  readonly pickButton: HTMLButtonElement;
  readonly firstFocus: HTMLElement;
}

interface IClosingHooks {
  readonly isPicking: () => boolean;
  readonly abortPick: () => void;
  readonly close: (restoreFocus: boolean) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** `<option>` créé dans `doc` (et non dans la fenêtre globale). */
function option(doc: Document, label: string, value: string): HTMLOptionElement {
  const element = doc.createElement('option');
  element.textContent = label;
  element.value = value;
  return element;
}

/** Cibles de la première scène qui sait faire choisir un objet, ou `undefined`. */
function findPicker(stage: IEditorStage): PickingTargets | undefined {
  return stage.stages
    .map((candidate) => candidate.targets)
    .find((targets): targets is PickingTargets => typeof targets?.pick === 'function');
}

/** Cibles proposées ; vide si une scène lève. */
function safeList(stage: IEditorStage): readonly ITargetInfo[] {
  try {
    return stage.listTargets();
  } catch {
    return [];
  }
}

/** Libellé de `target` par la scène (texte non vide), sinon `fallback` ; une scène qui lève donne `fallback`. */
function describeLabel(stage: IEditorStage, target: LayerTarget, fallback: string): string {
  try {
    const label = stage.describe(target)?.label;
    return typeof label === 'string' && label !== '' ? label : fallback;
  } catch {
    return fallback;
  }
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
    if (options.apply(target) === 'refused') {
      parts.status.textContent = TargetPopupLabels.refused;
      return;
    }
    close(true);
  };

  const startPick = async (): Promise<void> => {
    if (pickController !== null || closed) return;
    const controller = new AbortController();
    pickController = controller;
    let picked: LayerTarget | null;
    try {
      const targets = findPicker(options.stage);
      if (targets === undefined) return;
      parts.status.textContent = TargetPopupLabels.picking;
      picked = await targets.pick(controller.signal);
    } catch {
      if (!controller.signal.aborted && !closed) parts.status.textContent = TargetPopupLabels.pickFailed;
      return;
    } finally {
      if (pickController === controller) pickController = null;
    }
    if (controller.signal.aborted || closed) return;
    parts.status.textContent = '';
    // Hors du `try` : une erreur d'enregistrement n'est pas prise pour un échec du choix.
    if (picked !== null) finish(picked);
  };

  const abortPick = (): void => {
    if (pickController === null) return;
    pickController.abort();
    pickController = null;
    parts.status.textContent = '';
    if (!parts.pickButton.disabled) parts.pickButton.focus();
  };

  const parts = buildPopup(doc, options, finish, () => void startPick());
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

/** Échap, Tab hors de la fenêtre, clic extérieur ; touches gardées hors des raccourcis. */
function wireClosing(element: HTMLElement, anchor: HTMLElement, doc: Document, signal: AbortSignal, hooks: IClosingHooks): void {
  const inside = (target: EventTarget | null): boolean =>
    target instanceof Node && (element.contains(target) || anchor.contains(target));
  ISOLATED_EVENTS.forEach((type) => element.addEventListener(type, (event) => event.stopPropagation(), { signal }));
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (hooks.isPicking()) hooks.abortPick();
      else hooks.close(true);
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
    if (event.key !== 'Escape' || !hooks.isPicking() || inside(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    hooks.abortPick();
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
  const canPick = findPicker(options.stage) !== undefined;
  pickButton.disabled = !canPick;
  if (!canPick) pickButton.title = TargetPopupLabels.pickUnavailable;
  pickButton.addEventListener('click', () => {
    if (!pickButton.disabled) pick();
  });
  const form = buildForm(doc, options, finish, status);
  element.append(list.element, pickButton, form.element, status);
  return { element, status, pickButton, firstFocus: list.first ?? form.text };
}

/** Liste des cibles proposées : un bouton par cible. */
function buildList(
  doc: Document,
  options: ITargetPopupOptions,
  finish: (target: unknown) => void
): { element: HTMLElement; first: HTMLButtonElement | undefined } {
  const infos = safeList(options.stage);
  if (infos.length === 0) return { element: el(doc, 'p', `${TARGET_POPUP_CLASS}__empty`, TargetPopupLabels.empty), first: undefined };
  const element = el(doc, 'ul', `${TARGET_POPUP_CLASS}__list`);
  element.setAttribute('aria-label', TargetPopupLabels.list);
  const buttons = infos.map((info) => {
    const item = el(doc, 'li', `${TARGET_POPUP_CLASS}__item`);
    const label = describeLabel(options.stage, info.target, String(info.label));
    const button = el(doc, 'button', `${TARGET_POPUP_CLASS}__option`, label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(sameTarget(info.target, options.current)));
    if (typeof info.group === 'string') button.title = info.group;
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
  kind.append(option(doc, TargetPopupLabels.selector, 'selector'), option(doc, TargetPopupLabels.ref, 'ref'));
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
    const showStage = (): void => {
      stageSelect.hidden = kind.value !== 'ref';
    };
    kind.addEventListener('change', showStage);
    showStage();
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

/** Choix de la scène d'une ref, seulement quand il y a plusieurs scènes. */
function buildStageSelect(doc: Document, stage: IEditorStage, current: LayerTarget | undefined): HTMLSelectElement | null {
  if (stage.stages.length < 2) return null;
  const select = el(doc, 'select', `${TARGET_POPUP_CLASS}__stage`);
  select.setAttribute('aria-label', TargetPopupLabels.stage);
  select.appendChild(option(doc, TargetPopupLabels.anyStage, ''));
  stage.stages.forEach((candidate) => select.appendChild(option(doc, candidate.id, candidate.id)));
  if (current !== undefined && 'ref' in current && current.stage !== undefined) select.value = current.stage;
  return select;
}

/** Place la fenêtre sous le bouton, dans le repère de l'élément de l'éditeur. */
function position(element: HTMLElement, anchor: HTMLElement, parent: HTMLElement): void {
  const anchorBox = anchor.getBoundingClientRect();
  const parentBox = parent.getBoundingClientRect();
  element.style.left = `${Math.max(0, anchorBox.left - parentBox.left + parent.scrollLeft)}px`;
  element.style.top = `${anchorBox.bottom - parentBox.top + parent.scrollTop}px`;
}

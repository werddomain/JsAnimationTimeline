// packages/editor/src/plugins/layers/target/TargetPopup.ts
/**
 * Fenêtre de choix de la cible d'un calque (`layers.target`) :
 * - liste des cibles proposées par les scènes (`ctx.stage.listTargets()`,
 *   libellés de `describe`), la cible courante marquée ;
 * - bouton « Choisir sur la scène » : `targets.pick(signal)` de la première
 *   scène qui en a un (désactivé sinon), abandonné par la fermeture, Échap ou
 *   la destruction ; un résultat tardif ou annulé (`null`) ne change rien ;
 * - saisie libre : sélecteur CSS ou référence. La liste des scènes s'affiche
 *   quand il y en a plusieurs, ou quand la cible courante nomme une scène
 *   inconnue (« (inconnue) », pour pouvoir la corriger). Elle est préréglée
 *   sur la scène de la cible courante, sinon sur la première scène ;
 *   « Automatique » (aucune scène) reste un choix explicite. Sans liste, une
 *   référence va à la seule scène, sauf la référence préremplie d'une cible
 *   sans scène, gardée telle quelle : appliquer le texte prérempli ne change
 *   donc jamais rien.
 *
 * Fenêtre `role="dialog"` ajoutée dans l'élément de l'éditeur, placée comme
 * le menu de `layers.icon`. Elle se ferme sur Échap (focus rendu au bouton de
 * la ligne), quand le focus la quitte (Tab), sur un clic extérieur, ou à la
 * demande du plugin (calque supprimé, destruction) : si le focus était dans
 * la fenêtre, il revient au bouton, ou à l'éditeur si le bouton a disparu.
 * Un mousedown dans la fenêtre ne déplace pas le focus (sauf dans les champs) :
 * Safari et Firefox macOS ne focalisent pas les boutons, et une zone vide
 * donnerait le focus à l'éditeur, ce qui fermerait la fenêtre avant le clic.
 * Pendant un choix sur la scène, le clic extérieur et la perte du focus ne la
 * ferment pas (l'utilisateur clique justement sur la scène) ; Échap, où que
 * soit le focus, abandonne alors seulement le choix ; à la fin du choix
 * (annulé, refusé, échoué), le focus revient au bouton « Choisir sur la scène ».
 *
 * Les touches pressées dans la fenêtre ne remontent pas aux raccourcis de
 * l'éditeur, sauf annuler / rétablir (Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z). Une scène
 * qui lève dans `listTargets` ou `describe` donne une liste vide ou le libellé
 * brut ; une erreur de `pick` affiche un message.
 */

import { sameTarget } from '@kazo-ca/timeline-runtime';
import type { IStageTargets, ITargetInfo, LayerTarget } from '@kazo-ca/timeline-runtime';
import type { IEditorStage } from '../../../core/stage/types';
import { clampMenuPosition } from '../icon/menuPosition';
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
  unknownStage: (id: string): string => `${id} (inconnue)`,
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

/** Résultat d'un enregistrement : appliqué, inchangé (même cible) ou refusé avec un motif. */
export type ITargetApplyResult =
  | { readonly kind: 'applied' | 'unchanged' }
  | { readonly kind: 'refused'; readonly message: string };

/** Saisie en cours et partie qui a le focus, reprises quand la fenêtre est reconstruite. */
export interface ITargetPopupDraft {
  readonly kind: 'selector' | 'ref';
  readonly text: string;
  /** Valeur de la liste des scènes, `null` sans liste. */
  readonly stage: string | null;
  /** Partie qui avait le focus (`option:2`, `text`, `pick`...), `null` si le focus était ailleurs. */
  readonly focus: string | null;
  /** Vrai si l'utilisateur a modifié la saisie (type, texte ou scène) : seule une saisie modifiée est reprise. */
  readonly edited: boolean;
}

/** Ce que la fenêtre reçoit du plugin. */
export interface ITargetPopupOptions {
  readonly stage: IEditorStage;
  /** Élément où la fenêtre est ajoutée (l'élément de l'éditeur), qui reprend le focus si le bouton a disparu. */
  readonly parent: HTMLElement;
  /** Bouton de la ligne : position, focus rendu, clics qui ne ferment pas. */
  readonly anchor: HTMLElement;
  readonly layerName: string;
  readonly current: LayerTarget | undefined;
  /** Enregistre la cible. */
  readonly apply: (target: unknown) => ITargetApplyResult;
  /** Appelé une fois, à la fermeture. */
  readonly onClose: () => void;
  /** Saisie à reprendre (reconstruction) ; le focus n'est donné que si `draft.focus` est connu. */
  readonly draft?: ITargetPopupDraft;
  /** Appelé quand un choix sur la scène se termine sans fermer la fenêtre (annulé, échoué, refusé). */
  readonly onPickEnd?: () => void;
}

/** Fenêtre ouverte. */
export interface ITargetPopup {
  readonly element: HTMLElement;
  /**
   * Ferme la fenêtre (abandonne un choix en cours). Le focus revient au bouton
   * si `restoreFocus`, ou s'il était dans la fenêtre (à l'éditeur si le bouton
   * a disparu).
   */
  close(restoreFocus: boolean, anchorGone?: boolean): void;
  /** Vrai pendant un choix sur la scène. */
  readonly picking: boolean;
  /** Saisie en cours et partie qui a le focus. */
  draft(): ITargetPopupDraft;
}

interface IPopupParts {
  readonly element: HTMLElement;
  readonly status: HTMLElement;
  readonly pickButton: HTMLButtonElement;
  readonly firstFocus: HTMLElement;
  readonly form: IFormParts;
}

interface IFormParts {
  readonly element: HTMLFormElement;
  readonly kind: HTMLSelectElement;
  readonly text: HTMLInputElement;
  readonly stageSelect: HTMLSelectElement | null;
  /** Vrai si l'utilisateur a modifié le type, le texte ou la scène. */
  readonly isEdited: () => boolean;
}

/** Nom de la partie `element` de la fenêtre (`option:i` pour une cible de la liste), pour la retrouver. */
function partOf(popup: HTMLElement, element: Element | null): string | null {
  if (element === null || !popup.contains(element)) return null;
  const options = Array.from(popup.querySelectorAll(`.${TARGET_POPUP_CLASS}__option`));
  const index = options.indexOf(element);
  if (index >= 0) return `option:${index}`;
  const prefix = `${TARGET_POPUP_CLASS}__`;
  const name = Array.from(element.classList).find((className) => className.startsWith(prefix));
  return name === undefined ? null : name.slice(prefix.length);
}

/** Élément de la partie `part` (voir `partOf`), ou `null`. */
function partElement(popup: HTMLElement, part: string): HTMLElement | null {
  if (part.startsWith('option:')) {
    const options = popup.querySelectorAll<HTMLElement>(`.${TARGET_POPUP_CLASS}__option`);
    return options[Number(part.slice('option:'.length))] ?? null;
  }
  return popup.querySelector<HTMLElement>(`.${TARGET_POPUP_CLASS}__${part}`);
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

/** Champ de saisie qui garde son comportement au mousedown (curseur, liste déroulante). */
function isField(target: EventTarget | null): boolean {
  // Par le nom de balise : `instanceof` échouerait pour un document d'une autre fenêtre (iframe).
  const tag = (target as { readonly tagName?: unknown } | null)?.tagName;
  return tag === 'INPUT' || tag === 'SELECT';
}

/** Ouvre la fenêtre de choix pour `options.anchor`. */
export function openTargetPopup(options: ITargetPopupOptions): ITargetPopup {
  const doc = options.parent.ownerDocument;
  const listeners = new AbortController();
  let pickController: AbortController | null = null;
  let closed = false;

  const close = (restoreFocus: boolean, anchorGone = false): void => {
    if (closed) return;
    closed = true;
    const hadFocus = parts.element.contains(doc.activeElement);
    pickController?.abort();
    listeners.abort();
    parts.element.remove();
    if (restoreFocus || hadFocus) (!anchorGone && options.anchor.isConnected ? options.anchor : options.parent).focus();
    options.onClose();
  };

  const backToPickButton = (): void => {
    if (!closed && !parts.pickButton.disabled) parts.pickButton.focus();
  };

  const finish = (target: unknown): void => {
    const result = options.apply(target);
    if (result.kind === 'refused') {
      parts.status.textContent = result.message;
      return;
    }
    close(true);
  };

  const pickEnded = (): void => {
    if (!closed) options.onPickEnd?.();
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
      if (!controller.signal.aborted && !closed) {
        // Deferred rebuilds must observe an idle picker, even before the finally cleanup.
        if (pickController === controller) pickController = null;
        parts.status.textContent = TargetPopupLabels.pickFailed;
        backToPickButton();
        pickEnded();
      }
      return;
    } finally {
      if (pickController === controller) pickController = null;
    }
    if (controller.signal.aborted || closed) return;
    parts.status.textContent = '';
    // Hors du `try` : une erreur d'enregistrement n'est pas prise pour un échec du choix.
    if (picked !== null) finish(picked);
    backToPickButton();
    pickEnded();
  };

  const abortPick = (): void => {
    if (pickController === null) return;
    pickController.abort();
    pickController = null;
    parts.status.textContent = '';
    backToPickButton();
    pickEnded();
  };

  const parts = buildPopup(doc, options, finish, () => void startPick());
  wireClosing(parts.element, options.anchor, doc, listeners.signal, {
    isPicking: () => pickController !== null,
    abortPick,
    close
  });

  options.parent.appendChild(parts.element);
  position(parts.element, options.anchor);
  const draft = options.draft;
  if (draft === undefined) parts.firstFocus.focus();
  else if (draft.focus !== null) (partElement(parts.element, draft.focus) ?? parts.firstFocus).focus();
  return {
    element: parts.element,
    close,
    get picking(): boolean {
      return pickController !== null;
    },
    draft: (): ITargetPopupDraft => ({
      kind: parts.form.kind.value === 'ref' ? 'ref' : 'selector',
      text: parts.form.text.value,
      stage: parts.form.stageSelect?.value ?? null,
      focus: partOf(parts.element, doc.activeElement),
      edited: parts.form.isEdited()
    })
  };
}

/** Échap, Tab hors de la fenêtre, clic extérieur ; touches gardées hors des raccourcis. */
function wireClosing(element: HTMLElement, anchor: HTMLElement, doc: Document, signal: AbortSignal, hooks: IClosingHooks): void {
  const inside = (target: EventTarget | null): boolean =>
    target instanceof Node && (element.contains(target) || anchor.contains(target));
  // Un ancêtre (l'éditeur, focalisable, ou la ligne du bouton) qui prend le focus n'est pas une sortie :
  // les vrais clics extérieurs passent par le pointerdown du document.
  const isAncestor = (target: Node): boolean => target.contains(element) || target.contains(anchor);
  ISOLATED_EVENTS.forEach((type) => element.addEventListener(type, (event) => event.stopPropagation(), { signal }));
  element.addEventListener('mousedown', (event) => {
    if (!isField(event.target)) event.preventDefault();
  }, { signal });
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && leavesByTab(element, event)) {
      // Comme le menu d'icônes : Tab hors de la fenêtre la ferme et rend le focus au bouton de la ligne.
      event.preventDefault();
      event.stopPropagation();
      hooks.close(true);
      return;
    }
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
    const next = event.relatedTarget;
    if (hooks.isPicking() || !(next instanceof Node) || inside(next) || isAncestor(next)) return;
    hooks.close(false);
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

/** Vrai si Tab (ou Maj+Tab) sort de la fenêtre : focus sur son dernier (ou premier) élément focalisable. */
function leavesByTab(element: HTMLElement, event: KeyboardEvent): boolean {
  const focusable = Array.from(element.querySelectorAll<HTMLElement>('button, input, select'))
    .filter((candidate) => !(candidate as HTMLButtonElement).disabled && !candidate.hidden);
  const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
  return edge !== undefined && event.target === edge;
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
  return { element, status, pickButton, firstFocus: list.first ?? form.text, form };
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

/** Scène de la cible courante si c'est une ref (`undefined` sinon ou sans scène). */
function currentRefStage(current: LayerTarget | undefined): string | undefined {
  return current !== undefined && 'ref' in current ? current.stage : undefined;
}

/**
 * Scène d'une ref saisie (`text` rogné) : celle de la liste quand elle est
 * affichée (« Automatique » : aucune). Sans liste : la seule scène, sauf la
 * ref préremplie d'une cible sans scène, gardée sans scène ; sans aucune
 * scène (timeline seule), la scène de la cible courante.
 */
function refStageOf(stage: IEditorStage, current: LayerTarget | undefined, select: HTMLSelectElement | null, text: string): string | undefined {
  if (select !== null) return select.value === '' ? undefined : select.value;
  const only = stage.stages.length === 1 ? stage.stages[0] : undefined;
  if (only === undefined) return currentRefStage(current);
  const unchangedStageless = current !== undefined && 'ref' in current && current.stage === undefined && current.ref === text;
  // Gardée sans scène seulement si la scène la prend telle quelle ; sinon rattachée (l'alerte disparaît).
  return unchangedStageless && acceptsTarget(only, { ref: text }) ? undefined : only.id;
}

/** `stage.accepts(target)`, faux si la scène lève. */
function acceptsTarget(stage: { accepts(target: LayerTarget): boolean }, target: LayerTarget): boolean {
  try {
    return stage.accepts(target) === true;
  } catch {
    return false;
  }
}

/** Saisie libre : type, texte, scène (voir `buildStageSelect`), bouton Appliquer. */
function buildForm(
  doc: Document,
  options: ITargetPopupOptions,
  finish: (target: unknown) => void,
  status: HTMLElement
): IFormParts {
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
  const draft = options.draft;
  // Seule une saisie modifiée est reprise : sinon la nouvelle cible remplit le formulaire.
  if (draft !== undefined && draft.edited) {
    kind.value = draft.kind;
    text.value = draft.text;
    // Une scène qui n'est plus dans la liste (« (inconnue) » devenue connue) garde le préréglage.
    const stillListed = stageSelect !== null && Array.from(stageSelect.options).some((choice) => choice.value === draft.stage);
    if (stageSelect !== null && draft.stage !== null && stillListed) stageSelect.value = draft.stage;
  }
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
    const isRef = kind.value === 'ref';
    const input: ITargetInput = {
      kind: isRef ? 'ref' : 'selector',
      text: text.value,
      stage: isRef ? refStageOf(options.stage, current, stageSelect, text.value.trim()) : undefined
    };
    const target = targetFromInput(input);
    if (target === undefined) {
      status.textContent = TargetPopupLabels.emptyText;
      return;
    }
    finish(target);
  });
  let edited = draft?.edited === true;
  const markEdited = (): void => {
    edited = true;
  };
  kind.addEventListener('change', markEdited);
  text.addEventListener('input', markEdited);
  stageSelect?.addEventListener('change', markEdited);
  return { element: form, kind, text, stageSelect, isEdited: () => edited };
}

/**
 * Choix de la scène d'une ref : affiché quand il y a plusieurs scènes, ou
 * quand la cible courante nomme une scène inconnue (ajoutée « (inconnue) »).
 * Préréglé sur la scène de la cible courante (« Automatique » pour une ref
 * sans scène), sinon sur la première scène ; « Automatique » (aucune scène)
 * reste un choix explicite, en dernier.
 */
function buildStageSelect(doc: Document, stage: IEditorStage, current: LayerTarget | undefined): HTMLSelectElement | null {
  const ids = stage.stages.map((candidate) => candidate.id);
  const currentStage = currentRefStage(current);
  const unknown = currentStage !== undefined && !ids.includes(currentStage);
  if (ids.length === 0 || (ids.length === 1 && !unknown)) return null;
  const select = el(doc, 'select', `${TARGET_POPUP_CLASS}__stage`);
  select.setAttribute('aria-label', TargetPopupLabels.stage);
  ids.forEach((id) => select.appendChild(option(doc, id, id)));
  if (unknown) select.appendChild(option(doc, TargetPopupLabels.unknownStage(currentStage), currentStage));
  select.appendChild(option(doc, TargetPopupLabels.anyStage, ''));
  // « Automatique » seulement pour une ref sans scène qu'une scène prend telle quelle.
  const keepsStageless = current !== undefined && 'ref' in current && currentStage === undefined &&
    stage.stages.some((candidate) => acceptsTarget(candidate, current));
  select.value = currentStage ?? (keepsStageless ? '' : ids[0] ?? '');
  return select;
}

/**
 * Place la fenêtre (position `fixed`) sous le bouton, ramenée dans la fenêtre
 * du navigateur, comme le menu d'icônes de `layers.icon`.
 */
function position(element: HTMLElement, anchor: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  const size = element.getBoundingClientRect();
  const placed = clampMenuPosition(
    anchor.getBoundingClientRect(),
    { width: size.width, height: size.height },
    { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 }
  );
  element.style.left = `${placed.left}px`;
  element.style.top = `${placed.top}px`;
}

// packages/editor/src/plugins/toolbar/keyframeActions/KeyframeActionsPlugin.ts
/**
 * Plugin : toolbar.keyframeActions
 * Epic : toolbar
 * Dépend de : toolbar, toolbar.main, frames.keyframes, frames.selection, tweens.motion, interaction.shortcuts
 * Écoute : frames:selectionChanged, layers:selectionChanged, document:changed, document:loaded, tweens:motionAvailabilityChanged,
 *   playhead:changed, playback:pause, playback:complete
 * Émet : toolbar:editKeyframe
 *
 * Les quatre boutons d'images clés de la barre d'outils (groupe `keyframes`),
 * dans un seul contrôle de `toolbar.main` :
 * - « Ajouter une image clé » : `frames.keyframes.insertKeyframe()` ;
 * - « Créer une interpolation de mouvement » : `tweens.motion.create()` ;
 * - « Supprimer » : l'action aiguillée par `resolveDeleteAction` (image clé
 *   de propriété, interpolation ou image clé), nommée dans l'infobulle ;
 * - « Modifier l'image clé » : émet `toolbar:editKeyframe` (le panneau de
 *   propriétés l'écoute).
 *
 * Ce plugin ne contient aucune logique de modèle et n'enregistre aucun
 * raccourci (F5 / F6 / F7 sont à `frames.keyframes`). Un bouton indisponible
 * porte `aria-disabled="true"` (jamais l'attribut natif : il reste
 * focalisable) et sa raison en infobulle ; son activation, au clic comme au
 * clavier, ne fait rien. L'état se met à jour sur les changements de
 * sélection, de document et de disponibilité des interpolations, pas sur les
 * mouvements du pointeur, mais sur la tête de lecture (`playhead:changed`),
 * dont dépendent le repli sur les calques sélectionnés et `inTween`. La tête
 * ne compte que sans image sélectionnée et hors lecture : sinon son
 * mouvement est ignoré (la fin de la lecture, `playback:pause` ou
 * `playback:complete`, rafraîchit). Les attributs ne sont réécrits que s'ils
 * changent.
 * `layers.selection` est lu s'il est présent. La raison d'un bouton
 * indisponible est aussi donnée aux lecteurs d'écran (`aria-description`).
 *
 * « Modifier » vise une image clé (sélectionnée, sinon celle de la tête de
 * lecture sur un calque sélectionné). Avec un calque seul sélectionné (sans
 * image) et la tête de lecture dans une interpolation, « Supprimer » passe
 * par `deleteKeyframe()` (`canRemove` ne lit que les images sélectionnées),
 * actif seulement si la tête de lecture est sur une image clé. « Supprimer »
 * est désactivé (« Sélectionnez une image clé. ») quand aucune cible ne porte
 * d'image clé. Pas de pré-contrôle du modèle au-delà.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import '../../frames/keyframes/types';
import '../../frames/selection/types';
import '../../layers/selection/types';
import '../../tweens/motion/types';
import { findNodeById } from '@werddomain/timeline-runtime';
import { rowMarks } from '../../frames/grid/gridCells';
import { ToolbarGroupOrders } from '../main/ToolbarItems';
import { computeKeyframeActionsState } from './keyframeActionsState';
import type { IKeyframeActionsInput, IKeyframeActionsState } from './keyframeActionsState';
import './types';
import './KeyframeActions.less';

/** Identifiant du plugin (et de son contrôle dans la barre d'outils). */
export const KEYFRAME_ACTIONS_PLUGIN_ID = 'toolbar.keyframeActions';

/** Libellé du contrôle (nom accessible du groupe de boutons). */
export const KEYFRAME_ACTIONS_LABEL = 'Actions des images clés';

/** Classe du contrôle. */
export const KEYFRAME_ACTIONS_CLASS = 'jt-keyframeActions';

type KeyframeAction = 'insert' | 'createTween' | 'delete' | 'edit';

interface IButtonSpec {
  readonly action: KeyframeAction;
  readonly label: string;
  readonly icon: string;
  /** Raccourci rappelé dans l'infobulle (affiché par `interaction.shortcuts`). */
  readonly shortcut?: string;
}

const BUTTONS: readonly IButtonSpec[] = [
  { action: 'insert', label: 'Ajouter une image clé', icon: '◆', shortcut: 'F6' },
  { action: 'createTween', label: 'Créer une interpolation de mouvement', icon: '⟷' },
  { action: 'delete', label: "Supprimer l'image clé ou l'interpolation", icon: '✕', shortcut: 'Shift+F6' },
  { action: 'edit', label: "Modifier l'image clé", icon: '✎' }
];

/** Plugin `toolbar.keyframeActions` : ajouter, interpoler, supprimer et modifier les images clés. */
export class KeyframeActionsPlugin implements EditorPlugin {
  readonly id = 'toolbar.keyframeActions';
  readonly dependencies: readonly string[] = [
    'toolbar',
    'toolbar.main',
    'frames.keyframes',
    'frames.selection',
    'tweens.motion',
    'interaction.shortcuts'
  ];

  private ctx: IEditorContext | null = null;
  private buttons = new Map<KeyframeAction, HTMLButtonElement>();
  private state: IKeyframeActionsState | null = null;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const cleanups: Array<() => void> = [];
    try {
      const refresh = (): void => this.refresh();
      cleanups.push(ctx.events.on('frames:selectionChanged', refresh));
      cleanups.push(ctx.events.on('layers:selectionChanged', refresh));
      cleanups.push(ctx.events.on('document:changed', refresh));
      cleanups.push(ctx.events.on('document:loaded', refresh));
      cleanups.push(ctx.events.on('tweens:motionAvailabilityChanged', refresh));
      cleanups.push(ctx.events.on('playback:pause', refresh));
      cleanups.push(ctx.events.on('playback:complete', refresh));
      cleanups.push(ctx.events.on('playhead:changed', () => this.onPlayhead()));
      this.ctx = ctx;
      cleanups.push(
        ctx.services.require('toolbar.main').addControl({
          id: KEYFRAME_ACTIONS_PLUGIN_ID,
          label: KEYFRAME_ACTIONS_LABEL,
          group: 'keyframes',
          order: ToolbarGroupOrders.keyframes + 1,
          render: (element) => this.renderControl(element)
        })
      );
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      this.ctx = null;
      throw error;
    }
    this.cleanups = cleanups;
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.buttons = new Map();
    this.state = null;
    this.ctx = null;
  }

  private renderControl(element: HTMLElement): () => void {
    const doc = element.ownerDocument;
    element.classList.add(KEYFRAME_ACTIONS_CLASS);
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', KEYFRAME_ACTIONS_LABEL);
    const buttons = new Map<KeyframeAction, HTMLButtonElement>();
    const removers: Array<() => void> = [];
    BUTTONS.forEach((spec) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.classList.add('jt-toolbar__button', `${KEYFRAME_ACTIONS_CLASS}__${spec.action}`);
      button.dataset.keyframeAction = spec.action;
      button.setAttribute('aria-label', spec.label);
      const icon = doc.createElement('span');
      icon.classList.add('jt-toolbar__icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = spec.icon;
      button.append(icon);
      const onClick = (): void => this.activate(spec.action);
      // Un bouton indisponible ne réagit pas à Entrée ni Espace (qui déclencheraient un clic).
      const onKeyDown = (event: KeyboardEvent): void => {
        if ((event.key === 'Enter' || event.key === ' ') && button.getAttribute('aria-disabled') === 'true') {
          event.preventDefault();
        }
      };
      button.addEventListener('click', onClick);
      button.addEventListener('keydown', onKeyDown);
      removers.push(() => {
        button.removeEventListener('click', onClick);
        button.removeEventListener('keydown', onKeyDown);
      });
      buttons.set(spec.action, button);
      element.append(button);
    });
    this.buttons = buttons;
    this.refresh();
    return () => {
      removers.forEach((remove) => remove());
      if (this.buttons === buttons) this.buttons = new Map();
    };
  }

  /** Entrées du calcul d'état, lues dans les services au moment de l'appel. */
  private readInput(ctx: IEditorContext): IKeyframeActionsInput {
    const selection = ctx.services.require('frames.selection');
    const motion = ctx.services.require('tweens.motion');
    return {
      doc: ctx.document,
      cells: selection.cells(),
      selectedKeyframes: selection.keyframes(),
      playheadFrame: ctx.playback.frame,
      layerIds: ctx.services.get('layers.selection')?.selected(),
      keyframeAt: (layerId, frame) => hasKeyframeAt(ctx.document, layerId, frame),
      tweenAt: (layerId, frame) => motion.tweenAt(layerId, frame),
      canCreate: motion.canCreate(),
      canRemove: motion.canRemove()
    };
  }

  /** La tête de lecture ne compte que sans image sélectionnée et hors lecture. */
  private onPlayhead(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.playback.playing) return;
    if (ctx.services.require('frames.selection').cells().length > 0) return;
    this.refresh();
  }

  /** Recalcule l'état (une seule fois) et le recopie dans les boutons. */
  private refresh(): void {
    const ctx = this.ctx;
    if (ctx === null || this.buttons.size === 0) return;
    const state = computeKeyframeActionsState(this.readInput(ctx));
    this.state = state;
    const shortcuts = ctx.services.require('interaction.shortcuts');
    BUTTONS.forEach((spec) => {
      const button = this.buttons.get(spec.action);
      if (button === undefined) return;
      const { enabled, reason } = state[spec.action];
      const label = spec.action === 'delete' ? state.delete.label : spec.label;
      setAttr(button, 'aria-label', label);
      if (enabled) {
        unsetAttr(button, 'aria-disabled');
        unsetAttr(button, 'aria-description');
        setTitle(button, this.hintedLabel(spec, label, state, (keys) => shortcuts.format(keys)));
      } else {
        setAttr(button, 'aria-disabled', 'true');
        setTitle(button, reason === undefined ? label : `${label} : ${reason}`);
        if (reason === undefined) unsetAttr(button, 'aria-description');
        else setAttr(button, 'aria-description', reason);
      }
    });
  }

  /** Libellé suivi du raccourci, sauf pour « Supprimer » quand c'est `remove()` qui part (Maj+F6 ne le ferait pas). */
  private hintedLabel(
    spec: IButtonSpec,
    label: string,
    state: IKeyframeActionsState,
    format: (keys: string) => string
  ): string {
    if (spec.shortcut === undefined) return label;
    if (spec.action === 'delete' && state.delete.action !== 'deleteKeyframe') return label;
    return `${label} (${format(spec.shortcut)})`;
  }

  /** Exécute l'action d'un bouton, si elle est disponible à l'instant du clic. */
  private activate(action: KeyframeAction): void {
    const ctx = this.ctx;
    if (ctx === null || this.buttons.size === 0) return;
    this.refresh();
    const state = this.state;
    if (state === null || !state[action].enabled) return;
    switch (action) {
      case 'insert':
        ctx.services.require('frames.keyframes').insertKeyframe();
        return;
      case 'createTween':
        ctx.services.require('tweens.motion').create();
        return;
      case 'delete':
        if (state.delete.action === 'removeTween') ctx.services.require('tweens.motion').remove();
        else ctx.services.require('frames.keyframes').deleteKeyframe();
        return;
      case 'edit':
        if (state.editTarget !== undefined) ctx.events.emit('toolbar:editKeyframe', state.editTarget);
        return;
    }
  }
}

/** Écrit un attribut seulement s'il change. */
function setAttr(button: HTMLButtonElement, name: string, value: string): void {
  if (button.getAttribute(name) !== value) button.setAttribute(name, value);
}

function unsetAttr(button: HTMLButtonElement, name: string): void {
  if (button.hasAttribute(name)) button.removeAttribute(name);
}

function setTitle(button: HTMLButtonElement, title: string): void {
  if (button.title !== title) button.title = title;
}

/** Vrai si l'image `frame` du calque porte une image clé (contenu ou propriété). */
function hasKeyframeAt(doc: IEditorContext['document'], layerId: string, frame: number): boolean {
  const node = findNodeById(doc.layers, layerId);
  if (node === undefined) return false;
  return rowMarks(node, doc.settings.totalFrames, { first: frame, last: frame }).some((mark) => mark.kind !== 'spanEnd');
}

/** Crée le plugin `toolbar.keyframeActions`. */
export function createKeyframeActionsPlugin(): KeyframeActionsPlugin {
  return new KeyframeActionsPlugin();
}

// packages/editor/src/plugins/toolbar/keyframeActions/KeyframeActionsPlugin.ts
/**
 * Plugin : toolbar.keyframeActions
 * Epic : toolbar
 * Dépend de : toolbar, toolbar.main, frames.keyframes, frames.selection, tweens.motion, interaction.shortcuts
 * Écoute : frames:selectionChanged, layers:selectionChanged, document:changed, document:loaded, tweens:motionAvailabilityChanged
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
 * mouvements du pointeur. `layers.selection` est lu s'il est présent.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import '../../frames/keyframes/types';
import '../../frames/selection/types';
import '../../layers/selection/types';
import '../../tweens/motion/types';
import { ToolbarGroupOrders } from '../main/ToolbarItems';
import { computeKeyframeActionsState } from './keyframeActionsState';
import type { IActionAvailability, IKeyframeActionsInput, IKeyframeActionsState } from './keyframeActionsState';
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
      tweenAt: (layerId, frame) => motion.tweenAt(layerId, frame),
      canCreate: motion.canCreate(),
      canRemove: motion.canRemove()
    };
  }

  /** Recopie l'état courant dans les boutons. */
  private refresh(): void {
    const ctx = this.ctx;
    if (ctx === null || this.buttons.size === 0) return;
    const state = computeKeyframeActionsState(this.readInput(ctx));
    const shortcuts = ctx.services.require('interaction.shortcuts');
    BUTTONS.forEach((spec) => {
      const button = this.buttons.get(spec.action);
      if (button === undefined) return;
      const availability = this.availabilityOf(spec.action, state);
      const label = spec.action === 'delete' ? state.delete.label : spec.label;
      button.setAttribute('aria-label', label);
      if (availability.enabled) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', 'true');
      const hint = spec.shortcut !== undefined && this.hasShortcutHint(spec.action, state);
      button.title = availability.enabled
        ? hint && spec.shortcut !== undefined
          ? `${label} (${shortcuts.format(spec.shortcut)})`
          : label
        : (availability.reason ?? label);
    });
  }

  /** L'infobulle de « Supprimer » rappelle Maj+F6 seulement quand c'est `deleteKeyframe` qui part. */
  private hasShortcutHint(action: KeyframeAction, state: IKeyframeActionsState): boolean {
    return action !== 'delete' || state.delete.action === 'deleteKeyframe';
  }

  private availabilityOf(action: KeyframeAction, state: IKeyframeActionsState): IActionAvailability {
    return state[action];
  }

  /** Exécute l'action d'un bouton, si elle est disponible à l'instant du clic. */
  private activate(action: KeyframeAction): void {
    const ctx = this.ctx;
    const button = this.buttons.get(action);
    if (ctx === null || button === undefined) return;
    this.refresh();
    if (button.getAttribute('aria-disabled') === 'true') return;
    switch (action) {
      case 'insert':
        ctx.services.require('frames.keyframes').insertKeyframe();
        return;
      case 'createTween':
        ctx.services.require('tweens.motion').create();
        return;
      case 'delete':
        this.runDelete(ctx);
        return;
      case 'edit':
        this.runEdit(ctx);
        return;
    }
  }

  private runDelete(ctx: IEditorContext): void {
    const state = computeKeyframeActionsState(this.readInput(ctx));
    if (state.delete.action === 'removeTween') ctx.services.require('tweens.motion').remove();
    else ctx.services.require('frames.keyframes').deleteKeyframe();
  }

  private runEdit(ctx: IEditorContext): void {
    const target = computeKeyframeActionsState(this.readInput(ctx)).editTarget;
    if (target !== undefined) ctx.events.emit('toolbar:editKeyframe', target);
  }
}

/** Crée le plugin `toolbar.keyframeActions`. */
export function createKeyframeActionsPlugin(): KeyframeActionsPlugin {
  return new KeyframeActionsPlugin();
}

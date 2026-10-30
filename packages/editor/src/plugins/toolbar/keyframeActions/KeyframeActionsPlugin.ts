// packages/editor/src/plugins/toolbar/keyframeActions/KeyframeActionsPlugin.ts
/**
 * Plugin: toolbar.keyframeActions
 * Epic: toolbar
 * Depends on: toolbar, toolbar.main, frames.keyframes, frames.selection, tweens.motion, interaction.shortcuts
 * Listens: frames:selectionChanged, layers:selectionChanged, document:changed, document:loaded, tweens:motionAvailabilityChanged, playhead:changed, playback:pause, playback:complete
 * Emits: toolbar:editKeyframe
 *
 * Four buttons share one toolbar.main control in the keyframes group:
 * insertKeyframe(), create(), deletion routed by resolveDeleteAction,
 * and toolbar:editKeyframe for the property panel.
 *
 * Model operations and keyboard shortcuts belong to their owning services.
 * Unavailable buttons use aria-disabled rather than the native attribute,
 * stay focusable, and ignore activation. Their tooltip includes the action
 * and reason; aria-description also exposes the reason to screen readers.
 * Selection, document and tween availability changes refresh the state.
 * Playhead changes matter only without selected cells and outside playback;
 * pause and completion refresh the state after playback. DOM attributes
 * are written only when they change. layers.selection is optional.
 *
 * Edit targets a selected keyframe, otherwise the playhead keyframe on a
 * selected layer. With only a layer selected, Delete uses deleteKeyframe()
 * because canRemove() considers selected cells only. It is unavailable when
 * no target carries a keyframe; no further model dry run is performed here.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import '../../frames/keyframes/types';
import '../../frames/selection/types';
import '../../layers/selection/types';
import '../../tweens/motion/types';
import { findNodeById } from '@kazo-ca/timeline-runtime';
import { rowMarks } from '../../frames/grid/gridCells';
import { ToolbarGroupOrders } from '../main/ToolbarItems';
import { computeKeyframeActionsState } from './keyframeActionsState';
import { propertyActionsState } from './propertyActionsState';
import type { IKeyframeActionsInput, IKeyframeActionsState } from './keyframeActionsState';
import './types';
import './KeyframeActions.less';

/** Plugin and toolbar control identifier. */
export const KEYFRAME_ACTIONS_PLUGIN_ID = 'toolbar.keyframeActions';

/** Accessible name of the button group. */
export const KEYFRAME_ACTIONS_LABEL = 'Actions des images clés';

/** Control CSS class. */
export const KEYFRAME_ACTIONS_CLASS = 'jt-keyframeActions';

type KeyframeAction = 'insert' | 'createTween' | 'delete' | 'edit';

interface IButtonSpec {
  readonly action: KeyframeAction;
  readonly label: string;
  readonly icon: string;
  /** Tooltip shortcut, formatted by interaction.shortcuts. */
  readonly shortcut?: string;
}

const BUTTONS: readonly IButtonSpec[] = [
  { action: 'insert', label: 'Ajouter une image clé', icon: '◆', shortcut: 'F6' },
  { action: 'createTween', label: 'Créer une interpolation de mouvement', icon: '⟷' },
  { action: 'delete', label: "Supprimer l'image clé ou l'interpolation", icon: '✕', shortcut: 'Shift+F6' },
  { action: 'edit', label: "Modifier l'image clé", icon: '✎' }
];

/** Toolbar control for inserting, tweening, deleting and editing keyframes. */
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
      cleanups.push(ctx.events.on('stage:targetsChanged', refresh));
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
      // Prevent Enter and Space from generating a click on unavailable buttons.
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

  /** Read current state inputs from the services. */
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

  /** The playhead matters only without selected cells and outside playback. */
  private onPlayhead(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.playback.playing) return;
    if (ctx.services.require('frames.selection').cells().length > 0) return;
    this.refresh();
  }

  /** Compute the state once and apply it to the buttons. */
  private refresh(): void {
    const ctx = this.ctx;
    if (ctx === null || this.buttons.size === 0) return;
    const state = propertyActionsState(ctx) ?? computeKeyframeActionsState(this.readInput(ctx));
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

  /** Omit the delete shortcut when remove() runs, since Shift+F6 would not run it. */
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

  /** Run a button action only if it is available at activation time. */
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

/** Write an attribute only when it changes. */
function setAttr(button: HTMLButtonElement, name: string, value: string): void {
  if (button.getAttribute(name) !== value) button.setAttribute(name, value);
}

function unsetAttr(button: HTMLButtonElement, name: string): void {
  if (button.hasAttribute(name)) button.removeAttribute(name);
}

function setTitle(button: HTMLButtonElement, title: string): void {
  if (button.title !== title) button.title = title;
}

/** Whether the layer has a content or property keyframe at frame. */
function hasKeyframeAt(doc: IEditorContext['document'], layerId: string, frame: number): boolean {
  const node = findNodeById(doc.layers, layerId);
  if (node === undefined) return false;
  return rowMarks(node, doc.settings.totalFrames, { first: frame, last: frame }).some((mark) => mark.kind !== 'spanEnd');
}

/** Create the toolbar.keyframeActions plugin. */
export function createKeyframeActionsPlugin(): KeyframeActionsPlugin {
  return new KeyframeActionsPlugin();
}

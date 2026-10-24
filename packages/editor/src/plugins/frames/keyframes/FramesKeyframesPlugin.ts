// packages/editor/src/plugins/frames/keyframes/FramesKeyframesPlugin.ts
/**
 * Plugin : frames.keyframes
 * Epic : frames
 * Dépend de : frames.grid, frames.selection, interaction.shortcuts, layout.ruler
 * Écoute : frames:gridRendered, document:loaded, document:changed
 * Émet : —
 *
 * Images clés de la grille, comme dans Flash CS4 :
 * - F6 insère une image clé, F7 une image clé vide, Maj+F6 efface l'image
 *   clé, F5 insère une image, Maj+F5 en supprime une ;
 * - glisser une image clé sélectionnée la déplace (avec toute la sélection),
 *   voir `keyframeDrag.ts`.
 *
 * Les images visées sont les images sélectionnées, sinon la tête de lecture
 * sur les calques sélectionnés (`layers.selection`, s'il est présent) ; les
 * calques verrouillés sont écartés (voir `keyframeTargets.ts`). Une action
 * exécute un seul lot : une entrée d'historique, tout ou rien (un refus
 * annule le tout et émet `command:refused`).
 *
 * Les raccourcis retournent toujours « traité », même sans cible ou pendant
 * un glisser ou un regroupement de l'historique (l'action est alors
 * ignorée) : quand le focus est dans l'éditeur, hors champ de saisie, F5 ne
 * recharge donc pas la page. Dans un champ de saisie, les touches restent au
 * navigateur (`interaction.shortcuts` n'y déclenche pas les raccourcis).
 *
 * Le plugin ne dessine que le fantôme du glisser, dans un calque posé sur la
 * grille (`frames.grid` → `element()`).
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { SpanCommandLabels, createSpanCommands } from '../../../model/spans';
import type { ISpanCommands } from '../../../model/spans';
import { LAYOUT_SLOTS } from '../../layout/shell/layoutSlots';
// Types seulement : événements écoutés (frames:gridRendered) et services utilisés.
import type {} from '../grid/types';
import type {} from '../selection/types';
import type {} from '../../interaction/shortcuts/types';
import type {} from '../../layout/ruler/RulerPlugin';
import { moveSelectedKeyframes, runSpanAction } from './keyframeActions';
import type { SpanAction } from './keyframeActions';
import { KeyframeDrag } from './keyframeDrag';
import { FRAMES_KEYFRAMES_CLASSES, createKeyframeGhost } from './keyframeGhost';
import type { IKeyframeGhost } from './keyframeGhost';
import type { IFramesKeyframesService } from './types';
import './FramesKeyframes.less';

/** Identifiant du plugin (et de son service). */
export const FRAMES_KEYFRAMES_PLUGIN_ID = 'frames.keyframes';

/** Raccourci d'une action, dans l'ordre d'enregistrement. */
interface IKeyframeShortcut {
  readonly action: SpanAction;
  readonly keys: string;
  readonly label: string;
}

const SHORTCUTS: readonly IKeyframeShortcut[] = Object.freeze([
  { action: 'insertFrame', keys: 'F5', label: SpanCommandLabels.INSERT_FRAME },
  { action: 'removeFrame', keys: 'Shift+F5', label: SpanCommandLabels.REMOVE_FRAME },
  { action: 'insertKeyframe', keys: 'F6', label: SpanCommandLabels.INSERT_KEYFRAME },
  { action: 'deleteKeyframe', keys: 'Shift+F6', label: SpanCommandLabels.DELETE_KEYFRAME },
  { action: 'insertBlankKeyframe', keys: 'F7', label: SpanCommandLabels.INSERT_BLANK_KEYFRAME }
]);

/** Insère, efface et déplace les images clés de la grille (F5, F6, F7, glisser). */
export class FramesKeyframesPlugin implements EditorPlugin {
  readonly id = 'frames.keyframes';
  readonly dependencies: readonly string[] = ['frames.grid', 'frames.selection', 'interaction.shortcuts', 'layout.ruler'];
  readonly slot = LAYOUT_SLOTS.frames;

  private ctx: IEditorContext | undefined;
  private commands: ISpanCommands | undefined;
  private drag: KeyframeDrag | undefined;
  private ghost: IKeyframeGhost | undefined;
  private overlay: HTMLElement | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const commands = createSpanCommands(ctx.registry);
    this.ctx = ctx;
    this.commands = commands;
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const service = this.createService(ctx, commands);
    this.cleanups = [ctx.services.provide('frames.keyframes', service)];
    try {
      SHORTCUTS.forEach((shortcut) =>
        this.cleanups.push(
          shortcuts.register({
            id: `${FRAMES_KEYFRAMES_PLUGIN_ID}.${shortcut.action}`,
            keys: shortcut.keys,
            label: shortcut.label,
            // Toujours « traité » : hors champ de saisie, F5 ne recharge pas la page,
            // même pendant un glisser ou un regroupement, où l'action est ignorée.
            run: () => {
              if (!(this.drag?.active ?? false) && !ctx.commands.isGrouping) service[shortcut.action]();
              return true;
            }
          })
        )
      );
    } catch (error) {
      // `init` qui lève : son `destroy` ne sera pas appelé, on défait ce qui est fait.
      this.cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
      this.ctx = undefined;
      throw error;
    }
  };

  render(): void {
    const ctx = this.requireContext();
    const grid = ctx.services.require('frames.grid').element();
    if (grid === undefined || this.commands === undefined) {
      throw new Error("frames.keyframes : la grille frames.grid n'est pas rendue.");
    }
    const overlay = grid.ownerDocument.createElement('div');
    overlay.className = FRAMES_KEYFRAMES_CLASSES.layer;
    overlay.setAttribute('aria-hidden', 'true');
    grid.appendChild(overlay);
    this.overlay = overlay;
    this.ghost = createKeyframeGhost(ctx, overlay);
    this.drag = new KeyframeDrag(ctx, grid, this.ghost, this.commands);
  }

  destroy(): void {
    this.drag?.destroy();
    this.ghost?.destroy();
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.overlay?.remove();
    this.drag = undefined;
    this.ghost = undefined;
    this.overlay = undefined;
    this.commands = undefined;
    this.ctx = undefined;
  }

  private createService(ctx: IEditorContext, commands: ISpanCommands): IFramesKeyframesService {
    return Object.freeze({
      insertKeyframe: () => runSpanAction(ctx, commands, 'insertKeyframe'),
      insertBlankKeyframe: () => runSpanAction(ctx, commands, 'insertBlankKeyframe'),
      deleteKeyframe: () => runSpanAction(ctx, commands, 'deleteKeyframe'),
      insertFrame: () => runSpanAction(ctx, commands, 'insertFrame'),
      removeFrame: () => runSpanAction(ctx, commands, 'removeFrame'),
      move: (offset: number) => moveSelectedKeyframes(ctx, commands, offset)
    });
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('frames.keyframes : utilisé avant init ou après destroy.');
    return this.ctx;
  }
}

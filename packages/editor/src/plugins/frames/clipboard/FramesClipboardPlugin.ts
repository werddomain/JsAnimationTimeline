// packages/editor/src/plugins/frames/clipboard/FramesClipboardPlugin.ts
/**
 * Plugin : frames.clipboard
 * Epic : frames
 * Dépend de : frames.grid, frames.selection, interaction.shortcuts
 * Écoute : —
 * Émet : frames:clipboardChanged
 *
 * Copier / coller des images, comme dans Flash CS4 et dans le legacy
 * (`copyKeyframes` / `pasteKeyframes` de `legacy/core/KeyframeManager.ts`) :
 * - Ctrl+C (Cmd sur Mac) copie les plages des images sélectionnées (forme du
 *   rectangle, plages coupées aux bords, voir `clipboardModel.ts`) ;
 * - Ctrl+V les colle en écrasant les images visées (voir `clipboardOps.ts`),
 *   en UNE entrée d'historique « Coller des images ».
 *
 * Cible du collage : l'image passée à `paste(target)`, sinon l'ancre de la
 * sélection, sinon sa première image, sinon la tête de lecture sur le premier
 * calque sélectionné (`layers.selection`, facultatif). Les lignes du contenu
 * se placent sur les lignes de calque visibles à partir de celle de la cible
 * (les dossiers sont sautés) ; celles qui dépassent la dernière ligne sont
 * abandonnées. Après un collage réussi, les images collées sont sélectionnées.
 * Un calque verrouillé (ou dans un dossier verrouillé) refuse tout le collage.
 *
 * Quand une touche est inutile (rien de sélectionné, presse-papiers vide),
 * le raccourci est inactif : la touche reste au navigateur. Dans un champ de
 * saisie, Ctrl+C et Ctrl+V gardent leur sens (pas de `allowInEditable`).
 *
 * Le contenu vit seulement dans la mémoire du plugin : l'API asynchrone du
 * presse-papiers du système ne se lit pas de façon synchrone dans un
 * raccourci, et n'existe pas dans jsdom. Le contenu est du JSON pur : E1
 * pourra le recopier dans le presse-papiers du système.
 *
 * Pas de Ctrl+X : couper demande une opération « effacer des images » que le
 * cœur de plages (K1) n'a pas encore.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { SpanOperationError } from '../../../model/spans/SpanOperationError';
// Types seulement : services utilisés et événement émis.
import type {} from '../grid/types';
import type {} from '../selection/types';
import type {} from '../../interaction/shortcuts/types';
import type {} from '../../layers/selection/types';
import type { IFrameCell } from '../selection/frameSelection';
import { buildClip } from './clipboardModel';
import { createPasteCommand } from './pasteCommand';
import { planPaste } from './pastePlan';
import type { IFrameClip, IFramesClipboardService } from './types';

/** Identifiant du plugin (et de son service). */
export const FRAMES_CLIPBOARD_PLUGIN_ID = 'frames.clipboard';

/** Identifiants des raccourcis. */
export const FramesClipboardIds = {
  COPY: 'frames.clipboard.copy',
  PASTE: 'frames.clipboard.paste'
} as const;

/** Combinaisons des raccourcis (Mod = Ctrl, ou Cmd sur Mac). */
export const FramesClipboardKeys = {
  COPY: 'Mod+C',
  PASTE: 'Mod+V'
} as const;

/** Plugin `frames.clipboard` : Ctrl+C / Ctrl+V pour les images. */
export class FramesClipboardPlugin implements EditorPlugin {
  readonly id = 'frames.clipboard';
  readonly dependencies: readonly string[] = ['frames.grid', 'frames.selection', 'interaction.shortcuts'];

  private ctx: IEditorContext | undefined;
  private clip: IFrameClip | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const selection = ctx.services.require('frames.selection');
    const cleanups: Array<() => void> = [];
    this.ctx = ctx;
    try {
      // Chaque retrait est gardé dès son ajout : un échec plus loin défait les précédents.
      cleanups.push(ctx.services.provide('frames.clipboard', this.service()));
      cleanups.push(
        shortcuts.register({
          id: FramesClipboardIds.COPY,
          keys: FramesClipboardKeys.COPY,
          label: 'Copier les images',
          run: () => this.copy(),
          enabled: () => selection.cells().length > 0
        })
      );
      cleanups.push(
        shortcuts.register({
          id: FramesClipboardIds.PASTE,
          keys: FramesClipboardKeys.PASTE,
          label: 'Coller les images',
          run: () => this.paste(),
          enabled: () => this.clip !== undefined
        })
      );
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      this.ctx = undefined;
      throw error;
    }
    this.cleanups = cleanups;
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.clip = undefined;
    this.ctx = undefined;
  }

  private service(): IFramesClipboardService {
    return {
      copy: () => this.copy(),
      paste: (target) => this.paste(target),
      hasContent: () => this.clip !== undefined,
      content: () => this.clip,
      clear: () => this.clear()
    };
  }

  private copy(): boolean {
    const ctx = this.requireContext();
    const cells = ctx.services.require('frames.selection').cells();
    if (cells.length === 0) return false;
    const clip = this.tryBuildClip(ctx, cells);
    if (clip === undefined) return false;
    this.clip = clip;
    this.announce(ctx);
    return true;
  }

  /** Contenu pour `cells`, ou `undefined` si rien n'est copiable (valeurs impossibles à évaluer comprises). */
  private tryBuildClip(ctx: IEditorContext, cells: readonly IFrameCell[]): IFrameClip | undefined {
    try {
      return buildClip(ctx.document, ctx.services.require('frames.grid').rows(), cells, ctx.registry);
    } catch (error) {
      if (error instanceof SpanOperationError) return undefined;
      throw error;
    }
  }

  private paste(target?: IFrameCell): boolean {
    const ctx = this.requireContext();
    const clip = this.clip;
    const cell = target ?? this.defaultTarget(ctx);
    if (clip === undefined || cell === undefined) return false;
    const plan = planPaste(clip, ctx.services.require('frames.grid').rows(), cell);
    if (plan === undefined) return false;
    const before = ctx.document;
    // Un refus (calque verrouillé) laisse le document tel quel : `command:refused` est déjà émis.
    ctx.commands.execute(createPasteCommand(plan.placements, ctx.registry));
    if (ctx.document === before) return false;
    ctx.services.require('frames.selection').set(plan.cells);
    return true;
  }

  /** Ancre, sinon première image sélectionnée, sinon tête de lecture sur le premier calque sélectionné. */
  private defaultTarget(ctx: IEditorContext): IFrameCell | undefined {
    const selection = ctx.services.require('frames.selection');
    const selected = selection.anchor() ?? selection.cells()[0];
    if (selected !== undefined) return selected;
    const layerIds = new Set(
      ctx.services
        .require('frames.grid')
        .rows()
        .filter((row) => row.kind === 'layer')
        .map((row) => row.id)
    );
    const rowId = ctx.services.get('layers.selection')?.selected().find((id) => layerIds.has(id));
    return rowId === undefined ? undefined : { rowId, frame: ctx.playback.frame };
  }

  private clear(): void {
    if (this.clip === undefined) return;
    this.clip = undefined;
    this.announce(this.requireContext());
  }

  private announce(ctx: IEditorContext): void {
    const clip = this.clip;
    const lastRow = clip?.rows[clip.rows.length - 1];
    ctx.events.emit('frames:clipboardChanged', {
      hasContent: clip !== undefined,
      rows: lastRow === undefined ? 0 : lastRow.rowOffset + 1,
      width: clip?.width ?? 0
    });
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('frames.clipboard : utilisé avant init ou après destroy.');
    return this.ctx;
  }
}

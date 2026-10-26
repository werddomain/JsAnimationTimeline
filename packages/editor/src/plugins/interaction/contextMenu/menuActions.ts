// packages/editor/src/plugins/interaction/contextMenu/menuActions.ts
/** Service-backed actions; document changes always belong to existing commands. */
import { findNodeById, flattenLayers, resolveLocked, resolveVisible } from '@werddomain/timeline-runtime';
import type { IEditorContext } from '../../../core/context/IEditorContext';
import { rowMarks } from '../../frames/grid/gridCells';
import { lockedLayerIds } from '../../frames/keyframes/keyframeTargets';
import { computeKeyframeActionsState } from '../../toolbar/keyframeActions/keyframeActionsState';
import type { IActionAvailability } from '../../toolbar/keyframeActions/keyframeActionsState';
import type { ContextMenuTarget, IContextMenuAction } from './types';
import type {} from '../../frames/clipboard/types';
import type {} from '../../layers/rename/RenamePlugin';
import type {} from '../../layers/visibility/VisibilityPlugin';
import type {} from '../../layers/lock/LockPlugin';
import type {} from '../../layers/groups/types';
import type {} from '../../layers/toolbar/types';
import type {} from '../../tweens/easing/types';

const GROUP_REASON = 'Une commande est déjà en cours.';
const NO_OTHER_REASON = 'Aucun autre calque à modifier.';

function action(ctx: IEditorContext, id: string, label: string, state: IActionAvailability, run: () => unknown, mutates = true): IContextMenuAction {
  if (mutates && ctx.commands.isGrouping) return { id, label, enabled: false, reason: GROUP_REASON, run };
  return { id, label, ...state, run };
}

/** Read the same deletion resolver used by the keyframe toolbar (T2). */
function frameActions(ctx: IEditorContext, cell: Extract<ContextMenuTarget, { kind: 'frames' }>['cell']): IContextMenuAction[] {
  const selection = ctx.services.require('frames.selection');
  const keyframes = ctx.services.require('frames.keyframes');
  const motion = ctx.services.require('tweens.motion');
  const state = computeKeyframeActionsState({
    doc: ctx.document, cells: selection.cells(), selectedKeyframes: selection.keyframes(),
    playheadFrame: ctx.playback.frame, layerIds: ctx.services.require('layers.selection').selected(),
    keyframeAt: (id, frame) => {
      const node = findNodeById(ctx.document.layers, id);
      return node !== undefined && rowMarks(node, ctx.document.settings.totalFrames, { first: frame, last: frame }).some((mark) => mark.kind !== 'spanEnd');
    },
    tweenAt: (id, frame) => motion.tweenAt(id, frame), canCreate: motion.canCreate(), canRemove: motion.canRemove()
  });
  const items = [
    action(ctx, 'createTween', "Créer une interpolation de mouvement", state.createTween, () => motion.create()),
    action(ctx, 'insertFrame', 'Insérer une image', state.insert, () => keyframes.insertFrame()),
    action(ctx, 'removeFrame', "Supprimer l'image", state.insert, () => keyframes.removeFrame()),
    action(ctx, 'insertKeyframe', 'Insérer une image clé', state.insert, () => keyframes.insertKeyframe()),
    action(ctx, 'insertBlankKeyframe', 'Insérer une image clé vide', state.insert, () => keyframes.insertBlankKeyframe()),
    action(ctx, 'delete', state.delete.label, state.delete, () => state.delete.action === 'removeTween' ? motion.remove() : keyframes.deleteKeyframe())
  ];
  // Easing applies only to the context span, even when several cells are selected.
  const easing = ctx.services.get('tweens.easing');
  if (easing !== undefined && motion.tweenAt(cell.rowId, cell.frame) !== undefined) {
    items.push(action(ctx, 'easing', 'Modifier l’accélération', easing.canSetAt(cell.rowId, cell.frame), () => easing.openAt(cell.rowId, cell.frame)));
  }
  const clipboard = ctx.services.get('frames.clipboard');
  if (clipboard !== undefined) {
    const cells = selection.cells();
    const locked = lockedLayerIds(ctx.document);
    const pasteEnabled = clipboard.hasContent() && cells.length > 0 && !locked.has(cells[0].rowId);
    items.push(action(ctx, 'copy', 'Copier les images', { enabled: cells.length > 0, reason: 'Sélectionnez des images à copier.' }, () => clipboard.copy(), false));
    items.push(action(ctx, 'paste', 'Coller les images', { enabled: pasteEnabled, reason: !clipboard.hasContent() ? 'Le presse-papiers est vide.' : 'Sélectionnez une image sur un calque déverrouillé.' }, () => clipboard.paste()));
  }
  return items;
}

/** Changed flags only: false from a service then means a real refusal. */
function otherIds(ctx: IEditorContext, flag: 'visible' | 'locked', value: boolean): string[] {
  const selected = new Set(ctx.services.require('layers.selection').selected());
  return flattenLayers(ctx.document.layers).map(({ node }) => node)
    .filter((node) => !selected.has(node.id) && (flag === 'visible' ? resolveVisible(node) : resolveLocked(node)) !== value)
    .map((node) => node.id);
}

/** Own the group only when no other operation already owns it. */
export function setOtherFlags(ctx: IEditorContext, flag: 'visible' | 'locked', value: boolean, label: string): boolean {
  if (ctx.commands.isGrouping) return false;
  const ids = otherIds(ctx, flag, value);
  if (ids.length === 0) return false;
  ctx.commands.beginGroup(label);
  try {
    for (const id of ids) {
      const changed = flag === 'visible'
        ? ctx.services.require('layers.visibility').setVisible(id, value)
        : ctx.services.require('layers.lock').setLocked(id, value);
      if (!changed) {
        ctx.commands.cancelGroup();
        return false;
      }
    }
    return ctx.commands.endGroup();
  } catch (error) {
    if (ctx.commands.isGrouping) ctx.commands.cancelGroup();
    throw error;
  }
}

function layerActions(ctx: IEditorContext, rowId: string): IContextMenuAction[] {
  const toolbar = ctx.services.require('layers.toolbar');
  const groups = ctx.services.require('layers.groups');
  const node = findNodeById(ctx.document.layers, rowId);
  if (node === undefined) return [];
  const items = [
    action(ctx, 'newLayer', 'Nouveau calque', { enabled: true }, () => toolbar.newLayer()),
    action(ctx, 'newFolder', 'Nouveau dossier', { enabled: true }, () => groups.createFolder()),
    action(ctx, 'group', 'Grouper la sélection', { enabled: groups.canGroup(), reason: 'Sélectionnez des calques.' }, () => groups.groupSelection()),
    action(ctx, 'deleteLayers', 'Supprimer les calques sélectionnés', { enabled: ctx.services.require('layers.selection').selected().length > 0 }, () => toolbar.deleteSelection())
  ];
  if (node.type === 'folder') items.push(action(ctx, 'ungroup', 'Dissocier le dossier', { enabled: true }, () => groups.ungroup(rowId)));
  const rename = ctx.services.get('layers.rename');
  if (rename !== undefined) items.push(action(ctx, 'rename', 'Renommer le calque', { enabled: true }, () => rename.startEditing(rowId)));
  const visibility = ctx.services.get('layers.visibility');
  if (visibility !== undefined) {
    items.push(action(ctx, 'toggleVisible', resolveVisible(node) ? 'Masquer le calque' : 'Afficher le calque', { enabled: true }, () => visibility.toggle(rowId)));
    for (const value of [true, false]) {
      const label = value ? 'Afficher les autres calques' : 'Masquer les autres calques';
      items.push(action(ctx, value ? 'showOthers' : 'hideOthers', label,
        { enabled: otherIds(ctx, 'visible', value).length > 0, reason: NO_OTHER_REASON }, () => setOtherFlags(ctx, 'visible', value, label)));
    }
  }
  const lock = ctx.services.get('layers.lock');
  if (lock !== undefined) {
    items.push(action(ctx, 'toggleLocked', resolveLocked(node) ? 'Déverrouiller le calque' : 'Verrouiller le calque', { enabled: true }, () => lock.toggle(rowId)));
    const label = 'Verrouiller les autres calques';
    items.push(action(ctx, 'lockOthers', label, { enabled: otherIds(ctx, 'locked', true).length > 0, reason: NO_OTHER_REASON }, () => setOtherFlags(ctx, 'locked', true, label)));
  }
  return items;
}

/** Build current actions; no cached service verdict may authorize activation. */
export function contextMenuActions(ctx: IEditorContext, target: ContextMenuTarget): readonly IContextMenuAction[] {
  return target.kind === 'frames' ? frameActions(ctx, target.cell) : layerActions(ctx, target.rowId);
}

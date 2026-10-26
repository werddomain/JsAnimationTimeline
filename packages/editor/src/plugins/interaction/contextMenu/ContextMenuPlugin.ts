// packages/editor/src/plugins/interaction/contextMenu/ContextMenuPlugin.ts
/**
 * Plugin: interaction.contextMenu
 * Epic: interaction
 * Depends on: frames.grid, frames.selection, frames.keyframes, tweens.motion, layers.list, layers.selection, layers.toolbar, layers.groups
 * Listens: contextmenu, keydown, document:changed, document:loaded,
 * frames:selectionChanged, layers:selectionChanged, layers:rowsChanged
 * Emits: none
 *
 * Scoped context menus delegate to the existing v2 services. Clipboard,
 * rename, visibility, lock and W3 easing are optional.
 */
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { isEditableTarget } from '../shortcuts/ShortcutScope';
import { contextMenuActions } from './menuActions';
import { MenuController } from './MenuController';
import type { ContextMenuTarget, IMenuPosition } from './types';
import './ContextMenu.less';

export const CONTEXT_MENU_PLUGIN_ID = 'interaction.contextMenu';

export class ContextMenuPlugin implements EditorPlugin {
  readonly id = 'interaction.contextMenu';
  readonly dependencies = ['frames.grid', 'frames.selection', 'frames.keyframes', 'tweens.motion', 'layers.list', 'layers.selection', 'layers.toolbar', 'layers.groups'];
  private cleanups: Array<() => void> = [];
  private controller: MenuController | undefined;

  readonly init = (ctx: IEditorContext): void => {
    const controller = new MenuController(ctx.container);
    this.controller = controller;
    const contextmenu = (event: MouseEvent): void => {
      const target = this.target(ctx, event.target, { x: event.clientX, y: event.clientY });
      if (target === undefined) return;
      event.preventDefault();
      this.open(ctx, controller, target, { x: event.clientX, y: event.clientY });
    };
    const keydown = (event: KeyboardEvent): void => {
      if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
      const target = this.target(ctx, event.target);
      if (target === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      const surface = this.surface(ctx, target);
      const rect = surface.getBoundingClientRect();
      this.open(ctx, controller, target, { x: rect.left + 12, y: rect.top + 12 });
    };
    try {
      ctx.container.addEventListener('contextmenu', contextmenu);
      this.cleanups.push(() => ctx.container.removeEventListener('contextmenu', contextmenu));
      ctx.container.addEventListener('keydown', keydown);
      this.cleanups.push(() => ctx.container.removeEventListener('keydown', keydown));
      const invalidate = (): void => { controller.close(true); };
      this.cleanups.push(ctx.events.on('document:changed', invalidate));
      this.cleanups.push(ctx.events.on('document:loaded', invalidate));
      this.cleanups.push(ctx.events.on('frames:selectionChanged', invalidate));
      // A right click flushes pending row focus after the menu has opened.
      // Focus/anchor changes with identical selected IDs do not invalidate actions.
      this.cleanups.push(ctx.events.on('layers:selectionChanged', ({ ids, previous }) => {
        if (ids.length !== previous.length || ids.some((id, index) => id !== previous[index])) invalidate();
      }));
      this.cleanups.push(ctx.events.on('layers:rowsChanged', invalidate));
    } catch (error) {
      this.destroy();
      throw error;
    }
  };

  destroy(): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.controller?.close(false);
    this.controller = undefined;
  }

  private target(ctx: IEditorContext, target: EventTarget | null, point?: IMenuPosition): ContextMenuTarget | undefined {
    if (!(target instanceof Element) || target.closest('.JsTimeLine') !== ctx.container || isEditableTarget(target)) return undefined;
    const grid = ctx.services.require('frames.grid');
    if (grid.element()?.contains(target) || (point === undefined && target === ctx.container)) {
      const selection = ctx.services.require('frames.selection');
      const cell = point === undefined ? selection.anchor() ?? selection.cells()[0] : grid.cellAt(point.x, point.y);
      if (cell === undefined || ctx.services.require('layers.list').row(cell.rowId)?.node.type !== 'layer') return undefined;
      return { kind: 'frames', cell: { rowId: cell.rowId, frame: cell.frame } };
    }
    const list = ctx.services.require('layers.list');
    const rowId = list.element()?.contains(target) ? list.rowIdAt(target) : undefined;
    return rowId === undefined ? undefined : { kind: 'layers', rowId };
  }

  private surface(ctx: IEditorContext, target: ContextMenuTarget): HTMLElement {
    return (target.kind === 'layers' ? ctx.services.require('layers.list').rowElement(target.rowId) : ctx.container) ?? ctx.container;
  }

  private open(ctx: IEditorContext, controller: MenuController, target: ContextMenuTarget, point: IMenuPosition): void {
    controller.close(false);
    if (target.kind === 'frames') {
      const selection = ctx.services.require('frames.selection');
      selection.cancelPendingClick();
      if (!selection.isSelected(target.cell.rowId, target.cell.frame)) selection.select(target.cell);
    } else {
      const selection = ctx.services.require('layers.selection');
      if (!selection.isSelected(target.rowId)) selection.select([target.rowId]);
    }
    controller.open(point, this.surface(ctx, target), () => contextMenuActions(ctx, target));
  }
}

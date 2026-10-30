// packages/editor/src/plugins/layers/list/PropertyRowView.ts
import type { IEditorContext } from '../../../core/context/IEditorContext';
import type { IPropertyTimeline } from '@kazo-ca/timeline-runtime';
import { ROW_HEIGHT } from '../../../model/rows';
import type { IPropertyVisibleRow } from '../../../model/rows';
import { DEPTH_INDENT } from './LayerRowView';
import { propertyLabel } from '../../properties/panel/panelState';
import type {} from '../../frames/selection/types';
import type {} from '../selection/types';

function updatePropertyRowDepth(element: HTMLElement, row: IPropertyVisibleRow): void {
  element.setAttribute('aria-level', String(row.depth + 1));
  element.style.paddingLeft = `${row.depth * DEPTH_INDENT + 24}px`;
}

/** Property labels are separate from node views: no node control can receive their ids. */
export function propertyRowElement(ctx: IEditorContext, row: IPropertyVisibleRow): HTMLElement {
  const element = ctx.container.ownerDocument.createElement('button');
  element.type = 'button';
  element.tabIndex = -1;
  element.className = 'jt-property-row';
  element.dataset.propertyRowId = row.id;
  element.dataset.layerId = row.layerId;
  element.dataset.property = row.property;
  element.setAttribute('role', 'treeitem');
  element.style.height = `${ROW_HEIGHT}px`;
  updatePropertyRowDepth(element, row);
  element.textContent = row.property;
  element.title = row.property;
  const select = (): void => {
    ctx.services.get('layers.selection')?.select([row.layerId]);
    ctx.services.get('frames.selection')?.select({ rowId: row.id, frame: ctx.playback.frame });
  };
  element.addEventListener('focus', () => {
    ctx.services.get('layers.list')?.element()?.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((item) => { item.tabIndex = -1; });
    element.tabIndex = 0;
  });
  element.addEventListener('click', (event) => { event.stopPropagation(); select(); });
  element.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      ctx.services.get('layers.list')?.rowElement(row.layerId)?.focus();
    } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      const list = ctx.services.get('layers.list');
      const rows = list?.visibleRows() ?? [];
      const index = rows.findIndex((candidate) => candidate.id === row.id);
      const next = rows[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (next?.kind === 'property') {
        const target = Array.from(list?.element()?.querySelectorAll<HTMLElement>('[data-property-row-id]') ?? [])
          .find((candidate) => candidate.dataset.propertyRowId === next.id);
        target?.focus();
        target?.click();
      } else if (next !== undefined) {
        ctx.services.get('layers.selection')?.select([next.id]);
        list?.rowElement(next.id)?.focus();
      }
    }
  });
  return element;
}

/** Refresh reused row geometry and labels after document or projection changes. */
export function updatePropertyRowView(ctx: IEditorContext, element: HTMLElement, row: IPropertyVisibleRow, track: IPropertyTimeline | undefined): void {
  updatePropertyRowDepth(element, row);
  const descriptor = ctx.registry.get(row.property);
  const label = track?.label?.trim() ? track.label : descriptor === undefined ? row.property : propertyLabel(descriptor);
  element.textContent = label;
  element.title = label;
  element.setAttribute('aria-label', label);
}

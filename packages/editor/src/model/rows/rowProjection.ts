// packages/editor/src/model/rows/rowProjection.ts
import { walkLayers } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { visibleRows } from './visibleRows';
import type { IVisibleRow } from './visibleRows';

/** Shared per-editor presentation state. It never mutates the timeline or its history. */
export class RowProjection {
  private manual: ReadonlySet<string> = new Set();
  private selected: ReadonlySet<string> = new Set();
  private suppressed: ReadonlySet<string> = new Set();
  private document: ITimelineDocument | undefined;
  private cached: readonly IVisibleRow[] | undefined;

  rows(document: ITimelineDocument): readonly IVisibleRow[] {
    if (this.document !== document) {
      const ids = new Set<string>();
      walkLayers(document.layers, ({ node }) => { if (node.type === 'layer') ids.add(node.id); });
      this.manual = new Set([...this.manual].filter((id) => ids.has(id)));
      this.selected = new Set([...this.selected].filter((id) => ids.has(id)));
      this.suppressed = new Set([...this.suppressed].filter((id) => ids.has(id)));
      this.document = document;
      this.cached = undefined;
    }
    this.cached ??= visibleRows(document, new Set([...this.manual, ...this.selected].filter((id) => !this.suppressed.has(id))));
    return this.cached;
  }

  select(ids: readonly string[]): boolean {
    const next = new Set(ids);
    if (next.size === this.selected.size && [...next].every((id) => this.selected.has(id))) return false;
    // A manual fold during selection is temporary. Leaving and selecting again
    // restores the ordinary auto-expansion without changing the manual baseline.
    this.suppressed = new Set([...this.suppressed].filter((id) => next.has(id) && this.selected.has(id)));
    this.selected = next;
    this.cached = undefined;
    return true;
  }

  setExpanded(id: string, expanded: boolean): boolean {
    const current = !this.suppressed.has(id) && (this.manual.has(id) || this.selected.has(id));
    if (current === expanded) return false;
    this.manual = new Set([...this.manual].filter((candidate) => candidate !== id));
    this.suppressed = new Set([...this.suppressed].filter((candidate) => candidate !== id));
    if (expanded) this.manual = new Set([...this.manual, id]);
    else if (this.selected.has(id)) this.suppressed = new Set([...this.suppressed, id]);
    this.cached = undefined;
    return true;
  }

  reset(): void {
    this.manual = new Set();
    this.selected = new Set();
    this.suppressed = new Set();
    this.document = undefined;
    this.cached = undefined;
  }
}

const projections = new WeakMap<object, RowProjection>();

/** The list and the optional standalone grid share one projection for a context. */
export function rowProjection(owner: object): RowProjection {
  let projection = projections.get(owner);
  if (projection === undefined) { projection = new RowProjection(); projections.set(owner, projection); }
  return projection;
}

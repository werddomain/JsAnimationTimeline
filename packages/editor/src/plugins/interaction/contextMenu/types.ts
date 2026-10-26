// packages/editor/src/plugins/interaction/contextMenu/types.ts
/** Context targets and declarative actions shared by the plugin and its view. */
import type { IFrameCell } from '../../frames/selection/frameSelection';

export type ContextMenuTarget =
  | { readonly kind: 'frames'; readonly cell: IFrameCell }
  | { readonly kind: 'layers'; readonly rowId: string };

/** Actions are read again immediately before activation. */
export interface IContextMenuAction {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly run: () => unknown;
}

export interface IMenuPosition {
  readonly x: number;
  readonly y: number;
}

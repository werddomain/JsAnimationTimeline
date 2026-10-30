// packages/runtime/src/model/layer.ts
/**
 * Arbre des calques : un nœud est un calque (une cible, des plages) ou un
 * dossier (des enfants), distingués par `type`.
 */

import type { ISpan } from './span';
import type { IPropertyTimeline } from './propertyTimeline';
import type { LayerTarget } from './target';

/** Discriminator of a layer tree node. */
export type LayerNodeType = 'layer' | 'folder';

/** Fields shared by layers and folders. */
export interface ILayerNodeBase {
  readonly id: string;
  readonly type: LayerNodeType;
  readonly name: string;
  /** `#rrggbb`, case-insensitive. */
  readonly color?: string;
  /** Defaults to `DEFAULT_VISIBLE`. */
  readonly visible?: boolean;
  /** Defaults to `DEFAULT_LOCKED`. */
  readonly locked?: boolean;
}

/** A layer animates a single target. */
export interface ILayer extends ILayerNodeBase {
  readonly type: 'layer';
  /** Built-in icon name, CSS class or URL (interpreted by the editor). */
  readonly icon?: string;
  readonly target?: LayerTarget;
  /** Sorted, contiguous spans starting at frame 1 (may be empty). */
  readonly spans: readonly ISpan[];
  /** Independent typed property tracks, disjoint from legacy span tracks. */
  readonly propertyTimelines?: Readonly<Record<string, IPropertyTimeline>>;
}

/** A folder groups layers and folders. */
export interface IFolder extends ILayerNodeBase {
  readonly type: 'folder';
  /** Defaults to `DEFAULT_COLLAPSED`. */
  readonly collapsed?: boolean;
  readonly children: readonly LayerNode[];
}

/** A node of the layer tree. */
export type LayerNode = ILayer | IFolder;

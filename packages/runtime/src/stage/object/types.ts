// packages/runtime/src/stage/object/types.ts
/**
 * Types de `createObjectStage` : les objets que le développeur confie à la
 * scène (sprite canvas, piste audio, servomoteur...) et les fonctions qui les
 * pilotent. Voir `doc/v2/scene-developpeur.md`.
 */

import type { LayerTarget } from '../../model/target';
import type { PropertyDescriptor, PropertyValues } from '../../properties/types';
import type { ITransportSyncState, ITransportTime } from '../../transport/types';
import type { IStage, IStageLayerState, ITargetInfo } from '../types';

/** One object offered to the timeline under the ref `id`. */
export interface IObjectStageEntry<T> {
  /** Ref used by the layers: `{ ref: id, stage: <stage id> }`. Unique in the stage. */
  readonly id: string;
  /** Name shown in the target picker. */
  readonly label: string;
  readonly icon?: string;
  readonly group?: string;
  /** The animated object; it stays with the developer. */
  readonly object: T;
  /** Properties shown for this object (see `ITargetInfo.properties`). */
  readonly properties?: ITargetInfo['properties'];
}

/** State handed to `apply` and `endFrame`: `values` are completed with the defaults. */
export type ObjectStageState<T> = IStageLayerState<T>;

/** Options of `createObjectStage`. */
export interface IObjectStageOptions<T> {
  /** Stage id: 'canvas', 'audio'... */
  readonly id: string;
  /** Also accept `{ ref }` targets without `stage` (see `refStage`). Defaults to `false`. */
  readonly unscoped?: boolean;
  /** Added to the registry of the player or editor. */
  readonly properties?: readonly PropertyDescriptor[];
  /** Initial objects; more can be added with `add`. */
  readonly objects?: readonly IObjectStageEntry<T>[];
  /** Replaces the lookup by ref id (e.g. to build objects on demand). `null` marks the target missing. */
  readonly resolve?: (target: LayerTarget, objects: ReadonlyMap<string, T>) => T | null;
  /**
   * Called for every layer at every rendered frame. `values` holds the
   * evaluated values completed with the registry defaults of the object's
   * properties; for an inactive layer, and without `reset`, they are all the
   * defaults.
   */
  readonly apply: (object: T, values: PropertyValues, state: ObjectStageState<T>) => void;
  /**
   * Gives the object its initial state back: when a layer is released, and
   * before `apply` for an inactive layer. Without it, `apply` receives the
   * default values instead.
   */
  readonly reset?: (object: T) => void;
  /** Called once per rendered frame, after every `apply` (e.g. one drawing). */
  readonly endFrame?: (time: ITransportTime, states: readonly ObjectStageState<T>[]) => void;
  /** Play, pause, seek, speed change... (e.g. align an audio element). */
  readonly sync?: (time: ITransportTime, state: ITransportSyncState) => void;
}

/** The stage returned by `createObjectStage`, whose objects can change. */
export interface IObjectStage<T> extends IStage<T> {
  /** Offers another object; throws for an id already used. Notifies the targets subscribers. */
  add(entry: IObjectStageEntry<T>): void;
  /** Removes the object `id`; returns `false` when unknown. Notifies the targets subscribers. */
  remove(id: string): boolean;
}

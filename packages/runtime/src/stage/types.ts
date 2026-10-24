// packages/runtime/src/stage/types.ts
/**
 * Contrat d'une scène (`IStage`), sans type DOM : la timeline tient le temps
 * et calcule les valeurs, la scène les applique à ses objets (éléments HTML,
 * sprites canvas, pistes audio, servomoteurs...). Une scène implémente
 * `sync`, `render` ou les deux. Voir `doc/v2/scene-developpeur.md`.
 */

import type { ITimelineDocument } from '../model/document';
import type { ILayer } from '../model/layer';
import type { LayerTarget } from '../model/target';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { PropertyDescriptor, PropertyValues } from '../properties/types';
import type { ITransportSyncState, ITransportTime } from '../transport/types';
import type { IStageReportInput } from './reports';

export type { ITransportTime } from '../transport/types';

/** State of one layer at the rendered time, handed to `IStage.render`. */
export interface IStageLayerState<T = unknown> {
  readonly layerId: string;
  readonly target: LayerTarget;
  /** The object resolved by the stage for this layer. */
  readonly object: T;
  /** Value of every property animated anywhere in the layer (unknown tracks skipped). */
  readonly values: PropertyValues;
  /** Span holding the time, `undefined` outside every span. */
  readonly spanId?: string;
  /** `false` in a blank span and outside every span. */
  readonly active: boolean;
  /** Eye of the layer in the editor; always `true` in the player. */
  readonly editorVisible: boolean;
}

/** Display of one property for one object (label and unit per object). */
export interface ITargetPropertyInfo {
  readonly name: string;
  readonly label?: string;
  readonly unit?: string;
}

/** A target offered by a stage (target picker of the editor). */
export interface ITargetInfo {
  readonly target: LayerTarget;
  readonly label: string;
  readonly icon?: string;
  readonly group?: string;
  /** Properties shown for this object, by name or with a label and unit. */
  readonly properties?: readonly (string | ITargetPropertyInfo)[];
}

/** A layer bound to a stage, with the object the stage resolved for it. */
export interface IStageLayer<T = unknown> {
  readonly layerId: string;
  /** The layer, without its tracks unknown to the registry (reported `unknown-property`). */
  readonly layer: ILayer;
  readonly target: LayerTarget;
  readonly object: T;
}

/** Cancellation signal accepted by `targets.pick` (a DOM `AbortSignal` fits). */
export interface IStageAbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
}

/** What a stage knows about its targets (all members optional but `list`). */
export interface IStageTargets {
  /** Targets the stage can animate. */
  list(): readonly ITargetInfo[];
  /** Display information of one target, `undefined` when unknown. */
  describe?(target: LayerTarget): ITargetInfo | undefined;
  /** Lets the user pick an object (e.g. by clicking it); `null` when cancelled. */
  pick?(signal?: IStageAbortSignal): Promise<LayerTarget | null>;
  /**
   * Calls `onChange` when the targets change (model loaded, entity created):
   * failed resolutions are then retried. Returns the unsubscribe function.
   */
  subscribe?(onChange: () => void): () => void;
}

/** Play state handed to `IStage.sync`. */
export type IStageSyncState = ITransportSyncState;

/** Handed to `IStage.attach`: the property registry and the reporting channel. */
export interface IStageContext {
  /** Registry of the player or editor (built-ins, options and every stage's `properties`). */
  readonly registry: PropertyRegistry;
  /** Adds a warning (e.g. `duplicate-target`); the stage id is filled in. Deduplicated per document. */
  report(report: IStageReportInput): void;
  /** Reports an error of the stage like a thrown one (first per stage and per layer only). */
  error(error: unknown, layerId?: string): void;
}

/**
 * A place where layers are animated. Every method is called by the player or
 * the editor, never per frame except `render` (and `sync` on time jumps).
 * An exception thrown by a method goes to `onListenerError` (the first one per
 * stage and per layer, then nothing until the next document) and playback
 * continues; only a `StageDocumentError` thrown by `update` refuses the document.
 */
export interface IStage<T = unknown> {
  /** Unique among the stages of a player: 'html', 'canvas', 'audio'... */
  readonly id: string;
  /** Added to the registry of the editor or player (a name conflict is an error). */
  readonly properties?: readonly PropertyDescriptor[];
  readonly targets?: IStageTargets;
  /** True when this stage animates `target` (see `refStage`). */
  accepts(target: LayerTarget): boolean;
  /** Object animated for `target`, cached; `null` puts the layer in `missingTargets`. */
  resolve(target: LayerTarget): T | null;
  /** Called once, before anything else. */
  attach?(ctx: IStageContext): void;
  /** Called on every document (first load, update, undo, redo, refreshed targets). */
  update?(doc: ITimelineDocument, layers: readonly IStageLayer<T>[]): void;
  /** Play, pause, seek, speed change, loop, end and document change. */
  sync?(time: ITransportTime, state: IStageSyncState): void;
  /** Once per rendered frame, with every layer of the stage. */
  render?(time: ITransportTime, states: readonly IStageLayerState<T>[]): void;
  /** The layer was removed or its target changed; `object` is not destroyed. */
  release?(layerId: string, object: T): void;
  /** End; every object stays with the developer. */
  detach?(): void;
}

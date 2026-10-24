// packages/runtime/src/stage/object/createObjectStage.ts
/**
 * Aide `createObjectStage` : une scène pour des objets qui ne sont pas du HTML
 * (sprites canvas, pistes audio, servomoteurs...). Le développeur donne ses
 * objets et une fonction `apply` ; l'aide s'occupe du routage `{ ref }`, de la
 * liste des cibles, de la remise à zéro et d'un seul `endFrame` par image.
 * Un calque inactif reçoit `reset` puis `apply` ; sans `reset`, `apply` reçoit
 * les valeurs par défaut du registre.
 */

import { isRefTarget } from '../../model/guards';
import type { LayerTarget } from '../../model/target';
import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import { refStage } from '../routing';
import type { IStageContext, IStageLayer, IStageLayerState, ITargetInfo, ITargetPropertyInfo } from '../types';
import type { IObjectStage, IObjectStageEntry, IObjectStageOptions, ObjectStageState } from './types';

function propertyName(property: string | ITargetPropertyInfo): string {
  return typeof property === 'string' ? property : property.name;
}

function targetInfo(stageId: string, entry: IObjectStageEntry<unknown>): ITargetInfo {
  return {
    target: { ref: entry.id, stage: stageId },
    label: entry.label,
    ...(entry.icon === undefined ? {} : { icon: entry.icon }),
    ...(entry.group === undefined ? {} : { group: entry.group }),
    ...(entry.properties === undefined ? {} : { properties: entry.properties })
  };
}

/** Creates a stage animating the `objects` with `apply`; see `IObjectStageOptions`. */
export function createObjectStage<T>(options: IObjectStageOptions<T>): IObjectStage<T> {
  const stageId = options.id;
  const entries = new Map<string, IObjectStageEntry<T>>();
  const subscribers = new Set<() => void>();
  /** Layer id → target of the layers bound by the last `update` (needed by `release`). */
  const bound = new Map<string, LayerTarget>();
  let registry: PropertyRegistry = defaultPropertyRegistry;

  const addEntry = (entry: IObjectStageEntry<T>): void => {
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      throw new Error(`Stage "${stageId}": an object needs a non-empty string id.`);
    }
    if (entries.has(entry.id)) {
      throw new Error(`Stage "${stageId}": two objects have the id "${entry.id}".`);
    }
    entries.set(entry.id, entry);
  };
  (options.objects ?? []).forEach(addEntry);

  const entryOf = (target: LayerTarget): IObjectStageEntry<T> | undefined =>
    isRefTarget(target) ? entries.get(target.ref) : undefined;

  /** Registry defaults of the properties of `object` (those it declares, else the stage's) and of `extra`. */
  const defaultsFor = (object: T, extra: Iterable<string> = []): Record<string, number> => {
    const entry = Array.from(entries.values()).find((candidate) => candidate.object === object);
    const declared = entry?.properties?.map(propertyName) ?? (options.properties ?? []).map((p) => p.name);
    const defaults: Record<string, number> = {};
    [...declared, ...extra].forEach((name) => {
      defaults[name] = registry.get(name)?.defaultValue ?? 0;
    });
    return defaults;
  };

  const prepare = (state: IStageLayerState<T>): ObjectStageState<T> => {
    const defaults = defaultsFor(state.object, Object.keys(state.values));
    if (state.active) {
      return { ...state, values: { ...defaults, ...state.values } };
    }
    if (options.reset !== undefined) {
      options.reset(state.object);
      return { ...state, values: { ...defaults, ...state.values } };
    }
    return { ...state, values: defaults };
  };

  const stage: IObjectStage<T> = {
    id: stageId,
    properties: options.properties,
    accepts: refStage(stageId, { unscoped: options.unscoped }),
    targets: {
      list: () => Array.from(entries.values(), (entry) => targetInfo(stageId, entry)),
      describe(target) {
        const entry = stage.accepts(target) ? entryOf(target) : undefined;
        return entry === undefined ? undefined : targetInfo(stageId, entry);
      },
      subscribe(onChange) {
        subscribers.add(onChange);
        return () => {
          subscribers.delete(onChange);
        };
      }
    },
    resolve(target) {
      if (options.resolve !== undefined) {
        return options.resolve(target, new Map(Array.from(entries, ([id, entry]) => [id, entry.object])));
      }
      return entryOf(target)?.object ?? null;
    },
    attach(ctx: IStageContext) {
      registry = ctx.registry;
    },
    update(_doc, layers: readonly IStageLayer<T>[]) {
      bound.clear();
      layers.forEach((layer) => bound.set(layer.layerId, layer.target));
    },
    render(time, states) {
      const prepared = states.map(prepare);
      prepared.forEach((state) => options.apply(state.object, state.values, state));
      options.endFrame?.(time, prepared);
    },
    release(layerId, object) {
      const target = bound.get(layerId) ?? { ref: layerId, stage: stageId };
      bound.delete(layerId);
      if (options.reset !== undefined) {
        options.reset(object);
        return;
      }
      const values = defaultsFor(object);
      options.apply(object, values, { layerId, target, object, values, active: false, editorVisible: true });
    },
    add(entry) {
      addEntry(entry);
      Array.from(subscribers).forEach((listener) => listener());
    },
    remove(id) {
      const removed = entries.delete(id);
      if (removed) {
        Array.from(subscribers).forEach((listener) => listener());
      }
      return removed;
    }
  };
  if (options.sync !== undefined) {
    stage.sync = options.sync;
  }
  return stage;
}

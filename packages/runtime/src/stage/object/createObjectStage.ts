// packages/runtime/src/stage/object/createObjectStage.ts
/**
 * Aide `createObjectStage` : une scène pour des objets qui ne sont pas du HTML
 * (sprites canvas, pistes audio, servomoteurs...). Le développeur donne ses
 * objets et une fonction `apply` ; l'aide s'occupe du routage `{ ref }`, de la
 * liste des cibles, de la remise à zéro et d'un seul `endFrame` par image.
 * Un calque inactif reçoit `reset` puis `apply` ; sans `reset`, `apply` reçoit
 * les valeurs par défaut du registre, pour les propriétés déclarées et pour
 * celles que les pistes du calque animent (retenues à `update`, aussi au
 * relâchement).
 * `add()` et `remove()` signalent la cible touchée (`{ ref, stage }`) : l'hôte
 * relâche l'ancien objet et résout de nouveau les calques liés à ce `ref`,
 * qu'ils soient écrits avec ou sans `stage`. Avec un `resolve` personnalisé, un
 * autre `ref` peut mener au même objet : tous les calques liés sont aussi
 * signalés.
 */

import { isRefTarget } from '../../model/guards';
import type { ILayer } from '../../model/layer';
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

/** What the stage remembers of a layer between `update` and `release`. */
interface IBoundLayer {
  readonly target: LayerTarget;
  /** Declared properties of the object and properties animated by the layer's tracks. */
  readonly names: readonly string[];
}

/** Names of the properties animated by the tracks of `layer`'s spans. */
function trackNames(layer: ILayer): string[] {
  return Array.from(new Set(layer.spans.flatMap((span) => Object.keys(span.tracks ?? {}))));
}

/** Creates a stage animating the `objects` with `apply`; see `IObjectStageOptions`. */
export function createObjectStage<T>(options: IObjectStageOptions<T>): IObjectStage<T> {
  const stageId = options.id;
  const entries = new Map<string, IObjectStageEntry<T>>();
  const subscribers = new Set<(affected?: readonly LayerTarget[]) => void>();
  const notify = (id: string): void => {
    const own: LayerTarget = { ref: id, stage: stageId };
    // A custom `resolve` may map other refs to this object: notify every bound target too.
    const affected: readonly LayerTarget[] =
      options.resolve === undefined ? [own] : [own, ...Array.from(bound.values(), (layer) => layer.target)];
    Array.from(subscribers).forEach((listener) => listener(affected));
  };
  /** Layer id → target of the layers bound by the last `update` (needed by `release`). */
  const bound = new Map<string, IBoundLayer>();
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

  /** Names of the properties a layer's object declares (else the stage's), fixed at `update`. */
  const declaredNames = (object: T, target: LayerTarget): string[] => {
    const entry = entryOf(target) ?? Array.from(entries.values()).find((candidate) => candidate.object === object);
    return (entry?.properties?.map(propertyName) ?? (options.properties ?? []).map((p) => p.name));
  };

  const stageNames = (): string[] => (options.properties ?? []).map((p) => p.name);

  /** Registry defaults of `names` and of `extra`. */
  const defaultsFor = (names: readonly string[], extra: Iterable<string> = []): Record<string, number> => {
    const defaults: Record<string, number> = {};
    [...names, ...extra].forEach((name) => {
      defaults[name] = registry.get(name)?.defaultValue ?? 0;
    });
    return defaults;
  };

  const prepare = (state: IStageLayerState<T>): ObjectStageState<T> => {
    const defaults = defaultsFor(bound.get(state.layerId)?.names ?? stageNames(), Object.keys(state.values));
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
      layers.forEach((layer) =>
        bound.set(layer.layerId, {
          target: layer.target,
          names: Array.from(new Set([...declaredNames(layer.object, layer.target), ...trackNames(layer.layer)]))
        })
      );
    },
    render(time, states) {
      const prepared = states.map(prepare);
      prepared.forEach((state) => options.apply(state.object, state.values, state));
      options.endFrame?.(time, prepared);
    },
    release(layerId, object) {
      const layer = bound.get(layerId);
      bound.delete(layerId);
      if (options.reset !== undefined) {
        options.reset(object);
        return;
      }
      if (layer === undefined) {
        return;
      }
      const values = defaultsFor(layer.names);
      options.apply(object, values, { layerId, target: layer.target, object, values, active: false, editorVisible: true });
    },
    add(entry) {
      addEntry(entry);
      notify(entry.id);
    },
    remove(id) {
      const removed = entries.delete(id);
      if (removed) {
        notify(id);
      }
      return removed;
    }
  };
  if (options.sync !== undefined) {
    stage.sync = options.sync;
  }
  return stage;
}

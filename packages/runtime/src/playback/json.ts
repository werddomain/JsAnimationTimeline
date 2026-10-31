// packages/runtime/src/playback/json.ts
import { MAX_PLAYBACK_DEPTH, MAX_PLAYBACK_JSON_NODES, MAX_PLAYBACK_TEXT_LENGTH } from './limits';

interface ICloneBudget { nodes: number; characters: number; readonly ancestors: Set<object> }
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function textBudget(text: string, budget: ICloneBudget): void {
  budget.characters += text.length;
  if (budget.characters > MAX_PLAYBACK_TEXT_LENGTH) throw new TypeError('Le document de lecture dépasse la limite de texte.');
}

function cloneValue(value: unknown, budget: ICloneBudget, depth: number): unknown {
  if (++budget.nodes > MAX_PLAYBACK_JSON_NODES || depth > MAX_PLAYBACK_DEPTH) {
    throw new TypeError('Le document de lecture dépasse la limite de taille ou de profondeur.');
  }
  if (typeof value === 'string') { textBudget(value, budget); return value; }
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null || budget.ancestors.has(value)) {
    throw new TypeError('Le document de lecture exige des données JSON finies sans fonctions ni cycles.');
  }
  const isArray = Array.isArray(value);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (!isArray && prototype !== null && prototype !== Object.prototype) throw new TypeError('Le document de lecture contient un objet non sérialisable.');
  if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError('Les symboles ne sont pas autorisés dans les données de lecture.');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const fields = Object.entries(descriptors).filter(([key]) => !isArray || key !== 'length');
  if (isArray && (fields.length !== value.length || fields.some(([key], index) => key !== String(index)))) {
    throw new TypeError('Les tableaux de lecture doivent être complets et sans champs supplémentaires.');
  }
  budget.ancestors.add(value);
  const copy = Object.create(null) as Record<string, unknown>;
  for (const [key, descriptor] of fields) {
    textBudget(key, budget);
    if (!('value' in descriptor) || !descriptor.enumerable || RESERVED_KEYS.has(key)) {
      throw new TypeError('Les accesseurs, champs masqués et noms réservés sont interdits dans les données de lecture.');
    }
    copy[key] = cloneValue(descriptor.value, budget, depth + 1);
  }
  budget.ancestors.delete(value);
  return isArray ? fields.map(([key]) => copy[key]) : copy;
}

/** Strict JSON clone: never invokes getters or toJSON, and detaches every caller-owned object. */
export function clonePlaybackJson(input: unknown): unknown {
  return cloneValue(input, { nodes: 0, characters: 0, ancestors: new Set() }, 0);
}

/** Freeze a detached, already validated JSON tree before caching its validation. */
export function freezePlaybackJson<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freezePlaybackJson);
    Object.freeze(value);
  }
  return value;
}

// packages/editor/src/model/propertyTimelines/values.ts
import { isPropertyEasing } from '@kazo-ca/timeline-runtime';
import type { PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import { PropertyOperationError } from '../properties/propertyValue';
import type { PropertyTimelineOperation } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the complete value before accepting data from a JavaScript caller. */
export function assertPropertyValue(value: unknown): asserts value is TimelinePropertyValue {
  if (!isRecord(value)) throw new PropertyOperationError('La valeur de propriété doit préciser son type.');
  const fields = value.kind === 'color' ? ['kind', 'r', 'g', 'b', 'a'] : ['kind', 'value'];
  const complete = fields.every((field) => Object.prototype.hasOwnProperty.call(value, field))
    && Reflect.ownKeys(value).every((field) => typeof field === 'string' && fields.includes(field));
  const valid = value.kind === 'number' ? typeof value.value === 'number' && Number.isFinite(value.value)
    : value.kind === 'text' ? typeof value.value === 'string'
      : value.kind === 'boolean' ? typeof value.value === 'boolean'
        : value.kind === 'color' && ['r', 'g', 'b', 'a'].every((channel) =>
          typeof value[channel] === 'number' && Number.isFinite(value[channel]) && value[channel] >= 0 && value[channel] <= 1);
  if (!complete || !valid) throw new PropertyOperationError('La valeur de propriété est invalide (nombre fini, texte, booléen ou couleur RGBA entre 0 et 1).');
}

export function sameValue(first: TimelinePropertyValue, second: TimelinePropertyValue): boolean {
  if (first.kind === 'color') return second.kind === 'color'
    && first.r === second.r && first.g === second.g && first.b === second.b && first.a === second.a;
  return second.kind === first.kind && first.value === second.value;
}

export function assertEasing(easing: PropertyEasing | undefined): void {
  if (easing !== undefined && !isPropertyEasing(easing)) {
    throw new PropertyOperationError("L'effet d'accélération ou ses paramètres sont invalides.");
  }
}

export function sameEasing(first: PropertyEasing | undefined, second: PropertyEasing | undefined): boolean {
  if (first === undefined || second === undefined) return first === second;
  if (first.kind === 'bezier') return second.kind === 'bezier'
    && first.x1 === second.x1 && first.y1 === second.y1 && first.x2 === second.x2 && first.y2 === second.y2;
  if (second.kind !== 'effect' || first.family !== second.family || first.mode !== second.mode) return false;
  const firstParameters = Object.entries(first.parameters ?? {});
  const secondParameters = Object.entries(second.parameters ?? {});
  return firstParameters.length === secondParameters.length
    && firstParameters.every(([name, value]) => secondParameters.some(([other, otherValue]) => name === other && value === otherValue));
}

/** Own serializable operation data; metadata callbacks and the registry stay live. */
export function clonePropertyOperation(operation: PropertyTimelineOperation): PropertyTimelineOperation {
  const copy = { ...operation };
  if ('value' in copy && typeof copy.value === 'object' && copy.value !== null) copy.value = { ...copy.value };
  if ('initialValue' in copy && typeof copy.initialValue === 'object' && copy.initialValue !== null) copy.initialValue = { ...copy.initialValue };
  if ('frames' in copy && Array.isArray(copy.frames)) copy.frames = [...copy.frames];
  if ('easing' in copy && typeof copy.easing === 'object' && copy.easing !== null) {
    copy.easing = copy.easing.kind === 'effect' && isRecord(copy.easing.parameters)
      ? { ...copy.easing, parameters: { ...copy.easing.parameters } } : { ...copy.easing };
  }
  return copy;
}

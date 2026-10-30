// packages/runtime/src/model/propertyEasing.ts
/** Serializable, parameterized timing functions for independent property transitions. */
export type PropertyEasingFamily = 'linear' | 'sine' | 'circle' | 'quadratic' | 'cubic'
  | 'quartic' | 'quintic' | 'power' | 'exponential' | 'back' | 'bounce' | 'elastic';

/** Timing direction, distinct from the legacy CSS ease-in/ease-out presets. */
export type PropertyEasingMode = 'in' | 'out' | 'in-out';

/** Parameters are optional; only the selected effect's parameters are accepted. */
export interface IEffectParameters {
  /** Power family: exponent in [0.1, 20], default 2. */
  readonly power?: number;
  /** Exponential family: growth in [0, 30], default 2; zero is linear. */
  readonly exponent?: number;
  /** Back family: backward displacement in [0, 10], default 1. */
  readonly amplitude?: number;
  /** Bounce family: integer bounce count in [0, 32], default 3. */
  readonly bounces?: number;
  /** Bounce family: ratio of successive bounce sizes in [1, 10], default 2. */
  readonly bounciness?: number;
  /** Elastic family: integer oscillation count in [0, 32], default 3. */
  readonly oscillations?: number;
  /** Elastic family: envelope growth in [0, 30], default 3; zero is linear. */
  readonly springiness?: number;
}

/** Cubic Bezier timing curve: x coordinates in [0, 1], y coordinates in [-100, 100]. */
export interface IBezierPropertyEasing {
  readonly kind: 'bezier';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** A mathematical effect and its timing direction. */
export interface IEffectPropertyEasing {
  readonly kind: 'effect';
  readonly family: PropertyEasingFamily;
  readonly mode: PropertyEasingMode;
  readonly parameters?: IEffectParameters;
}

/** No executable function is stored in a document. */
export type PropertyEasing = IBezierPropertyEasing | IEffectPropertyEasing;

type ParameterName = keyof IEffectParameters;

const FAMILY_PARAMETERS: Readonly<Record<PropertyEasingFamily, readonly ParameterName[]>> = {
  linear: [], sine: [], circle: [], quadratic: [], cubic: [], quartic: [], quintic: [],
  power: ['power'], exponential: ['exponent'], back: ['amplitude'],
  bounce: ['bounces', 'bounciness'], elastic: ['oscillations', 'springiness']
};

const PARAMETER_LIMITS: Readonly<Record<ParameterName, readonly [number, number]>> = {
  power: [0.1, 20], exponent: [0, 30], amplitude: [0, 10], bounces: [0, 32],
  bounciness: [1, 10], oscillations: [0, 32], springiness: [0, 30]
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function hasOnlyFields(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  allowed: readonly string[] = required
): boolean {
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Reflect.ownKeys(value).every((key) => typeof key === 'string' && allowed.includes(key));
}

function isInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isFamily(value: unknown): value is PropertyEasingFamily {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FAMILY_PARAMETERS, value);
}

function isParameters(value: unknown, family: PropertyEasingFamily): boolean {
  if (!isRecord(value) || !hasOnlyFields(value, [], FAMILY_PARAMETERS[family])) return false;
  return Object.getOwnPropertyNames(value).every((key) => {
    const name = key as ParameterName;
    const parameter = value[name];
    const [min, max] = PARAMETER_LIMITS[name];
    return isInRange(parameter, min, max)
      && (name !== 'bounces' && name !== 'oscillations' || Number.isInteger(parameter));
  });
}

/** Validate an untrusted easing description before evaluating or persisting it. */
export function isPropertyEasing(value: unknown): value is PropertyEasing {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'kind')) return false;
  if (value.kind === 'bezier') {
    return hasOnlyFields(value, ['kind', 'x1', 'y1', 'x2', 'y2'])
      && isInRange(value.x1, 0, 1) && isInRange(value.x2, 0, 1)
      && isInRange(value.y1, -100, 100) && isInRange(value.y2, -100, 100);
  }
  if (value.kind !== 'effect'
    || !hasOnlyFields(value, ['kind', 'family', 'mode'], ['kind', 'family', 'mode', 'parameters'])
    || !isFamily(value.family)
    || value.mode !== 'in' && value.mode !== 'out' && value.mode !== 'in-out') return false;
  return !Object.prototype.hasOwnProperty.call(value, 'parameters') || isParameters(value.parameters, value.family);
}

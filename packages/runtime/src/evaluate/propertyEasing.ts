// packages/runtime/src/evaluate/propertyEasing.ts
import { isPropertyEasing } from '../model/propertyEasing';
import type { IEffectPropertyEasing, PropertyEasing } from '../model/propertyEasing';
import { createEasingFunction } from './easingFunction';
import type { EasingFunction } from './easingFunction';

/** Expand scientific notation because the existing CSS parser accepts decimal notation. */
function decimal(value: number): string {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [coefficient, exponent] = text.split('e');
  const sign = coefficient.startsWith('-') ? '-' : '';
  const unsigned = coefficient.replace('-', '');
  const digits = unsigned.replace('.', '');
  const point = (unsigned.includes('.') ? unsigned.indexOf('.') : unsigned.length) + Number(exponent);
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** Numerically stable at small positive growth, with the exact zero-growth limit. */
function exponentialEnvelope(growth: number): EasingFunction {
  if (growth <= Number.EPSILON) return (progress) => progress;
  const denominator = Math.expm1(growth);
  return (progress) => Math.expm1(growth * progress) / denominator;
}

interface BounceArc {
  readonly start: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Geometric parabolic arcs with the last half-arc ending at one. This construction
 * also handles equal bounce sizes (ratio = 1) without unstable logarithms.
 * Effect semantics follow WPF: https://learn.microsoft.com/en-us/dotnet/desktop/wpf/graphics-multimedia/easing-functions
 */
function bounceIn(count: number, ratio: number): EasingFunction {
  const arcs: BounceArc[] = [];
  let start = 0;
  for (let index = 0; index <= count; index++) {
    const width = Math.pow(ratio, index);
    arcs.push({ start, width, height: Math.pow(ratio, index - count) });
    start += index === count ? width / 2 : width;
  }
  const totalWidth = start;
  return (progress) => {
    const position = progress * totalWidth;
    const arc = arcs.find((candidate) => position <= candidate.start + candidate.width) ?? arcs[arcs.length - 1];
    const local = (position - arc.start) / arc.width;
    return 4 * arc.height * local * (1 - local);
  };
}

/** Snapshot parameters so editing a description cannot mutate an existing function. */
function effectIn(easing: IEffectPropertyEasing): EasingFunction {
  const parameters = easing.parameters;
  switch (easing.family) {
    case 'linear': return (progress) => progress;
    case 'sine': return (progress) => 1 - Math.cos(progress * Math.PI / 2);
    case 'circle': return (progress) => 1 - Math.sqrt(1 - progress * progress);
    case 'quadratic': return (progress) => progress * progress;
    case 'cubic': return (progress) => progress * progress * progress;
    case 'quartic': return (progress) => Math.pow(progress, 4);
    case 'quintic': return (progress) => Math.pow(progress, 5);
    case 'power': {
      const power = parameters?.power ?? 2;
      return (progress) => Math.pow(progress, power);
    }
    case 'exponential': return exponentialEnvelope(parameters?.exponent ?? 2);
    case 'back': {
      const amplitude = parameters?.amplitude ?? 1;
      return (progress) => progress * progress * progress - amplitude * progress * Math.sin(Math.PI * progress);
    }
    case 'bounce': return bounceIn(parameters?.bounces ?? 3, parameters?.bounciness ?? 2);
    case 'elastic': {
      const envelope = exponentialEnvelope(parameters?.springiness ?? 3);
      const frequency = (2 * (parameters?.oscillations ?? 3) + 0.5) * Math.PI;
      return (progress) => envelope(progress) * Math.sin(frequency * progress);
    }
  }
}

function compile(easing: PropertyEasing | undefined): EasingFunction {
  if (easing === undefined) return (progress) => progress;
  if (easing.kind === 'bezier') {
    const coordinates = [easing.x1, easing.y1, easing.x2, easing.y2].map(decimal).join(',');
    return createEasingFunction(`cubic-bezier(${coordinates})`);
  }
  const easeIn = effectIn(easing);
  switch (easing.mode) {
    case 'in': return easeIn;
    case 'out': return (progress) => 1 - easeIn(1 - progress);
    case 'in-out': return (progress) => progress < 0.5
      ? easeIn(2 * progress) / 2 : 1 - easeIn(2 * (1 - progress)) / 2;
  }
}

/**
 * Build a timing function for a modern property transition; undefined is linear.
 * Input progress is normalized to [0, 1]; nonfinite inputs throw. Output is never
 * clamped, preserving backward motion and spring/Bezier overshoot.
 */
export function createPropertyEasingFunction(easing?: PropertyEasing): EasingFunction {
  if (easing !== undefined && !isPropertyEasing(easing)) throw new Error('Invalid property easing.');
  const evaluate = compile(easing);
  return (progress) => {
    if (!Number.isFinite(progress)) throw new Error('Property easing progress must be finite.');
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return evaluate(progress);
  };
}

// packages/runtime/src/properties/types.ts
/**
 * Description d'une propriété animable : partagée par le runtime, l'éditeur
 * et l'export CSS, pour que les trois donnent le même rendu.
 */

/** `transform` : composée dans la chaîne `transform` ; `style` : propriété CSS à part. */
export type PropertyKind = 'transform' | 'style';

/**
 * Step of the fixed transform order (translate → rotate → scale → skew).
 * Properties of the same step are sorted by name (see `PropertyRegistry.transformProperties`).
 */
export type TransformStep = 'translate' | 'rotate' | 'scale' | 'skew';

/** Fixed composition order of the transform steps. */
export const TRANSFORM_STEPS: readonly TransformStep[] = ['translate', 'rotate', 'scale', 'skew'];

/** Interpolation between `a` (t = 0) and `b` (t = 1); `t` may leave [0, 1] with overshooting easings. */
export type PropertyInterpolator = (a: number, b: number, t: number) => number;

/** Fields shared by every property descriptor. */
interface IPropertyDescriptorBase {
  /** Name used in the document tracks, e.g. `x`, `opacity`, `borderRadius`. */
  readonly name: string;
  readonly kind: PropertyKind;
  /** Unit appended to the value in CSS, e.g. `px`, `deg`, `` (none). */
  readonly unit: string;
  /** Value used when no keyframe defines the property. */
  readonly defaultValue: number;
  /** Lower bound applied to computed values (e.g. 0 for opacity). */
  readonly min?: number;
  /** Upper bound applied to computed values (e.g. 1 for opacity). */
  readonly max?: number;
  /** Defaults to linear interpolation. */
  readonly interpolate?: PropertyInterpolator;
}

/** A property composed into the `transform` string. */
export interface ITransformPropertyDescriptor extends IPropertyDescriptorBase {
  readonly kind: 'transform';
  /** CSS transform function, e.g. `translateX`, `rotate`. */
  readonly cssName: string;
  readonly step: TransformStep;
}

/** A property written as its own CSS property. */
export interface IStylePropertyDescriptor extends IPropertyDescriptorBase {
  readonly kind: 'style';
  /** CSS property name in kebab-case, e.g. `opacity`, `border-radius`. */
  readonly cssName: string;
}

/** Description of an animatable numeric property. */
export type PropertyDescriptor = ITransformPropertyDescriptor | IStylePropertyDescriptor;

/** Numeric value per property name. */
export type PropertyValues = Readonly<Record<string, number>>;

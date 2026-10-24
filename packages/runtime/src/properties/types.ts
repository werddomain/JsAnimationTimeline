// packages/runtime/src/properties/types.ts
/**
 * Description d'une propriété animable : partagée par le runtime, l'éditeur
 * et l'export CSS, pour que les trois donnent le même rendu.
 */

/**
 * `transform` : composée dans la chaîne `transform` ; `style` : propriété CSS
 * à part ; `value` : simple nombre sans nom CSS, passé tel quel à une scène
 * (canvas, audio...) et ignoré par la composition CSS.
 */
export type PropertyKind = 'transform' | 'style' | 'value';

/** Kinds written to CSS. */
export type CssPropertyKind = Exclude<PropertyKind, 'value'>;

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
  /**
   * Unit appended to the value in CSS, e.g. `px`, `deg`, `` (none). For a
   * `value` property it is only displayed.
   */
  readonly unit: string;
  /** Display name in the editor, e.g. `Rotation`; defaults to `name`. */
  readonly label?: string;
  /** Display group in the editor, e.g. `Transform`, `Audio`. */
  readonly group?: string;
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

/** A plain number with no CSS name, read by a stage (e.g. `frameIndex`, `volume`). */
export interface IValuePropertyDescriptor extends IPropertyDescriptorBase {
  readonly kind: 'value';
  /** A value property has no CSS name. */
  readonly cssName?: undefined;
}

/** A property written to CSS. */
export type CssPropertyDescriptor = ITransformPropertyDescriptor | IStylePropertyDescriptor;

/** Description of an animatable numeric property. */
export type PropertyDescriptor = CssPropertyDescriptor | IValuePropertyDescriptor;

/** True for `transform` and `style` properties (the ones written to CSS). */
export function isCssProperty(descriptor: PropertyDescriptor): descriptor is CssPropertyDescriptor {
  return descriptor.kind !== 'value';
}

/** Numeric value per property name. */
export type PropertyValues = Readonly<Record<string, number>>;

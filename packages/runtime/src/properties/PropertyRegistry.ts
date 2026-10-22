// packages/runtime/src/properties/PropertyRegistry.ts
/**
 * Registre des propriétés animables. Contient les propriétés intégrées ; un
 * plugin y ajoute toute propriété CSS numérique avec `register`.
 */

import { BUILTIN_PROPERTIES } from './builtins';
import { TRANSFORM_STEPS } from './types';
import type { ITransformPropertyDescriptor, PropertyDescriptor } from './types';

const CSS_IDENT = /^-?[a-zA-Z_][\w-]*$/;
const PROPERTY_NAME = /^[a-zA-Z_$][\w$]*$/;

function fail(name: string, reason: string): never {
  throw new Error(`Invalid property "${name}": ${reason}.`);
}

/** Throws a descriptive `Error` when a descriptor is malformed. */
export function assertValidDescriptor(descriptor: PropertyDescriptor): void {
  const { name } = descriptor;
  if (typeof name !== 'string' || !PROPERTY_NAME.test(name)) {
    fail(String(name), 'the name must be an identifier such as "x" or "borderRadius"');
  }
  if (descriptor.kind !== 'transform' && descriptor.kind !== 'style') {
    fail(name, `unknown kind "${String((descriptor as { kind: unknown }).kind)}"`);
  }
  if (typeof descriptor.cssName !== 'string' || !CSS_IDENT.test(descriptor.cssName)) {
    fail(name, 'cssName must be a CSS identifier');
  }
  if (typeof descriptor.unit !== 'string') {
    fail(name, 'unit must be a string ("" for none)');
  }
  if (!Number.isFinite(descriptor.defaultValue)) {
    fail(name, 'defaultValue must be a finite number');
  }
  if (descriptor.min !== undefined && descriptor.max !== undefined && descriptor.min > descriptor.max) {
    fail(name, 'min is greater than max');
  }
  if (descriptor.kind === 'transform' && !TRANSFORM_STEPS.includes(descriptor.step)) {
    fail(name, `step must be one of ${TRANSFORM_STEPS.join(', ')}`);
  }
}

/** Set of property descriptors, looked up by name. */
export class PropertyRegistry {
  private readonly descriptors = new Map<string, PropertyDescriptor>();

  /** @param descriptors Initial properties, usually `BUILTIN_PROPERTIES`. */
  constructor(descriptors: readonly PropertyDescriptor[] = []) {
    descriptors.forEach((descriptor) => this.register(descriptor));
  }

  /** Adds a property; throws when it is malformed or the name is taken. */
  register(descriptor: PropertyDescriptor): this {
    assertValidDescriptor(descriptor);
    if (this.descriptors.has(descriptor.name)) {
      throw new Error(`Property "${descriptor.name}" is already registered.`);
    }
    this.descriptors.set(descriptor.name, Object.freeze({ ...descriptor }));
    return this;
  }

  /** Removes a property; returns `false` when it was not registered. */
  unregister(name: string): boolean {
    return this.descriptors.delete(name);
  }

  has(name: string): boolean {
    return this.descriptors.has(name);
  }

  get(name: string): PropertyDescriptor | undefined {
    return this.descriptors.get(name);
  }

  /** Like `get`, but throws for an unknown name. */
  require(name: string): PropertyDescriptor {
    const descriptor = this.descriptors.get(name);
    if (descriptor === undefined) {
      throw new Error(`Unknown property "${name}". Register it with registerProperty().`);
    }
    return descriptor;
  }

  /** All properties, in registration order. */
  list(): PropertyDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /** Transform properties in composition order (translate → rotate → scale → skew). */
  transformProperties(): ITransformPropertyDescriptor[] {
    const transforms = this.list().filter((d): d is ITransformPropertyDescriptor => d.kind === 'transform');
    return TRANSFORM_STEPS.flatMap((step) => transforms.filter((d) => d.step === step));
  }

  /** Independent copy (same descriptors), to extend without touching this one. */
  clone(): PropertyRegistry {
    return new PropertyRegistry(this.list());
  }
}

/** New registry holding the built-in properties. */
export function createPropertyRegistry(extra: readonly PropertyDescriptor[] = []): PropertyRegistry {
  return new PropertyRegistry([...BUILTIN_PROPERTIES, ...extra]);
}

/** Registry used by default by the player, the editor and the CSS export. */
export const defaultPropertyRegistry: PropertyRegistry = createPropertyRegistry();

/** Adds a property to `defaultPropertyRegistry` (for plugins). */
export function registerProperty(descriptor: PropertyDescriptor): void {
  defaultPropertyRegistry.register(descriptor);
}

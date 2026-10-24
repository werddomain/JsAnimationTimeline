// packages/export-css/src/__tests__/registry.ts
/**
 * Registre de test qui connaît en plus une propriété non CSS (`frameIndex`,
 * `kind: 'value'`), comme celles qu'ajoutera F06. Le registre actuel refuse
 * ce type à l'enregistrement : `get` est donc surchargé.
 */

import { BUILTIN_PROPERTIES, PropertyRegistry } from '@werddomain/timeline-runtime';
import type { PropertyDescriptor } from '@werddomain/timeline-runtime';

const FRAME_INDEX = { name: 'frameIndex', kind: 'value', unit: '', defaultValue: 0 } as unknown as PropertyDescriptor;

export class RegistryWithValueProperty extends PropertyRegistry {
  constructor() {
    super(BUILTIN_PROPERTIES);
  }

  override get(name: string): PropertyDescriptor | undefined {
    return name === FRAME_INDEX.name ? FRAME_INDEX : super.get(name);
  }
}

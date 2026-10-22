// packages/runtime/src/migrate/easing.ts
/**
 * Conversion du `type` d'un tween v1 en accélération v2.
 */

import { parseEasing, type Easing } from '../model/easing';

/** camelCase names that some v1 files use for the CSS presets. */
const V1_ALIASES: ReadonlyMap<string, Easing> = new Map<string, Easing>([
  ['easeIn', 'ease-in'],
  ['easeOut', 'ease-out'],
  ['easeInOut', 'ease-in-out']
]);

/** Returns the v2 easing of a v1 tween `type`, or `null` when it is unknown. */
export function mapV1Easing(type: string): Easing | null {
  const trimmed = type.trim();
  const alias = V1_ALIASES.get(trimmed);
  if (alias !== undefined) {
    return alias;
  }
  const lower = trimmed.toLowerCase();
  return parseEasing(lower) === null ? null : (lower as Easing);
}

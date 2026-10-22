// packages/runtime/src/migrate/context.ts
/**
 * État partagé d'une migration (ids, avertissements, nombre d'images) et
 * petits utilitaires de lecture d'un JSON non typé.
 */

import type { IdAllocator } from './ids';
import type { IMigrationWarning, MigrationWarningCode } from './issues';

export interface IMigrationContext {
  readonly totalFrames: number;
  readonly ids: IdAllocator;
  readonly warnings: IMigrationWarning[];
}

export function warn(ctx: IMigrationContext, path: string, code: MigrationWarningCode, message: string): void {
  ctx.warnings.push({ path, code, message });
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

// packages/runtime/src/migrate/migrate-v1.ts
/**
 * Migrateur v1 → v2 : convertit un document v1 (JSON déjà analysé) en
 * document v2, en signalant chaque correction par un avertissement.
 * Le résultat respecte les invariants de `validateDocument`.
 */

import { SCHEMA_VERSION, type ITimelineDocument, type ITimelineSettings } from '../model/document';
import { isPositiveInteger, isRecord, type IMigrationContext } from './context';
import { IdAllocator } from './ids';
import { MigrationError, MigrationErrorCodes, MigrationWarningCodes, type IMigrationWarning } from './issues';
import { collectRawIds, migrateNodes } from './layers';
import type { IV1TimelineDocument } from './v1-types';

/** fps used when the v1 `frameRate` is missing or not a number. */
export const V1_DEFAULT_FPS = 24;
const MIN_FPS = 1;
const MAX_FPS = 240;

/** A v2 document and the fixes made to get it. */
export interface IMigrationResult {
  readonly document: ITimelineDocument;
  /** Empty when the input converted without any fix. */
  readonly warnings: readonly IMigrationWarning[];
}

function majorOf(value: Readonly<Record<string, unknown>>): string | null {
  if (typeof value.version !== 'string') {
    return null;
  }
  const match = /^(\d+)(?:\.|$)/.exec(value.version.trim());
  return match === null ? null : match[1];
}

/** True when `value` is an object whose `version` has major 1 (the content is not checked). */
export function isV1Document(value: unknown): value is IV1TimelineDocument {
  return isRecord(value) && majorOf(value) === '1';
}

function readFps(warnings: IMigrationWarning[], frameRate: unknown): number {
  if (typeof frameRate !== 'number' || !Number.isFinite(frameRate)) {
    warnings.push({ path: '/settings/frameRate', code: MigrationWarningCodes.FPS_ADJUSTED,
      message: `Missing or invalid frame rate; ${V1_DEFAULT_FPS} fps is used.` });
    return V1_DEFAULT_FPS;
  }
  const fps = Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(frameRate)));
  if (fps !== frameRate) {
    warnings.push({ path: '/settings/frameRate', code: MigrationWarningCodes.FPS_ADJUSTED,
      message: `Frame rate ${frameRate} is not an integer in ${MIN_FPS}..${MAX_FPS}; ${fps} fps is used.` });
  }
  return fps;
}

function readSettings(warnings: IMigrationWarning[], raw: unknown): ITimelineSettings {
  if (!isRecord(raw) || !isPositiveInteger(raw.totalFrames)) {
    throw new MigrationError(MigrationErrorCodes.INVALID_SETTINGS, 'settings.totalFrames must be a positive integer.');
  }
  return { fps: readFps(warnings, raw.frameRate), totalFrames: raw.totalFrames };
}

/**
 * Converts a v1 document to v2.
 * - Each keyframe starts a span lasting until the next keyframe (or the last frame):
 *   hollow → `blank`, solid → `static`, or `tween` when it starts inside a v1 tween.
 * - Frames before the first keyframe become a `blank` span; a layer without keyframes has no spans.
 * - Tweens keep their easing but get no tracks (v1 stores no property values).
 * - The editor view settings (frameWidth, rowHeight...) are dropped.
 * @param input Parsed JSON; it is never modified.
 * @throws MigrationError when the input is not a convertible v1 document.
 */
export function migrateV1(input: unknown): IMigrationResult {
  if (!isRecord(input)) {
    throw new MigrationError(MigrationErrorCodes.NOT_AN_OBJECT, 'A timeline document must be a JSON object.');
  }
  if (majorOf(input) !== '1') {
    throw new MigrationError(MigrationErrorCodes.UNSUPPORTED_VERSION,
      `Expected a version 1.x document, got ${JSON.stringify(input.version)}.`);
  }
  const warnings: IMigrationWarning[] = [];
  const settings = readSettings(warnings, input.settings);
  if (!Array.isArray(input.layers)) {
    throw new MigrationError(MigrationErrorCodes.INVALID_LAYERS, 'layers must be an array.');
  }
  const ctx: IMigrationContext = {
    totalFrames: settings.totalFrames,
    ids: new IdAllocator(collectRawIds(input.layers)),
    warnings
  };
  const layers = migrateNodes(ctx, input.layers, '/layers');
  return { document: { version: SCHEMA_VERSION, settings, layers }, warnings };
}

/**
 * Returns a v2 document whatever the input version: a version 2.x document
 * is returned as is (not validated, see `validateDocument`), a version 1.x
 * one goes through `migrateV1`.
 * @throws MigrationError for any other input.
 */
export function migrateToV2(input: unknown): IMigrationResult {
  if (isRecord(input) && majorOf(input) === '2') {
    return { document: input as unknown as ITimelineDocument, warnings: [] };
  }
  return migrateV1(input);
}

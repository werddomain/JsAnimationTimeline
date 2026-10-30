// packages/runtime/src/model/shape.ts
/**
 * Contrôle de forme écrit à la main (pas d'ajv à l'exécution) : vérifie
 * qu'une valeur quelconque, par exemple un fichier JSON importé, a la forme
 * décrite par `schema/timeline.schema.json` (version, réglages, nœuds,
 * cibles, noms de propriétés, valeurs finies). Un test compare son verdict à
 * celui d'ajv sur les mêmes fichiers.
 *
 * Laissés aux invariants sémantiques de `validateDocument` (codes inchangés) :
 * l'accélération invalide ou interdite et les pistes d'une plage vide.
 */

import { isValidPropertyName } from './names';
import { escapePointerToken, ValidationCodes } from './issues';
import type { IValidationIssue, ValidationCode } from './issues';
import { TARGET_KEYS } from './target';
import { checkPropertyTimelinesShape } from './propertyTimelineShape';

/** Options of the shape check. */
export interface IShapeOptions {
  /**
   * Accepts the runtime-only `{ element }` target. Defaults to `true` (the
   * player keeps working with live targets); stores and importers pass `false`.
   */
  readonly allowLiveTargets?: boolean;
}

type JsonRecord = Readonly<Record<string, unknown>>;

interface IShapeContext {
  readonly allowLiveTargets: boolean;
  readonly issues: IValidationIssue[];
}

const VERSION_PATTERN = /^2\.\d+\.\d+$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const SPAN_KINDS: readonly string[] = ['static', 'blank', 'tween'];
const MAX_FPS = 240;

const NODE_FIELDS: readonly string[] = ['id', 'type', 'name', 'color', 'visible', 'locked'];
const LAYER_FIELDS: readonly string[] = [...NODE_FIELDS, 'icon', 'target', 'spans', 'propertyTimelines'];
const FOLDER_FIELDS: readonly string[] = [...NODE_FIELDS, 'collapsed', 'children'];

function report(ctx: IShapeContext, path: string, code: ValidationCode, message: string): void {
  ctx.issues.push({ path, code, message });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function has(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** The record, or `null` after reporting a type issue. */
function expectRecord(ctx: IShapeContext, value: unknown, path: string, what: string): JsonRecord | null {
  if (isRecord(value)) {
    return value;
  }
  report(ctx, path, ValidationCodes.INVALID_TYPE, `${what} must be an object.`);
  return null;
}

/** Reports missing required fields and fields outside `allowed`. */
function checkFields(
  ctx: IShapeContext,
  record: JsonRecord,
  path: string,
  required: readonly string[],
  allowed: readonly string[]
): void {
  for (const field of required) {
    if (!has(record, field)) {
      report(ctx, `${path}/${field}`, ValidationCodes.MISSING_FIELD, `Field "${field}" is required.`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!allowed.includes(field)) {
      report(ctx, `${path}/${escapePointerToken(field)}`, ValidationCodes.UNKNOWN_FIELD, `Field "${field}" is not allowed here.`);
    }
  }
}

/** Checks `record[field]` when present (absence is reported by `checkFields`). */
function checkString(ctx: IShapeContext, record: JsonRecord, field: string, path: string, nonEmpty: boolean): void {
  if (!has(record, field)) {
    return;
  }
  const value = record[field];
  if (typeof value !== 'string') {
    report(ctx, `${path}/${field}`, ValidationCodes.INVALID_TYPE, `"${field}" must be a string.`);
  } else if (nonEmpty && value.length === 0) {
    report(ctx, `${path}/${field}`, ValidationCodes.INVALID_VALUE, `"${field}" must not be empty.`);
  }
}

function checkBoolean(ctx: IShapeContext, record: JsonRecord, field: string, path: string): void {
  if (has(record, field) && typeof record[field] !== 'boolean') {
    report(ctx, `${path}/${field}`, ValidationCodes.INVALID_TYPE, `"${field}" must be a boolean.`);
  }
}

function checkInteger(ctx: IShapeContext, record: JsonRecord, field: string, path: string, min: number, max = Infinity): void {
  if (!has(record, field)) {
    return;
  }
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    report(ctx, `${path}/${field}`, ValidationCodes.INVALID_TYPE, `"${field}" must be an integer.`);
  } else if (value < min || value > max) {
    const range = max === Infinity ? `>= ${min}` : `between ${min} and ${max}`;
    report(ctx, `${path}/${field}`, ValidationCodes.OUT_OF_RANGE, `"${field}" must be ${range} (got ${value}).`);
  }
}

function checkPattern(ctx: IShapeContext, record: JsonRecord, field: string, path: string, pattern: RegExp, code: ValidationCode): void {
  const value = record[field];
  if (typeof value === 'string' && !pattern.test(value)) {
    report(ctx, `${path}/${field}`, code, `"${field}" has an invalid value "${value}".`);
  }
}

function checkKeyframe(ctx: IShapeContext, value: unknown, path: string): void {
  const keyframe = expectRecord(ctx, value, path, 'A keyframe');
  if (keyframe === null) {
    return;
  }
  checkFields(ctx, keyframe, path, ['frame', 'value'], ['frame', 'value']);
  checkInteger(ctx, keyframe, 'frame', path, 1);
  if (!has(keyframe, 'value')) {
    return;
  }
  const number = keyframe['value'];
  if (typeof number !== 'number') {
    report(ctx, `${path}/value`, ValidationCodes.INVALID_TYPE, '"value" must be a number.');
  } else if (!Number.isFinite(number)) {
    report(ctx, `${path}/value`, ValidationCodes.NON_FINITE_VALUE, `Value ${number} is not a finite number.`);
  }
}

function checkTracks(ctx: IShapeContext, value: unknown, path: string): void {
  const tracks = expectRecord(ctx, value, path, '"tracks"');
  if (tracks === null) {
    return;
  }
  for (const [name, track] of Object.entries(tracks)) {
    const trackPath = `${path}/${escapePointerToken(name)}`;
    if (!isValidPropertyName(name)) {
      report(ctx, trackPath, ValidationCodes.INVALID_PROPERTY_NAME,
        `Property name "${name}" must be letters and digits starting with a letter (not "constructor" or "prototype").`);
    } else if (!Array.isArray(track)) {
      report(ctx, trackPath, ValidationCodes.INVALID_TYPE, `Track "${name}" must be an array of keyframes.`);
    } else {
      track.forEach((keyframe: unknown, index) => checkKeyframe(ctx, keyframe, `${trackPath}/${index}`));
    }
  }
}

function checkSpan(ctx: IShapeContext, value: unknown, path: string): void {
  const span = expectRecord(ctx, value, path, 'A span');
  if (span === null) {
    return;
  }
  checkFields(ctx, span, path, ['id', 'start', 'end', 'kind'], ['id', 'start', 'end', 'kind', 'easing', 'tracks']);
  checkString(ctx, span, 'id', path, true);
  checkInteger(ctx, span, 'start', path, 1);
  checkInteger(ctx, span, 'end', path, 1);
  checkString(ctx, span, 'kind', path, false);
  const kind = span['kind'];
  if (typeof kind === 'string' && !SPAN_KINDS.includes(kind)) {
    report(ctx, `${path}/kind`, ValidationCodes.INVALID_VALUE, `Span kind must be one of ${SPAN_KINDS.join(', ')}.`);
  }
  checkString(ctx, span, 'easing', path, false);
  if (has(span, 'tracks')) {
    checkTracks(ctx, span['tracks'], `${path}/tracks`);
  }
}

function checkTargetKey(ctx: IShapeContext, target: JsonRecord, key: string, path: string): void {
  if (key === 'element') {
    if (!ctx.allowLiveTargets) {
      report(ctx, path, ValidationCodes.LIVE_TARGET, 'A live { element } target cannot be saved; use { selector } or { ref }.');
      return;
    }
    checkFields(ctx, target, path, ['element'], ['element']);
    if (typeof target['element'] !== 'object' || target['element'] === null) {
      report(ctx, `${path}/element`, ValidationCodes.INVALID_TYPE, '"element" must be an object.');
    }
    return;
  }
  const allowed = key === 'ref' ? ['ref', 'stage'] : ['selector'];
  checkFields(ctx, target, path, [key], allowed);
  allowed.forEach((field) => checkString(ctx, target, field, path, true));
}

function checkTarget(ctx: IShapeContext, value: unknown, path: string): void {
  const target = expectRecord(ctx, value, path, 'A target');
  if (target === null) {
    return;
  }
  const keys = TARGET_KEYS.filter((key) => has(target, key));
  if (keys.length !== 1) {
    report(ctx, path, ValidationCodes.INVALID_TARGET,
      `A target needs exactly one of ${TARGET_KEYS.join(', ')} (found ${keys.length === 0 ? 'none' : keys.join(', ')}).`);
    return;
  }
  checkTargetKey(ctx, target, keys[0], path);
}

function checkNodeBase(ctx: IShapeContext, node: JsonRecord, path: string): void {
  checkString(ctx, node, 'id', path, true);
  checkString(ctx, node, 'name', path, false);
  checkString(ctx, node, 'color', path, false);
  checkPattern(ctx, node, 'color', path, COLOR_PATTERN, ValidationCodes.INVALID_VALUE);
  checkBoolean(ctx, node, 'visible', path);
  checkBoolean(ctx, node, 'locked', path);
}

/** Array check, then `each` on every item. */
function checkArray(ctx: IShapeContext, record: JsonRecord, field: string, path: string, each: (item: unknown, itemPath: string) => void): void {
  if (!has(record, field)) {
    return;
  }
  const items = record[field];
  if (!Array.isArray(items)) {
    report(ctx, `${path}/${field}`, ValidationCodes.INVALID_TYPE, `"${field}" must be an array.`);
    return;
  }
  items.forEach((item: unknown, index) => each(item, `${path}/${field}/${index}`));
}

function checkNode(ctx: IShapeContext, value: unknown, path: string): void {
  const node = expectRecord(ctx, value, path, 'A layer or folder');
  if (node === null) {
    return;
  }
  const type = node['type'];
  if (type === 'layer') {
    checkFields(ctx, node, path, ['id', 'type', 'name', 'spans'], LAYER_FIELDS);
    checkNodeBase(ctx, node, path);
    checkString(ctx, node, 'icon', path, true);
    if (has(node, 'target')) {
      checkTarget(ctx, node['target'], `${path}/target`);
    }
    checkArray(ctx, node, 'spans', path, (span, spanPath) => checkSpan(ctx, span, spanPath));
    if (has(node, 'propertyTimelines')) {
      ctx.issues.push(...checkPropertyTimelinesShape(node['propertyTimelines'], `${path}/propertyTimelines`));
    }
  } else if (type === 'folder') {
    checkFields(ctx, node, path, ['id', 'type', 'name', 'children'], FOLDER_FIELDS);
    checkNodeBase(ctx, node, path);
    checkBoolean(ctx, node, 'collapsed', path);
    checkArray(ctx, node, 'children', path, (child, childPath) => checkNode(ctx, child, childPath));
  } else if (type === undefined) {
    report(ctx, `${path}/type`, ValidationCodes.MISSING_FIELD, 'Field "type" is required ("layer" or "folder").');
  } else {
    report(ctx, `${path}/type`, ValidationCodes.INVALID_VALUE, 'Node type must be "layer" or "folder".');
  }
}

function checkSettings(ctx: IShapeContext, value: unknown, path: string): void {
  const settings = expectRecord(ctx, value, path, '"settings"');
  if (settings === null) {
    return;
  }
  checkFields(ctx, settings, path, ['fps', 'totalFrames'], ['fps', 'totalFrames']);
  checkInteger(ctx, settings, 'fps', path, 1, MAX_FPS);
  checkInteger(ctx, settings, 'totalFrames', path, 1);
}

/**
 * Every shape issue of `value` (empty when it has the form of a timeline
 * document). Paths are JSON-pointer-like, `''` for the root.
 */
export function checkDocumentShape(value: unknown, options: IShapeOptions = {}): IValidationIssue[] {
  const ctx: IShapeContext = { allowLiveTargets: options.allowLiveTargets ?? true, issues: [] };
  const doc = expectRecord(ctx, value, '', 'The document');
  if (doc === null) {
    return ctx.issues;
  }
  checkFields(ctx, doc, '', ['version', 'settings', 'layers'], ['version', 'settings', 'layers']);
  checkString(ctx, doc, 'version', '', false);
  checkPattern(ctx, doc, 'version', '', VERSION_PATTERN, ValidationCodes.INVALID_VERSION);
  if (has(doc, 'settings')) {
    checkSettings(ctx, doc['settings'], '/settings');
  }
  checkArray(ctx, doc, 'layers', '', (node, nodePath) => checkNode(ctx, node, nodePath));
  return ctx.issues;
}

// packages/runtime/src/model/propertyTimelineShape.ts
import { escapePointerToken, ValidationCodes } from './issues';
import type { IValidationIssue, ValidationCode } from './issues';
import { isValidPropertyName } from './names';
import { isPropertyEasing } from './propertyEasing';
import { CUBIC_BEZIER_PATTERN, isEasingPreset } from './easing';

type JsonRecord = Readonly<Record<string, unknown>>;
type Reporter = (path: string, code: ValidationCode, message: string) => void;
const has = (value: JsonRecord, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

function record(value: unknown, path: string, report: Reporter): JsonRecord | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as JsonRecord;
  report(path, ValidationCodes.INVALID_TYPE, 'Expected an object.');
  return null;
}

function fields(value: JsonRecord, path: string, required: readonly string[], optional: readonly string[], report: Reporter): void {
  for (const key of required) {
    if (!has(value, key)) report(`${path}/${key}`, ValidationCodes.MISSING_FIELD, `Field "${key}" is required.`);
  }
  for (const key of Object.keys(value)) {
    if (![...required, ...optional].includes(key)) {
      report(`${path}/${escapePointerToken(key)}`, ValidationCodes.UNKNOWN_FIELD, `Field "${key}" is not allowed.`);
    }
  }
}

function finite(value: unknown, path: string, report: Reporter, min = -Infinity, max = Infinity): void {
  if (typeof value !== 'number') report(path, ValidationCodes.INVALID_TYPE, 'Expected a number.');
  else if (!Number.isFinite(value)) report(path, ValidationCodes.NON_FINITE_VALUE, 'Expected a finite number.');
  else if (value < min || value > max) report(path, ValidationCodes.OUT_OF_RANGE, `Expected a number in [${min}, ${max}].`);
}

function frame(value: unknown, path: string, report: Reporter): void {
  finite(value, path, report, 1);
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
    report(path, ValidationCodes.INVALID_TYPE, 'Expected an integer frame.');
  }
}

function typedValue(value: unknown, path: string, report: Reporter): void {
  const item = record(value, path, report);
  if (item === null) return;
  if (item['kind'] === 'color') {
    fields(item, path, ['kind', 'r', 'g', 'b', 'a'], [], report);
    for (const channel of ['r', 'g', 'b', 'a']) finite(item[channel], `${path}/${channel}`, report, 0, 1);
  } else {
    fields(item, path, ['kind', 'value'], [], report);
    const kind = item['kind'];
    if (kind === 'number') finite(item['value'], `${path}/value`, report);
    else if (kind === 'text' || kind === 'boolean') {
      if (typeof item['value'] !== (kind === 'text' ? 'string' : 'boolean')) {
        report(`${path}/value`, ValidationCodes.INVALID_TYPE, `Expected a ${kind} value.`);
      }
    } else report(`${path}/kind`, ValidationCodes.INVALID_VALUE, 'Unknown property value kind.');
  }
}

function keys(value: unknown, path: string, report: Reporter): void {
  if (!Array.isArray(value)) {
    report(path, ValidationCodes.INVALID_TYPE, 'Expected an array of keys.');
    return;
  }
  value.forEach((entry: unknown, index) => {
    const keyPath = `${path}/${index}`;
    const key = record(entry, keyPath, report);
    if (key === null) return;
    fields(key, keyPath, ['frame', 'value'], [], report);
    frame(key['frame'], `${keyPath}/frame`, report);
    typedValue(key['value'], `${keyPath}/value`, report);
  });
}

function easing(value: JsonRecord, path: string, report: Reporter): void {
  if (has(value, 'easing') && !isPropertyEasing(value['easing'])) {
    report(`${path}/easing`, ValidationCodes.INVALID_EASING, 'Invalid property easing or effect parameters.');
  }
}

function source(value: unknown, path: string, report: Reporter): void {
  const item = record(value, path, report);
  if (item === null) return;
  fields(item, path, ['start', 'end', 'keys'], ['easing', 'legacyEasing'], report);
  frame(item['start'], `${path}/start`, report);
  frame(item['end'], `${path}/end`, report);
  keys(item['keys'], `${path}/keys`, report);
  easing(item, path, report);
  if (has(item, 'legacyEasing')) {
    const legacy = item['legacyEasing'];
    if (typeof legacy !== 'string' || (!isEasingPreset(legacy) && !CUBIC_BEZIER_PATTERN.test(legacy))) {
      report(`${path}/legacyEasing`, ValidationCodes.INVALID_EASING, 'Expected a legacy CSS easing string.');
    }
    if (has(item, 'easing')) report(path, ValidationCodes.INVALID_CURVE_SOURCE, 'Legacy and modern source easing are mutually exclusive.');
    if (Array.isArray(item['keys'])) item['keys'].forEach((key: unknown, index) => {
      if (typeof key !== 'object' || key === null || !('value' in key)) return;
      const value = key.value;
      if (typeof value === 'object' && value !== null && 'kind' in value && value.kind !== 'number') {
        report(`${path}/keys/${index}/value`, ValidationCodes.PROPERTY_KIND_MISMATCH, 'Legacy curve sources require numeric keys.');
      }
    });
  }
}

function transitions(value: unknown, path: string, report: Reporter): void {
  if (!Array.isArray(value)) {
    report(path, ValidationCodes.INVALID_TYPE, 'Expected an array of transitions.');
    return;
  }
  value.forEach((entry: unknown, index) => {
    const entryPath = `${path}/${index}`;
    const item = record(entry, entryPath, report);
    if (item === null) return;
    fields(item, entryPath, ['id', 'fromFrame', 'toFrame'], ['easing', 'source'], report);
    if (typeof item['id'] !== 'string' || item['id'].length === 0) {
      report(`${entryPath}/id`, ValidationCodes.INVALID_VALUE, 'Expected a nonempty transition id.');
    }
    frame(item['fromFrame'], `${entryPath}/fromFrame`, report);
    frame(item['toFrame'], `${entryPath}/toFrame`, report);
    easing(item, entryPath, report);
    if (has(item, 'source')) source(item['source'], `${entryPath}/source`, report);
  });
}

function timeline(value: unknown, path: string, report: Reporter): void {
  const item = record(value, path, report);
  if (item === null) return;
  fields(item, path, ['initialValue', 'keys'], ['transitions', 'beforeFirst', 'label', 'group'], report);
  typedValue(item['initialValue'], `${path}/initialValue`, report);
  keys(item['keys'], `${path}/keys`, report);
  if (has(item, 'transitions')) transitions(item['transitions'], `${path}/transitions`, report);
  if (has(item, 'beforeFirst') && item['beforeFirst'] !== 'initial' && item['beforeFirst'] !== 'first-key') {
    report(`${path}/beforeFirst`, ValidationCodes.INVALID_VALUE, 'Expected initial or first-key.');
  }
  for (const field of ['label', 'group']) {
    if (has(item, field) && typeof item[field] !== 'string') report(`${path}/${field}`, ValidationCodes.INVALID_TYPE, 'Expected a string.');
  }
}

/** Shape-only validation matching the optional PropertyTimelines JSON definition. */
export function checkPropertyTimelinesShape(value: unknown, path: string): IValidationIssue[] {
  const issues: IValidationIssue[] = [];
  const report: Reporter = (issuePath, code, message) => issues.push({ path: issuePath, code, message });
  const tracks = record(value, path, report);
  if (tracks !== null) {
    for (const [name, value] of Object.entries(tracks)) {
      const trackPath = `${path}/${escapePointerToken(name)}`;
      if (!isValidPropertyName(name)) report(trackPath, ValidationCodes.INVALID_PROPERTY_NAME, `Invalid property name "${name}".`);
      timeline(value, trackPath, report);
    }
  }
  return issues;
}

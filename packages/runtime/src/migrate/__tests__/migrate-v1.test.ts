// packages/runtime/src/migrate/__tests__/migrate-v1.test.ts
/**
 * v1 → v2 migration: spans built from keyframes and tweens, warnings for
 * every fix, errors for inputs that cannot be converted.
 */

import { compileSchema } from '../../model/__tests__/fixtures/schema';
import type { ISpan } from '../../model/span';
import { validateDocument } from '../../model/validate';
import { MigrationError, MigrationErrorCodes, MigrationWarningCodes, type IMigrationWarning } from '../issues';
import { MAX_FOLDER_DEPTH } from '../layers';
import { isV1Document, migrateToV2, migrateV1, type IMigrationResult } from '../migrate-v1';

function v1(layers: unknown[], totalFrames = 10, frameRate: unknown = 24): Record<string, unknown> {
  return { version: '1.0.0', settings: { totalFrames, frameRate, frameWidth: 15 }, layers };
}

function layer(keyframes: unknown, tweens: unknown = [], id = 'l1'): Record<string, unknown> {
  return { id, name: 'Layer', type: 'layer', keyframes, tweens };
}

function spansOf(result: IMigrationResult): readonly ISpan[] {
  const first = result.document.layers[0];
  if (first.type !== 'layer') {
    throw new Error('expected a layer');
  }
  return first.spans;
}

/** `kind start-end` of each span, plus the easing of tweens. */
function shape(spans: readonly ISpan[]): string[] {
  return spans.map((span) => `${span.kind} ${span.start}-${span.end}${span.easing === undefined ? '' : ` ${span.easing}`}`);
}

function codes(warnings: readonly IMigrationWarning[]): string[] {
  return warnings.map((warning) => `${warning.code} ${warning.path}`);
}

function errorCodeOf(input: unknown): string {
  try {
    migrateV1(input);
  } catch (error) {
    if (error instanceof MigrationError) {
      return error.code;
    }
    throw error;
  }
  throw new Error('expected a MigrationError');
}

describe('migrateV1', () => {
  it('converts the v1 demo document into a valid v2 document', () => {
    const input = v1([
      { id: 'layer1', name: 'Layer 1', type: 'layer', visible: true, locked: false,
        keyframes: [{ frame: 1 }, { frame: 20 }, { frame: 40, isEmpty: true }],
        tweens: [{ startFrame: 1, endFrame: 20, type: 'linear' }] },
      { id: 'folder1', name: 'Folder 1', type: 'folder', children: [
        { id: 'layer2', name: 'Layer 2', type: 'layer', locked: true,
          keyframes: [{ frame: 1 }, { frame: 15 }], tweens: [{ startFrame: 1, endFrame: 15, type: 'ease' }] }
      ] }
    ], 60);
    const result = migrateV1(input);

    expect(result.warnings).toEqual([]);
    expect(result.document).toEqual({
      version: '2.0.0',
      settings: { fps: 24, totalFrames: 60 },
      layers: [
        { id: 'layer1', type: 'layer', name: 'Layer 1', visible: true, locked: false, spans: [
          { id: 'layer1-s1', start: 1, end: 19, kind: 'tween', easing: 'linear' },
          { id: 'layer1-s2', start: 20, end: 39, kind: 'static' },
          { id: 'layer1-s3', start: 40, end: 60, kind: 'blank' }
        ] },
        { id: 'folder1', type: 'folder', name: 'Folder 1', children: [
          { id: 'layer2', type: 'layer', name: 'Layer 2', locked: true, spans: [
            { id: 'layer2-s1', start: 1, end: 14, kind: 'tween', easing: 'ease' },
            { id: 'layer2-s2', start: 15, end: 60, kind: 'static' }
          ] }
        ] }
      ]
    });
    expect(validateDocument(result.document)).toEqual([]);
    expect(compileSchema()(result.document)).toBe(true);
  });

  it('never modifies its input', () => {
    const input = v1([layer([{ frame: 3 }, { frame: 3, isEmpty: true }], [{ startFrame: 3, endFrame: 99 }])]);
    const copy = JSON.parse(JSON.stringify(input)) as unknown;
    migrateV1(input);
    expect(input).toEqual(copy);
  });

  it('covers the frames before the first keyframe with a blank span', () => {
    expect(shape(spansOf(migrateV1(v1([layer([{ frame: 4 }, { frame: 8 }])]))))).toEqual(['blank 1-3', 'static 4-7', 'static 8-10']);
  });

  it('gives no spans to a layer without keyframes', () => {
    expect(spansOf(migrateV1(v1([layer(undefined, undefined)])))).toEqual([]);
  });

  it('turns every span starting inside a tween into a tween span', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 4 }, { frame: 7 }], [{ startFrame: 1, endFrame: 7, type: 'ease-out' }])]));
    expect(shape(spansOf(result))).toEqual(['tween 1-3 ease-out', 'tween 4-6 ease-out', 'static 7-10']);
  });

  it('chains consecutive tweens', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 5 }, { frame: 9 }],
      [{ startFrame: 5, endFrame: 9, type: 'ease-in' }, { startFrame: 1, endFrame: 5 }])]));
    expect(shape(spansOf(result))).toEqual(['tween 1-4', 'tween 5-8 ease-in', 'static 9-10']);
    expect(result.warnings).toEqual([]);
  });

  it('maps easing names and warns about unknown ones', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 3 }, { frame: 5 }, { frame: 7 }, { frame: 9 }], [
      { startFrame: 1, endFrame: 3, type: 'easeInOut' },
      { startFrame: 3, endFrame: 5, type: ' EASE ' },
      { startFrame: 5, endFrame: 7, type: 'cubic-bezier(0.1, 0.2, 0.3, 1.5)' },
      { startFrame: 7, endFrame: 9, type: 'bounce' }
    ])]));
    expect(shape(spansOf(result))).toEqual([
      'tween 1-2 ease-in-out', 'tween 3-4 ease', 'tween 5-6 cubic-bezier(0.1, 0.2, 0.3, 1.5)', 'tween 7-8', 'static 9-10'
    ]);
    expect(codes(result.warnings)).toEqual([`${MigrationWarningCodes.UNKNOWN_EASING} /layers/0/tweens/3/type`]);
  });

  it('adds the missing keyframes at tween boundaries', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }], [{ startFrame: 3, endFrame: 6 }])]));
    expect(shape(spansOf(result))).toEqual(['static 1-2', 'tween 3-5', 'static 6-10']);
    expect(codes(result.warnings)).toEqual([
      `${MigrationWarningCodes.TWEEN_KEYFRAME_ADDED} /layers/0/tweens`,
      `${MigrationWarningCodes.TWEEN_KEYFRAME_ADDED} /layers/0/tweens`
    ]);
  });

  it('truncates a tween ending after the last frame', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 5 }], [{ startFrame: 5, endFrame: 30 }])]));
    expect(shape(spansOf(result))).toEqual(['static 1-4', 'tween 5-10']);
    expect(codes(result.warnings)).toEqual([`${MigrationWarningCodes.TWEEN_TRUNCATED} /layers/0/tweens/0/endFrame`]);
  });

  it('drops invalid tweens', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 5 }], [
      null, { startFrame: 5, endFrame: 5 }, { startFrame: 1.5, endFrame: 5 }, { startFrame: 11, endFrame: 12 }, { startFrame: 1 }
    ])]));
    expect(shape(spansOf(result))).toEqual(['static 1-4', 'static 5-10']);
    expect(codes(result.warnings)).toEqual([0, 1, 2, 3, 4].map((i) => `${MigrationWarningCodes.INVALID_TWEEN} /layers/0/tweens/${i}`));
  });

  it('keeps a hollow keyframe inside a tween blank', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 4, isEmpty: true }, { frame: 8 }], [{ startFrame: 1, endFrame: 8 }])]));
    expect(shape(spansOf(result))).toEqual(['tween 1-3', 'blank 4-7', 'static 8-10']);
    expect(codes(result.warnings)).toEqual([`${MigrationWarningCodes.TWEEN_ON_BLANK_KEYFRAME} /layers/0/keyframes`]);
  });

  it('drops invalid keyframes and merges duplicates, solid first', () => {
    const result = migrateV1(v1([layer([
      { frame: 0 }, { frame: 11 }, { frame: 2.5 }, 'x', { frame: 6, isEmpty: true }, { frame: 6 }, { frame: 3 }, { frame: 3, isEmpty: true }
    ])]));
    expect(shape(spansOf(result))).toEqual(['blank 1-2', 'static 3-5', 'static 6-10']);
    expect(codes(result.warnings)).toEqual([
      ...[0, 1, 2, 3].map((i) => `${MigrationWarningCodes.INVALID_KEYFRAME} /layers/0/keyframes/${i}`),
      `${MigrationWarningCodes.DUPLICATE_KEYFRAME} /layers/0/keyframes/5`,
      `${MigrationWarningCodes.DUPLICATE_KEYFRAME} /layers/0/keyframes/7`
    ]);
  });

  it('adjusts the frame rate', () => {
    const fps = (frameRate: unknown): number => migrateV1(v1([], 10, frameRate)).document.settings.fps;
    expect(fps(30)).toBe(30);
    expect(fps(29.97)).toBe(30);
    expect(fps(0)).toBe(1);
    expect(fps(1000)).toBe(240);
    expect(fps(undefined)).toBe(24);
    expect(fps('24')).toBe(24);
    expect(codes(migrateV1(v1([], 10, 12.5)).warnings)).toEqual([`${MigrationWarningCodes.FPS_ADJUSTED} /settings/frameRate`]);
  });

  it('fixes ids, names and node types', () => {
    const result = migrateV1(v1([
      { id: 'a', name: 'A', type: 'layer' },
      { id: 'a', name: 'Duplicate', type: 'layer' },
      { name: 'No id', type: 'folder', children: [] },
      { id: 'layer-1', type: 'layer' },
      { id: 'g', name: 'G', children: [{ id: 'c', name: 'C' }] },
      42
    ]));
    const nodes = result.document.layers;
    expect(nodes.map((node) => `${node.type} ${node.id} ${node.name}`)).toEqual([
      'layer a A', 'layer layer-2 Duplicate', 'folder folder-1 No id', 'layer layer-1 layer-1', 'folder g G'
    ]);
    expect(codes(result.warnings)).toEqual([
      `${MigrationWarningCodes.ID_GENERATED} /layers/1/id`,
      `${MigrationWarningCodes.ID_GENERATED} /layers/2/id`,
      `${MigrationWarningCodes.NAME_DEFAULTED} /layers/3/name`,
      `${MigrationWarningCodes.NODE_TYPE_INFERRED} /layers/4/type`,
      `${MigrationWarningCodes.NODE_TYPE_INFERRED} /layers/4/children/0/type`,
      `${MigrationWarningCodes.INVALID_NODE} /layers/5`
    ]);
    expect(validateDocument(result.document)).toEqual([]);
  });

  it('never reuses an explicit id for a generated span id', () => {
    const result = migrateV1(v1([layer([{ frame: 1 }]), { id: 'l1-s1', name: 'Taken', type: 'layer' }]));
    expect(spansOf(result).map((span) => span.id)).toEqual(['l1-s2']);
    expect(validateDocument(result.document)).toEqual([]);
  });

  it('ignores folder keyframes and invalid children', () => {
    const result = migrateV1(v1([{ id: 'f', name: 'F', type: 'folder', keyframes: [{ frame: 1 }], children: 'nope' }]));
    expect(result.document.layers).toEqual([{ id: 'f', type: 'folder', name: 'F', children: [] }]);
    expect(codes(result.warnings)).toEqual([
      `${MigrationWarningCodes.FOLDER_CONTENT_IGNORED} /layers/0`,
      `${MigrationWarningCodes.INVALID_NODE} /layers/0/children`
    ]);
  });

  it('copies visible and locked only when they are booleans', () => {
    const result = migrateV1(v1([{ id: 'l', name: 'L', type: 'layer', visible: 'yes', locked: true }]));
    expect(result.document.layers[0]).toEqual({ id: 'l', type: 'layer', name: 'L', locked: true, spans: [] });
  });

  it('rejects inputs it cannot convert', () => {
    expect(errorCodeOf(null)).toBe(MigrationErrorCodes.NOT_AN_OBJECT);
    expect(errorCodeOf([])).toBe(MigrationErrorCodes.NOT_AN_OBJECT);
    expect(errorCodeOf({ settings: {}, layers: [] })).toBe(MigrationErrorCodes.UNSUPPORTED_VERSION);
    expect(errorCodeOf({ version: '2.0.0', settings: {}, layers: [] })).toBe(MigrationErrorCodes.UNSUPPORTED_VERSION);
    expect(errorCodeOf({ version: '1.0.0', layers: [] })).toBe(MigrationErrorCodes.INVALID_SETTINGS);
    expect(errorCodeOf({ version: '1.0.0', settings: { totalFrames: 0, frameRate: 24 }, layers: [] }))
      .toBe(MigrationErrorCodes.INVALID_SETTINGS);
    expect(errorCodeOf({ version: '1.0.0', settings: { totalFrames: 10, frameRate: 24 } })).toBe(MigrationErrorCodes.INVALID_LAYERS);
  });

  it('treats inherited object keys as unknown easings', () => {
    const types = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
    const result = migrateV1(v1([layer([{ frame: 1 }, { frame: 3 }, { frame: 5 }, { frame: 7 }, { frame: 9 }],
      types.map((type, i) => ({ startFrame: 1 + 2 * i, endFrame: 3 + 2 * i, type })))]));
    expect(shape(spansOf(result))).toEqual(['tween 1-2', 'tween 3-4', 'tween 5-6', 'tween 7-8', 'static 9-10']);
    expect(codes(result.warnings)).toEqual(types.map((_, i) => `${MigrationWarningCodes.UNKNOWN_EASING} /layers/0/tweens/${i}/type`));
    expect(compileSchema()(result.document)).toBe(true);
  });

  it('rejects folders nested too deeply and unsafe frame counts', () => {
    const nest = (depth: number): unknown[] => {
      let nodes: unknown[] = [];
      for (let i = 0; i < depth; i++) {
        nodes = [{ id: `f${i}`, name: 'F', type: 'folder', children: nodes }];
      }
      return nodes;
    };
    expect(() => migrateV1(v1(nest(MAX_FOLDER_DEPTH)))).not.toThrow();
    expect(errorCodeOf(v1(nest(MAX_FOLDER_DEPTH + 1)))).toBe(MigrationErrorCodes.TOO_DEEP);
    expect(errorCodeOf(v1(nest(20000)))).toBe(MigrationErrorCodes.TOO_DEEP);
    expect(errorCodeOf(v1([], 1e300))).toBe(MigrationErrorCodes.INVALID_SETTINGS);
  });

  it('names its errors', () => {
    const error = new MigrationError(MigrationErrorCodes.INVALID_LAYERS, 'boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MigrationError');
    expect(error.message).toBe('boom');
  });
});

describe('isV1Document', () => {
  it('checks the major version only', () => {
    expect(isV1Document({ version: '1.0.0' })).toBe(true);
    expect(isV1Document({ version: '1' })).toBe(true);
    expect(isV1Document({ version: '10.0.0' })).toBe(false);
    expect(isV1Document({ version: '2.0.0' })).toBe(false);
    expect(isV1Document({ version: 1 })).toBe(false);
    expect(isV1Document('1.0.0')).toBe(false);
  });
});

describe('migrateToV2', () => {
  it('returns a v2 document unchanged', () => {
    const doc = { version: '2.1.0', settings: { fps: 30, totalFrames: 5 }, layers: [] };
    const result = migrateToV2(doc);
    expect(result.document).toBe(doc);
    expect(result.warnings).toEqual([]);
  });

  it('migrates a v1 document', () => {
    expect(migrateToV2(v1([])).document.version).toBe('2.0.0');
  });

  it('rejects other versions', () => {
    expect(() => migrateToV2({ version: '3.0.0' })).toThrow(MigrationError);
  });
});

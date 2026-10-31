// packages/runtime/src/playback/__tests__/compileWork.test.ts
import { compilePlayback } from '../compilePlayback';
import * as evaluator from '../../evaluate/evaluateDocument';
import * as validator from '../../model/validate';
import type { ITimelineDocument } from '../../model/document';
import type { ICompilePlaybackOptions } from '../types';
import { documentWith, numberValue } from './fixtures';

const keys = (count: number) => Array.from({ length: count }, (_, index) => ({ frame: index + 1, value: numberValue(index) }));

function expectEarlyRefusal(doc: ITimelineDocument, options?: ICompilePlaybackOptions): void {
  const validate = jest.spyOn(validator, 'validateDocument').mockImplementation(() => { throw new Error('semantic validation must not run'); });
  const evaluate = jest.spyOn(evaluator, 'evaluateDocument').mockImplementation(() => { throw new Error('evaluation must not run'); });
  try {
    const result = compilePlayback(doc, options);
    expect(result).toEqual({ status: 'refused', diagnostics: [expect.objectContaining({ code: 'resource-limit' })] });
    expect(validate).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  } finally {
    validate.mockRestore();
    evaluate.mockRestore();
  }
}

describe('playback compilation work budget', () => {
  it('refuses a compact document with 10,000 frames and 10,000 keys before semantic validation or evaluation', () => {
    expectEarlyRefusal(documentWith({ gain: { initialValue: numberValue(0), keys: keys(10_000) } }, 10_000));
  });

  it('bounds quadratic transition validation even for a two-frame document', () => {
    expectEarlyRefusal(documentWith({ gain: {
      initialValue: numberValue(0), keys: keys(2),
      transitions: Array.from({ length: 4_000 }, (_, index) => ({ id: `t${index}`, fromFrame: 1, toFrame: 2 }))
    } }, 2));
  });

  it.each([false, true])('counts all retained source keys with legacy easing = %s', (legacy) => {
    const sourceKeys = [...keys(1_999), { frame: 10_000, value: numberValue(10_000) }];
    expectEarlyRefusal(documentWith({ gain: {
      initialValue: numberValue(0), keys: [sourceKeys[0], sourceKeys[sourceKeys.length - 1]],
      transitions: [{ id: 'long', fromFrame: 1, toFrame: 10_000, source: {
        start: 1, end: 10_000, keys: sourceKeys, ...(legacy ? { legacyEasing: 'linear' as const } : {})
      } }]
    } }, 10_000));
  });

  it('also counts historical span track keys', () => {
    expectEarlyRefusal({ version: '2.0.0', settings: { fps: 24, totalFrames: 10_000 }, layers: [{
      type: 'layer', id: 'legacy', name: 'Legacy', spans: [{ id: 'tween', start: 1, end: 10_000, kind: 'tween', tracks: {
        x: Array.from({ length: 10_000 }, (_, index) => ({ frame: index + 1, value: index }))
      } }]
    }] });
  });

  it('includes layers nested inside folders in the work estimate', () => {
    const doc = documentWith({ gain: { initialValue: numberValue(0), keys: keys(10_000) } }, 10_000);
    expectEarlyRefusal({ ...doc, layers: [{ type: 'folder', id: 'folder', name: 'Folder', children: doc.layers }] });
  });

  it('applies caller cell limits before semantic validation and evaluation', () => {
    expectEarlyRefusal(documentWith({ gain: { initialValue: numberValue(0), keys: keys(2) } }, 10), { maxCells: 29 });
  });

  it('still validates and evaluates ordinary curves with retained sources', () => {
    const sourceKeys = keys(20);
    const validate = jest.spyOn(validator, 'validateDocument');
    const evaluate = jest.spyOn(evaluator, 'evaluateDocument');
    try {
      const result = compilePlayback(documentWith({ gain: {
        initialValue: numberValue(0), keys: [sourceKeys[0], sourceKeys[19]],
        transitions: [{ id: 'normal', fromFrame: 1, toFrame: 20, source: { start: 1, end: 20, keys: sourceKeys } }]
      } }, 20), { maxCells: 60 });
      expect(result.status).toBe('exported');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(evaluate).toHaveBeenCalledTimes(20);
    } finally {
      validate.mockRestore();
      evaluate.mockRestore();
    }
  });
});

// packages/runtime/src/stage/__tests__/StageHost.errors.test.ts
/**
 * Erreurs des scènes : la première par scène et par calque est signalée
 * (`onError` et `warnings`), puis plus rien jusqu'au prochain document ;
 * une `StageDocumentError` levée par `update` annule le document.
 */

import { StageDocumentError, StageReportCodes } from '../reports';
import { StageReporter } from '../StageReporter';
import type { IStage } from '../types';
import { createFakeStage, createHost, docOf, refLayer, timeAt } from './fakeStage';
import type { IFakeObject } from './fakeStage';

function throwing(message: string): () => never {
  return () => {
    throw new Error(message);
  };
}

describe('error muting', () => {
  it('reports the first render error of a stage only, until the next document', () => {
    const errors: unknown[] = [];
    const fake = createFakeStage('canvas', { unscoped: true });
    const stage: IStage<IFakeObject> = { ...fake.stage, render: throwing('render failed') };
    const host = createHost([stage], errors);
    const doc = docOf([refLayer('l1', 'a')]);
    host.load(doc);
    host.render(timeAt(1));
    host.render(timeAt(2));
    expect(errors).toEqual([new Error('render failed')]);
    expect(host.warnings).toEqual([expect.objectContaining({ code: StageReportCodes.STAGE_ERROR, stageId: 'canvas', layerId: undefined, error: new Error('render failed') })]);
    expect(host.warnings[0].message).toBe('Stage "canvas" threw: render failed');
    host.load(doc);
    expect(host.warnings).toEqual([]);
    host.render(timeAt(3));
    expect(errors).toHaveLength(2);
  });

  it('reports once per layer for layer methods', () => {
    const errors: unknown[] = [];
    const fake = createFakeStage('canvas', { unscoped: true });
    const stage: IStage<IFakeObject> = { ...fake.stage, resolve: throwing('resolve failed') };
    const host = createHost([stage], errors);
    host.load(docOf([refLayer('l1', 'a'), refLayer('l2', 'b')]));
    host.refresh();
    host.refresh();
    expect(errors).toHaveLength(2);
    expect(host.warnings.map((w) => w.layerId)).toEqual(['l1', 'l2']);
    expect(host.warnings[0].message).toBe('Stage "canvas" (layer "l1") threw: resolve failed');
    expect(host.missingTargets).toEqual(['l1', 'l2']);
  });

  it('keeps going when attach, sync, update, release, detach and subscribe throw', () => {
    const errors: unknown[] = [];
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    const stage: IStage<IFakeObject> = {
      ...fake.stage,
      attach: throwing('attach'),
      update: throwing('update'),
      sync: throwing('sync'),
      release: throwing('release'),
      detach: throwing('detach'),
      targets: { list: () => [], subscribe: throwing('subscribe') }
    };
    const host = createHost([stage], errors);
    host.load(docOf([refLayer('l1', 'a')]));
    host.sync(timeAt(1), { playing: false, speed: 1 });
    host.render(timeAt(1));
    expect(fake.calls).toEqual(['resolve a', 'render 1']);
    expect(errors.map((e) => (e as Error).message)).toEqual(['attach']);
    host.load(docOf([]));
    expect(errors.map((e) => (e as Error).message)).toEqual(['attach', 'release', 'update']);
    host.load(docOf([refLayer('l1', 'a')]));
    host.destroy();
    expect(errors.map((e) => (e as Error).message)).toEqual(['attach', 'release', 'update', 'update', 'release']);
  });

  it('lets a stage report warnings and errors through its context, deduplicated', () => {
    const errors: unknown[] = [];
    const fake = createFakeStage('canvas', { unscoped: true });
    const host = createHost([fake.stage], errors);
    host.load(docOf([]));
    fake.ctx?.report({ code: 'duplicate-target', layerId: 'l1', message: 'twice' });
    fake.ctx?.report({ code: 'duplicate-target', layerId: 'l1', message: 'twice' });
    fake.ctx?.error('custom', 'l1');
    fake.ctx?.error('custom again', 'l1');
    expect(host.warnings.map((w) => [w.code, w.stageId, w.layerId])).toEqual([
      ['duplicate-target', 'canvas', 'l1'],
      ['stage-error', 'canvas', 'l1']
    ]);
    expect(errors).toEqual(['custom']);
    expect(host.warnings[1].message).toBe('Stage "canvas" (layer "l1") threw: custom');
  });

  it('returns a frozen copy of the warnings and calls onReport', () => {
    const seen: string[] = [];
    const reporter = new StageReporter(() => undefined, (report) => seen.push(report.code));
    reporter.add({ code: 'unrouted', message: 'm' });
    const list = reporter.list;
    expect(Object.isFrozen(list)).toBe(true);
    reporter.add({ code: 'unrouted', message: 'm' });
    expect(seen).toEqual(['unrouted']);
    expect(reporter.guard('s', undefined, () => 1, 0)).toBe(1);
  });
});

describe('refused documents', () => {
  function refusing(fake: ReturnType<typeof createFakeStage>, refuse: () => boolean): IStage<IFakeObject> {
    return {
      ...fake.stage,
      update(doc, layers) {
        fake.stage.update?.(doc, layers);
        if (refuse()) {
          throw new StageDocumentError('refused');
        }
      }
    };
  }

  it('rolls back to the previous document and rethrows', () => {
    let refuse = false;
    const first = createFakeStage('first', { unscoped: true });
    const second = createFakeStage('second');
    first.objects.set('a', { name: 'A' });
    first.objects.set('b', { name: 'B' });
    second.objects.set('c', { name: 'C' });
    const host = createHost([first.stage, refusing(second, () => refuse)]);
    host.load(docOf([refLayer('l1', 'a'), refLayer('l3', 'c', 'second')]));
    host.load(docOf([refLayer('l1', 'a'), refLayer('l3', 'c', 'second'), refLayer('l9', 'nope', 'zzz')]));
    expect(host.warnings).toHaveLength(1);
    first.calls.length = 0;
    second.calls.length = 0;
    refuse = true;
    expect(() => host.load(docOf([refLayer('l2', 'b')]))).toThrow(StageDocumentError);
    expect(first.calls).toEqual(['release l1 A', 'resolve b', 'update l2', 'release l2 B', 'resolve a', 'update l1', 'sync paused', 'render 1']);
    expect(second.calls).toEqual(['release l3 C', 'update ', 'resolve c', 'update l3', 'sync paused', 'render 1']);
    expect(second.updates[second.updates.length - 1][0].object).toEqual({ name: 'C' });
    expect(host.missingTargets).toEqual(['l9']);
    // The refusing stage refuses the previous document too: reported, not thrown.
    expect(host.warnings.map((w) => w.code)).toEqual(['unknown-stage', 'stage-error']);
    expect(first.renders[first.renders.length - 1].states.map((s) => s.layerId)).toEqual(['l1']);
  });

  it('rolls back a refused first document to nothing', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    const host = createHost([refusing(fake, () => true)]);
    expect(() => host.load(docOf([refLayer('l1', 'a')]))).toThrow('refused');
    expect(fake.calls).toEqual(['attach', 'resolve a', 'update l1', 'release l1 A']);
    expect(host.missingTargets).toEqual([]);
    host.render(timeAt(1));
    expect(fake.renders).toEqual([]);
  });

  it('reports a StageDocumentError thrown while refreshing instead of refusing', () => {
    const errors: unknown[] = [];
    const fake = createFakeStage('canvas', { unscoped: true });
    let refuse = false;
    const host = createHost([refusing(fake, () => refuse)], errors);
    host.load(docOf([refLayer('l1', 'late')]));
    refuse = true;
    fake.objects.set('late', { name: 'Late' });
    host.refresh();
    expect(errors).toEqual([new StageDocumentError('refused')]);
    expect(host.missingTargets).toEqual([]);
  });
});
